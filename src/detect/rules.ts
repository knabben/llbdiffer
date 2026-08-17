import type { ExecOp, FileOp, Node, SourceOp } from '../models/artifact';

export type ConfidenceTier = 'proven' | 'structural' | 'heuristic';

export interface FindingAffected {
  nodeId: string;
  /** Human-readable command/identifier for this node (`Node.label`) — a raw digest alone doesn't tell you which build step this is. */
  label: string;
  side?: 'left' | 'right';
}

export interface Finding {
  id: string;
  tier: ConfidenceTier;
  causeCode: string;
  message: string;
  fix?: string;
  affected: FindingAffected[];
  /** Present only for Proven root-cause findings (Pass 2). */
  blastRadius?: number;
}

export interface StructuralChange {
  nodeId: string;
  label: string;
  side: 'left' | 'right';
  status: 'added' | 'removed' | 'moved';
}

export interface DeterminismReport {
  schemaVersion: string;
  mode: 'single' | 'comparison';
  identical: boolean;
  findings: Finding[];
  /** Present only in comparison mode (spec US3). */
  structuralChanges?: StructuralChange[];
}

// --- local:// volatile-attribute ignore-list (spec FR-012) ---
//
// These attrs legitimately change on every single build by design (e.g. a
// per-invocation unique/session id). Without excluding them from
// content-equality checks, every comparison involving a local build-context
// source would falsely report it as changed. `local.unique` is confirmed
// against a real `buildctl debug dump-llb` sample (it differs between two
// otherwise-identical runs); `local.session` is kept as a defensive alias
// for older/other BuildKit versions that may name it differently.
const LOCAL_VOLATILE_ATTRS = new Set(['local.unique', 'local.session']);

function normalizedAttrs(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (!LOCAL_VOLATILE_ATTRS.has(key)) out[key] = value;
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Content equality for Pass 1/2 alignment: two nodes are content-identical
 * when their op kind, ignore_cache flag, and kind-specific fields match —
 * after stripping the local:// volatile-attribute ignore-list from source
 * attrs. DOT-derived nodes (no `.llb`) fall back to id equality, matching
 * `src/compare/artifact.ts`'s existing DOT-path semantics.
 */
export function nodeContentEqual(a: Node, b: Node): boolean {
  if (!a.llb || !b.llb) return a.id === b.id;
  const opA = a.llb.op;
  const opB = b.llb.op;
  if (opA.kind !== opB.kind) return false;
  if (a.llb.opMetadata.ignoreCache !== b.llb.opMetadata.ignoreCache) return false;

  switch (opA.kind) {
    case 'source': {
      const sb = opB as SourceOp;
      return opA.identifier === sb.identifier && deepEqual(normalizedAttrs(opA.attrs), normalizedAttrs(sb.attrs));
    }
    case 'exec':
    case 'file':
      return deepEqual(opA, opB);
    default:
      // build/merge/diff carry no fields of their own beyond their inputs,
      // which alignment compares separately.
      return true;
  }
}

// --- Structural tier (single-artifact, guaranteed-bad constructs) ---

function affectedOf(node: Node, side?: 'left' | 'right'): FindingAffected[] {
  return [{ nodeId: node.id, label: node.label, side }];
}

export function detectStructuralFindings(node: Node, side?: 'left' | 'right'): Finding[] {
  if (!node.llb) return [];
  const { op, opMetadata } = node.llb;
  const findings: Finding[] = [];
  const affected = affectedOf(node, side);

  if (opMetadata.ignoreCache) {
    findings.push({
      id: `UNCONDITIONAL_CACHE_MISS:${node.id}`,
      tier: 'structural',
      causeCode: 'UNCONDITIONAL_CACHE_MISS',
      message: 'This operation is marked to always bypass cache (ignore_cache), so it re-runs on every build regardless of content.',
      fix: 'Remove the explicit no-cache flag for this step unless bypassing cache is intentional.',
      affected,
    });
  }

  if (op.kind === 'exec') {
    findings.push(...detectExecStructuralFindings(op, node.id, affected));
  }

  if (op.kind === 'source') {
    findings.push(...detectSourceStructuralFindings(op, node.id, affected));
  }

  if (op.kind === 'file') {
    findings.push(...detectFileStructuralFindings(op, node.id, affected));
  }

  return findings;
}

function detectExecStructuralFindings(op: ExecOp, nodeId: string, affected: FindingAffected[]): Finding[] {
  const findings: Finding[] = [];

  if (op.network === 'HOST') {
    findings.push({
      id: `NON_HERMETIC_EXEC:network:${nodeId}`,
      tier: 'structural',
      causeCode: 'NON_HERMETIC_EXEC',
      message: 'This step runs with host networking (network: HOST), which is non-hermetic — its result can depend on the host network environment.',
      fix: 'Avoid host networking unless required; prefer the default sandboxed network.',
      affected,
    });
  }
  if (op.security === 'INSECURE') {
    findings.push({
      id: `NON_HERMETIC_EXEC:security:${nodeId}`,
      tier: 'structural',
      causeCode: 'NON_HERMETIC_EXEC',
      message: 'This step disables build isolation (security: INSECURE).',
      fix: 'Avoid insecure mode unless required; prefer the default sandboxed security mode.',
      affected,
    });
  }
  if (op.meta.proxyEnv && Object.keys(op.meta.proxyEnv).length > 0) {
    findings.push({
      id: `NON_HERMETIC_EXEC:proxy:${nodeId}`,
      tier: 'structural',
      causeCode: 'NON_HERMETIC_EXEC',
      message: "This step has proxy environment variables set, making it depend on the build host's network configuration.",
      fix: 'Remove proxy_env unless the build genuinely requires a host proxy.',
      affected,
    });
  }

  return findings;
}

function detectSourceStructuralFindings(op: SourceOp, nodeId: string, affected: FindingAffected[]): Finding[] {
  if (op.identifier.startsWith('local://')) return []; // excluded by design — spec FR-012

  if (op.identifier.startsWith('docker-image://')) {
    if (!op.identifier.includes('@sha256:')) {
      return [
        {
          id: `UNPINNED_BASE:${nodeId}`,
          tier: 'structural',
          causeCode: 'UNPINNED_BASE',
          message: `Source "${op.identifier}" references a mutable tag with no @sha256 digest pin.`,
          fix: 'Pin the base image to a digest, e.g. image@sha256:....',
          affected,
        },
      ];
    }
    return [];
  }

  if (op.identifier.startsWith('git://') || op.identifier.startsWith('git@')) {
    const pinnedCommit = /#[0-9a-f]{40}(#|$)/i.test(op.identifier);
    if (!pinnedCommit) {
      return [
        {
          id: `UNPINNED_GIT:${nodeId}`,
          tier: 'structural',
          causeCode: 'UNPINNED_GIT',
          message: `Source "${op.identifier}" has no pinned commit SHA.`,
          fix: 'Pin the git source to a full commit SHA rather than a branch or tag.',
          affected,
        },
      ];
    }
    return [];
  }

  if (op.identifier.startsWith('http://') || op.identifier.startsWith('https://')) {
    if (!op.attrs['http.checksum']) {
      return [
        {
          id: `UNCHECKSUMMED_HTTP:${nodeId}`,
          tier: 'structural',
          causeCode: 'UNCHECKSUMMED_HTTP',
          message: `Source "${op.identifier}" has no http.checksum attribute.`,
          fix: 'Add a checksum attribute pinning the expected content hash.',
          affected,
        },
      ];
    }
    return [];
  }

  return [];
}

function detectFileStructuralFindings(op: FileOp, nodeId: string, affected: FindingAffected[]): Finding[] {
  const findings: Finding[] = [];
  op.actions.forEach((action, i) => {
    if (action.copy && action.copy.timestamp === -1) {
      findings.push({
        id: `CLOCK_TIMESTAMP:${nodeId}:${i}`,
        tier: 'structural',
        causeCode: 'CLOCK_TIMESTAMP',
        message: 'This file copy uses "current time" (timestamp: -1) rather than a fixed timestamp.',
        fix: 'Set an explicit, fixed timestamp for reproducible file copies.',
        affected,
      });
    }
  });
  return findings;
}

// --- Heuristic tier (advisory string-pattern matches, spec FR-010) ---

const RFC3339_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const EPOCH_RE = /\b1[5-9]\d{8}\b/; // 10-digit unix-epoch-shaped numbers, roughly 2017-2033
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const SHA40_RE = /\b[0-9a-f]{40}\b/i;
const ABS_PATH_RE = /(^|[\s=])(\/[A-Za-z0-9._-]+){3,}/;

interface HeuristicMatch {
  causeCode: string;
  message: string;
}

function scanString(value: string): HeuristicMatch[] {
  const matches: HeuristicMatch[] = [];
  if (RFC3339_RE.test(value)) {
    matches.push({ causeCode: 'EMBEDDED_TIMESTAMP', message: `Contains what looks like an embedded RFC3339 timestamp: "${value}".` });
  } else if (EPOCH_RE.test(value)) {
    matches.push({ causeCode: 'EMBEDDED_TIMESTAMP', message: `Contains what looks like an embedded Unix epoch timestamp: "${value}".` });
  }
  if (UUID_RE.test(value)) {
    matches.push({ causeCode: 'EMBEDDED_UUID', message: `Contains what looks like a generated UUID: "${value}".` });
  }
  if (SHA40_RE.test(value)) {
    matches.push({ causeCode: 'EMBEDDED_SHA', message: `Contains what looks like a 40-character hex SHA: "${value}".` });
  }
  if (ABS_PATH_RE.test(value)) {
    matches.push({ causeCode: 'ABSOLUTE_BUILD_PATH', message: `Contains what looks like a machine-specific absolute path: "${value}".` });
  }
  return matches;
}

/** Advisory-only (spec FR-010/FR-011) — scoped to `meta.args`, per research.md §3. */
export function detectHeuristicFindings(node: Node, side?: 'left' | 'right'): Finding[] {
  if (!node.llb || node.llb.op.kind !== 'exec') return [];
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const arg of node.llb.op.meta.args) {
    for (const match of scanString(arg)) {
      const id = `${match.causeCode}:${node.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      findings.push({ id, tier: 'heuristic', causeCode: match.causeCode, message: match.message, affected: affectedOf(node, side) });
    }
  }

  return findings;
}

// --- Proven tier (two-artifact root-cause field diffs, spec FR-006/FR-007) ---

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sortedEqual(a: string[], b: string[]): boolean {
  const as = [...a].sort();
  const bs = [...b].sort();
  return arraysEqual(as, bs);
}

function provenFinding(causeCode: string, message: string, fix: string, left: Node, right: Node): Finding {
  return {
    id: `${causeCode}:${left.id}`,
    tier: 'proven',
    causeCode,
    message,
    fix,
    affected: [
      { nodeId: left.id, label: left.label, side: 'left' },
      { nodeId: right.id, label: right.label, side: 'right' },
    ],
  };
}

/**
 * Tries each Proven rule against a pair of nodes whose content differs.
 * Returns the first match (env ordering, mount/secretenv/extra-hosts
 * ordering, per-run cache-mount id, timestamp drift), or `null` when no
 * rule matches — the caller (`src/detect/divergence.ts`) is responsible
 * for the raw-diff fallback (spec US4) when this returns `null`.
 */
export function detectProvenFinding(left: Node, right: Node): Finding | null {
  if (!left.llb || !right.llb) return null;
  const a = left.llb.op;
  const b = right.llb.op;
  if (a.kind !== b.kind) return null;

  if (a.kind === 'exec' && b.kind === 'exec') {
    if (!arraysEqual(a.meta.env, b.meta.env) && sortedEqual(a.meta.env, b.meta.env)) {
      return provenFinding(
        'UNSORTED_ENV',
        'Environment variables contain the same entries in a different order.',
        'Sort environment variables before setting them in the build definition.',
        left,
        right,
      );
    }

    const aMountDests = a.mounts.map((m) => m.dest);
    const bMountDests = b.mounts.map((m) => m.dest);
    if (!arraysEqual(aMountDests, bMountDests) && sortedEqual(aMountDests, bMountDests)) {
      return provenFinding(
        'UNSORTED_MOUNTS',
        'Mounts contain the same destinations in a different order.',
        'Sort mounts by destination before setting them in the build definition.',
        left,
        right,
      );
    }

    const aSecret = (a.secretenv ?? []).map((s) => s.name);
    const bSecret = (b.secretenv ?? []).map((s) => s.name);
    if (!arraysEqual(aSecret, bSecret) && sortedEqual(aSecret, bSecret)) {
      return provenFinding(
        'UNSORTED_SECRETENV',
        'Secret environment entries contain the same names in a different order.',
        'Sort secret environment entries before setting them in the build definition.',
        left,
        right,
      );
    }

    const aHosts = (a.meta.extraHosts ?? []).map((h) => h.host);
    const bHosts = (b.meta.extraHosts ?? []).map((h) => h.host);
    if (!arraysEqual(aHosts, bHosts) && sortedEqual(aHosts, bHosts)) {
      return provenFinding(
        'UNSORTED_EXTRA_HOSTS',
        'Extra-hosts entries contain the same entries in a different order.',
        'Sort extra-hosts entries before setting them in the build definition.',
        left,
        right,
      );
    }

    const aCacheIds = a.mounts.map((m) => m.cacheOpt?.id).filter((id): id is string => Boolean(id));
    const bCacheIds = b.mounts.map((m) => m.cacheOpt?.id).filter((id): id is string => Boolean(id));
    if (aCacheIds.length > 0 && bCacheIds.length > 0 && !arraysEqual(aCacheIds, bCacheIds)) {
      return provenFinding(
        'PER_RUN_CACHE_MOUNT_ID',
        "A cache-mount ID differs between the two builds, so its cache is generated fresh each run.",
        'Use a fixed, stable ID for this cache mount instead of a generated one.',
        left,
        right,
      );
    }
  }

  if (a.kind === 'file' && b.kind === 'file') {
    const count = Math.max(a.actions.length, b.actions.length);
    for (let i = 0; i < count; i++) {
      const ca = a.actions[i]?.copy;
      const cb = b.actions[i]?.copy;
      if (ca && cb && ca.timestamp !== -1 && cb.timestamp !== -1 && ca.timestamp !== cb.timestamp) {
        return provenFinding(
          'TIMESTAMP_DRIFT',
          'This file copy uses two different concrete timestamps across the two builds.',
          'Set an explicit, fixed, matching timestamp for reproducible file copies.',
          left,
          right,
        );
      }
    }
  }

  return null;
}

/**
 * A human-readable summary of what actually differs for a root-cause pair
 * that matched no named Proven rule (US4's raw-diff fallback) — names the
 * specific field and both values where a summary is available, instead of
 * a bare "content differs" that gives the engineer nothing to act on.
 */
export function describeDivergence(left: Node, right: Node): string {
  if (!left.llb || !right.llb) return "This operation's content differs between the two builds.";
  const a = left.llb.op;
  const b = right.llb.op;
  if (a.kind !== b.kind) return `Operation kind differs: "${a.kind}" → "${b.kind}".`;

  if (a.kind === 'exec' && b.kind === 'exec') {
    if (!arraysEqual(a.meta.args, b.meta.args)) {
      return `Command differs: "${a.meta.args.join(' ')}" → "${b.meta.args.join(' ')}".`;
    }
    if (!arraysEqual(a.meta.env, b.meta.env)) {
      return `Environment variables differ: [${a.meta.env.join(', ')}] → [${b.meta.env.join(', ')}].`;
    }
    if (a.meta.cwd !== b.meta.cwd) return `Working directory differs: "${a.meta.cwd}" → "${b.meta.cwd}".`;
    if (a.meta.user !== b.meta.user) return `User differs: "${a.meta.user}" → "${b.meta.user}".`;
    return "This step's content differs in a field not covered by a summary (mounts/network/security/secrets) — inspect both artifacts directly.";
  }

  if (a.kind === 'source' && b.kind === 'source') {
    if (a.identifier !== b.identifier) return `Source identifier differs: "${a.identifier}" → "${b.identifier}".`;
    return `Source attributes differ for "${a.identifier}".`;
  }

  if (a.kind === 'file' && b.kind === 'file') {
    return "This file operation's actions differ between the two builds — inspect both artifacts directly.";
  }

  return "This operation's content differs between the two builds.";
}

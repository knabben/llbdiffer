// Along with adapt.ts, this is the only module allowed to know the raw LLB
// JSON wire format (`buildctl debug dump-llb`'s default, non---dot output).
// No other module may parse this format directly — Constitution Principle I.
import type {
  BuildOp,
  DiffOp,
  ExecOp,
  FileAction,
  FileOp,
  LlbMount,
  LlbOp,
  LlbOpMetadata,
  MergeOp,
  MetaOp,
  SourceOp,
} from '../../models/artifact';

export class LlbJsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlbJsonParseError';
  }
}

export interface LlbRecord {
  digest: string;
  op: LlbOp;
  opMetadata: LlbOpMetadata;
  inputs: { digest: string; index: number }[];
}

export interface ParsedLlbGraph {
  records: LlbRecord[];
}

// --- raw wire tolerance helpers ---
//
// buildctl debug dump-llb's exact field casing isn't pinned down by a
// verified real-world sample in this environment (research.md §1's "Open
// verification item"). Every raw-field read goes through `pick` with both
// the camelCase name this project's own fixtures use and the PascalCase
// name BuildKit's Go structs would produce, so a real sample disagreeing
// with either can be reconciled in one place.
function pick(obj: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseMount(raw: unknown): LlbMount {
  const m = asRecord(raw) ?? {};
  const cacheOptRaw = asRecord(pick(m, 'cacheOpt', 'CacheOpt'));
  return {
    dest: asString(pick(m, 'dest', 'Dest')),
    // Real dumps omit `input` entirely when it's 0 (Go's omitempty) — 0 is
    // the correct default, not "absent", since a mount with no explicit
    // input reads from the ExecOp's first (and usually only) input.
    input: asNumber(pick(m, 'input', 'Input'), 0),
    selector: asOptionalString(pick(m, 'selector', 'Selector')),
    readonly: typeof pick(m, 'readonly', 'Readonly') === 'boolean' ? (pick(m, 'readonly', 'Readonly') as boolean) : undefined,
    cacheOpt: cacheOptRaw
      ? {
          id: asString(pick(cacheOptRaw, 'id', 'ID')),
          sharing: asOptionalString(pick(cacheOptRaw, 'sharing', 'Sharing')),
        }
      : undefined,
  };
}

function normalizeNetwork(value: unknown): ExecOp['network'] {
  const v = asString(value).toUpperCase();
  if (v.includes('HOST')) return 'HOST';
  if (v.includes('NONE')) return 'NONE';
  return 'UNSET';
}

function normalizeSecurity(value: unknown): ExecOp['security'] {
  return asString(value).toUpperCase().includes('INSECURE') ? 'INSECURE' : 'SANDBOX';
}

function parseExecOp(raw: Record<string, unknown>): ExecOp {
  const metaRaw = asRecord(pick(raw, 'meta', 'Meta')) ?? {};
  const extraHostsRaw = asArray(pick(metaRaw, 'extraHosts', 'ExtraHosts'));
  const secretenvRaw = asArray(pick(raw, 'secretenv', 'Secretenv', 'SecretEnv'));
  const proxyEnvRaw = asRecord(pick(metaRaw, 'proxyEnv', 'ProxyEnv'));

  return {
    kind: 'exec',
    meta: {
      args: asArray(pick(metaRaw, 'args', 'Args')).map((v) => asString(v)),
      env: asArray(pick(metaRaw, 'env', 'Env')).map((v) => asString(v)),
      cwd: asString(pick(metaRaw, 'cwd', 'Cwd')),
      user: asString(pick(metaRaw, 'user', 'User')),
      proxyEnv: proxyEnvRaw
        ? Object.fromEntries(Object.entries(proxyEnvRaw).map(([k, v]) => [k, asString(v)]))
        : undefined,
      extraHosts: extraHostsRaw.map((h) => {
        const hr = asRecord(h) ?? {};
        return { host: asString(pick(hr, 'host', 'Host')), ip: asString(pick(hr, 'ip', 'IP', 'Ip')) };
      }),
      hostname: asOptionalString(pick(metaRaw, 'hostname', 'Hostname')),
    },
    mounts: asArray(pick(raw, 'mounts', 'Mounts')).map(parseMount),
    network: normalizeNetwork(pick(raw, 'network', 'Network')),
    security: normalizeSecurity(pick(raw, 'security', 'Security')),
    secretenv: secretenvRaw.length
      ? secretenvRaw.map((s) => {
          const sr = asRecord(s) ?? {};
          return { id: asString(pick(sr, 'id', 'ID')), name: asString(pick(sr, 'name', 'Name')) };
        })
      : undefined,
  };
}

function parseSourceOp(raw: Record<string, unknown>): SourceOp {
  const attrsRaw = asRecord(pick(raw, 'attrs', 'Attrs')) ?? {};
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrsRaw)) attrs[k] = asString(v);
  return { kind: 'source', identifier: asString(pick(raw, 'identifier', 'Identifier')), attrs };
}

function parseFileOp(raw: Record<string, unknown>): FileOp {
  const actionsRaw = asArray(pick(raw, 'actions', 'Actions'));
  const actions: FileAction[] = actionsRaw.map((a) => {
    const ar = asRecord(a) ?? {};
    // Each action's variant (copy/mkdir/mkfile/rm/...) is nested one level
    // deeper under "Action" — a real dump looks like
    // `{input, secondaryInput, output, Action: {copy: {...}}}`.
    const variantRaw = asRecord(pick(ar, 'Action', 'action')) ?? ar;
    const copyRaw = asRecord(pick(variantRaw, 'copy', 'Copy'));
    if (!copyRaw) return {};
    return {
      copy: {
        timestamp: asNumber(pick(copyRaw, 'timestamp', 'Timestamp'), -1),
        owner: asOptionalString(pick(copyRaw, 'owner', 'Owner')),
        mode: asOptionalNumber(pick(copyRaw, 'mode', 'Mode')),
        includePatterns: asArray(pick(copyRaw, 'includePatterns', 'IncludePatterns')).map((v) => asString(v)),
        excludePatterns: asArray(pick(copyRaw, 'excludePatterns', 'ExcludePatterns')).map((v) => asString(v)),
      },
    };
  });
  return { kind: 'file', actions };
}

function parseOp(raw: Record<string, unknown>): LlbOp {
  const execRaw = asRecord(pick(raw, 'exec', 'Exec'));
  if (execRaw) return parseExecOp(execRaw);
  const sourceRaw = asRecord(pick(raw, 'source', 'Source'));
  if (sourceRaw) return parseSourceOp(sourceRaw);
  const fileRaw = asRecord(pick(raw, 'file', 'File'));
  if (fileRaw) return parseFileOp(fileRaw);
  if (pick(raw, 'build', 'Build') !== undefined) return { kind: 'build' } satisfies BuildOp;
  if (pick(raw, 'merge', 'Merge') !== undefined) return { kind: 'merge' } satisfies MergeOp;
  if (pick(raw, 'diff', 'Diff') !== undefined) return { kind: 'diff' } satisfies DiffOp;
  if (Object.keys(raw).length === 0) return { kind: 'meta' } satisfies MetaOp; // definition-terminator record
  throw new LlbJsonParseError('Op record has no recognized oneof kind (exec/source/file/build/merge/diff)');
}

function parseOpMetadata(raw: unknown): LlbOpMetadata {
  const r = asRecord(raw);
  const descriptionRaw = asRecord(pick(r, 'description', 'Description'));
  return {
    ignoreCache: asBoolean(pick(r, 'ignoreCache', 'IgnoreCache', 'ignore_cache')),
    description: descriptionRaw
      ? Object.fromEntries(Object.entries(descriptionRaw).map(([k, v]) => [k, asString(v)]))
      : undefined,
  };
}

function parseRecord(raw: unknown, index: number): LlbRecord {
  const r = asRecord(raw);
  if (!r) throw new LlbJsonParseError(`Record ${index} is not a JSON object`);
  // Real dumps double-nest the oneof: the record's own "Op" field is
  // BuildKit's `pb.Op` wrapper (carrying `inputs`, `platform`,
  // `constraints`, ...), and THAT wrapper has its own "Op" field holding
  // the actual oneof (`{"exec": {...}}`, `{"source": {...}}`, etc.) —
  // confirmed against a real `buildctl debug dump-llb` sample, not
  // documented anywhere.
  const opWrapper = asRecord(pick(r, 'Op', 'op'));
  if (!opWrapper) throw new LlbJsonParseError(`Record ${index} is missing an "Op" field`);
  const oneof = asRecord(pick(opWrapper, 'Op', 'op')) ?? {};
  const digest = asString(pick(r, 'digest', 'Digest'));
  if (!digest) throw new LlbJsonParseError(`Record ${index} is missing a "Digest" field`);

  // `pb.Input.Index` selects which OUTPUT of a multi-output producer op to
  // use (almost always 0, omitted via omitempty) — it is NOT this input's
  // ordinal position among the consumer's own `inputs` array, which is
  // simply array order and carries no separate wire field.
  const inputsRaw = asArray(pick(opWrapper, 'inputs', 'Inputs'));
  const inputs = inputsRaw.map((i, ordinal) => {
    const ir = asRecord(i) ?? {};
    return { digest: asString(pick(ir, 'digest', 'Digest')), index: ordinal };
  });

  return {
    digest,
    op: parseOp(oneof),
    opMetadata: parseOpMetadata(pick(r, 'opMetadata', 'OpMetadata')),
    inputs,
  };
}

/**
 * Parses `buildctl debug dump-llb`'s default JSON output into typed
 * records. Tolerates both a JSON-array and newline-delimited-JSON framing
 * (research.md §1) — no cross-record validation happens here; that's
 * adapt.ts's job (mirroring `dot/parse.ts` vs. `dot/adapt.ts`).
 */
export function parseLlbJson(text: string): ParsedLlbGraph {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new LlbJsonParseError('Empty input');
  }

  let rawRecords: unknown[];
  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new LlbJsonParseError(err instanceof Error ? err.message : String(err));
    }
    if (!Array.isArray(parsed)) throw new LlbJsonParseError('Top-level JSON array expected');
    rawRecords = parsed;
  } else if (trimmed.startsWith('{') && !trimmed.includes('\n{')) {
    try {
      rawRecords = [JSON.parse(trimmed)];
    } catch (err) {
      throw new LlbJsonParseError(err instanceof Error ? err.message : String(err));
    }
  } else {
    rawRecords = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, i) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          throw new LlbJsonParseError(`Line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
  }

  return { records: rawRecords.map((raw, i) => parseRecord(raw, i)) };
}

import type { Artifact } from '../models/artifact';
import { alignArtifacts, type AlignedPair } from '../align/shapeKey';
import {
  detectHeuristicFindings,
  detectProvenFinding,
  detectStructuralFindings,
  type DeterminismReport,
  type Finding,
  type StructuralChange,
} from './rules';

function singleArtifactFindings(artifact: Artifact, side?: 'left' | 'right'): Finding[] {
  const findings: Finding[] = [];
  for (const node of artifact.nodes) {
    findings.push(...detectStructuralFindings(node, side));
    findings.push(...detectHeuristicFindings(node, side));
  }
  return findings;
}

/**
 * Structural/Heuristic findings for one aligned pair. When a pair exists on
 * both sides (any status — including 'modified'/'cascaded', not just
 * 'shared'), a finding matched on both sides by cause code is the same
 * conceptual issue and is merged into one, `affected` covering both node
 * ids — the same op can carry a different digest per side purely from
 * digest chaining even when this particular field never changed, and
 * reporting it twice would look like two separate issues.
 */
function pairStructuralHeuristicFindings(pair: AlignedPair): Finding[] {
  const leftFindings = pair.left ? [...detectStructuralFindings(pair.left, 'left'), ...detectHeuristicFindings(pair.left, 'left')] : [];
  const rightFindings = pair.right
    ? [...detectStructuralFindings(pair.right, 'right'), ...detectHeuristicFindings(pair.right, 'right')]
    : [];
  if (!pair.left || !pair.right) return [...leftFindings, ...rightFindings];

  const rightByCause = new Map(rightFindings.map((f) => [f.causeCode, f]));
  const mergedCauses = new Set<string>();
  const merged: Finding[] = [];

  for (const lf of leftFindings) {
    const rf = rightByCause.get(lf.causeCode);
    if (rf) {
      mergedCauses.add(lf.causeCode);
      merged.push({ ...lf, affected: [...lf.affected, ...rf.affected] });
    } else {
      merged.push(lf);
    }
  }
  for (const rf of rightFindings) {
    if (!mergedCauses.has(rf.causeCode)) merged.push(rf);
  }
  return merged;
}

function sortFindings(findings: Finding[]): Finding[] {
  const tierOrder: Record<Finding['tier'], number> = { proven: 0, structural: 1, heuristic: 2 };
  return [...findings].sort((a, b) => {
    const tierDelta = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDelta !== 0) return tierDelta;
    if (a.tier === 'proven') return (b.blastRadius ?? 0) - (a.blastRadius ?? 0);
    return 0;
  });
}

/**
 * Pass 2 (divergence frontier): builds lookup indices so a pair's inputs
 * can be checked for content identity via the alignment already computed,
 * rather than re-deriving alignment per input.
 */
function buildPairIndex(pairs: AlignedPair[]) {
  const byLeftId = new Map<string, AlignedPair>();
  const byRightId = new Map<string, AlignedPair>();
  for (const pair of pairs) {
    if (pair.left) byLeftId.set(pair.left.id, pair);
    if (pair.right) byRightId.set(pair.right.id, pair);
  }
  return { byLeftId, byRightId };
}

function inputsContentIdentical(
  pair: AlignedPair,
  left: Artifact,
  right: Artifact,
  index: ReturnType<typeof buildPairIndex>,
): boolean {
  const leftInputIds = left.edges.filter((e) => e.target === pair.left!.id).map((e) => e.source);
  const rightInputIds = right.edges.filter((e) => e.target === pair.right!.id).map((e) => e.source);
  if (leftInputIds.length !== rightInputIds.length) return false;

  const rightInputSet = new Set(rightInputIds);
  for (const leftInputId of leftInputIds) {
    const inputPair = index.byLeftId.get(leftInputId);
    if (!inputPair || !inputPair.right) return false; // no aligned counterpart at all
    if (!rightInputSet.has(inputPair.right.id)) return false; // not actually one of this pair's right-side inputs
    if (inputPair.status !== 'shared' && inputPair.status !== 'moved') return false; // content differs upstream
  }
  return true;
}

/** Count of distinct aligned pairs reachable from a root cause, following the "after" artifact's forward edges. */
function blastRadius(pair: AlignedPair, right: Artifact): number {
  if (!pair.right) return 0;
  const visited = new Set<string>();
  const stack = [pair.right.id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const edge of right.edges) {
      if (edge.source === id && !visited.has(edge.target)) {
        visited.add(edge.target);
        stack.push(edge.target);
      }
    }
  }
  return visited.size;
}

function structuralChangesOf(pairs: AlignedPair[]): StructuralChange[] {
  const changes: StructuralChange[] = [];
  for (const pair of pairs) {
    if (pair.status === 'added' && pair.right) changes.push({ nodeId: pair.right.id, side: 'right', status: 'added' });
    if (pair.status === 'removed' && pair.left) changes.push({ nodeId: pair.left.id, side: 'left', status: 'removed' });
    if (pair.status === 'moved' && pair.left && pair.right) {
      changes.push({ nodeId: pair.left.id, side: 'left', status: 'moved' });
      changes.push({ nodeId: pair.right.id, side: 'right', status: 'moved' });
    }
  }
  return changes;
}

/** US1: single-artifact determinism report — Structural + Heuristic findings only, no comparison. */
export function buildSingleArtifactReport(artifact: Artifact): DeterminismReport {
  const findings = sortFindings(singleArtifactFindings(artifact));
  return { schemaVersion: artifact.schemaVersion, mode: 'single', identical: findings.length === 0, findings };
}

/**
 * US2/US3/US4: two-artifact comparison. Root-cause findings (Pass 2/3) are
 * merged with Structural/Heuristic findings from either artifact — per
 * spec.md Clarifications, both tiers show in both modes, not Proven-only.
 */
export function buildComparisonReport(left: Artifact, right: Artifact): DeterminismReport {
  const pairs = alignArtifacts(left, right);
  const index = buildPairIndex(pairs);

  const provenFindings: Finding[] = [];
  for (const pair of pairs) {
    if (pair.status !== 'modified' || !pair.left || !pair.right) continue;
    if (!inputsContentIdentical(pair, left, right, index)) continue; // cascaded — attributed to its upstream root cause instead

    const radius = blastRadius(pair, right);
    const rule = detectProvenFinding(pair.left, pair.right);
    if (rule) {
      provenFindings.push({ ...rule, blastRadius: radius });
    } else {
      // US4: no known rule matched — report the raw divergence rather than
      // dropping it silently.
      provenFindings.push({
        id: `UNKNOWN_DIVERGENCE:${pair.left.id}`,
        tier: 'proven',
        causeCode: 'UNKNOWN_DIVERGENCE',
        message: "This operation's content differs between the two builds, but no known pattern matches the difference.",
        affected: [
          { nodeId: pair.left.id, side: 'left' },
          { nodeId: pair.right.id, side: 'right' },
        ],
        blastRadius: radius,
      });
    }
  }

  const structuralHeuristic = pairs.flatMap((pair) => pairStructuralHeuristicFindings(pair));
  const findings = sortFindings([...provenFindings, ...structuralHeuristic]);
  const structuralChanges = structuralChangesOf(pairs);

  return {
    schemaVersion: left.schemaVersion,
    mode: 'comparison',
    identical: findings.length === 0 && structuralChanges.length === 0,
    findings,
    structuralChanges,
  };
}

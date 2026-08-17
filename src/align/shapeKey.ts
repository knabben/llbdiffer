import { createHash } from 'crypto';
import type { Artifact, Node } from '../models/artifact';
import { nodeContentEqual } from '../detect/rules';

export type ShapeKey = string;

export type NodeStatus = 'shared' | 'modified' | 'cascaded' | 'added' | 'removed' | 'moved';

export interface AlignedPair {
  shapeKey: ShapeKey;
  left?: Node;
  right?: Node;
  status: NodeStatus;
}

function opKind(node: Node | undefined): string {
  return node?.llb?.op.kind ?? 'unknown';
}

function buildInputIndex(artifact: Artifact): Map<string, { id: string; index: number }[]> {
  const byId = new Map(artifact.nodes.map((n) => [n.id, n]));
  const inputsOf = new Map<string, { id: string; index: number }[]>();
  for (const node of artifact.nodes) inputsOf.set(node.id, []);
  for (const edge of artifact.edges) {
    if (!byId.has(edge.target)) continue;
    const list = inputsOf.get(edge.target) ?? [];
    list.push({ id: edge.source, index: edge.inputIndex ?? list.length });
    inputsOf.set(edge.target, list);
  }
  for (const list of inputsOf.values()) list.sort((a, b) => a.index - b.index);
  return inputsOf;
}

/**
 * Bottom-up shape key: `opKind` plus the ordered sequence of input shape
 * keys, deliberately excluding all mutable content (env, args, timestamps,
 * etc.) so a changed op's descendants still align with their counterpart on
 * the other artifact even though every descendant's content-addressed
 * digest changed too — research.md §2. Sibling disambiguation ("ordinal" in
 * the design note) is realized at match time in `alignArtifacts`, not baked
 * into the hash itself.
 */
export function computeShapeKeys(artifact: Artifact): Map<string, ShapeKey> {
  const byId = new Map(artifact.nodes.map((n) => [n.id, n]));
  const inputsOf = buildInputIndex(artifact);
  const cache = new Map<string, ShapeKey>();

  function shapeKeyOf(id: string, visiting: Set<string>): ShapeKey {
    const cached = cache.get(id);
    if (cached) return cached;
    if (visiting.has(id)) {
      // A cycle shouldn't occur in a well-formed LLB DAG; fail closed with a
      // stable-but-distinguishing key rather than infinite-looping.
      return `cycle:${id}`;
    }
    visiting.add(id);

    const inputs = inputsOf.get(id) ?? [];
    const inputKeys = inputs.map((input) => shapeKeyOf(input.id, visiting));

    const hash = createHash('sha256');
    hash.update(JSON.stringify({ kind: opKind(byId.get(id)), inputs: inputKeys }));
    const key = hash.digest('hex');

    cache.set(id, key);
    visiting.delete(id);
    return key;
  }

  for (const node of artifact.nodes) shapeKeyOf(node.id, new Set());
  return cache;
}

function groupByShapeKey(nodes: Node[], keys: Map<string, ShapeKey>): Map<ShapeKey, Node[]> {
  const map = new Map<ShapeKey, Node[]>();
  for (const node of nodes) {
    const key = keys.get(node.id) ?? '';
    const list = map.get(key) ?? [];
    list.push(node);
    map.set(key, list);
  }
  return map;
}

function outgoingEdges(artifact: Artifact, nodeId: string) {
  return artifact.edges.filter((e) => e.source === nodeId);
}

/** Multiset of this node's consumers' shape keys, ignoring input ordinal. */
function consumerShapeKeyMultiset(artifact: Artifact, nodeId: string, shapeKeys: Map<string, ShapeKey>): string {
  return outgoingEdges(artifact, nodeId)
    .map((e) => shapeKeys.get(e.target) ?? '')
    .sort()
    .join('|');
}

/** Multiset of (consumer shape key, input ordinal) pairs this node feeds into. */
function consumerSignature(artifact: Artifact, nodeId: string, shapeKeys: Map<string, ShapeKey>): string {
  return outgoingEdges(artifact, nodeId)
    .map((e) => `${shapeKeys.get(e.target) ?? ''}:${e.inputIndex ?? ''}`)
    .sort()
    .join('|');
}

/**
 * "Moved" (US3) means this node's set of consumers is structurally
 * unchanged — same consumer shape keys, same count — but its ordinal
 * position among at least one consumer's inputs differs. A node whose
 * consumer *set* changed (gained/lost a consumer elsewhere in the graph)
 * is a structural change to THAT relationship, not a move of this node,
 * so it deliberately does not qualify.
 */
function hasMoved(left: Artifact, leftId: string, leftKeys: Map<string, ShapeKey>, right: Artifact, rightId: string, rightKeys: Map<string, ShapeKey>): boolean {
  const sameConsumerSet = consumerShapeKeyMultiset(left, leftId, leftKeys) === consumerShapeKeyMultiset(right, rightId, rightKeys);
  if (!sameConsumerSet) return false;
  return consumerSignature(left, leftId, leftKeys) !== consumerSignature(right, rightId, rightKeys);
}

/**
 * Aligns two artifacts' operations by structural shape key (Pass 1) and
 * classifies each aligned/unaligned node as shared, modified, added,
 * removed, or moved. Cascaded-vs-root-cause classification (Pass 2) is
 * `src/detect/divergence.ts`'s job, since it needs the full aligned-pair
 * set to evaluate.
 */
export function alignArtifacts(left: Artifact, right: Artifact): AlignedPair[] {
  const leftKeys = computeShapeKeys(left);
  const rightKeys = computeShapeKeys(right);

  const leftByKey = groupByShapeKey(left.nodes, leftKeys);
  const rightByKey = groupByShapeKey(right.nodes, rightKeys);

  const pairs: AlignedPair[] = [];
  const allKeys = new Set([...leftByKey.keys(), ...rightByKey.keys()]);

  for (const key of allKeys) {
    const leftNodes = [...(leftByKey.get(key) ?? [])];
    const rightNodes = [...(rightByKey.get(key) ?? [])];

    // Content-first matching within the group, so an added+removed pair
    // isn't mistaken for a modification of an unrelated same-shape sibling.
    for (const l of [...leftNodes]) {
      const matchIdx = rightNodes.findIndex((r) => nodeContentEqual(l, r));
      if (matchIdx === -1) continue;
      const [r] = rightNodes.splice(matchIdx, 1);
      leftNodes.splice(leftNodes.indexOf(l), 1);
      const moved = hasMoved(left, l.id, leftKeys, right, r.id, rightKeys);
      pairs.push({ shapeKey: key, left: l, right: r, status: moved ? 'moved' : 'shared' });
    }

    // Remaining same-shape leftovers pair positionally as modified.
    const remaining = Math.min(leftNodes.length, rightNodes.length);
    for (let i = 0; i < remaining; i++) {
      pairs.push({ shapeKey: key, left: leftNodes[i], right: rightNodes[i], status: 'modified' });
    }
    for (let i = remaining; i < leftNodes.length; i++) {
      pairs.push({ shapeKey: key, left: leftNodes[i], status: 'removed' });
    }
    for (let i = remaining; i < rightNodes.length; i++) {
      pairs.push({ shapeKey: key, right: rightNodes[i], status: 'added' });
    }
  }

  return pairs;
}

// Along with parse.ts and adapt.ts, this is the only module allowed to know
// DOT/Graphviz exists — the output-serialization half of the adapter
// boundary described in Constitution Principle I.
import { digraph, toDot, type NodeModel } from 'ts-graphviz';
import type { Artifact } from '../../models/artifact';
import type { SideClassification } from '../../compare/artifact';

export const SHARED_FILL = '#8b8b8b';
export const ADDED_FILL = '#34d399';
export const REMOVED_FILL = '#f87171';

export type UniqueSide = 'added' | 'removed';

/**
 * Serializes a canonical Artifact plus its shared/unique classification
 * back into DOT text, adding a style/fillcolor attribute per node/edge.
 * `uniqueSide` picks the highlight color for this side's unique elements:
 * 'added' (right/second artifact) renders green, 'removed' (left/first
 * artifact) renders red — shared elements are always neutral gray on both
 * sides.
 *
 * Node references are passed as the NodeModel objects `digraph()` returns,
 * not raw id strings — ts-graphviz parses string edge targets as
 * "id:port:compass" and would otherwise mis-split ids like
 * "sha256:abc..." on the colon.
 */
export function renderClassifiedDot(
  artifact: Artifact,
  classification: SideClassification,
  uniqueSide: UniqueSide,
): string {
  const uniqueFill = uniqueSide === 'added' ? ADDED_FILL : REMOVED_FILL;
  const nodeStatusById = new Map(classification.nodes.map((n) => [n.id, n.status]));
  const edgeStatusByKey = new Map(
    classification.edges.map((e) => [`${e.source} ${e.target}`, e.status]),
  );

  const graph = digraph((g) => {
    // Smaller default label size — the full node label is often a long
    // command/reference string, and BuildKit graphs can have many nodes.
    g.attributes.node.apply({ fontsize: 10 });
    g.attributes.edge.apply({ fontsize: 10 });

    const models = new Map<string, NodeModel>();

    for (const node of artifact.nodes) {
      const status = nodeStatusById.get(node.id) ?? 'shared';
      const model = g.node(node.id, {
        label: node.label,
        style: 'filled',
        fillcolor: status === 'unique' ? uniqueFill : SHARED_FILL,
      });
      models.set(node.id, model);
    }

    for (const edge of artifact.edges) {
      const source = models.get(edge.source);
      const target = models.get(edge.target);
      if (!source || !target) continue;
      const status = edgeStatusByKey.get(`${edge.source} ${edge.target}`) ?? 'shared';
      g.edge([source, target], { color: status === 'unique' ? uniqueFill : undefined });
    }
  });

  return toDot(graph);
}

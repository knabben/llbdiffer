// Reuses the same `ts-graphviz` output-serialization library
// `src/adapters/dot/render.ts` uses for the 002 compare view — this is a
// second, independent DOT *writer* for visualizing a determinism report,
// not a DOT *reader*. It has nothing to do with ingesting DOT-format
// artifacts (that stays exclusively `src/adapters/dot/{parse,adapt}.ts`,
// per Constitution Principle I); it just targets the same
// `GraphRenderer`/`@hpcc-js/wasm-graphviz` rendering pipeline already used
// throughout the app.
import { digraph, toDot, type NodeModel } from 'ts-graphviz';
import type { Artifact } from '../models/artifact';
import type { DeterminismReport } from './rules';

export const ROOT_CAUSE_FILL = '#fb923c';
export const BLAST_RADIUS_FILL = '#fed7aa';
export const STRUCTURAL_FILL = '#e8b464';
export const HEURISTIC_FILL = '#fde68a';
export const ADDED_FILL = '#34d399';
export const REMOVED_FILL = '#f87171';
export const MOVED_FILL = '#a78bfa';
export const CLEAN_FILL = '#8b8b8b';

export type DeterminismNodeCategory =
  | 'rootCause'
  | 'added'
  | 'removed'
  | 'moved'
  | 'structural'
  | 'heuristic'
  | 'blastRadius'
  | 'clean';

// Priority order, highest first: a node earns the most specific/actionable
// color it qualifies for, not the first one found — e.g. a node that's both
// downstream of a root cause AND has its own unrelated Structural issue
// shows as Structural, since that's the more specific, actionable fact.
const CATEGORY_PRIORITY: DeterminismNodeCategory[] = [
  'rootCause',
  'added',
  'removed',
  'moved',
  'structural',
  'heuristic',
  'blastRadius',
  'clean',
];

const FILL_BY_CATEGORY: Record<DeterminismNodeCategory, string> = {
  rootCause: ROOT_CAUSE_FILL,
  added: ADDED_FILL,
  removed: REMOVED_FILL,
  moved: MOVED_FILL,
  structural: STRUCTURAL_FILL,
  heuristic: HEURISTIC_FILL,
  blastRadius: BLAST_RADIUS_FILL,
  clean: CLEAN_FILL,
};

/**
 * Computes each node's visualization category for one side of an already-
 * computed `DeterminismReport` — a pure presentation-layer mapping, not a
 * new analysis step (Constitution Principle II: the renderer consumes the
 * precomputed report, it doesn't re-derive findings). `side` is `undefined`
 * for single-artifact mode, matching how `Finding.affected[].side` is only
 * ever set in comparison mode.
 */
export function categorizeNodes(report: DeterminismReport, side: 'left' | 'right' | undefined): Map<string, DeterminismNodeCategory> {
  const categories = new Map<string, DeterminismNodeCategory>();

  function claim(nodeId: string, category: DeterminismNodeCategory) {
    const current = categories.get(nodeId);
    if (!current || CATEGORY_PRIORITY.indexOf(category) < CATEGORY_PRIORITY.indexOf(current)) {
      categories.set(nodeId, category);
    }
  }

  for (const finding of report.findings) {
    for (const affected of finding.affected) {
      if (affected.side !== side) continue;
      if (finding.tier === 'proven') claim(affected.nodeId, 'rootCause');
      else if (finding.tier === 'structural') claim(affected.nodeId, 'structural');
      else claim(affected.nodeId, 'heuristic');
    }
    if (side === 'right') {
      for (const nodeId of finding.blastRadiusNodeIds ?? []) claim(nodeId, 'blastRadius');
    }
  }

  for (const change of report.structuralChanges ?? []) {
    if (change.side === side) claim(change.nodeId, change.status);
  }

  return categories;
}

/**
 * Renders one side of a comparison (or the single uploaded artifact) as a
 * colored DOT graph, using the category priority above.
 */
export function renderDeterminismDot(artifact: Artifact, report: DeterminismReport, side: 'left' | 'right' | undefined): string {
  const categories = categorizeNodes(report, side);

  const graph = digraph((g) => {
    g.attributes.node.apply({ fontsize: 10 });
    g.attributes.edge.apply({ fontsize: 10 });

    const models = new Map<string, NodeModel>();
    for (const node of artifact.nodes) {
      const category = categories.get(node.id) ?? 'clean';
      const model = g.node(node.id, { label: node.label, style: 'filled', fillcolor: FILL_BY_CATEGORY[category] });
      models.set(node.id, model);
    }

    for (const edge of artifact.edges) {
      const source = models.get(edge.source);
      const target = models.get(edge.target);
      if (!source || !target) continue;
      g.edge([source, target]);
    }
  });

  return toDot(graph);
}

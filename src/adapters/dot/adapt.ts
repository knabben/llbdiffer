// Along with parse.ts, this is the only module allowed to know DOT/Graphviz
// exists. No other module (models, validation, app/api) may import
// `@ts-graphviz/*` or DOT-specific types directly — Constitution Principle I.
import { parseDot } from './parse';
import { SCHEMA_VERSION, type Artifact, type Node as ArtifactNode, type Edge as ArtifactEdge } from '../../models/artifact';

export class DanglingEdgeError extends Error {
  readonly danglingIds: string[];

  constructor(danglingIds: string[]) {
    super(`Edge(s) reference undeclared node id(s): ${danglingIds.join(', ')}`);
    this.name = 'DanglingEdgeError';
    this.danglingIds = danglingIds;
  }
}

/**
 * Adapts raw BuildKit LLB DOT text into the canonical Artifact schema
 * (FR-007). This is the only place DOT-derived data crosses into the
 * canonical model; everything downstream (validation call sites, the route
 * handler) only ever sees `Artifact`.
 */
export function adaptDot(dotText: string): Artifact {
  const parsed = parseDot(dotText);

  const declaredIds = new Set(parsed.nodes.map((n) => n.id));
  const dangling = new Set<string>();
  for (const edge of parsed.edges) {
    if (!declaredIds.has(edge.source)) dangling.add(edge.source);
    if (!declaredIds.has(edge.target)) dangling.add(edge.target);
  }
  if (dangling.size > 0) {
    throw new DanglingEdgeError(Array.from(dangling));
  }

  const nodes: ArtifactNode[] = parsed.nodes.map((n) => {
    // FR-008: fall back to the node id, matching Graphviz's own default
    // label, when no explicit `label` attribute is present.
    const label = n.attributes.label ?? n.id;
    const metadata: Record<string, unknown> & { command: string } = { command: label };
    for (const [key, value] of Object.entries(n.attributes)) {
      if (key === 'label') continue;
      metadata[key] = value;
    }
    return { id: n.id, label, metadata };
  });

  const edges: ArtifactEdge[] = parsed.edges.map((e) => ({ source: e.source, target: e.target }));

  return { schemaVersion: SCHEMA_VERSION, nodes, edges };
}

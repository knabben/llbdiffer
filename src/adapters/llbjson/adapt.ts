// Along with parse.ts, this is the only module allowed to know the raw LLB
// JSON wire format exists. No other module (models, validation, src/align,
// src/detect, app/api) may import from this directory — Constitution
// Principle I.
import { parseLlbJson } from './parse';
import {
  SCHEMA_VERSION,
  type Artifact,
  type Edge as ArtifactEdge,
  type LlbOp,
  type Node as ArtifactNode,
} from '../../models/artifact';

export class DanglingInputError extends Error {
  readonly danglingDigests: string[];

  constructor(danglingDigests: string[]) {
    super(`Op input(s) reference undeclared digest(s): ${danglingDigests.join(', ')}`);
    this.name = 'DanglingInputError';
    this.danglingDigests = danglingDigests;
  }
}

/**
 * Derives a human-readable display string for an LLB op, mirroring what
 * BuildKit's own `--dot` output would show as a node label, since this is
 * the only place LLB-JSON-derived nodes get their `label`/`metadata.command`.
 */
function deriveLabel(op: LlbOp): string {
  switch (op.kind) {
    case 'exec':
      return op.meta.args.length > 0 ? op.meta.args.join(' ') : '(exec)';
    case 'source':
      return op.identifier;
    case 'file':
      return `file(${op.actions.length} action${op.actions.length === 1 ? '' : 's'})`;
    case 'build':
      return '(build)';
    case 'merge':
      return '(merge)';
    case 'diff':
      return '(diff)';
    case 'meta':
      return '(meta)';
  }
}

/**
 * Adapts BuildKit LLB JSON (`buildctl debug dump-llb`'s default output)
 * into the canonical Artifact schema (FR-013). This is the only place
 * LLB-JSON-derived data crosses into the canonical model; everything
 * downstream (`src/align/`, `src/detect/`, the route handler) only ever
 * sees `Artifact`.
 */
export function adaptLlbJson(jsonText: string): Artifact {
  const { records } = parseLlbJson(jsonText);

  const declaredDigests = new Set(records.map((r) => r.digest));
  const dangling = new Set<string>();
  for (const record of records) {
    for (const input of record.inputs) {
      if (!declaredDigests.has(input.digest)) dangling.add(input.digest);
    }
  }
  if (dangling.size > 0) {
    throw new DanglingInputError(Array.from(dangling));
  }

  const nodes: ArtifactNode[] = records.map((record) => {
    const label = deriveLabel(record.op);
    return {
      id: record.digest,
      label,
      metadata: { command: label },
      llb: { op: record.op, opMetadata: record.opMetadata },
    };
  });

  const edges: ArtifactEdge[] = [];
  for (const record of records) {
    // ExecOp mounts reference a specific input by index (research.md §5);
    // look those up once per record so each edge can carry its mount dest.
    const mountDestByInput = new Map<number, string>();
    if (record.op.kind === 'exec') {
      for (const mount of record.op.mounts) {
        if (mount.input >= 0 && mount.dest) mountDestByInput.set(mount.input, mount.dest);
      }
    }
    for (const input of record.inputs) {
      edges.push({
        source: input.digest,
        target: record.digest,
        inputIndex: input.index,
        mountDest: mountDestByInput.get(input.index),
      });
    }
  }

  return { schemaVersion: SCHEMA_VERSION, nodes, edges };
}

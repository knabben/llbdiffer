export const SCHEMA_VERSION = '1.1.0';

export interface Node {
  id: string;
  label: string;
  /** Open, extensible metadata bag (FR-005). Always carries `command` (FR-006). */
  metadata: Record<string, unknown> & { command: string };
  /**
   * Present only for nodes produced by the llbjson adapter (004). DOT-derived
   * nodes never populate this — every reader of `Node` outside
   * `src/adapters/llbjson/`, `src/align/`, and `src/detect/` may ignore it.
   */
  llb?: { op: LlbOp; opMetadata: LlbOpMetadata };
}

export interface Edge {
  source: string;
  target: string;
  /**
   * Ordinal of `source` among `target`'s Op.inputs (004). Present only for
   * llbjson-derived edges; required for shape-key alignment, which is
   * undefined without input ordering (research.md §2).
   */
  inputIndex?: number;
  /** Set only when this edge represents an ExecOp mount (004). */
  mountDest?: string;
}

export interface Artifact {
  schemaVersion: string;
  nodes: Node[];
  edges: Edge[];
}

// --- LLB op model (004-llb-root-cause-analysis) ---
//
// Canonical, normalized shape for a BuildKit LLB `pb.Op`, attached to a
// `Node` via `Node.llb`. Field names here are this project's own
// normalized names, not a verbatim copy of BuildKit's protobuf field
// names — `src/adapters/llbjson/parse.ts` is the only code that translates
// the raw wire JSON into this shape (Constitution Principle I).

export type OpKind = 'exec' | 'source' | 'file' | 'build' | 'merge' | 'diff' | 'meta';

export interface LlbOpMetadata {
  ignoreCache: boolean;
  description?: Record<string, string>;
}

export interface LlbMount {
  dest: string;
  /** Index into the owning ExecOp's `inputs` array this mount reads from. */
  input: number;
  selector?: string;
  readonly?: boolean;
  cacheOpt?: { id: string; sharing?: string };
}

export interface ExecOpMeta {
  args: string[];
  env: string[];
  cwd: string;
  user: string;
  proxyEnv?: Record<string, string>;
  extraHosts?: { host: string; ip: string }[];
  hostname?: string;
}

export interface ExecOp {
  kind: 'exec';
  meta: ExecOpMeta;
  mounts: LlbMount[];
  network: 'NONE' | 'HOST' | 'UNSET';
  security: 'SANDBOX' | 'INSECURE';
  secretenv?: { id: string; name: string }[];
}

export interface SourceOp {
  kind: 'source';
  identifier: string;
  attrs: Record<string, string>;
}

export interface FileActionCopy {
  timestamp: number;
  owner?: string;
  mode?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface FileAction {
  copy?: FileActionCopy;
}

export interface FileOp {
  kind: 'file';
  actions: FileAction[];
}

export interface BuildOp {
  kind: 'build';
}

export interface MergeOp {
  kind: 'merge';
}

export interface DiffOp {
  kind: 'diff';
}

/**
 * `buildctl debug dump-llb`'s definition-terminator record: BuildKit always
 * emits one trailing record whose oneof is genuinely empty (`{}`), pointing
 * at the actual final op via its own `inputs`, to mark the definition's
 * overall output without special-casing one real op as "the root". Carries
 * no fields of its own — confirmed against a real `buildctl` dump, not
 * documented anywhere.
 */
export interface MetaOp {
  kind: 'meta';
}

export type LlbOp = ExecOp | SourceOp | FileOp | BuildOp | MergeOp | DiffOp | MetaOp;

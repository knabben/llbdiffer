# Phase 1 Data Model: LLB Root Cause Analysis

All types below are TypeScript interfaces/types to be added under `src/`.
Fields on the existing canonical `Artifact`/`Node`/`Edge` (in
`src/models/artifact.ts`) are additive only — see research.md §5.

## Canonical schema extension

```ts
// src/models/artifact.ts — additive changes
export const SCHEMA_VERSION = '1.1.0'; // was '1.0.0'

export interface Edge {
  source: string;
  target: string;
  inputIndex?: number;   // ordinal of `source` among target's Op.inputs; llbjson-only
  mountDest?: string;    // set only when this edge represents a mount; llbjson-only
}

export interface Node {
  id: string;
  label: string;
  metadata: Record<string, unknown> & { command: string };
  llb?: { op: LlbOp; opMetadata: LlbOpMetadata }; // llbjson-only, absent for DOT-derived nodes
}
```

## LLB op types (`src/adapters/llbjson/`)

```ts
export type OpKind = 'exec' | 'source' | 'file' | 'build' | 'merge' | 'diff';

export interface LlbOpMetadata {
  ignoreCache: boolean;
  description?: Record<string, string>;
}

export interface LlbMount {
  dest: string;
  selector?: string;
  readonly?: boolean;
  cacheOpt?: { id: string; sharing?: string };
}

export interface ExecOp {
  kind: 'exec';
  meta: {
    args: string[];
    env: string[];        // "KEY=VALUE" entries, raw order as declared
    cwd: string;
    user: string;
    proxyEnv?: Record<string, string>;
    extraHosts?: { host: string; ip: string }[];
    hostname?: string;
  };
  mounts: LlbMount[];
  network: 'NONE' | 'HOST' | 'UNSET';
  security: 'SANDBOX' | 'INSECURE';
  secretenv?: { id: string; name: string }[];
}

export interface SourceOp {
  kind: 'source';
  identifier: string;             // e.g. "docker-image://…", "git://…", "https://…", "local://…"
  attrs: Record<string, string>;  // e.g. "http.checksum", "local.session"
}

export interface FileAction {
  copy?: { timestamp: number; owner?: string; mode?: number; includePatterns?: string[]; excludePatterns?: string[] };
}

export interface FileOp {
  kind: 'file';
  actions: FileAction[];
}

export interface BuildOp { kind: 'build' }
export interface MergeOp { kind: 'merge' }
export interface DiffOp { kind: 'diff' }

export type LlbOp = ExecOp | SourceOp | FileOp | BuildOp | MergeOp | DiffOp;

export interface LlbRecord {
  digest: string;
  op: LlbOp;
  opMetadata: LlbOpMetadata;
  inputs: { digest: string; index: number }[];
}
```

**Validation rules** (enforced in `src/validation/llbArtifact.ts`, mirroring
`src/validation/artifact.ts`'s pattern):
- Every `inputs[].digest` MUST reference a `digest` present elsewhere in the
  same upload (same dangling-reference rejection as 001's `DanglingEdgeError`,
  reused as `DanglingInputError`).
- `op` MUST discriminate to exactly one of the six known kinds; an
  unrecognized/missing discriminator is a parse error, not a silently
  dropped record.
- Upload size cap reuses 001's `MAX_UPLOAD_SIZE_BYTES` constant.

## Alignment types (`src/align/shapeKey.ts`)

```ts
export type ShapeKey = string; // sha256 hex digest

export type NodeStatus = 'shared' | 'modified' | 'cascaded' | 'added' | 'removed' | 'moved';

export interface AlignedPair {
  shapeKey: ShapeKey;
  left?: Node;   // absent when status = 'added'
  right?: Node;  // absent when status = 'removed'
  status: NodeStatus;
}
```

`classify()` in `src/compare/artifact.ts` (DOT path, `status: 'shared' |
'unique'`) is untouched; this is a parallel, LLB-specific classifier, not a
replacement.

## Divergence & findings types (`src/detect/`)

```ts
export type ConfidenceTier = 'proven' | 'structural' | 'heuristic';

export interface Finding {
  id: string;                 // stable id, e.g. `${causeCode}:${nodeId}`
  tier: ConfidenceTier;
  causeCode: string;          // e.g. "UNSORTED_ENV", "UNPINNED_BASE", "CLOCK_TIMESTAMP"
  message: string;            // human-readable explanation
  fix?: string;                // suggested remediation, when a rule provides one
  affected: { nodeId: string; side?: 'left' | 'right' }[];
  blastRadius?: number;        // present only for Proven root-cause findings
}

export interface DeterminismReport {
  schemaVersion: string;       // matches Artifact.schemaVersion of the input(s)
  mode: 'single' | 'comparison';
  identical: boolean;          // true only in comparison mode with zero findings
  findings: Finding[];         // sorted: proven root causes by blastRadius desc, then structural, then heuristic
}
```

**Relationships**:
- A `DeterminismReport` is produced by `src/detect/divergence.ts` (Pass 2,
  orchestrating Pass 1's `AlignedPair[]` and Pass 3's rule table) — it never
  reads raw LLB JSON directly, only the canonical `Artifact` the
  `llbjson` adapter already produced.
- `Finding.affected[].nodeId` references canonical `Node.id`, letting the
  UI cross-reference a finding back to a specific op the same way
  `DiffSummaryEntry.ref` already does for the DOT-based diff summary.
- Cascaded content differences never produce their own `Finding`; they are
  implicitly represented by the root-cause `Finding`'s `blastRadius` count.

## State / lifecycle

None of these entities are persisted or have a lifecycle beyond a single
request — matching Assumptions in spec.md and 001/002/003's existing
stateless pattern. A `DeterminismReport` is constructed once per `POST
/api/determinism` call and returned directly; nothing is written to disk or
a database.

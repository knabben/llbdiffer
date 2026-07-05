# Phase 1 Data Model: Side-by-Side Diff Viewer

This feature reuses the canonical `Artifact`/`Node`/`Edge` types from
001-dag-diff-schema (`src/models/artifact.ts`) unchanged as its input. The
types below are additive.

## ElementStatus

```ts
type ElementStatus = 'shared' | 'unique';
```

Per the Assumptions in spec.md: because node ids are content-addressed
digests, there is no third "modified" status — an id/edge either appears
on both sides (`shared`) or only on one (`unique`).

## ClassifiedNode / ClassifiedEdge (internal to `src/compare/`)

```ts
interface ClassifiedNode {
  id: string;
  status: ElementStatus;
}

interface ClassifiedEdge {
  source: string;
  target: string;
  status: ElementStatus;
}
```

Produced by `src/compare/artifact.ts` from two plain `Artifact` values —
this module has no DOT knowledge and only deals in ids/edge pairs.

## SidePresentation (API response shape, per side)

```ts
interface SidePresentation {
  /** DOT text, re-serialized from the canonical artifact, with a
   *  style/color attribute added per node/edge reflecting ElementStatus. */
  dot: string;
  /** All node ids belonging to this side's artifact (FR-006). */
  hashes: string[];
}
```

Produced by `src/adapters/dot/render.ts` from a canonical `Artifact` plus
its `ClassifiedNode[]`/`ClassifiedEdge[]`. This is the only place the
classification is turned back into DOT syntax, per Principle I.

## DiffSummary (API response shape)

```ts
interface DiffSummaryEntry {
  kind: 'node' | 'edge';
  /** Node id, or "source->target" for an edge. */
  ref: string;
}

interface DiffSummary {
  added: DiffSummaryEntry[];   // unique to the right/second artifact
  removed: DiffSummaryEntry[]; // unique to the left/first artifact
  shared: DiffSummaryEntry[];
}
```

Rendered directly by `DiffSummaryPanel` (spec FR-013/FR-014, Diff Summary
key entity). "Added"/"removed" here just mean "unique to right" / "unique
to left" respectively — a labeling convenience for the summary list, not a
reintroduction of a temporal before/after semantic (see research.md).

## ComparisonResult (full `POST /api/compare` 200 response shape)

```ts
interface ComparisonResult {
  left: SidePresentation;
  right: SidePresentation;
  summary: DiffSummary;
  /** True iff summary.added and summary.removed are both empty. */
  identical: boolean;
}
```

`identical` directly backs spec FR-008 / Story 3 Scenario 3 ("no
differences found" messaging) without the frontend needing to re-derive it
from the summary arrays.

## Validation rules

- Every `ClassifiedNode.id` and `ClassifiedEdge.{source,target}` MUST
  correspond to a node id that exists in at least one of the two input
  artifacts (guaranteed by construction — `src/compare/artifact.ts` only
  ever iterates over the two artifacts' own ids).
- `SidePresentation.hashes` MUST equal exactly that side's original
  `Artifact.nodes[].id` list (FR-006) — rendering/classification never
  adds or removes nodes from a side's own hash list, only annotates them.
- `identical` MUST be `true` if and only if `summary.added` and
  `summary.removed` are both empty (edges and nodes both accounted for).

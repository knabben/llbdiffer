# Phase 1 Data Model: AI Diff Analysis

This feature introduces no persisted entities and no changes to the
canonical `Artifact` schema (001) or `Classification`/`DiffSummary` shapes
(002). It defines two request/response-scoped shapes used only in memory
for the duration of a single analysis call.

## AnalysisPromptContext

Built server-side, inside `src/analysis/claude.ts`, from data already
produced by 001/002 modules. Not sent as-is to the client; it's the
intermediate shape used to render the prompt text sent to Claude.

| Field | Type | Source | Notes |
|---|---|---|---|
| `left` | `Artifact` | `adapt()` output for the `left` upload | Same object `/api/compare` builds |
| `right` | `Artifact` | `adapt()` output for the `right` upload | Same object `/api/compare` builds |
| `classification` | `Classification` | `classify(left, right)` | Reused verbatim from `src/compare/artifact.ts` |
| `summary` | `DiffSummary` | `buildDiffSummary(classification)` | Reused verbatim; gives added/removed/shared reference lists |

**Validation rules**: None beyond what `validateUploadedField` and
`adapt()` already enforce on `left`/`right` before this shape is built —
if either upload fails validation or adaptation, analysis is never
attempted and the existing 400 error path (shared with `/api/compare`) is
returned instead.

**State transitions**: None — this is a pure, single-use, in-memory value
constructed and consumed within one request.

## AnalysisResult

The shape returned to the frontend on success.

| Field | Type | Notes |
|---|---|---|
| `analysis` | `string` | The narrative text from Claude's response, forwarded as-is (no parsing/restructuring beyond extracting the text content block) |

**Validation rules**: `analysis` must be a non-empty string; an empty or
missing text response from the SDK is treated as an analysis failure (see
`contracts/analyze.md` error shape), not a successful empty result.

**State transitions** (frontend-only, in `components/AnalysisPanel.tsx`):

```
idle -> loading -> result       (success)
idle -> loading -> error        (failure; retry re-enters loading)
result|error -> idle            (new comparison started; FR-011)
```

No entity here is persisted to disk or a database — Storage is N/A per
`plan.md`'s Technical Context.

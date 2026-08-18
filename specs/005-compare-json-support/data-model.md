# Phase 1 Data Model: Compare Accepts LLB JSON

## No schema changes

This feature introduces no new entities and changes no existing ones. The
canonical `Artifact` schema (`src/models/artifact.ts`, `SCHEMA_VERSION`
unchanged) is exactly what both `src/adapters/dot/` and
`src/adapters/llbjson/` already normalize to — that is the entire point of
Constitution Principle I, and the reason this feature is scoped to a
validation-import swap rather than a data-model change.

## Entities referenced (unchanged, for traceability to spec Key Entities)

| Spec Key Entity | Existing type | Notes |
|---|---|---|
| Build Definition | Uploaded `File` → `Artifact` (via `validateAndAdaptLlbJson`) | Was: `File` → `Artifact` via `validateAndAdapt` (DOT). Same target shape, different source parser. |
| Layer | `Node` (`src/models/artifact.ts`) | Unchanged. `llbjson`-derived nodes populate the optional `llb` field; not read by compare/analyze. |
| Connection | `Edge` (`src/models/artifact.ts`) | Unchanged. `llbjson`-derived edges populate optional `inputIndex`/`mountDest`; not read by compare/analyze. |
| Diff Summary | `DiffSummary` (`src/compare/artifact.ts`) | Unchanged — produced by `buildDiffSummary(classify(left, right))`, which only ever reads `Artifact.nodes`/`Artifact.edges`. |

## Validation rules (moved, not changed)

The per-file validation rules enforced on `left`/`right` uploads move from
`src/validation/artifact.ts` (`validateUploadedField`) to
`src/validation/llbArtifact.ts` (`validateUploadedLlbField`), already
implemented for 004:

1. Field present and is a `File` — else `MISSING_FILE`.
2. Size ≤ `MAX_UPLOAD_SIZE_BYTES` (20MB, unchanged constant, still exported
   from `src/validation/artifact.ts` and imported by `llbArtifact.ts`) —
   else `UNSUPPORTED_FORMAT`.
3. Filename ends in `.json` — else `UNSUPPORTED_FORMAT` (was: `.dot`).
4. Text parses as valid JSON matching the LLB wire shape — else
   `LLB_JSON_PARSE_ERROR` (was: `DOT_PARSE_ERROR`).
5. Every op's input references an id present in the same file — else
   `DANGLING_INPUT_REFERENCE` (was: `DANGLING_EDGE_REFERENCE`).

Each side (`left`, `right`) is still validated independently, and both
errors are still returned together when both sides fail (spec Edge Cases,
unchanged from 002's existing behavior).

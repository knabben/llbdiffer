# Phase 0 Research: Compare Accepts LLB JSON

No unknowns were left as `NEEDS CLARIFICATION` in the Technical Context —
this feature reuses infrastructure already built and shipped for 004
(`src/adapters/llbjson/`, `src/validation/llbArtifact.ts`). The research
below documents the decisions made and why no new investigation was needed.

## Decision: Reuse `src/validation/llbArtifact.ts` unchanged

**Decision**: `app/api/compare/route.ts` and `app/api/analyze/route.ts`
switch their import from `validateUploadedField` (`src/validation/artifact.ts`,
DOT) to `validateUploadedLlbField` (`src/validation/llbArtifact.ts`, JSON).
No changes to `llbArtifact.ts` itself.

**Rationale**: `llbArtifact.ts` already validates a required upload field
(missing file, size cap, `.json` extension check, JSON parse, dangling
input-reference check) and returns the same canonical `Artifact` shape the
DOT path returns. It was built in 004 specifically as a sibling to
`validation/artifact.ts`, following the same `ArtifactResult`-shaped
contract, so it drops into `/api/compare`/`/api/analyze`'s existing
`Promise.all([...])` call pattern with no structural change to the route
handlers beyond the import and field names.

**Alternatives considered**:
- *Write new validation specific to compare.* Rejected — would duplicate
  logic 004 already built, tested, and shipped for the identical job
  (validate an uploaded LLB JSON file into an `Artifact`), violating the
  project's own precedent of one adapter/validator per source format
  (Constitution Principle I).
- *Accept both `.dot` and `.json` on these two routes.* Rejected per spec
  Assumptions — the user's request and the spec explicitly call for `.dot`
  to be replaced, not kept alongside JSON, since JSON is stated to be the
  only format the project uses going forward for this flow.

## Decision: No changes to `classify()`, `buildDiffSummary()`, `isIdentical()`, or `renderClassifiedDot()`

**Decision**: `src/compare/artifact.ts` and
`src/adapters/dot/render.ts` are left untouched.

**Rationale**: Both already operate purely on the canonical `Artifact`
schema (`src/models/artifact.ts`), never on raw DOT or JSON text.
`renderClassifiedDot()` in particular is *output* serialization (Artifact →
DOT string, for Graphviz rendering in the browser) — it has never parsed
DOT as input and is unaffected by what format produced the `Artifact` it's
given. This is precisely what satisfies the spec's "layer comparison must
exist" and "the difference layout must be kept" requirements: the
comparison algorithm and the two-graphs-plus-summary visual layout are
identical before and after this change, because neither ever depended on
the input format.

**Alternatives considered**: None — there is no reasonable alternative that
touches this code, since doing so would violate Constitution Principle I
(no source-format-specific logic in the diff engine or visualizer) for no
benefit.

## Decision: Response error codes for `/api/compare` and `/api/analyze` change from DOT codes to LLB JSON codes

**Decision**: The `400` validation-error response `code` values change from
`ArtifactErrorCode` (`MISSING_FILE`, `UNSUPPORTED_FORMAT`, `DOT_PARSE_ERROR`,
`DANGLING_EDGE_REFERENCE`) to `LlbArtifactErrorCode` (`MISSING_FILE`,
`UNSUPPORTED_FORMAT`, `LLB_JSON_PARSE_ERROR`, `DANGLING_INPUT_REFERENCE`),
matching what `/api/determinism` already returns for the same underlying
validator. `MISSING_FILE` and `UNSUPPORTED_FORMAT` are unchanged; only the
two parse-failure codes rename.

**Rationale**: This is an intentional, spec-required contract change (FR-002/
FR-003), not an oversight — the response shape (`{errors: {left, right}}`)
stays identical, so the frontend's existing per-field error rendering in
`app/compare/page.tsx` needs no structural change, only updated labels/hints
(spec FR-008) and a switch of which fixture/extension it rejects.

**Alternatives considered**: *Keep the old DOT error code names for
backward compatibility.* Rejected — there is no external consumer of these
codes to preserve compatibility for (single-container, self-hosted tool per
Constitution Principle III), and reusing DOT-flavored names for JSON errors
would be actively misleading.

## Decision: Reuse existing `tests/fixtures/llbjson/` fixtures

**Decision**: Integration tests for `/api/compare` and `/api/analyze` are
rewritten against `tests/fixtures/llbjson/added-op-before.json` /
`added-op-after.json` (a genuine before/after pair — non-identical,
one-added-op case), `clean.json` (used twice, for the identical-builds
case), and `malformed.json` (for the parse-failure case). No new fixture
files are authored.

**Rationale**: These fixtures already exist, were built for 004, and cover
exactly the scenarios spec Story 1 (compare, non-identical) and Story 1
Scenario 2 (identical) and Story 2 (invalid JSON) need. Authoring
parallel, duplicate fixtures would add maintenance burden with no coverage
benefit.

**Alternatives considered**: *Author new fixtures dedicated to this
feature.* Rejected as unnecessary duplication — the existing fixtures were
already validated against the same `llbjson` adapter this feature reuses.

# Implementation Plan: Compare Accepts LLB JSON

**Branch**: `005-compare-json-support` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-compare-json-support/spec.md`

## Summary

Swap the input format the `/compare` page (and its `/api/compare` and
`/api/analyze` endpoints) accepts from BuildKit LLB `.dot` files to LLB JSON
build definitions — the format the rest of the project already standardizes
on (introduced by 004's `src/adapters/llbjson/` + `src/validation/llbArtifact.ts`).
This is purely an adapter swap at the upload/validation boundary: both
routes already operate only on the canonical `Artifact` schema past
validation, so `classify()`, `buildDiffSummary()`, `isIdentical()`, and
`renderClassifiedDot()` (the layer/connection comparison and the diff
visualization) are untouched — exactly the scenario Constitution Principle I
exists for. `.dot` input support is removed from these two routes and the
Compare page's UI (per spec Assumptions); `/api/artifacts` (001) and the
existing DOT input adapter (`src/adapters/dot/{parse,adapt}.ts`) are left
in place and out of scope, since no other part of the project references them
for this flow.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (Next.js 14+, App
Router) — same project as 001/002/003/004; this feature modifies two
existing routes and one existing page.
**Primary Dependencies**: None new. Reuses `src/adapters/llbjson/` and
`src/validation/llbArtifact.ts`, both already built and tested for 004's
`/api/determinism`. `ts-graphviz` (diff-output rendering) is unchanged —
still only ever produces DOT for display, never parses it as input for this
feature.
**Storage**: N/A — stateless request/response, matching 001/002/003/004.
**Testing**: Vitest, matching the existing project convention. Existing
integration tests for `/api/compare` and `/api/analyze`
(`tests/integration/api/compare/*`, `tests/integration/api/analyze/*`) are
rewritten to use LLB JSON fixtures instead of `.dot` fixtures — reusing the
existing `tests/fixtures/llbjson/{added-op-before,added-op-after,clean,malformed}.json`
fixtures already added for 004, rather than authoring new ones. Existing
unit tests for `src/compare/artifact.ts` and `src/adapters/dot/render.ts`
are untouched — that logic isn't changing.
**Target Platform**: Same single Docker container as 001/002/003/004.
**Project Type**: Web application — same single Next.js project, modifying
two existing API routes and one existing page in place (no new routes,
pages, or schema).
**Performance Goals**: Same as 002 — comparison and rendering complete
within a couple of seconds for build graphs on the order of a few hundred
operations; JSON parsing is not expected to be materially slower than the
DOT parsing it replaces.
**Constraints**: Per Constitution Principle I, `src/adapters/llbjson/` (already
the sole owner of the LLB JSON wire format, per 004) remains the only code
that gains new callers here — no source-format-specific logic is added to
`src/compare/artifact.ts` or `src/adapters/dot/render.ts`. Per spec
Assumptions, `.dot` upload support is removed from `/api/compare` and
`/api/analyze` (not kept alongside JSON); `/api/artifacts` keeps accepting
`.dot` unchanged, since it is out of scope for this feature.
**Scale/Scope**: Single-user/small-team self-hosted use, same as
001/002/003/004. Two existing routes and one existing page modified; no new
modules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Normalize to One Internal Schema** — PASS. This feature is a textbook
  application of the principle: the adapter feeding `/api/compare` and
  `/api/analyze` changes from `src/adapters/dot/` to the already-existing
  `src/adapters/llbjson/`, and nothing downstream (`classify()`,
  `buildDiffSummary()`, `isIdentical()`, `renderClassifiedDot()`) changes at
  all, because both adapters already normalize to the same `Artifact` shape.
  No source-format-specific logic is added to diff or render code.
- **II. Diff-as-Artifact** — PASS, unaffected. `classify()`/
  `buildDiffSummary()` already compute the diff as a standalone step before
  `DiffSummaryPanel`/`ComparePanel` render it; this feature changes only
  what feeds `Artifact` into that step, not the step itself.
- **III. Self-Contained Single-Container Deployment, No External
  Dependencies** — PASS. No network calls added or changed. `/api/analyze`
  keeps its existing, already-isolated LLM call boundary
  (`src/analysis/claude.ts`) unchanged — this feature only changes how its
  two input files are validated/parsed, not what it does with them.
- **IV. LLM Analysis Is Advisory, Not Ground Truth** — PASS, unaffected. The
  AI analysis panel's presentation and separation from diff data are
  untouched; only its input format changes.
- **Architecture Constraints**: `src/adapters/llbjson/` and
  `src/validation/llbArtifact.ts` are already independently unit-testable
  modules with no HTTP-layer dependency (built for 004); this feature adds
  no new coupling to the Next.js layer.

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-compare-json-support/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── artifacts/route.ts        # existing (001), untouched — stays .dot-only, out of scope
│   ├── compare/route.ts          # MODIFIED: validate via src/validation/llbArtifact.ts
│   ├── analyze/route.ts          # MODIFIED: validate via src/validation/llbArtifact.ts
│   └── determinism/route.ts      # existing (004), untouched
├── compare/
│   └── page.tsx                  # MODIFIED: accept=".json", updated labels/hints
└── determinism/
    └── page.tsx                  # existing (004), untouched

src/
├── adapters/
│   ├── dot/                      # existing (001) — untouched; still backs /api/artifacts only
│   └── llbjson/                  # existing (004), untouched — gains two new callers
├── models/
│   └── artifact.ts               # existing — untouched, no schema change
├── compare/
│   └── artifact.ts                # existing (002), untouched — classify()/buildDiffSummary()
│                                   #   already format-agnostic over Artifact
└── validation/
    ├── artifact.ts                # existing (001/002) — untouched, still backs /api/artifacts
    └── llbArtifact.ts             # existing (004), untouched — gains two new callers

components/
├── ComparePanel.tsx               # existing (002), untouched — renders DOT output regardless
│                                   #   of input format
├── DiffSummaryPanel.tsx           # existing (002), untouched
└── AnalysisPanel.tsx              # existing (003), untouched

tests/
├── fixtures/
│   ├── dot/                       # existing (001/002), untouched — still used by artifacts tests
│   └── llbjson/                   # existing (004), reused: added-op-{before,after}.json,
│                                   #   clean.json, malformed.json
└── integration/
    └── api/
        ├── compare/                # MODIFIED: happy-path.test.ts, invalid-file.test.ts
        │                           #   rewritten against llbjson fixtures
        └── analyze/                # MODIFIED: happy-path.test.ts, failure.test.ts
                                     #   rewritten against llbjson fixtures
```

**Structure Decision**: Single Next.js project (unchanged from 001–004).
This feature modifies exactly two existing route files
(`app/api/compare/route.ts`, `app/api/analyze/route.ts`), one existing page
(`app/compare/page.tsx`), and their integration tests — swapping their
validation import from `src/validation/artifact.ts` to the already-existing
`src/validation/llbArtifact.ts` (built for 004). No new modules, no schema
changes, no new pages or routes.

## Complexity Tracking

No violations — table not needed.

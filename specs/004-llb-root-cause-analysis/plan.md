# Implementation Plan: LLB Root Cause Analysis

**Branch**: `004-llb-root-cause-analysis` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-llb-root-cause-analysis/spec.md`

## Summary

Add a new, separate `/determinism` page and `POST /api/determinism` endpoint
that accept BuildKit LLB **JSON** dumps (`buildctl debug dump-llb`'s default
`{Op, Digest, OpMetadata}`-per-record output) — never `.dot` — and produce a
ranked list of build-determinism findings. One uploaded artifact yields a
determinism report of Structural findings (guaranteed-bad constructs:
`ignore_cache`, `timestamp: -1`, unpinned image tags, `network: HOST`,
unchecksummed HTTP sources) and Heuristic findings (advisory string-pattern
matches). Two uploaded artifacts additionally align operations by a
content-excluding **shape key** (Pass 1), separate root-cause divergences
from their cascaded descendants and compute each root cause's blast radius
(Pass 2), and name each root cause via a field-diff rule table (Pass 3:
`UNSORTED_ENV`, `UNPINNED_BASE`, `TIMESTAMP_DRIFT`, etc.) — with both modes
returning the same Structural/Heuristic findings alongside any Proven ones,
per Clarifications. This is entirely new, pure computation: no network
calls, no LLM involvement, and no changes to the existing DOT-based compare
(001/002) or AI-analysis (003) features, which remain untouched on their own
pages.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (Next.js 14+, App
Router) — same project as 001/002/003; this feature is additive.
**Primary Dependencies**: None new. Uses Node's built-in `crypto` module for
shape-key hashing (SHA-256 over a canonical JSON encoding); no new npm
package required. Does NOT use `@anthropic-ai/sdk` — this feature is a
deterministic rule engine, not an LLM feature, and is unrelated to 003's
advisory-analysis integration point.
**Storage**: N/A — each analysis is a fresh request/response; nothing
persisted, matching 001/002/003's stateless pattern.
**Testing**: Vitest, matching the existing project convention. Unit tests
for the LLB JSON adapter, shape-key alignment, divergence-frontier/blast-
radius computation, and the field-diff rule table, all over fixture JSON —
no real `buildctl` invocation in the test suite. Integration test for
`POST /api/determinism` covering single- and two-artifact requests.
**Target Platform**: Same single Docker container as 001/002/003.
**Project Type**: Web application — same single Next.js project, additive
route/module/page/components. No existing route, page, or module is
modified except the shared canonical schema (`src/models/artifact.ts`,
extended additively — see Data Model) and `CLAUDE.md`'s plan pointer.
**Performance Goals**: A determinism report (either mode) completes within a
few seconds for a build graph on the order of a few hundred operations,
matching the Assumptions in spec.md.
**Constraints**: Zero outbound network calls — this feature has no
exception under Constitution Principle III, unlike 003. Only
`src/adapters/llbjson/{parse,adapt}.ts` may know the raw LLB JSON wire
shape, per Constitution Principle I; `src/align/`, `src/detect/`, and the
API route consume only the canonical `Artifact` schema. The alignment,
divergence, and rule-table computation MUST run as a standalone step
producing a serializable `DeterminismReport` before the panel renders it,
per Constitution Principle II — the panel is a pure renderer of precomputed
findings, never a place that re-derives them.
**Scale/Scope**: Single-user/small-team self-hosted use, same as 001/002/003.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Normalize to One Internal Schema** — PASS. `src/adapters/llbjson/`
  sits beside `src/adapters/dot/` as a second, isolated adapter; it is the
  only place that parses the LLB JSON wire format. `src/align/`,
  `src/detect/`, and the route handler only ever see the canonical
  `Artifact` schema (extended — see Data Model) — never raw LLB JSON.
  Supporting this input format required only a new adapter; no change to
  any existing adapter, the DOT-based `classify()`, or the visualizer.
- **II. Diff-as-Artifact** — PASS, and this feature is a second, deeper
  instance of the principle: `src/align/shapeKey.ts` (Pass 1) and
  `src/detect/divergence.ts` (Pass 2) together produce a standalone,
  serializable `DeterminismReport` (findings, confidence tiers, blast
  radii) as a discrete computation step. `DeterminismPanel.tsx` consumes
  that precomputed report; it does not align, classify, or derive causes
  itself. The canonical schema's version is bumped for the additive Edge/
  Node fields this feature requires (see Data Model).
- **III. Self-Contained Single-Container Deployment, No External
  Dependencies** — PASS. This feature makes zero outbound network calls
  under any circumstance; it does not touch or extend 003's LLM
  integration boundary. If this feature is never invoked, and even if it
  is, the container's network posture is unchanged.
- **IV. LLM Analysis Is Advisory, Not Ground Truth** — N/A / PASS by
  construction. This feature is not an LLM feature — every finding
  (Proven, Structural, Heuristic) is produced by deterministic code over
  the parsed `pb.Op` fields, not by a model. The "Heuristic" confidence
  tier is a rule-based pattern match (regex-style checks for
  RFC3339/epoch-shaped strings, UUIDs, 40-hex SHAs, absolute paths), not
  an LLM call, and is still clearly labeled advisory-only per FR-011 so it
  is never presented as proven fact — consistent with this principle's
  intent even though it doesn't apply literally.
- **Architecture Constraints**: `src/adapters/llbjson/`, `src/align/`, and
  `src/detect/` are plain, independently unit-testable modules with no
  dependency on the Next.js HTTP layer — each is testable by calling it
  directly with fixture data, no running server required.

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-llb-root-cause-analysis/
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
│   ├── artifacts/route.ts        # existing (001), untouched
│   ├── compare/route.ts          # existing (002), untouched
│   ├── analyze/route.ts          # existing (003), untouched
│   └── determinism/route.ts      # new: POST — accepts `primary` (required) + `secondary`
│                                  #      (optional) LLB JSON files, returns a DeterminismReport
├── compare/
│   └── page.tsx                  # existing (002/003), untouched
└── determinism/
    └── page.tsx                  # new: separate entry point (per Clarifications) — 1-or-2-file
                                   #      LLB JSON upload + DeterminismPanel

src/
├── adapters/
│   ├── dot/                      # existing (001), untouched
│   └── llbjson/                  # new — only module that knows the LLB JSON wire format
│       ├── parse.ts              # raw JSON -> typed per-record { digest, op, opMetadata }[]
│       └── adapt.ts              # typed records -> canonical Artifact (extended schema)
├── models/
│   └── artifact.ts               # existing (001), extended additively: Edge gains optional
│                                  #   `inputIndex`/`mountDest`; Node gains optional `llb` field
│                                  #   carrying the typed op + opMetadata. SCHEMA_VERSION bumped.
├── align/
│   └── shapeKey.ts               # new: Pass 1 — bottom-up shape-key computation + two-artifact
│                                  #   alignment (shared / modified / added / removed / moved)
├── detect/
│   ├── rules.ts                  # new: Pass 3 — field-diff -> named cause + fix, per op kind,
│                                  #   plus single-artifact Structural/Heuristic rules and the
│                                  #   local:// volatile-attribute ignore-list
│   └── divergence.ts             # new: Pass 2 — root-cause vs. cascaded classification +
│                                  #   blast-radius computation over an aligned-pair set
├── compare/
│   └── artifact.ts               # existing (002), untouched — unrelated DOT-based classify()
└── validation/
    └── artifact.ts                # existing (001/002), untouched; llbjson upload validation
                                     #   lives in a new sibling, `src/validation/llbArtifact.ts`

components/
├── ComparePanel.tsx               # existing (002), untouched
├── DiffSummaryPanel.tsx           # existing (002), untouched
├── GraphRenderer.tsx              # existing (002), untouched
├── AnalysisPanel.tsx              # existing (003), untouched
├── DeterminismUpload.tsx          # new: 1-or-2-file LLB JSON upload control
└── DeterminismPanel.tsx           # new: renders ranked findings (confidence badge, blast
                                    #   radius, cause + fix) for both single- and two-artifact modes

tests/
├── fixtures/
│   ├── dot/                       # existing (001/002), untouched
│   └── llbjson/                   # new: sample buildctl debug dump-llb JSON fixtures
│       ├── clean.json             #   no findings
│       ├── unsorted-env-before.json / unsorted-env-after.json
│       ├── unpinned-base.json     #   single-artifact Structural finding
│       └── malformed.json         #   invalid input, for the reject-with-clear-error edge case
└── unit/
    ├── adapters/llbjson/{parse,adapt}.test.ts
    ├── align/shapeKey.test.ts
    ├── detect/{rules,divergence}.test.ts
    ├── validation/llbArtifact.test.ts
    ├── api/determinism.test.ts
    └── components/{DeterminismUpload,DeterminismPanel}.test.tsx
```

**Structure Decision**: Single Next.js project (Option 1-equivalent; this
codebase does not use the frontend/backend-split layout), additive to the
existing 001/002/003 structure. The one shared file this feature touches is
`src/models/artifact.ts` (the canonical schema, extended additively and
non-breaking for the DOT path) — every other new file is new, isolated to
`src/adapters/llbjson/`, `src/align/`, `src/detect/`, `app/api/determinism/`,
`app/determinism/`, and two new components. Per Constitution Principle I,
`src/adapters/llbjson/{parse,adapt}.ts` is the only code in the project
permitted to know the LLB JSON wire format, mirroring how `dot/{parse,adapt}.ts`
is the only code permitted to know Graphviz DOT syntax.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table not needed.

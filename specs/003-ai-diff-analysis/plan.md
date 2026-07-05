# Implementation Plan: AI Diff Analysis

**Branch**: `003-ai-diff-analysis` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-ai-diff-analysis/spec.md`

## Summary

Add an opt-in "Analyze with AI" control to the `/compare` page. On click, the
frontend resubmits the same two `.dot` files already held in browser state
(from the original comparison) to a new `POST /api/analyze` endpoint, which
re-adapts and re-classifies them (reusing the exact 002 modules —
`validateUploadedField`, `classify` — so the AI never sees a different
classification than the one already rendered), builds a plain-text summary
of both artifacts' nodes/commands and the shared/added/removed
classification, and sends it as a single, direct Claude API call (no MCP, no
tool use, no agentic loop). The narrative response is displayed in a new,
clearly-labeled advisory panel, structurally separate from the diff graphs
and diff summary panel. This is the one and only place in the app that makes
an outbound network call.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (Next.js 14+, App
Router) — same project as 001/002; this feature is additive.
**Primary Dependencies**: `@anthropic-ai/sdk` (official Node/TypeScript
Claude API SDK) — new; reuses 002's `validateUploadedField` and `classify`,
and 001's canonical `Artifact` schema. No MCP client, no tool-use/agentic
framework.
**Storage**: N/A — each analysis is a fresh request/response; nothing
persisted.
**Testing**: Vitest. Unit tests for prompt-building (`src/analysis/claude.ts`)
with the Anthropic client mocked — no real network call in the test suite.
Integration test for `/api/analyze` with the SDK call mocked the same way.
**Target Platform**: Same single Docker container as 001/002.
**Project Type**: Web application — same single Next.js project, additive
route/module/component.
**Performance Goals**: Analysis completes within a few seconds to ~20s for
typical diffs (a few hundred nodes); a loading state covers the wait (spec
FR-004).
**Constraints**: This endpoint is the *only* outbound network call in the
entire application, per Constitution Principle III — every other route
continues to require zero network access whether or not this feature is
ever invoked. The Claude API key is read from a server-side environment
variable and never sent to or exposed in the browser (spec FR-008,
Assumptions). Single request/response per analysis — no MCP server, no
tool/function calling, no multi-step loop (spec FR-008a).
**Scale/Scope**: Single-user/small-team self-hosted use, same as 001/002.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Normalize to One Internal Schema** — PASS. `src/analysis/claude.ts`
  builds its prompt from the canonical `Artifact` + classification data
  only; it has no DOT-specific code and never touches `src/adapters/dot/`.
- **II. Diff-as-Artifact** — PASS. The classification used for the prompt is
  produced by the same `classify()` step already used for `/api/compare` —
  the analysis step consumes a precomputed artifact, it does not derive its
  own notion of what differs.
- **III. Self-Contained Single-Container Deployment, No External
  Dependencies** — PASS, and this is the feature that exercises the
  constitution's one narrow exception. `app/api/analyze/route.ts` is the
  only module in the entire codebase permitted to make an outbound network
  call; every other route/page continues to function with zero network
  access if this endpoint is never invoked.
- **IV. LLM Analysis Is Advisory, Not Ground Truth** — PASS, this feature
  exists to implement Principle IV directly: the returned narrative is
  rendered in its own panel and is never written into, or merged with, the
  `ComparisonResult` the graphs and diff summary render from.
- **Architecture Constraints**: `src/analysis/claude.ts` is a plain,
  independently unit-testable module (prompt construction is a pure
  function over `Artifact`/`Classification` data); the Anthropic SDK call
  itself is mocked in tests, per the constraints requiring pipeline logic
  to be testable without exercising a real network call.

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-ai-diff-analysis/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── artifacts/route.ts        # existing (001)
│   ├── compare/route.ts          # existing (002)
│   └── analyze/route.ts          # new: POST — re-validates left/right, classifies, calls Claude, returns narrative text
└── compare/
    └── page.tsx                  # existing (002); gains an "Analyze with AI" control + result panel

src/
├── adapters/dot/                 # existing (001), untouched
├── compare/
│   └── artifact.ts               # existing (002), reused as-is (classify())
├── analysis/
│   └── claude.ts                 # new: Artifact + Classification -> prompt text -> Claude call -> narrative string
├── models/
│   └── artifact.ts               # existing (001), untouched
└── validation/
    └── artifact.ts               # existing (001/002), reused as-is (validateUploadedField())

components/
├── ComparePanel.tsx               # existing (002)
├── DiffSummaryPanel.tsx           # existing (002)
├── GraphRenderer.tsx              # existing (002)
└── AnalysisPanel.tsx              # new: loading / result / error states for the AI narrative

tests/
├── unit/
│   ├── analysis/claude.test.ts         # new (Anthropic client mocked)
│   └── components/AnalysisPanel.test.tsx  # new
└── integration/
    └── api/analyze/                    # new (Anthropic client mocked)
```

**Structure Decision**: Extends the existing single Next.js project.
`src/analysis/` is a new sibling to `src/adapters/`, `src/compare/`,
`src/models/`, and `src/validation/` — it is the only module that imports
the Anthropic SDK, mirroring how `src/adapters/dot/` is the only module
that imports the DOT parsing library. `app/api/analyze/route.ts` reuses
`validateUploadedField` and `classify` unchanged rather than introducing a
second copy of file-validation or classification logic.

## Complexity Tracking

*No constitution violations — table not applicable.*

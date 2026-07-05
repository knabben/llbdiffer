# Implementation Plan: Side-by-Side Diff Viewer

**Branch**: `002-diff-viewer` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-diff-viewer/spec.md`

## Summary

Add a comparison endpoint and a frontend dashboard page to the existing
Next.js app (from 001-dag-diff-schema). The endpoint accepts two `.dot`
uploads, reuses the existing DOT adapter to get two canonical artifacts,
classifies every node/edge on each side as shared (same id on both sides)
or unique to that side, and returns per-side DOT text annotated with that
classification's styling, each side's node-hash list, and a categorized
added/removed/shared list for the summary panel. The frontend renders a
three-panel dashboard: left and right graph panels (each an actual
rendered image, client-side, via a WASM Graphviz renderer bundled with the
app — no CDN fetch — plus that side's hash list), and a third diff-summary
panel listing every difference as text, all three driven from the same
comparison result so they can never disagree.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (Next.js 14+, App
Router) — same as 001-dag-diff-schema; this feature extends that project,
not a new one.
**Primary Dependencies**: Existing `ts-graphviz`-based adapter
(`src/adapters/dot/`); a client-side WASM Graphviz renderer for turning DOT
text into an on-screen graph (see research.md); React (already part of
Next.js) for the two-panel page.
**Storage**: N/A — comparisons are computed per-request, nothing persisted.
**Testing**: Vitest, extended to a `jsdom` environment so panel/rendering
logic can be unit-tested alongside the existing Node-environment backend
tests (see research.md).
**Target Platform**: Same single Docker container as 001; no new deployment
target.
**Project Type**: Web application — same single Next.js project, additive
routes/modules.
**Performance Goals**: Side-by-side rendering of artifacts with up to a few
hundred nodes each stays responsive (spec SC-005); large graphs remain
navigable via pan/zoom rather than becoming unusable.
**Constraints**: Zero outbound network calls — the WASM Graphviz asset MUST
be bundled with the app and served from the app's own origin, not fetched
from a public CDN at runtime, or Principle III is silently violated by a
dependency's default behavior. No new backend persistence.
**Scale/Scope**: Single-user/small-team self-hosted use, same as 001.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Normalize to One Internal Schema** — PASS. The new comparison logic
  (`src/compare/`) operates only on the canonical `Artifact` schema (id/edge
  set operations) and has no DOT-specific code. DOT knowledge stays inside
  `src/adapters/dot/`, which gains a symmetric *output* responsibility
  (serializing a classified artifact back to annotated DOT for rendering)
  alongside its existing *input* responsibility (parsing DOT) — still the
  only module allowed to know DOT syntax exists, in either direction.
- **II. Diff-as-Artifact** — PASS. The shared/unique classification is
  computed once, server-side, in the comparison endpoint, before any
  rendering; the frontend never re-derives or adjusts it (spec FR-011).
- **III. Self-Contained Single-Container Deployment, No External
  Dependencies** — PASS, conditional on the WASM Graphviz renderer's assets
  being bundled and served locally rather than fetched from a CDN (a common
  default for these libraries that must be explicitly overridden — flagged
  in research.md as a build requirement, not a violation to justify).
- **IV. LLM Analysis Is Advisory** — N/A. Not touched by this feature.
- **Architecture Constraints**: `src/compare/` and `src/adapters/dot/`
  remain independently unit-testable without a running server or browser
  (classification and DOT serialization are both pure functions over plain
  data).

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-diff-viewer/
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
│   └── compare/route.ts          # new: POST — accepts left/right .dot, returns classified DOT + hashes + summary lists
└── compare/
    └── page.tsx                  # new: two-file upload control + three-panel dashboard

src/
├── adapters/dot/
│   ├── parse.ts                  # existing (001)
│   ├── adapt.ts                  # existing (001)
│   └── render.ts                 # new: classified Artifact -> annotated DOT text (output side of the adapter)
├── compare/
│   └── artifact.ts               # new: shared/unique classification, format-agnostic (no DOT knowledge)
├── models/
│   └── artifact.ts                # existing (001); may gain classification-related types
└── validation/
    └── artifact.ts                # existing (001), reused as-is

components/
├── ComparePanel.tsx               # new: one side's graph + hash list
├── GraphRenderer.tsx              # new: wraps the client-side WASM Graphviz rendering
└── DiffSummaryPanel.tsx           # new: third panel — categorized added/removed/shared text lists

tests/
├── unit/
│   ├── compare/artifact.test.ts        # new
│   └── adapters/dot/render.test.ts     # new
└── integration/
    └── api/compare/                    # new
```

**Structure Decision**: Extends the existing single Next.js project rather
than starting a new one. `src/compare/` is a new, DOT-agnostic sibling to
`src/adapters/`, `src/models/`, and `src/validation/` — it consumes the
canonical schema only. DOT serialization for rendering purposes is added to
`src/adapters/dot/` (not a new top-level module) so all DOT-format
knowledge, both parsing and serializing, stays confined to one place per
Principle I. `DiffSummaryPanel` renders the same classification data the
two `ComparePanel`s use, sourced from one API response, so the summary list
and the graph highlighting cannot drift apart (spec FR-011, Diff Summary
entity).

## Complexity Tracking

*No constitution violations — table not applicable.*

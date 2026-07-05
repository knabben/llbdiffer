---

description: "Task list for AI Diff Analysis"
---

# Tasks: AI Diff Analysis

**Input**: Design documents from `/specs/003-ai-diff-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analyze.md, quickstart.md

**Tests**: Included, following 001/002's precedent. Vitest, with the
Anthropic client mocked in every test — no real network call in the suite
(research.md, plan.md Constraints).

**Organization**: Tasks are grouped by user story (from spec.md: US1, US2 —
both P1; US3 — P2) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths follow plan.md's structure (`app/`, `src/`, `components/`, `tests/`),
  extending the existing 001-dag-diff-schema / 002-diff-viewer project.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the new dependency this feature needs

- [X] T001 Add `@anthropic-ai/sdk` as a dependency in `package.json`
- [X] T002 Regenerate `package-lock.json` inside a `node:20-alpine` container (per 001/002's documented glibc/musl gotcha) after adding the above dependency
- [X] T003 [P] Confirm `make build` and `make test` still succeed against the updated `deps` stage with no Dockerfile changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define `AnalysisPromptContext` and `AnalysisResult` types in `src/analysis/claude.ts` per data-model.md
- [X] T005 Implement prompt-building — `Artifact`×2 + `Classification` + `DiffSummary` → plain-text prompt (per-side `id: command` lines plus categorized added/removed/shared lists) — in `src/analysis/claude.ts` (depends on T004)
- [X] T006 [P] Implement the Claude API call wrapper in `src/analysis/claude.ts`: an injected/factory Anthropic client, model `claude-opus-4-8`, single non-streaming `messages.create()` call, no MCP/tool use (depends on T004)
- [X] T007 Scaffold the `POST /api/analyze` route handler — reuse `validateUploadedField` (001/002) and `classify` (002) unchanged, call `src/analysis/claude.ts`, map success to `{analysis}` and failures to the 400/502 shapes from contracts/analyze.md — in `app/api/analyze/route.ts` (depends on T005, T006)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Request an AI explanation of the diff (Priority: P1)

**Goal**: An engineer can click "Analyze with AI" after a comparison and get
a narrative explanation back.

**Independent Test**: Complete a comparison, click the analyze control, and
confirm a narrative result appears referencing the actual differences in
the loaded comparison.

### Tests for User Story 1

- [X] T008 [P] [US1] Unit test: prompt-building includes both artifacts' node commands and the classification's added/removed/shared references, Anthropic client mocked, in `tests/unit/analysis/claude.test.ts`
- [X] T009 [P] [US1] Integration test: POST two valid `.dot` fixtures to `/api/analyze` with the Anthropic client mocked, assert 200 and a well-formed `{analysis: string}` body, in `tests/integration/api/analyze/happy-path.test.ts`

### Implementation for User Story 1

- [X] T010 [US1] Add an "Analyze with AI" control to `app/compare/page.tsx`, enabled only once a `ComparisonResult` exists (FR-001)
- [X] T011 [US1] Wire the control's click handler to resubmit the held `leftFile`/`rightFile` as `FormData` to `POST /api/analyze`, sent only on explicit click — never automatically (FR-002, FR-003) (depends on T010)
- [X] T012 [US1] Implement `components/AnalysisPanel.tsx` with a loading/pending state shown while the request is in flight (FR-004) (depends on T011)
- [X] T013 [US1] Render the narrative result text in `AnalysisPanel` on success (depends on T012)

**Checkpoint**: Clicking "Analyze with AI" yields a displayed narrative — end to end

---

## Phase 4: User Story 2 - See the AI's explanation clearly separated from the diff (Priority: P1)

**Goal**: The AI narrative is unmistakably commentary, in its own panel,
never blended with the deterministic diff graphs/summary.

**Independent Test**: Request an analysis and confirm it renders in a
distinct, clearly labeled panel, and that the graphs/diff summary are
byte-for-byte unchanged before and after the request.

### Tests for User Story 2

- [X] T014 [P] [US2] Component test: `AnalysisPanel` renders as a visually distinct, clearly-labeled "AI-generated/advisory" panel — not styled as part of the diff graphs or summary — in `tests/unit/components/AnalysisPanel.test.tsx`
- [X] T015 [P] [US2] Component test: `page.tsx`'s `ComparisonResult` state (and what `ComparePanel`/`DiffSummaryPanel` render) is unchanged before and after an AI analysis request, in `tests/unit/app/compare/page.test.tsx`

### Implementation for User Story 2

- [X] T016 [US2] Position `AnalysisPanel` in `app/compare/page.tsx` as a separate panel outside the graphs/diff-summary layout, labeled as AI-generated/advisory (FR-005, FR-006) (depends on T013)
- [X] T017 [US2] Confirm (by code review, backed by T015) that `AnalysisPanel`'s result state lives independently in `page.tsx` and is never written into `ComparisonResult` or passed to `ComparePanel`/`DiffSummaryPanel` (FR-007) (depends on T016)
- [X] T018 [US2] Clear any displayed `AnalysisPanel` result/error whenever a new comparison is submitted (FR-011) (depends on T016)

**Checkpoint**: AI panel is structurally separated and resets on every new comparison

---

## Phase 5: User Story 3 - Get a clear error when AI analysis fails (Priority: P2)

**Goal**: A failed analysis request shows a specific, readable, retry-able
error without disrupting the rest of the page.

**Independent Test**: Force an analysis failure (mocked provider error) and
confirm a specific error appears in the AI panel with a retry option, while
graphs/hash lists/diff summary keep working.

### Tests for User Story 3

- [X] T019 [P] [US3] Integration test: Anthropic client mock throws/errors → `/api/analyze` returns `502` with `{error: {code: "ANALYSIS_FAILED", message}}` per contracts/analyze.md, in `tests/integration/api/analyze/failure.test.ts`
- [X] T020 [P] [US3] Component test: `AnalysisPanel` shows a specific error message and a retry control when the request fails, in `tests/unit/components/AnalysisPanel.test.tsx`

### Implementation for User Story 3

- [X] T021 [US3] Catch Claude API call failures in `app/api/analyze/route.ts` and return the `502 ANALYSIS_FAILED` shape from contracts/analyze.md (depends on T007)
- [X] T022 [US3] Handle `502`/network/unexpected-failure responses in `page.tsx`'s analyze handler, surfacing a retry-able error state in `AnalysisPanel` (FR-009) (depends on T021, T012)
- [X] T023 [US3] Add a retry action in `AnalysisPanel` that re-invokes the same analyze request without requiring the user to re-select files (depends on T022)

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T024 [P] Document configuring `ANTHROPIC_API_KEY` for the self-hosted container in the README (FR-012, added via post-tasks clarification)
- [X] T025 [P] Run quickstart.md validation end-to-end (`make build`, real `docker run`, click through "Analyze with AI" against the running container, including a forced-failure check) — validated via `curl` against the user's live `make dev` container (no `ANTHROPIC_API_KEY` set): `/api/analyze` correctly returns `502 ANALYSIS_FAILED` with the exact contracts/analyze.md shape, and `/api/compare` remains unaffected (`200`), confirming zero regression. Full browser click-through (loading/result states, retry button) is covered by the automated component tests in `tests/unit/components/AnalysisPanel.test.tsx` and `tests/unit/app/compare/page.test.tsx`; a real Claude API key was not available in this environment to verify an actual successful narrative end-to-end.
- [X] T026 Review `src/analysis/claude.ts` to confirm it's the only module importing `@anthropic-ai/sdk`, mirroring `src/adapters/dot/`'s isolation of the DOT parsing library, per Principle I — confirmed via `grep`: only `src/analysis/claude.ts` imports it in production code (test files import only for mocking/types)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 and US2 are both P1; US2 depends on US1's control/handler/`AnalysisPanel` scaffolding (T010–T013) existing, so within this feature they are naturally sequential, not parallel, despite sharing priority P1
  - US3 depends on US1's loading-state plumbing (T012) and the route scaffold (T007), and can proceed in parallel with US2 once those exist
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3
- **User Story 2 (P1)**: Depends on US1's control, handler, and `AnalysisPanel` (T010–T013) to have something to separate/label
- **User Story 3 (P2)**: Depends on US1's `AnalysisPanel` loading state (T012) and the route scaffold (T007); independently testable from US2

### Within Each User Story

- Tests are written before implementation tasks in that story's phase and MUST fail first (run via `make test`)
- Foundational prompt-building/API-call wrapper before any route or UI that uses them
- Story complete before moving to the next priority phase

### Parallel Opportunities

- T003 (Setup) can run in parallel once T001/T002 land
- T006 (Foundational) can run in parallel with T005 once T004 is done
- Within US1: T008 and T009 (tests) can run in parallel
- Within US2: T014 and T015 (tests) can run in parallel
- Within US3: T019 and T020 (tests) can run in parallel
- US3 can be staffed in parallel with US2 once US1 (T007, T012) is done

---

## Parallel Example: User Story 1

```bash
# Launch US1's tests together:
Task: "Unit test: prompt-building includes commands and classification in tests/unit/analysis/claude.test.ts"
Task: "Integration test: POST two valid .dot fixtures to /api/analyze in tests/integration/api/analyze/happy-path.test.ts"
```

---

## Implementation Strategy

### Incremental Delivery

1. Setup + Foundational → foundation ready (prompt-building, Claude call wrapper, route scaffold)
2. Add User Story 1 → clicking "Analyze with AI" yields a narrative → verify via `make test`
3. Add User Story 2 → AI panel is structurally separated and reset-safe → verify via `make test`
4. Add User Story 3 → failures are specific and retry-able → verify via `make test`
5. Polish (Phase 6)

### Parallel Team Strategy

Like 002, US1→US2 are naturally sequential here (US2 separates/labels what
US1 scaffolded), so a single developer working through them in order is the
straightforward path. US3 (error handling) can be picked up by a second
developer in parallel once US1's route scaffold (T007) and loading state
(T012) exist, since it only touches the failure branch of the same flow.

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Per Principle I, only `src/analysis/claude.ts` may import `@anthropic-ai/sdk`; `app/api/analyze/route.ts` stays a thin route that reuses `validateUploadedField`/`classify` unchanged
- Per Principle III, `app/api/analyze/route.ts` remains the only route in the codebase permitted to make an outbound network call
- No task assumes host Node.js/npm — build, dev, lint, and test all go through the `Makefile`'s Docker-backed targets

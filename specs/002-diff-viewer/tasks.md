---

description: "Task list for Side-by-Side Diff Viewer"
---

# Tasks: Side-by-Side Diff Viewer

**Input**: Design documents from `/specs/002-diff-viewer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/compare.md, quickstart.md

**Tests**: Included. plan.md's Technical Context specifies Vitest (now with
a `jsdom` environment) for unit, component, and integration tests.

**Organization**: Tasks are grouped by user story (from spec.md: US1, US2,
US3 — all P1; US4 — P2) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths follow plan.md's structure (`app/`, `src/`, `components/`, `tests/`),
  extending the existing 001-dag-diff-schema project.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the new dependencies this feature needs

- [X] T001 Add `@hpcc-js/wasm-graphviz` as a dependency in `package.json`
- [X] T002 [P] Add `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, and `jsdom` as devDependencies in `package.json`
- [X] T003 [P] Switch `vitest.config.ts`'s default `environment` to `'jsdom'` with the React plugin + a setup file, and add a `// @vitest-environment node` override to every existing/new backend integration test that calls `request.formData()` — required after discovering (by actually running the suite) that jsdom's `FormData` breaks Next.js route-handler multipart parsing; see research.md
- [X] T004 Regenerate `package-lock.json` inside a `node:20-alpine` container (per 001's documented glibc/musl gotcha) after adding the above dependencies
- [X] T005 [P] Confirm `make build` and `make test` still succeed against the updated `deps` stage with no Dockerfile changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Define `ElementStatus`/`ClassifiedNode`/`ClassifiedEdge` types in `src/compare/artifact.ts` per data-model.md
- [X] T007 Implement shared/unique classification (two `Artifact`s → per-side `ClassifiedNode[]`/`ClassifiedEdge[]`) in `src/compare/artifact.ts` (depends on T006) — went through two corrections from live user testing: briefly compared node labels in addition to id (to catch a hand-authored fixture reusing ids across changed content), then reverted to id-only after that broke a legitimate case (a `docker-image://` source op keeping the same id across builds while its label shows a different resolved digest). Final: id-only, per research.md.
- [X] T008 [P] Implement `DiffSummary` assembly (added/removed/shared arrays + `identical` flag) in `src/compare/artifact.ts` (depends on T007)
- [X] T009 Implement classified-`Artifact` → annotated DOT text serialization in `src/adapters/dot/render.ts` (depends on T006) — real bug found and fixed: passing raw id strings like `"sha256:aaa"` as edge targets makes ts-graphviz mis-parse them as Graphviz `id:port` references; fixed by using the `NodeModel` objects `digraph()` returns instead of id strings (regression-tested in render.test.ts)
- [X] T010 Scaffold the `POST /api/compare` route handler — reuse `validateAndAdapt` (001) per side, wire classification + render + summary into the `ComparisonResult` response — in `app/api/compare/route.ts` (depends on T007, T008, T009). Extracted the shared per-field upload validation (`validateUploadedField`) into `src/validation/artifact.ts` so `/api/artifacts` and `/api/compare` don't duplicate it.

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Upload two builds for comparison (Priority: P1)

**Goal**: An engineer can select two `.dot` files and submit them together
as a single comparison request.

**Independent Test**: Select two valid `.dot` files, submit, and confirm a
well-formed `ComparisonResult` (per contracts/compare.md) comes back from
`/api/compare`.

### Tests for User Story 1

- [X] T011 [P] [US1] Integration test: POST two valid `.dot` fixtures to `/api/compare`, assert 200 and a well-formed `ComparisonResult` shape, in `tests/integration/api/compare/happy-path.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Create `app/compare/page.tsx` with a two-file-slot upload control and submission disabled until exactly two files are selected (FR-001, FR-002)
- [X] T013 [US1] Wire the submit handler to read both files and POST them as `FormData` to `/api/compare` (FR-003) (depends on T012)
- [X] T014 [P] [US1] Reuse/extend the 001 `.dot` fixtures (`tests/fixtures/dot/valid-before.dot`, `valid-after.dot`) for this feature's tests
- [X] T015 [US1] Component test: submit control stays disabled until exactly two files are selected, in `tests/unit/app/compare/page.test.tsx` (depends on T012)

**Checkpoint**: Submission flow works end-to-end against the real endpoint

---

## Phase 4: User Story 2 - View both builds side-by-side with their node hashes (Priority: P1)

**Goal**: After a successful comparison, two panels render side by side —
each showing that side's graph as an actual image plus its node hash list.

**Independent Test**: Submit two valid files and confirm two panels
render, left showing the first artifact's graph and hash list, right
showing the second's.

### Tests for User Story 2

- [X] T016 [P] [US2] Component test: `GraphRenderer` renders SVG output from a DOT string, in `tests/unit/components/GraphRenderer.test.tsx`
- [X] T017 [P] [US2] Component test: `ComparePanel` displays the full hash list for its side, in `tests/unit/components/ComparePanel.test.tsx`

### Implementation for User Story 2

- [X] T018 [US2] Implement `components/GraphRenderer.tsx`, wrapping `@hpcc-js/wasm-graphviz`'s `Graphviz.load()`/`.dot()` to turn DOT text into an SVG element (depends on T016)
- [X] T019 [US2] Implement `components/ComparePanel.tsx`, rendering `GraphRenderer` plus the hash list for one side (depends on T017, T018)
- [X] T020 [US2] Wire `app/compare/page.tsx` to render left/right `ComparePanel`s from the `ComparisonResult` once received (depends on T013, T019)
- [X] T021 [US2] Verify the production Next.js build doesn't fetch the WASM asset from a CDN (inspect build output per research.md's self-containment check) — confirmed: zero `unpkg`/`jsdelivr` references in `.next/static/chunks/`, real end-to-end request against `next start` returned correctly-styled DOT

**Checkpoint**: Two-panel side-by-side view works

---

## Phase 5: User Story 3 - See conflicts and similarities clearly highlighted (Priority: P1)

**Goal**: Shared vs. unique elements are visually obvious in both graph
panels, and a third summary panel lists every difference as text — the
tool's core value proposition.

**Independent Test**: Submit two files with known differences and known
shared elements; confirm shared elements are styled identically in both
panels, unique elements stand out, and the summary panel lists every
added/removed/shared entry.

### Tests for User Story 3

- [X] T022 [P] [US3] Unit test: classification marks matching ids as shared and non-matching ids as unique, in `tests/unit/compare/artifact.test.ts`
- [X] T023 [P] [US3] Unit test: DOT serialization applies a distinct style/color for unique elements and a neutral style for shared elements, in `tests/unit/adapters/dot/render.test.ts`
- [X] T024 [P] [US3] Unit test: `DiffSummary` reports added/removed/shared correctly, with `identical: true` only when both `added` and `removed` are empty, in `tests/unit/compare/artifact.test.ts`
- [X] T025 [P] [US3] Component test: `DiffSummaryPanel` lists categorized added/removed/shared entries, in `tests/unit/components/DiffSummaryPanel.test.tsx`

### Implementation for User Story 3

- [X] T026 [US3] Implement `components/DiffSummaryPanel.tsx`, rendering the summary's added/removed/shared lists (FR-013, FR-014) (depends on T025)
- [X] T027 [US3] Wire `app/compare/page.tsx` to render `DiffSummaryPanel` as the third dashboard panel, and show "no differences" messaging when `identical: true` (FR-008) (depends on T020, T026)
- [X] T028 [US3] Confirm `ComparePanel`'s rendered graph visually reflects each element's shared/unique styling exactly as received, with no client-side recomputation (FR-011) (depends on T019) — verified end-to-end via a real `curl` against `next start` (fillcolor differs correctly between shared/unique nodes with zero client-side logic)

**Checkpoint**: Full three-panel dashboard with highlighting and summary — core value delivered

---

## Phase 6: User Story 4 - Get a clear error when a submission can't be compared (Priority: P2)

**Goal**: Invalid submissions produce specific, readable errors; unexpected
failures produce a generic, retry-able error — never a blank or crashed
screen.

**Independent Test**: Submit one malformed file and confirm a specific
error names which file failed and why, rather than a blank or crashed
screen.

### Tests for User Story 4

- [X] T029 [P] [US4] Integration test: one invalid file → 400 with per-side error detail, in `tests/integration/api/compare/invalid-file.test.ts`
- [X] T030 [P] [US4] Component test: `page.tsx` displays a specific per-file error message when the API returns 400, in `tests/unit/app/compare/page.test.tsx`

### Implementation for User Story 4

- [X] T031 [US4] Handle 400 responses in the submit handler, surfacing the specific per-side error message (FR-009) (depends on T013)
- [X] T032 [US4] Handle network/unexpected-failure cases with a generic, retry-able error state (FR-010) (depends on T013)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T033 [P] Add README instructions for extracting a `.dot` file from a Dockerfile via `buildctl debug dump-llb --dot` (verified against the real BuildKit source/examples, not assumed)
- [X] T034 [P] Run quickstart.md validation end-to-end (`make build`, real `docker run`, `curl /api/compare` against the running container with real fixtures) — also caught and fixed two real bugs this way: (1) content-type-based upload validation falsely rejecting real `.dot` files on Windows due to Word-template MIME collision, (2) `classify()` trusting id equality without checking label equality, which silently hid genuine differences when a fixture reused an id
- [X] T035 Review `src/compare/` and `src/adapters/dot/render.ts` to confirm no DOT-specific knowledge leaked into `src/compare/`, and no classification logic leaked into `src/adapters/dot/`, per Principle I — confirmed via `grep`; only `components/GraphRenderer.tsx` imports the client-side rendering library, which is a rendering concern, not a parsing/classification one

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1, US2, and US3 are all P1; US2 depends on US1's page/submit scaffolding (T012/T013) existing, and US3 depends on US2's `ComparePanel` (T019) and page wiring (T020) existing — so within this feature they are naturally sequential, not parallel, despite sharing priority P1
  - US4 depends only on US1's submit handler (T013), and can proceed in parallel with US2/US3 once that exists
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3/US4
- **User Story 2 (P1)**: Depends on US1's page and submit handler (T012/T013) to have something to render into
- **User Story 3 (P1)**: Depends on US2's `ComparePanel` and page wiring (T019/T020) to add highlighting/summary on top of
- **User Story 4 (P2)**: Depends only on US1's submit handler (T013); independently testable from US2/US3

### Within Each User Story

- Tests are written before implementation tasks in that story's phase and MUST fail first (run via `make test`)
- Foundational classification/serialization before any UI that renders them
- Story complete before moving to the next priority phase

### Parallel Opportunities

- T002, T003, T005 (Setup) can run in parallel once T001/T004 land
- T008 and T009 (Foundational) can run in parallel once T006/T007 are done
- Within US2: T016 and T017 (tests) can run in parallel
- Within US3: T022, T023, T024, T025 can all run in parallel
- Within US4: T029 and T030 can run in parallel
- US4 can be staffed in parallel with US2/US3 once US1 (T013) is done

---

## Parallel Example: User Story 3

```bash
# Launch US3's tests together:
Task: "Unit test: classification marks matching ids as shared in tests/unit/compare/artifact.test.ts"
Task: "Unit test: DOT serialization applies distinct styling in tests/unit/adapters/dot/render.test.ts"
Task: "Unit test: DiffSummary reports added/removed/shared correctly in tests/unit/compare/artifact.test.ts"
Task: "Component test: DiffSummaryPanel lists categorized entries in tests/unit/components/DiffSummaryPanel.test.tsx"
```

---

## Implementation Strategy

### Incremental Delivery

1. Setup + Foundational → foundation ready (classification, serialization, endpoint)
2. Add User Story 1 → submission flow works → verify via `make test`
3. Add User Story 2 → two-panel visual view works → verify via `make test`
4. Add User Story 3 → highlighting + summary panel deliver the tool's core value → verify via `make test`
5. Add User Story 4 → error handling hardened → verify via `make test`
6. Polish (Phase 7)

### Parallel Team Strategy

Unlike 001, US1→US2→US3 are naturally sequential here (each renders more of
what the previous story scaffolded), so a single developer working through
them in order is the straightforward path. US4 (error handling) can be
picked up by a second developer in parallel once US1's submit handler
(T013) exists, since it only touches error branches of the same handler.

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Per Principle I, only `src/adapters/dot/` may import DOT-parsing/serializing
  types; `src/compare/`, `src/models/`, and `app/api/` must stay format-agnostic
- No task assumes host Node.js/npm — build, dev, lint, and test all go through the `Makefile`'s Docker-backed targets

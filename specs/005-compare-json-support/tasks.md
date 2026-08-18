# Tasks: Compare Accepts LLB JSON

**Input**: Design documents from `/specs/005-compare-json-support/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. `plan.md`'s Testing section commits to rewriting the
existing `/api/compare` and `/api/analyze` integration tests and the
`/compare` page unit test against LLB JSON fixtures, reusing fixtures
already added for 004 — no new fixtures are authored.

**Organization**: Tasks are grouped by user story (spec.md: US1 P1, US2 P2,
US3 P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js project (`app/`, `src/`, `components/`, `tests/` at
repository root) — unchanged from 001–004.

---

## Phase 1: Setup

Not applicable. This feature adds no new dependencies, no new modules, and
no new project scaffolding — it only reuses `src/adapters/llbjson/` and
`src/validation/llbArtifact.ts`, both already shipped in 004. No tasks.

---

## Phase 2: Foundational

Not applicable. There is no shared prerequisite that blocks all three user
stories: US1 and US3 each modify their own, independent route file, and no
new schema or module is introduced (see plan.md Constitution Check — "No
schema changes"). No tasks.

---

## Phase 3: User Story 1 - Compare two builds from LLB JSON (Priority: P1) 🎯 MVP

**Goal**: Users can upload two LLB JSON build definitions on the `/compare`
page and get the same side-by-side comparison the page previously produced
for `.dot` files.

**Independent Test**: Upload `tests/fixtures/llbjson/added-op-before.json`
and `added-op-after.json` as the "Left"/"Right" inputs on `/compare` (or via
`curl -F left=@... -F right=@...` per `contracts/compare.md`) and confirm a
`200` response with both build graphs and a non-empty diff summary.

### Implementation for User Story 1

- [X] T001 [P] [US1] In `app/api/compare/route.ts`, replace the import of `validateUploadedField` from `../../../src/validation/artifact` with `validateUploadedLlbField` from `../../../src/validation/llbArtifact`, and replace the two `validateUploadedField(form, 'left')` / `validateUploadedField(form, 'right')` calls with `validateUploadedLlbField(form, 'left', true)` / `validateUploadedLlbField(form, 'right', true)`. Leave the `classify`/`buildDiffSummary`/`renderClassifiedDot`/response-building code below unchanged (per `contracts/compare.md`, the `200` response shape is unchanged).
- [X] T002 [P] [US1] In `app/compare/page.tsx`, change the `<FileChip>` `accept` attribute from `".dot"` to `".json"`, update the `label` props from `"First build (.dot)"` / `"Second build (.dot)"` to `"First build (JSON)"` / `"Second build (JSON)"`, and update the placeholder text `'Select a .dot file…'` to `'Select a JSON file…'`.

### Tests for User Story 1

- [X] T003 [P] [US1] Rewrite `tests/integration/api/compare/happy-path.test.ts`: replace the `.dot`-based `buildRequest` helper (and its `readDotFixture` import) with one that builds `left`/`right` as `.json` files (`type: 'application/json'`) from `readLlbJsonFixture` (`tests/utils/fixtures.ts`, already exists). First test uses `readLlbJsonFixture('added-op-before.json')` / `readLlbJsonFixture('added-op-after.json')` and keeps the existing non-identical assertions (`summary.added`/`removed`/`shared` all non-empty, `identical: false`). Second test uses `readLlbJsonFixture('clean.json')` for both sides and keeps the existing identical-builds assertions. Mirror `tests/integration/api/determinism/comparison.test.ts`'s `buildRequest` pattern.
- [X] T004 [P] [US1] In `tests/unit/app/compare/page.test.tsx`, rename `makeDotFile` to `makeJsonFile`, returning `new File(['{}'], name, { type: 'application/json' })` with a `.json` filename, and update every `screen.getAllByLabelText(/build \(\.dot\)/i)` call to match the new label text from T002 (e.g. `/build \(json\)/i`). Leave the `ComparisonResult`-shaped mock fetch responses (`left.dot`, `right.dot`, etc.) unchanged — those are the unchanged DOT *output* rendering field names, not the input format.

**Checkpoint**: `/compare` and `POST /api/compare` accept LLB JSON and reject nothing they shouldn't — User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Clear rejection of unsupported files (Priority: P2)

**Goal**: Uploading a `.dot` file, or an invalid `.json` file, to Compare
produces a clear, per-file error instead of a confusing failure.

**Independent Test**: `POST /api/compare` with a `.dot` file as `left` and a
valid LLB JSON file as `right`; confirm `400` with
`errors.left.code === 'UNSUPPORTED_FORMAT'` and `errors.right === null`.

**Depends on**: T001 (US1) — this story's assertions target
`/api/compare`'s validation behavior after it has been switched to
`validateUploadedLlbField`.

### Tests for User Story 2

- [X] T005 [US2] Rewrite `tests/integration/api/compare/invalid-file.test.ts` with three cases, mirroring `tests/integration/api/determinism/errors.test.ts`'s assertion style: (1) `left = new File(['digraph {}'], 'left.dot', { type: 'text/vnd.graphviz' })`, `right = readLlbJsonFixture('added-op-after.json')` → expect `400`, `body.errors.left.code === 'UNSUPPORTED_FORMAT'`, `body.errors.right === null`; (2) `left = readLlbJsonFixture('malformed.json')`, `right = readLlbJsonFixture('added-op-after.json')` → expect `400`, `body.errors.left.code === 'LLB_JSON_PARSE_ERROR'`; (3) `left` = an inline dangling-reference JSON string (mirror the inline fixture in `tests/unit/adapters/llbjson/adapt.test.ts`'s `'throws DanglingInputError...'` test: `JSON.stringify([{ Digest: 'sha256:a', Op: { inputs: [{ digest: 'sha256:missing' }], Op: { build: {} } }, OpMetadata: {} }])`), `right = readLlbJsonFixture('added-op-after.json')` → expect `400`, `body.errors.left.code === 'DANGLING_INPUT_REFERENCE'`.

**Checkpoint**: Invalid uploads to `/api/compare` are rejected with the correct per-file, per-reason error code — User Story 2 is independently testable.

---

## Phase 5: User Story 3 - AI analysis keeps working on JSON inputs (Priority: P3)

**Goal**: "Analyze with AI" on the Compare page continues to work, now
driven by the same two uploaded LLB JSON files.

**Independent Test**: `POST /api/analyze` with two valid LLB JSON files
(Claude client mocked, per existing test convention); confirm `200` with
the mocked narrative text in `body.analysis`.

### Implementation for User Story 3

- [X] T006 [US3] In `app/api/analyze/route.ts`, apply the same import and call-site change as T001: replace `validateUploadedField` (`../../../src/validation/artifact`) with `validateUploadedLlbField` (`../../../src/validation/llbArtifact`), calling it as `validateUploadedLlbField(form, 'left', true)` / `validateUploadedLlbField(form, 'right', true)`. Leave `classify`/`buildDiffSummary`/`analyzeDiff` and the `502 ANALYSIS_FAILED` handling unchanged.

### Tests for User Story 3

- [X] T007 [P] [US3] Rewrite `tests/integration/api/analyze/happy-path.test.ts`: replace the `.dot`-based `buildRequest` helper with one using `readLlbJsonFixture('added-op-before.json')` / `readLlbJsonFixture('added-op-after.json')` as `.json` files (`type: 'application/json'`), keeping the mocked `create.mockResolvedValue(...)` and `body.analysis` assertion unchanged.
- [X] T008 [P] [US3] Rewrite `tests/integration/api/analyze/failure.test.ts`: update the `502` test's `buildRequest` to use the same LLB JSON fixtures as T007; update the `400` test to send `new File(['not a json file'], 'left.txt', { type: 'text/plain' })` as `left` and `readLlbJsonFixture('added-op-after.json')` as `right`, keeping the `expect(create).not.toHaveBeenCalled()` assertion.

**Checkpoint**: All three user stories are independently functional — `/compare` accepts LLB JSON, rejects invalid uploads with clear errors, and "Analyze with AI" works end-to-end on JSON inputs.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 [P] Run `make lint` and `make test` (full Vitest suite) and confirm no regressions in `POST /api/artifacts` (`tests/integration/api/artifacts/*`), `/determinism` (`tests/integration/api/determinism/*`), or the DOT adapter/render unit tests (`tests/unit/adapters/dot/*`) — all of which stay `.dot`-based and out of scope for this feature.
- [X] T010 Run through `quickstart.md` manually against `make dev`: generate `before.json`/`after.json` via `buildctl debug dump-llb --output=json`, upload them on `/compare`, confirm the comparison renders with the same dual-graph-plus-summary layout as before this change, then click "Analyze with AI" and confirm an analysis is returned.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational**: N/A — no tasks, nothing blocks story start.
- **User Story 1 (Phase 3)**: No dependencies — start immediately. This is the MVP.
- **User Story 2 (Phase 4)**: Depends on T001 (US1) — reuses `/api/compare` after its validator swap. T002/T003/T004 (US1) are not required first.
- **User Story 3 (Phase 5)**: No dependency on US1 or US2 — modifies a separate route file (`app/api/analyze/route.ts`) and can proceed in parallel with Phase 3.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T001 (US1, `app/api/compare/route.ts`) and T006 (US3, `app/api/analyze/route.ts`) touch different files and can be done in parallel by different people.
- T001 and T002 (both US1) touch different files and can run in parallel.
- T003 and T004 (both US1 tests) touch different files and can run in parallel with each other and with T001/T002, though they should be re-run (not just written) after T001/T002 land to confirm they pass.
- T007 and T008 (both US3 tests) touch different files and can run in parallel.
- T005 (US2) must follow T001 (US1) — see Phase 4 dependency note above.

---

## Parallel Example: User Story 1

```bash
# All four US1 tasks touch different files and can be launched together:
Task: "In app/api/compare/route.ts, swap validateUploadedField for validateUploadedLlbField"
Task: "In app/compare/page.tsx, change accept=\".dot\" to accept=\".json\" and update labels"
Task: "Rewrite tests/integration/api/compare/happy-path.test.ts against llbjson fixtures"
Task: "Rewrite tests/unit/app/compare/page.test.tsx against llbjson fixtures/labels"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3 (T001–T004).
2. **STOP and VALIDATE**: `make test` for `tests/integration/api/compare/happy-path.test.ts` and `tests/unit/app/compare/page.test.tsx`, then manually upload two LLB JSON files on `/compare`.
3. This alone delivers the feature request's core ask.

### Incremental Delivery

1. Phase 3 (US1) → Compare works with JSON → demo-able MVP.
2. Phase 4 (US2) → invalid uploads get clear errors.
3. Phase 5 (US3) → AI analysis confirmed working on JSON inputs.
4. Phase 6 → full regression pass + manual quickstart walkthrough.

### Parallel Team Strategy

With two developers: Developer A takes Phase 3 (US1) then Phase 4 (US2,
which depends on it); Developer B takes Phase 5 (US3) in parallel, since it
touches an entirely separate route file. Both converge on Phase 6.

---

## Notes

- Total scope is intentionally small: 2 production files (`app/api/compare/route.ts`, `app/api/analyze/route.ts`, `app/compare/page.tsx` — 3 total) and 4 test files modified, 0 new files, per plan.md's Project Structure.
- No new fixtures: all tasks reuse `tests/fixtures/llbjson/{added-op-before,added-op-after,clean,malformed}.json`, already present from 004.
- `app/api/artifacts/route.ts` and its tests are explicitly out of scope and must not be touched (spec Assumptions / plan.md Summary).

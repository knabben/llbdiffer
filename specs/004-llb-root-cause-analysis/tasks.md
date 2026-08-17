---

description: "Task list for LLB Root Cause Analysis"
---

# Tasks: LLB Root Cause Analysis

**Input**: Design documents from `/specs/004-llb-root-cause-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/determinism.md, quickstart.md

**Tests**: Included, following 001/002/003's precedent. Vitest; no network
calls anywhere in this feature (unlike 003), so no mocking is needed for
that reason — tests run entirely over fixture JSON.

**Organization**: Tasks are grouped by user story (from spec.md: US1, US2 —
both P1; US3, US4 — both P2) to enable independent implementation and
testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths follow plan.md's structure (`app/`, `src/`, `components/`, `tests/`),
  extending the existing 001/002/003 project. No existing file outside
  `src/models/artifact.ts` and `CLAUDE.md` is modified by this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold new module files; confirm no dependency changes are needed

- [X] T001 [P] Scaffold empty typed module stubs per plan.md's Project Structure: `src/adapters/llbjson/{parse.ts,adapt.ts}`, `src/align/shapeKey.ts`, `src/detect/{rules.ts,divergence.ts}`, `src/validation/llbArtifact.ts`, `app/api/determinism/route.ts`, `app/determinism/page.tsx`, `components/{DeterminismUpload.tsx,DeterminismPanel.tsx}`
- [X] T002 [P] Confirm `make build`, `make test`, and `make lint` still succeed with the new stub files in place — this feature needs no new npm dependency (research.md §2 uses Node's built-in `crypto`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Canonical schema extension, LLB JSON parsing/adapting, validation, and the base route/types every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Extend `src/models/artifact.ts` per data-model.md: add optional `Edge.inputIndex`/`Edge.mountDest`, optional `Node.llb`, bump `SCHEMA_VERSION` to `1.1.0` (non-breaking — the existing DOT adapter/`classify()`/analysis code paths never populate or read the new fields)
- [X] T004 [P] Define LLB op types (`OpKind`, `LlbOpMetadata`, `LlbMount`, `ExecOp`, `SourceOp`, `FileAction`, `FileOp`, `BuildOp`, `MergeOp`, `DiffOp`, `LlbOp`, `LlbRecord`) in `src/adapters/llbjson/parse.ts` per data-model.md
- [X] T005 Implement `parseLlbJson` in `src/adapters/llbjson/parse.ts`: `buildctl debug dump-llb` JSON → typed `LlbRecord[]`, tolerant of `Op`/`op` and `OpMetadata`/`opMetadata` casing per research.md §1 (depends on T004)
- [X] T006 Implement `DanglingInputError` + dangling-input detection in `src/adapters/llbjson/parse.ts`, mirroring 001's `DanglingEdgeError` (depends on T005)
- [X] T007 Implement `adaptLlbJson` in `src/adapters/llbjson/adapt.ts`: `LlbRecord[]` → canonical `Artifact`, populating `Node.llb`, `Edge.inputIndex`, and `Edge.mountDest` (depends on T003, T006)
- [X] T008 [P] Implement `src/validation/llbArtifact.ts` (`isSupportedLlbJsonFile`, `validateAndAdaptLlbJson`, `validateUploadedLlbField`, reusing 001's `MAX_UPLOAD_SIZE_BYTES` pattern), rejecting `.dot` uploads outright per FR-013 (depends on T007)
- [X] T009 [P] Define `ConfidenceTier`, `Finding`, `DeterminismReport`, and the `DetectionRule` table shape in `src/detect/rules.ts` per data-model.md (depends on T004)
- [X] T010 Scaffold `POST /api/determinism` in `app/api/determinism/route.ts`: parse `primary`/`secondary` FormData fields via `validateUploadedLlbField`, return the `400` error shape from contracts/determinism.md on validation failure, else delegate to a stubbed `buildDeterminismReport` (depends on T008, T009)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Get a determinism report from a single build (Priority: P1) 🎯 MVP

**Goal**: An engineer uploads one LLB JSON artifact and receives a report of
guaranteed-bad (Structural) and advisory (Heuristic) findings, no second
artifact required.

**Independent Test**: Upload a single LLB JSON artifact and confirm a
report listing any guaranteed-bad constructs and advisory observations,
each labeled with a confidence tier — or a clear "nothing found" state.

### Tests for User Story 1

- [X] T011 [P] [US1] Create LLB JSON fixtures in `tests/fixtures/llbjson/`: `clean.json` (no findings), `unpinned-base.json` (a Structural finding), `malformed.json` (invalid input)
- [X] T012 [P] [US1] Unit tests for Structural rules over the fixtures in `tests/unit/detect/rules.test.ts` (depends on T011)
- [X] T013 [P] [US1] Unit tests for Heuristic pattern rules (RFC3339/epoch-shaped strings, UUID-shaped strings, 40-hex SHAs, absolute paths) in `tests/unit/detect/rules.test.ts`
- [X] T014 [P] [US1] Unit test: a `local://` session-identifier-style attribute never produces a finding, in `tests/unit/detect/rules.test.ts`
- [X] T015 [P] [US1] Integration test: POST `unpinned-base.json` alone to `/api/determinism`, assert `mode:"single"` and the expected Structural finding, in `tests/integration/api/determinism/single-artifact.test.ts` (depends on T011)
- [X] T016 [P] [US1] Integration test: POST `clean.json` alone, assert the report states nothing was found, in `tests/integration/api/determinism/single-artifact.test.ts` (depends on T011)
- [X] T017 [P] [US1] Integration test: POST `malformed.json`, assert `400` with `LLB_JSON_PARSE_ERROR`, in `tests/integration/api/determinism/errors.test.ts` (depends on T011)

### Implementation for User Story 1

- [X] T018 [US1] Implement Structural-tier rules — unconditional cache-bypass, `CLOCK_TIMESTAMP`, `UNPINNED_BASE`, `UNPINNED_GIT`, `UNCHECKSUMMED_HTTP`, `NON_HERMETIC_EXEC` (network/security/proxy_env) — each with a cause code, message, and fix, plus the `local://` ignore-list, in `src/detect/rules.ts` (depends on T009)
- [X] T019 [US1] Implement Heuristic-tier regex-pattern rules in `src/detect/rules.ts` (depends on T009)
- [X] T020 [US1] Implement `buildDeterminismReport`'s single-artifact path in `src/detect/divergence.ts`: run Structural+Heuristic rules over one `Artifact`'s nodes, assemble a sorted `DeterminismReport` (`mode:"single"`), with an explicit empty-findings state (depends on T018, T019)
- [X] T021 [US1] Wire `app/api/determinism/route.ts`'s single-file branch to `buildDeterminismReport` and the `{report}` response shape from contracts/determinism.md (depends on T020, T010)
- [X] T022 [P] [US1] Implement `components/DeterminismUpload.tsx`: LLB JSON file picker (primary file required)
- [X] T023 [P] [US1] Implement `components/DeterminismPanel.tsx`: ranked findings list with confidence-tier badge, cause, fix, and an explicit "nothing found" state
- [X] T024 [US1] Implement `app/determinism/page.tsx`: wire upload → `POST /api/determinism` → `DeterminismPanel`, with a loading state (depends on T022, T023, T021)

**Checkpoint**: Single-artifact determinism report works end to end — deployable MVP

---

## Phase 4: User Story 2 - See the real cause of cache misses, not a wall of red (Priority: P1)

**Goal**: Comparing two builds surfaces a small, ranked list of root causes
(each with a blast radius), instead of every cascaded operation appearing
as an unrelated difference.

**Independent Test**: Compare two artifacts differing by one upstream
change affecting N downstream operations, and confirm the report shows one
root-cause finding with `blastRadius: N`, not N separate findings.

### Tests for User Story 2

- [X] T025 [P] [US2] Add fixture pair `tests/fixtures/llbjson/unsorted-env-before.json` / `unsorted-env-after.json`: one upstream env-order change cascading to several downstream ops
- [X] T026 [P] [US2] Unit tests for `computeShapeKey`/`alignArtifacts` (`shared`/`modified`/`added`/`removed`) over small fixture graphs in `tests/unit/align/shapeKey.test.ts`
- [X] T027 [P] [US2] Unit tests for root-cause-vs-cascaded classification + blast-radius counting in `tests/unit/detect/divergence.test.ts`
- [X] T028 [P] [US2] Unit tests for Proven rules (`UNSORTED_ENV` plus mounts-by-dest/secretenv/extraHosts ordering, `PER_RUN_CACHE_MOUNT_ID`, `TIMESTAMP_DRIFT`) in `tests/unit/detect/rules.test.ts`
- [X] T029 [P] [US2] Integration test: POST the unsorted-env fixture pair, assert one root-cause finding with the correct `blastRadius` and no separate cascaded findings, in `tests/integration/api/determinism/comparison.test.ts` (depends on T025)
- [X] T030 [P] [US2] Integration test: POST two identical fixtures, assert `identical:true`, in `tests/integration/api/determinism/comparison.test.ts`
- [X] T031 [P] [US2] Integration test: multiple independent root causes are sorted by blast radius, descending, in `tests/integration/api/determinism/comparison.test.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement bottom-up `computeShapeKey` (sha256 over op kind + ordered input shape keys + ordinal) in `src/align/shapeKey.ts` per research.md §2 (depends on T007)
- [X] T033 [US2] Implement `alignArtifacts` producing `AlignedPair[]` with `shared`/`modified`/`added`/`removed` status (`moved` deferred to US3) in `src/align/shapeKey.ts` (depends on T032)
- [X] T034 [US2] Implement root-cause-vs-cascaded classification + blast-radius graph traversal in `src/detect/divergence.ts` (depends on T033)
- [X] T035 [US2] Implement Proven-tier rules (sort-then-compare for env/mounts/secretenv/extraHosts, cache-mount id, `TIMESTAMP_DRIFT`) in `src/detect/rules.ts` (depends on T009)
- [X] T036 [US2] Extend `buildDeterminismReport`'s comparison-mode path: merge Proven root-cause findings with Structural/Heuristic findings from either artifact (per spec.md Clarifications), sorted proven-by-blast-radius-desc then structural then heuristic, in `src/detect/divergence.ts` (depends on T034, T035, T020)
- [X] T037 [US2] Wire `app/api/determinism/route.ts`'s two-file branch to the comparison path and the `side`/`blastRadius` response fields from contracts/determinism.md (depends on T036)
- [X] T038 [US2] Extend `DeterminismUpload.tsx` with an optional second file, and `DeterminismPanel.tsx` to render blast radius + side badges in comparison mode (depends on T022, T023, T037)

**Checkpoint**: Two-artifact root-cause comparison works end to end

---

## Phase 5: User Story 3 - Understand structural changes separately from content changes (Priority: P2)

**Goal**: Added, removed, and reordered operations are shown as their own
distinct category, not folded into "content differs."

**Independent Test**: Compare two artifacts where one has an extra
operation inserted mid-graph, and confirm it's identified as added, not as
a pile of unrelated "modified" findings for everything after it.

### Tests for User Story 3

- [X] T039 [P] [US3] Extend fixtures with a pair differing by one operation inserted mid-graph, in `tests/fixtures/llbjson/`
- [X] T040 [P] [US3] Unit test: an inserted operation is classified `added`, without cascading false `modified` status onto everything after it, in `tests/unit/align/shapeKey.test.ts` (depends on T039)
- [X] T041 [P] [US3] Unit test: an operation present on both sides at a different sibling position (same content) is classified `moved`, not `modified`, in `tests/unit/align/shapeKey.test.ts`
- [X] T042 [P] [US3] Integration test: the comparison response distinguishes added/removed/moved operations from content-modified ones, in `tests/integration/api/determinism/comparison.test.ts` (depends on T039)

### Implementation for User Story 3

- [X] T043 [US3] Extend `alignArtifacts` in `src/align/shapeKey.ts` to detect `moved` (same shape key and content, different structural/sibling position) as distinct from `modified` (depends on T033)
- [X] T044 [US3] Surface added/removed/moved operations in the `DeterminismReport`/route response as a structural-changes list alongside `findings` (depends on T043, T036)
- [X] T045 [US3] Update `DeterminismPanel.tsx` with a distinct "structural changes" section, separate from the ranked findings list (depends on T044, T038)

**Checkpoint**: Structural layout changes are visible and distinct from content changes

---

## Phase 6: User Story 4 - Get a named cause and a fix, not just "differs" (Priority: P2)

**Goal**: Every root-cause finding either names its cause with a fix, or —
when no rule matches — is still shown as a finding with the raw field
diff, never silently dropped.

**Independent Test**: Compare two artifacts whose only difference is
unsorted environment variables, and confirm the finding names that exact
cause rather than a generic "content differs" message.

### Tests for User Story 4

- [X] T046 [P] [US4] Unit test: a root-cause field difference matching no known rule still produces a `Finding` with the raw field diff and no `causeCode`/`fix`, in `tests/unit/detect/divergence.test.ts`
- [X] T047 [P] [US4] Unit test: a root cause matching a known pattern (e.g. `UNSORTED_ENV`) always carries a `causeCode` and is never presented as a generic "content differs" message, in `tests/unit/detect/rules.test.ts`

### Implementation for User Story 4

- [X] T048 [US4] Implement the raw-field-diff fallback path in `src/detect/divergence.ts` for root causes matching no Pass 3 rule (depends on T034, T035)
- [X] T049 [US4] Update `DeterminismPanel.tsx` to visually distinguish a named finding (cause + fix) from a raw-diff-only fallback finding (depends on T048, T045)

**Checkpoint**: Every root cause is either explained or explicitly shown as an unmatched raw diff — no silent gaps

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation across all stories

- [X] T050 [P] Add a "Determinism Analysis" section to `README.md` documenting `/determinism`, the required LLB JSON input format (and that `.dot` is not accepted here), and linking to quickstart.md — mirrors 003's README precedent
- [X] T051 [P] Run quickstart.md validation end-to-end (`make build`, real `docker run`, `curl /api/determinism` against the running container, both single- and two-artifact modes)
- [X] T052 [P] Confirm `make lint`, `make test`, and `make build` all pass with every new module included

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion; its comparison-mode report-merging (T036) also depends on US1's single-artifact path (T020) already existing
- **User Story 3 (Phase 5)**: Depends on US2's alignment (T033) and comparison wiring (T036)
- **User Story 4 (Phase 6)**: Depends on US2's divergence/rules (T034, T035)
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independently testable after Foundational — the MVP
- **US2 (P1)**: Independently testable after Foundational; its comparison-mode report builder reuses US1's single-artifact report builder (T020) as a subroutine, so implement US1 first in practice even though both are P1
- **US3 (P2)**: Builds on US2's alignment module (adds the `moved` status); not independently implementable before US2
- **US4 (P2)**: Builds on US2's divergence/rules modules (adds the fallback path); not independently implementable before US2

### Within Each User Story

- Fixtures before tests that reference them
- Tests before implementation (write and confirm they fail first)
- Type/rule definitions before the modules that consume them
- Core computation modules (`align/`, `detect/`) before the route wiring that calls them
- Route wiring before the UI components that call the route
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- T001 and T002 (Setup) run in parallel
- T004, T008, T009 (Foundational, different files) run in parallel once their own dependencies are satisfied
- All fixture-creation and test tasks marked [P] within a story run in parallel (different test files)
- T022/T023 (UI component stubs) can be built in parallel with the story's backend tasks, then wired together in the final task of that story
- US3 and US4 can be worked on in parallel once US2's checkpoint is reached, since US3 extends `align/shapeKey.ts` and US4 extends `detect/divergence.ts` + `detect/rules.ts` — different files, though both touch `DeterminismPanel.tsx` in their final task, so those two specific tasks (T045, T049) should not run concurrently

---

## Parallel Example: User Story 1

```bash
# Launch all fixture + test tasks for User Story 1 together:
Task: "Create LLB JSON fixtures in tests/fixtures/llbjson/"
Task: "Unit tests for Structural rules in tests/unit/detect/rules.test.ts"
Task: "Unit tests for Heuristic pattern rules in tests/unit/detect/rules.test.ts"
Task: "Unit test: local:// ignore-list exclusion in tests/unit/detect/rules.test.ts"

# Launch the two UI component stubs together:
Task: "Implement components/DeterminismUpload.tsx"
Task: "Implement components/DeterminismPanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Upload a single LLB JSON artifact and confirm the determinism report
5. Deploy/demo if ready — this is the "front door" the feature description calls out as the lowest-friction entry point

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (root-cause comparison)
4. Add User Story 3 → Test independently → Deploy/Demo (structural layout diff)
5. Add User Story 4 → Test independently → Deploy/Demo (raw-diff fallback, closing the last gap)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. One developer completes US1 (needed as a subroutine for US2's comparison path)
3. Once US1's checkpoint is reached: a second developer starts US2
4. Once US2's checkpoint is reached: US3 and US4 can proceed in parallel (different core files; coordinate on the shared `DeterminismPanel.tsx` final task in each)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2, US3, and US4 are not fully independent of US1/US2 the way 003's user
  stories were — US2 reuses US1's report builder as a subroutine, and
  US3/US4 both extend modules US2 introduces. This is called out explicitly
  in the Dependencies section above rather than glossed over, since the
  feature's own design (shape-key alignment feeding the divergence
  frontier feeding the cause taxonomy) is inherently a pipeline, not four
  unrelated slices.
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, and skipping the Foundational phase

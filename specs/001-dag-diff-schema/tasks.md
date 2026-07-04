---

description: "Task list for DAG Artifact Schema & Adapters"
---

# Tasks: DAG Artifact Schema & Adapters

**Input**: Design documents from `/specs/001-dag-diff-schema/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/artifacts-upload.md, quickstart.md

**Tests**: Included. plan.md's Technical Context specifies Vitest for unit and
integration tests as part of this feature's technical approach.

**Organization**: Tasks are grouped by user story (from spec.md: US1, US2 —
both P1; US3 — P2) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths follow the single-Next.js-project structure from plan.md (`app/`, `src/`, `tests/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Next.js (App Router, TypeScript) project scaffold — `package.json`, `next.config.js` (with `output: 'standalone'`), `tsconfig.json` at repo root
- [ ] T002 [P] Add the DOT parser dependency (per research.md decision) and Vitest as devDependencies in `package.json`
- [ ] T003 [P] Configure ESLint + Prettier for the TypeScript/Next.js project
- [ ] T004 [P] Write the multi-stage `Dockerfile` (deps → build → `node:20-alpine` runner using the standalone output) per research.md
- [ ] T005 [P] Configure Vitest (`vitest.config.ts`) to discover `tests/unit/**` and `tests/integration/**`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Define the canonical `Artifact`/`Node`/`Edge` types (including `schemaVersion` and `metadata.command`) in `src/models/artifact.ts` per data-model.md
- [ ] T007 Implement DOT-text → intermediate AST parsing in `src/adapters/dot/parse.ts` using the library chosen in research.md
- [ ] T008 [P] Implement AST → canonical `Artifact` mapping (label → `metadata.command`) in `src/adapters/dot/adapt.ts` (depends on T006, T007)
- [ ] T009 Implement structural validation (parse-failure surfacing, dangling-edge detection) in `src/validation/artifact.ts` (depends on T006)
- [ ] T010 Scaffold the `POST /api/artifacts` route handler — read `left`/`right` from `Request.formData()`, check both fields are present — in `app/api/artifacts/route.ts` (depends on T006)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Upload two conforming DOT artifacts (Priority: P1) 🎯 MVP

**Goal**: Two valid `.dot` files uploaded to the endpoint are both accepted and
returned as canonical artifacts, with each node's DOT label preserved
verbatim in `metadata.command`.

**Independent Test**: POST two well-formed `.dot` fixtures to `/api/artifacts`
and confirm a 200 response matching the shape in
`contracts/artifacts-upload.md`.

### Tests for User Story 1

- [ ] T011 [P] [US1] Integration test: POST two valid `.dot` fixtures to `/api/artifacts`, assert 200 response matches the canonical shape, in `tests/integration/api/artifacts/happy-path.test.ts`
- [ ] T012 [P] [US1] Unit test: adapter preserves a structured/free-form label (e.g. `copy{src=..., dest=...}`) verbatim in `metadata.command`, in `tests/unit/adapters/dot/adapt.test.ts`

### Implementation for User Story 1

- [ ] T013 [US1] Wire the route handler to parse + adapt both `left` and `right` uploads and return the 200 JSON body per contracts/artifacts-upload.md, in `app/api/artifacts/route.ts` (depends on T007, T008, T010)
- [ ] T014 [P] [US1] Add small valid BuildKit-style `.dot` fixtures in `tests/fixtures/dot/valid-before.dot` and `tests/fixtures/dot/valid-after.dot`
- [ ] T015 [US1] Add a 20MB-per-file upload size guard in `app/api/artifacts/route.ts` (depends on T013)

**Checkpoint**: User Story 1 is fully functional and testable independently (MVP)

---

## Phase 4: User Story 2 - Reject structurally invalid DOT input (Priority: P1)

**Goal**: A `.dot` file that fails to parse, or whose edges reference an
undeclared node id, is rejected with a specific, actionable error; both
uploaded files are validated independently so one bad file doesn't mask
errors in the other.

**Independent Test**: Upload a malformed `.dot` file, and separately one with
a dangling edge reference, and confirm each produces a 400 response with the
correct error code from contracts/artifacts-upload.md.

### Tests for User Story 2

- [ ] T016 [P] [US2] Integration test: malformed DOT syntax → 400 with `DOT_PARSE_ERROR`, in `tests/integration/api/artifacts/invalid-dot.test.ts`
- [ ] T017 [P] [US2] Integration test: dangling edge reference → 400 with `DANGLING_EDGE_REFERENCE`, in `tests/integration/api/artifacts/dangling-edge.test.ts`
- [ ] T018 [P] [US2] Unit test: validation module reports independent errors when both sides are invalid (no fail-fast on the first), in `tests/unit/validation/artifact.test.ts`

### Implementation for User Story 2

- [ ] T019 [US2] Implement per-side validation and error-code assignment (`MISSING_FILE`, `UNSUPPORTED_FORMAT`, `DOT_PARSE_ERROR`, `DANGLING_EDGE_REFERENCE`) in `src/validation/artifact.ts` (depends on T009)
- [ ] T020 [US2] Wire validation failures into the route handler's 400 response shape (`{ errors: { left, right } }`) per contracts/artifacts-upload.md, in `app/api/artifacts/route.ts` (depends on T013, T019)
- [ ] T021 [P] [US2] Add malformed-syntax and dangling-edge `.dot` fixtures in `tests/fixtures/dot/invalid-syntax.dot` and `tests/fixtures/dot/dangling-edge.dot`

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Adapt the DOT file into the canonical schema (Priority: P2)

**Goal**: The DOT adapter is independently correct and swappable: it passes
through extra DOT node attributes as opaque metadata beyond `command`, falls
back to Graphviz's default label (the node id) when no explicit label is
given, and is fully unit-testable without a running server — demonstrating
the adapter boundary required by Constitution Principle I.

**Independent Test**: Run the adapter's unit tests directly against
`src/adapters/dot/adapt.ts` (no HTTP layer involved) and confirm both the
default-label fallback and opaque-metadata passthrough behave correctly.

### Tests for User Story 3

- [ ] T022 [P] [US3] Unit test: a node with no explicit `label` attribute defaults `metadata.command` to the node id, in `tests/unit/adapters/dot/adapt.test.ts`
- [ ] T023 [P] [US3] Unit test: extra DOT node attributes (e.g. `shape`) are preserved as additional opaque `metadata` keys without validation, in `tests/unit/adapters/dot/adapt.test.ts`

### Implementation for User Story 3

- [ ] T024 [US3] Extend `src/adapters/dot/adapt.ts` to pass through additional DOT node attributes (e.g. `shape`) into `metadata` beyond `command` (depends on T008)
- [ ] T025 [US3] Extend `src/adapters/dot/adapt.ts` with the default-label-to-id fallback per FR-008 (depends on T008)
- [ ] T026 [P] [US3] Add a short header comment in `src/adapters/dot/adapt.ts` documenting that no other module may import the DOT parser library directly, enforcing the Principle I adapter boundary

**Checkpoint**: All three user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T027 [P] Run the quickstart.md validation end-to-end (`docker build`, `docker run`, `curl` the endpoint with real fixtures)
- [ ] T028 [P] Add a root-level `README.md` documenting the Docker build/run steps and the `/api/artifacts` contract
- [ ] T029 Review `src/adapters/dot/` to confirm no DOT-specific types or parser-library imports have leaked into `src/models/`, `src/validation/`, or `app/api/`, per Principle I

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and can proceed in parallel once Foundational is done
  - US3 depends only on Foundational (specifically T008), not on US1/US2, though it is naturally sequenced after the MVP since it hardens the adapter that US1/US2 already exercise end-to-end
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — reuses the route handler skeleton from T010/T013 but adds its own validation wiring; independently testable via its own error-path fixtures
- **User Story 3 (P2)**: Can start after Foundational (Phase 2), specifically after T008 — independently testable via unit tests against the adapter alone, with no dependency on the route handler

### Within Each User Story

- Tests are written before implementation tasks in that story's phase and MUST fail first
- Models/types (Foundational) before adapters/validation
- Adapters/validation before route-handler wiring
- Story complete before moving to the next priority phase

### Parallel Opportunities

- T002, T003, T004, T005 (Setup) can all run in parallel
- T008 and T009 (Foundational) can run in parallel once T006/T007 are done
- Once Foundational completes, US1, US2, and US3 can all be staffed in parallel
- Within US1: T011, T012, T014 can run in parallel
- Within US2: T016, T017, T018, T021 can run in parallel
- Within US3: T022, T023, T026 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1's tests together:
Task: "Integration test: POST two valid .dot fixtures to /api/artifacts in tests/integration/api/artifacts/happy-path.test.ts"
Task: "Unit test: adapter preserves structured label verbatim in tests/unit/adapters/dot/adapt.test.ts"

# Add fixtures in parallel with the above:
Task: "Add valid .dot fixtures in tests/fixtures/dot/valid-before.dot and valid-after.dot"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run T011/T012, confirm the happy-path upload works end-to-end
5. Deploy/demo if ready (`docker build && docker run`, per quickstart.md)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → test independently → demo (MVP!)
3. Add User Story 2 → test independently → demo (robust rejection behavior)
4. Add User Story 3 → test independently → demo (adapter hardened/documented)
5. Polish (Phase 6)

### Parallel Team Strategy

With multiple developers, once Foundational is done:
- Developer A: User Story 1 (T011–T015)
- Developer B: User Story 2 (T016–T021)
- Developer C: User Story 3 (T022–T026)

Stories complete and integrate independently against the shared Foundational
types and route-handler skeleton.

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Per Principle I, only `src/adapters/dot/` may import DOT-parsing types; `src/models/`, `src/validation/`, and `app/api/` must stay format-agnostic

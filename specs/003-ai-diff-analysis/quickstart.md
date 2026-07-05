# Quickstart: AI Diff Analysis

## Prerequisites

- The app is running via `make dev` (or the built container), same as for
  001/002.
- A Claude API key is set in the container's environment as
  `ANTHROPIC_API_KEY`. Without it, the "Analyze with AI" control still
  appears, but requests will fail with the `502 ANALYSIS_FAILED` error
  (contracts/analyze.md) — this is expected, not a bug, when no key is
  configured.

## Manual verification flow

1. Open `/compare`, upload two `.dot` files as `left`/`right` (any pair
   used for 002 testing works).
2. Confirm the existing 3-panel comparison (left graph, right graph, diff
   summary) renders exactly as it did before this feature — this feature
   must not change that behavior at all (spec US2, SC-005).
3. Click "Analyze with AI".
   - Expect an immediate loading/pending state in the AI panel (spec US1
     Scenario 2, FR-004) — the rest of the page stays interactive.
   - Expect a narrative result to appear in a panel visually and
     structurally separate from the graphs/diff summary, clearly labeled
     as AI-generated (spec US2 Scenario 1, FR-005, FR-006).
   - Confirm the graphs and diff summary are byte-for-byte unchanged from
     step 2 (spec US2 Scenario 2, SC-005).
4. Click "Analyze with AI" again. Confirm a fresh request is made (not a
   cached result) and the panel shows the new request's loading/result
   state (spec Edge Cases).
5. Simulate a failure (e.g., temporarily unset `ANTHROPIC_API_KEY` and
   restart the container, or upload files while offline). Confirm the AI
   panel shows a specific, readable error with a retry option, and that
   the rest of the page (graphs, diff summary) remains fully functional
   (spec US3, FR-009).
6. Start a new comparison (upload a different pair of files). Confirm any
   previously shown AI analysis result/error is cleared before the new
   comparison's panels render (spec FR-011, Edge Cases).
7. With AI analysis never invoked (skip clicking the button entirely for
   a full comparison session), confirm via browser dev tools' Network tab
   that zero requests are made to any AI provider (spec FR-010, SC-004).

## Automated verification

- `make test` runs `tests/unit/analysis/claude.test.ts` (prompt-building,
  Anthropic client mocked) and `tests/integration/api/analyze/` (route
  behavior for validation-failure, analysis-failure, and success paths,
  all with the Anthropic client mocked — no real network call).
- `make typecheck` and `make lint` cover the new files the same as any
  other feature.

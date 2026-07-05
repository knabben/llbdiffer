# Phase 0 Research: AI Diff Analysis

## Claude API integration approach

**Decision**: Official `@anthropic-ai/sdk` Node/TypeScript package, called
directly from `app/api/analyze/route.ts` via `src/analysis/claude.ts` — a
single non-streaming `client.messages.create()` call, no MCP server, no
tool/function calling, no agentic loop. Model: `claude-opus-4-8`.

**Rationale**: The spec (FR-008a, clarified 2026-07-05) explicitly requires
a direct API call only. This also matches the simplest tier for the actual
task — "explain this diff in plain language" is a single classification/
summarization-style request (one request, one response), not a multi-step
or tool-using workflow, so reaching for MCP or an agent loop would be
unjustified complexity for what this feature does.

**Alternatives considered**:
- MCP server / tool use — explicitly ruled out by the spec; would also add
  an unnecessary indirection layer for a single-shot text completion.
- Streaming response — considered, since the skill's default guidance is to
  stream for large inputs/outputs. Rejected for this feature: the prompt
  size (a few hundred nodes' worth of commands) and expected output (a
  paragraph-scale narrative) are both well under the ~16K-token threshold
  where non-streaming risks SDK HTTP timeouts. Documented here so it isn't
  silently revisited — if diffs routinely exceed a few thousand nodes,
  switch to streaming rather than raising `max_tokens` indefinitely.
- Extended thinking (`thinking: {type: "adaptive"}`) — not used. This task
  is a direct, bounded summarization of already-structured data (the
  precomputed classification), not open-ended reasoning; thinking would add
  latency without a clear quality benefit. Can be revisited if narrative
  quality turns out to need it.

## Re-validating and re-classifying instead of extending `/api/compare`

**Decision**: `/api/analyze` accepts the same two `.dot` file uploads
`/api/compare` does (the frontend resubmits the `left`/`right` `File`
objects already held in `ComparePage` state), and internally reuses
`validateUploadedField` (`src/validation/artifact.ts`) and `classify`
(`src/compare/artifact.ts`) unchanged.

**Rationale**: `/api/compare`'s current response shape (`dot` strings,
`hashes` arrays, `summary`) doesn't carry structured per-node command text
— that's embedded inside the rendered DOT string, which would have to be
re-parsed to build a good prompt. Since the frontend already has the
original two files in memory from the initial upload, resubmitting them is
simpler than either re-parsing the rendered DOT or changing `/api/compare`'s
contract to carry redundant structured data every comparison already has
lying around. This also guarantees the AI is fed *exactly* the same
classification already rendered on screen — reusing `classify()` verbatim,
not a second implementation that could drift from it.

**Alternatives considered**:
- Extend `/api/compare`'s response with structured node data, and have
  `/api/analyze` accept that JSON instead of re-uploading files — rejected:
  changes a contract two other features (frontend rendering, diff summary)
  already depend on, for a payload the frontend would have to hold onto
  and resend anyway. Re-submitting the original files is no more work for
  the frontend (it already has them) and touches zero existing contracts.

## Prompt content and structure

**Decision**: The prompt is plain text (not JSON) built from the two
`Artifact` objects and their `Classification`: for each side, a list of
`id: command` lines; then a categorized list of added/removed/shared node
and edge references (the same data `buildDiffSummary` produces). A short
system prompt frames the task: explain the differences between two build
DAGs in plain language, given the classified node/edge lists.

**Rationale**: Claude doesn't need DOT syntax or graph-rendering
concerns — it needs the same information a human would read off the
rendered summary panel (which commands are unique to which side, which are
shared) in a compact textual form. Keeping the prompt plain text (not a
raw JSON dump) keeps token usage down and lets the system prompt focus
Claude on producing prose, not restating the input.

## Error handling and response shape

**Decision**: `/api/analyze` reuses the exact 400 validation-error shape
from `/api/compare` (`{errors: {left, right}}`) for file-validation
failures. A **new** error path — `502` with `{error: {code:
"ANALYSIS_FAILED", message}}` — covers failures from the Claude API call
itself (network error, provider error, timeout), distinct from a validation
failure, so the frontend can tell "your files were fine but the AI call
failed" from "your files were invalid."

**Rationale**: Spec FR-009 requires a specific, retry-able error for
analysis failures without disrupting the rest of the page; distinguishing
the error's origin (bad input vs. upstream provider issue) is necessary to
show the right message and to know whether retrying with the same input is
even sensible (it is, for a `502`; it isn't, for a `400`).

## Testing without a real network call

**Decision**: `src/analysis/claude.ts` takes an injected Anthropic client
(or a factory), so unit tests mock `messages.create` directly — no real API
key or network access is needed in the test suite, keeping `make test`
itself fully offline per Principle III.

**Rationale**: The constitution's Architecture Constraints require
pipeline modules to be unit-testable without exercising what they wrap;
for this feature that specifically means not calling the real Claude API
from `make test`, which would make the test suite flaky, slow, and
dependent on a real API key being present in CI.

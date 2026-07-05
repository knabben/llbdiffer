# Feature Specification: AI Diff Analysis

**Feature Branch**: `003-ai-diff-analysis`
**Created**: 2026-07-05
**Status**: Draft
**Input**: User description: "Add an AI analyze button, it must send all the layers and diff information (with commands and labels, boxes) to Claude API and the result must be present on the screen, probably a box explaining exactly the difference between the layers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request an AI explanation of the diff (Priority: P1)

After comparing two builds, an engineer clicks an "Analyze with AI" control and
receives a plain-language explanation of what changed and why it might
matter, without having to read raw node commands and labels themselves.

**Why this priority**: This is the entire point of the feature — a button
that does nothing, or that doesn't produce a useful explanation, delivers no
value.

**Independent Test**: Can be fully tested by completing a comparison,
clicking the analyze control, and confirming a narrative explanation appears
that references the actual differences in the loaded comparison.

**Acceptance Scenarios**:

1. **Given** a completed comparison with differences, **When** the user
   clicks "Analyze with AI," **Then** the full comparison (both artifacts'
   nodes with their commands/labels, and the shared/added/removed
   classification) is sent for analysis and a narrative result is displayed.
2. **Given** the analysis request is in flight, **When** the user is
   waiting, **Then** the screen shows a clear loading/pending state rather
   than appearing frozen or unresponsive.
3. **Given** a completed comparison with no differences, **When** the user
   clicks "Analyze with AI," **Then** the result reflects that the builds are
   equivalent rather than inventing differences.

---

### User Story 2 - See the AI's explanation clearly separated from the diff (Priority: P1)

The engineer can immediately tell that the AI's explanation is commentary
about the diff, not the diff itself — the deterministic comparison (graphs,
hash lists, diff summary) is never mixed with or altered by what the AI says.

**Why this priority**: This is a non-negotiable trust boundary for the tool
(per the project constitution): the diff is a verifiable computation, the
AI's read of it is not. Blending them would let unverified commentary
masquerade as ground truth.

**Independent Test**: Can be fully tested by requesting an analysis and
confirming it renders in a distinct, clearly labeled panel that is not part
of the graphs or diff summary, and that the graphs/summary are unchanged
before and after the request.

**Acceptance Scenarios**:

1. **Given** an AI analysis result is displayed, **When** the user views the
   screen, **Then** the result appears in its own panel, visually distinct
   from the diff graphs and diff summary panel, and labeled as AI-generated.
2. **Given** an AI analysis has been requested, **When** the user inspects
   the diff graphs and diff summary, **Then** their content is identical to
   what it was before the request — nothing from the AI response has been
   written into them.

---

### User Story 3 - Get a clear error when AI analysis fails (Priority: P2)

If the AI analysis request fails (network issue, provider error, missing
configuration), the engineer sees a specific, readable error in the AI
panel, while the rest of the page keeps working normally.

**Why this priority**: Important for trust and usability, but the tool's
core value (comparing and viewing two builds) does not depend on this
feature working.

**Independent Test**: Can be fully tested by forcing an analysis failure
(e.g., simulating a provider error) and confirming a specific error appears
in the AI panel without disrupting the graphs, hash lists, or diff summary.

**Acceptance Scenarios**:

1. **Given** the AI analysis request fails for any reason, **When** the
   failure occurs, **Then** the AI panel shows a specific, readable error
   message and an option to retry, while the rest of the page remains fully
   functional.

---

### Edge Cases

- What happens if the user clicks "Analyze with AI" multiple times in a row?
  Each click is treated as a new, independent request; the panel shows the
  most recent request's state (loading, result, or error) rather than
  queuing or blending multiple results.
- What happens if the user starts a new comparison while an AI analysis
  panel from a previous comparison is showing? The AI panel MUST be cleared
  (or clearly marked stale) so it can never be mistaken for an explanation
  of the new comparison.
- What happens if AI analysis is never invoked? Nothing changes about the
  rest of the tool's behavior — no automatic or background call to the AI
  provider ever occurs (see Assumptions).
- What happens if the comparison is very large (many nodes)? The analysis
  request MUST still be sent and handled; response time may be longer, but
  the loading state (Story 1, Scenario 2) keeps the user informed rather
  than the UI appearing stuck.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a control (e.g. a button) to request an
  AI-generated analysis, available once a comparison result exists.
- **FR-002**: The AI analysis request MUST only be sent when the user
  explicitly invokes the control — it MUST NOT be triggered automatically
  when a comparison completes or at any other time.
- **FR-003**: Upon request, system MUST send the full comparison data for
  analysis: both artifacts' nodes (id, label/command text, and other
  available metadata such as shape) and edges, plus the precomputed
  shared/added/removed classification already computed for the diff.
- **FR-004**: System MUST display a loading/pending state while the
  analysis request is in flight.
- **FR-005**: System MUST display the AI's narrative result in a panel that
  is visually and structurally distinct from the diff graphs and the diff
  summary panel.
- **FR-006**: The AI analysis panel MUST be clearly labeled as AI-generated
  / advisory content, not verified fact.
- **FR-007**: System MUST NOT write the AI's output into, or otherwise merge
  it with, the diff/classification data — the diff graphs and diff summary
  MUST remain byte-for-byte the same regardless of whether AI analysis was
  requested or what it returned.
- **FR-008**: System MUST perform the call to the AI provider from the
  backend, not directly from the browser, so that provider credentials are
  never exposed to the client.
- **FR-009**: System MUST display a specific, readable error in the AI
  panel if the analysis request fails, with an option to retry, without
  disrupting the rest of the page.
- **FR-010**: When AI analysis is never invoked, system MUST make zero
  outbound network calls to the AI provider — this feature MUST remain the
  one narrow, explicit exception to the tool otherwise requiring no network
  access.
- **FR-011**: Starting a new comparison MUST clear any previously displayed
  AI analysis result, so it can never be mistaken for an explanation of the
  new comparison.

### Key Entities

- **Analysis Request**: The payload sent for AI analysis — both artifacts'
  nodes (id, label/command, other metadata) and edges, plus the
  shared/added/removed classification already computed for the current
  comparison. Derived entirely from data already produced by the comparison
  step; nothing new is computed for this request.
- **Analysis Result**: The AI provider's narrative response, displayed
  as-is in the advisory panel. Not merged into, and not a substitute for,
  the Comparison Result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can request an AI explanation of a completed comparison
  with a single click.
- **SC-002**: 100% of AI analysis results are displayed in a panel visually
  distinct from the diff graphs and diff summary, labeled as AI-generated.
- **SC-003**: 100% of AI analysis failures produce a specific, readable
  error with a retry option, without disrupting the rest of the page.
- **SC-004**: With AI analysis never invoked, the tool makes zero outbound
  network requests to the AI provider (verifiable by inspecting network
  activity during normal use of the comparison feature).
- **SC-005**: After requesting an AI analysis, the diff graphs and diff
  summary panel are unchanged from immediately before the request.

## Assumptions

- The AI provider credentials (e.g. an API key) are configured server-side
  by whoever deploys this self-hosted tool (e.g. via an environment
  variable), not entered by the end user in the browser.
- Each click on the analyze control sends a fresh request; results are not
  cached or reused across requests, and there is no artificial limit on how
  many times a user may request analysis for the same comparison.
- "Layers" in the user's request refers to the DAG nodes (build steps/ops)
  already modeled by the comparison feature — the same nodes shown in the
  graph panels and node-hash lists, not a new concept.
- This feature is additive to the existing comparison feature
  (002-diff-viewer) and does not change how comparisons are computed or
  rendered; it only adds an opt-in analysis step on top of an existing
  Comparison Result.
- No conversation history or follow-up questions are in scope — each
  analysis is a single request/response about one comparison, not a chat.

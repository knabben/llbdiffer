# Feature Specification: Side-by-Side Diff Viewer

**Feature Branch**: `002-diff-viewer`
**Created**: 2026-07-04
**Status**: Draft
**Input**: User description: "The frontend to upload both files that can be parsed by the API. The component must be able to receive multiple files, read them, and send them to the endpoint; the diff output is received, also in DOT format, highlighting what is different, and the screen must be able to render it. When uploaded, the files must be presented as images in different parts of the screen on each side, and the difference between them highlighted; each panel must contain the list of hashes of each image and be VERY clear about the difference between them. The main goal is to show what conflicts between two builds and what is similar — the tool must allow this presentation flawlessly."

## Clarifications

### Session 2026-07-04

- Q: Should the UI include a dedicated summary/list panel enumerating
  differences (e.g. "3 nodes added, 2 removed", listing which ones) in
  addition to the two highlighted graph panels, or is inline highlighting
  within the two graph panels enough? → A: Add a dedicated diff-summary
  panel. The dashboard has three panels/splits: the left graph, the right
  graph, and a summary panel that lists every added, removed, and shared
  node/edge as text, not just colored in the graphs. The summary panel may
  organize its added/removed/shared lists using tabs or sections; the exact
  UI pattern is a presentation-layer choice for planning, not a spec-level
  requirement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload two builds for comparison (Priority: P1)

An engineer selects two BuildKit LLB `.dot` files representing two build
artifacts and submits them to be compared.

**Why this priority**: This is the entry point; nothing else in the feature
can happen until two artifacts are successfully submitted together.

**Independent Test**: Can be fully tested by selecting two valid `.dot`
files and confirming both are read and sent together as a single comparison
request.

**Acceptance Scenarios**:

1. **Given** two valid `.dot` files are selected, **When** the user submits
   them, **Then** both files are read and sent together as a single
   comparison request.
2. **Given** fewer than two files are selected, **When** the user attempts
   to submit, **Then** submission is blocked until exactly two files are
   present.

---

### User Story 2 - View both builds side-by-side with their node hashes (Priority: P1)

After submitting, the engineer sees a multi-panel dashboard: the left panel
renders the first build's graph, the right panel renders the second
build's graph, and each of those two panels lists the node hashes belonging
to that build.

**Why this priority**: This is the baseline visual comparison the tool
exists to provide — seeing both builds at once, side by side, is the
foundation everything else (highlighting, conflict detection, the diff
summary) builds on.

**Independent Test**: Can be fully tested by submitting two valid files and
confirming two panels render — left showing the first artifact's graph and
hash list, right showing the second's.

**Acceptance Scenarios**:

1. **Given** a successful comparison, **When** the result is returned,
   **Then** the left panel renders the first artifact's graph and the right
   panel renders the second artifact's graph.
2. **Given** a rendered panel, **When** the user views it, **Then** the
   full list of that artifact's node hashes is visible in that panel.

---

### User Story 3 - See conflicts and similarities clearly highlighted (Priority: P1)

The engineer can immediately tell, without extra effort, which parts of the
two builds are shared and which are unique to one side — this is the main
goal of the tool: showing what conflicts between two builds and what is
similar, presented flawlessly.

**Why this priority**: A side-by-side view without this would not deliver
the tool's actual purpose. This is the core value proposition, not a
polish item.

**Independent Test**: Can be fully tested by submitting two files with both
known differences and known shared elements, and confirming shared
elements are styled identically and recognizably in both panels, elements
unique to one side stand out distinctly, and a third summary panel lists
every added/removed/shared node and edge as text.

**Acceptance Scenarios**:

1. **Given** a node or edge present in both artifacts, **When** both panels
   render, **Then** that node/edge is styled identically and recognizably
   as shared in both panels.
2. **Given** a node or edge present in only one artifact, **When** that
   panel renders, **Then** it is styled distinctly from shared elements so
   it stands out as a conflict/unique element at a glance.
3. **Given** two identical artifacts are submitted, **When** the result
   renders, **Then** both panels show every element as shared and the user
   is clearly told there are no differences.
4. **Given** a successful comparison, **When** the dashboard renders,
   **Then** a summary panel (separate from the two graph panels) lists
   every added, removed, and shared node/edge as text, not only as graph
   coloring.

---

### User Story 4 - Get a clear error when a submission can't be compared (Priority: P2)

If one of the uploaded files is invalid, the engineer gets a specific,
readable explanation instead of a broken or blank result.

**Why this priority**: Important for trust and usability, but the tool
still delivers its core value (Stories 1–3) without polished error
handling.

**Independent Test**: Can be fully tested by submitting one malformed file
and confirming a specific error names which file failed and why, rather
than a blank or crashed screen.

**Acceptance Scenarios**:

1. **Given** one submitted file is invalid or structurally broken, **When**
   the user submits, **Then** a specific, readable error identifies which
   file failed and why.
2. **Given** an unexpected server or network failure occurs, **When** this
   happens, **Then** the user sees a generic, retry-able error rather than
   an unhandled crash.

---

### Edge Cases

- What happens when the same file is selected for both sides? The
  comparison is valid and expected to show every element as shared, with
  the "no differences" state clearly communicated (Story 3, Scenario 3).
- What happens when more than two files are selected? Additional files are
  rejected or prevented before submission; exactly two are accepted.
- What happens with a very large graph? Both panels MUST remain readable
  and responsive rather than becoming unusable; the specific interaction
  mechanism (e.g., pan/zoom/scroll) is a technical decision for planning.
- What happens when one file is valid and the other is invalid? The error
  for the invalid side MUST clearly identify which side failed without
  blocking clarity about which one it was (Story 4).
- Is there a "partially similar" node state? No — node identifiers in this
  system are content-addressed digests, so an identical id always means
  identical content (see Assumptions). Only "shared" and "unique to one
  side" states exist; there is no partial/fuzzy similarity to represent.
- What does the summary panel show when there are no differences? It MUST
  clearly state that everything is shared (no added/removed entries),
  consistent with the "no differences" messaging in Story 3, Scenario 3 —
  not an empty-looking or missing list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a user select exactly two DAG artifact files
  (BuildKit LLB `.dot` files) before a comparison can be submitted.
- **FR-002**: System MUST prevent submission unless exactly two files are
  selected.
- **FR-003**: Upon submission, system MUST read both selected files and
  submit them together as a single comparison request.
- **FR-004**: System MUST compute the comparison between the two submitted
  artifacts as a precomputed step, before any rendering occurs, classifying
  each node and edge in each artifact as either shared (present in both
  artifacts) or unique to that side (present only in that one artifact).
- **FR-005**: System MUST render the two artifacts side-by-side, one panel
  per artifact, each panel visually presenting that artifact's graph, as
  part of a multi-panel dashboard layout (see FR-013 for the third panel).
- **FR-006**: Each of the two graph panels MUST display the list of node
  hashes (identifiers) belonging to that artifact.
- **FR-007**: Each panel MUST visually distinguish its shared elements
  (present in both artifacts) from its unique elements (present only in
  that artifact), clearly enough to be understood at a glance without a
  separate legend or explanation.
- **FR-008**: When the two submitted artifacts are identical, system MUST
  clearly communicate that no differences were found, in addition to the
  normal shared-element styling.
- **FR-009**: System MUST display a specific, actionable error identifying
  which uploaded file is invalid and why, when validation fails for one or
  both files.
- **FR-010**: System MUST display a generic, retry-able error when the
  comparison fails for reasons other than file validation (e.g.,
  network/server error).
- **FR-011**: System MUST NOT independently determine, on the client,
  which elements are shared versus unique; it MUST reflect exactly the
  classification already computed and returned by the comparison step.
- **FR-012**: The side-by-side presentation MUST remain clear and usable
  for artifacts of realistic size (see Success Criteria) — panel content
  MUST NOT become unreadable, mislabeled, or misleading as node count
  grows within that range.
- **FR-013**: System MUST provide a third, dedicated summary panel,
  separate from the two graph panels, that lists every added, removed, and
  shared node and edge as text — the dashboard MUST have at least these
  three panels/splits, not just the two graph panels with inline
  highlighting.
- **FR-014**: The summary panel's added/removed/shared lists MUST each be
  individually identifiable (e.g., grouped or labeled by category) so a
  user can tell which list a given entry belongs to without ambiguity.

### Key Entities

- **Comparison Request**: The pairing of exactly two user-selected artifact
  files submitted together to be compared.
- **Comparison Result**: The precomputed outcome of comparing two
  artifacts; for each artifact, identifies which of its nodes and edges are
  shared with the other artifact versus unique to it, plus enough
  information to render each artifact visually.
- **Panel**: The on-screen presentation of one artifact — its rendered
  graph and its list of node hashes — styled according to the Comparison
  Result's shared/unique classification.
- **Diff Summary**: The third dashboard panel; a textual, categorized
  listing of every added, removed, and shared node/edge drawn from the same
  Comparison Result the two graph panels render, so the list and the graph
  highlighting can never disagree.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select two files and see both builds rendered
  side-by-side without needing to read or understand raw DOT syntax.
- **SC-002**: Users can correctly identify which parts of the two builds
  are shared and which are unique to one side within a few seconds, without
  needing a legend explained to them beforehand.
- **SC-003**: 100% of comparisons between two identical artifacts are
  reported as having no differences, rather than an ambiguous or
  empty-looking result.
- **SC-004**: 100% of invalid file submissions produce a specific,
  readable error identifying the problem, rather than a blank screen or
  unhandled crash.
- **SC-005**: Side-by-side comparisons of artifacts with up to a few
  hundred nodes each remain clearly readable and responsive, with no
  broken or missing panel content.
- **SC-006**: A user can find a complete, categorized list of every
  difference in the summary panel without needing to visually scan either
  graph for colored elements.

## Assumptions

- Node identity is the graph vertex id alone, not its label. Two nodes
  with the same id are the same node and are classified as shared even if
  their label text differs — e.g. a `docker-image://` source op can
  legitimately keep the same LLB vertex id across two builds while its
  label shows a different resolved digest (a floating tag resolved at
  different times). There is no "modified in place" three-way state —
  only "shared" (matching id, present in both) or "unique to one side."
  (An earlier draft of this assumption additionally compared label text and
  treated a same-id/different-label pair as unique; that was reverted after
  testing showed it produced false "different" results for exactly this
  kind of legitimate same-id case.)
- "Multiple files" in the upload component refers to exactly the two files
  being compared, not an arbitrary batch of N files.
- The shared/unique classification is computed once, server-side, as a
  precomputed comparison result; the frontend panels render that result
  and do not compute or adjust the classification themselves.
- Client-side validation is limited to file count and basic presence; all
  format and structural validation (e.g., malformed DOT, dangling edges) is
  performed server-side, and the frontend surfaces whatever error is
  reported.
- No comparison state is persisted between sessions or page reloads; each
  comparison is a fresh, one-shot submission.
- "Flawless" presentation is treated as: no broken or missing panel
  content, no ambiguous styling, and correct behavior across the edge cases
  above — rather than a specific numeric polish metric.
- This feature spans both the backend comparison step (producing the
  shared/unique classification and DOT-format rendering data) and the
  frontend panels, delivered together as one user-facing capability,
  consistent with how the prior ingestion feature was scoped end-to-end.

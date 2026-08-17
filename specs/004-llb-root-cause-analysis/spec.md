# Feature Specification: LLB Root Cause Analysis

**Feature Branch**: `004-llb-root-cause-analysis`
**Created**: 2026-08-17
**Status**: Draft
**Input**: User description: "Root-cause determinism analysis for LLB JSON artifacts: structural alignment via shape keys, divergence frontier with blast radius, field-diff cause taxonomy, and single-artifact structural findings mode."

## Clarifications

### Session 2026-08-17

- Q: Where should this analysis live in the product — its own page, or
  folded into the existing two-artifact compare page? → A: A new, separate
  page/entry point. The existing DOT-based compare page (001/002/003) is
  untouched; this feature's single-artifact upload is the default landing
  experience, with two-artifact comparison as the deeper mode.
- Q: In a two-artifact comparison, are Structural/Heuristic findings shown
  alongside Proven root causes, or exclusive to the single-artifact report?
  → A: Shown in both modes. A two-artifact comparison surfaces Proven root
  causes plus any Structural/Heuristic findings detectable in either
  artifact, even ones identical on both sides (e.g., an unpinned base image
  used unchanged in both builds is still flagged).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get a determinism report from a single build (Priority: P1)

An engineer who only has one build's LLB dump on hand (no "before" to compare
against) uploads it and receives a report of guaranteed-bad or suspicious
build constructs found in that single artifact — no second build required.

**Why this priority**: This is the lowest-friction entry point into the
product. Most engineers investigating a flaky or slow build have exactly one
artifact in hand, not two; if the tool only works with pairs, most visits
produce nothing useful.

**Independent Test**: Can be fully tested by uploading a single LLB JSON
artifact and confirming a report is returned listing any guaranteed-bad
constructs (e.g., an operation marked to always bypass cache, an unpinned
base image) and advisory pattern-based observations, each clearly labeled
with how certain the system is about it.

**Acceptance Scenarios**:

1. **Given** a single valid LLB JSON artifact containing at least one
   guaranteed-bad construct, **When** the engineer uploads it, **Then** the
   report lists that construct with a named cause and a suggested fix.
2. **Given** a single valid LLB JSON artifact with no guaranteed-bad
   constructs and no suspicious patterns, **When** the engineer uploads it,
   **Then** the report clearly states nothing was found rather than showing
   an empty or ambiguous screen.
3. **Given** a single artifact, **When** the report is generated, **Then**
   no finding requiring a second artifact to prove (e.g., "these two builds
   differ here") appears in it.

---

### User Story 2 - See the real cause of cache misses, not a wall of red (Priority: P1)

An engineer compares two builds ("before" and "after") that should have
produced identical results but didn't, and instead of a graph where every
downstream operation appears as an unrelated difference, receives a small,
ranked list of the actual root causes — each showing how many downstream
operations it invalidated.

**Why this priority**: This is the core value proposition. Existing
comparison tools that match operations by their content-derived identifier
make one changed operation look like dozens of unrelated changes, because
every operation downstream of it gets a new identifier too. Without
collapsing that cascade, the tool tells the engineer nothing they didn't
already know from watching the build fail to hit cache.

**Independent Test**: Can be fully tested by comparing two LLB JSON
artifacts that differ because of one upstream change (e.g., an
unsorted environment variable) affecting many downstream operations, and
confirming the report surfaces one root-cause finding with the correct
downstream count, rather than one finding per affected operation.

**Acceptance Scenarios**:

1. **Given** two artifacts where a single upstream operation's content
   differs and that difference cascades to N downstream operations, **When**
   the comparison runs, **Then** the report shows one root-cause finding
   whose reported downstream count is N, and does not list the N cascaded
   operations as separate, unexplained findings.
2. **Given** two artifacts with multiple independent root causes, **When**
   the comparison runs, **Then** the findings are ordered by how many
   downstream operations each one invalidates, largest first.
3. **Given** two identical artifacts, **When** the comparison runs, **Then**
   the report states the builds are equivalent.

---

### User Story 3 - Understand structural changes separately from content changes (Priority: P2)

An engineer comparing two builds where operations were added, removed, or
reordered (not just changed in content) can see that distinction clearly,
instead of the tool only being able to say "these two sets of operations
differ."

**Why this priority**: Reordering or inserting a build step is a materially
different situation from a step's content silently changing, and engineers
need to know which one happened to know where to look.

**Independent Test**: Can be fully tested by comparing two artifacts where
one has an extra operation inserted mid-graph, and confirming the report
identifies it as an added operation (not as an unrelated pile of "modified"
findings for everything after it).

**Acceptance Scenarios**:

1. **Given** two artifacts where the second has one additional operation not
   present in the first, **When** compared, **Then** the report identifies
   that operation as added.
2. **Given** two artifacts where an operation present in both changed its
   position among its siblings but not its content, **When** compared,
   **Then** the report identifies it as moved/reordered, not as a content
   change.

---

### User Story 4 - Get a named cause and a fix, not just "differs" (Priority: P2)

For each root cause the tool identifies, the engineer sees a specific,
named explanation (e.g., "environment variables are in a different order but
contain the same entries") and a concrete suggested fix, instead of a raw
field-level diff they have to interpret themselves.

**Why this priority**: A tool that says two fields differ without saying why
still leaves the engineer to do the diagnostic work by hand. Naming the
pattern (and offering the one-line fix, where one exists) is what turns a
diff into an explanation.

**Independent Test**: Can be fully tested by comparing two artifacts whose
only difference is that one exec operation's environment variables are the
same set in a different order, and confirming the finding is labeled with
that specific cause and fix rather than a generic "content differs" message.

**Acceptance Scenarios**:

1. **Given** two artifacts differing only in the order of an operation's
   environment variables (same entries, different sequence), **When**
   compared, **Then** the finding names this specific cause and is not
   presented as an ordinary content change.
2. **Given** a root-cause finding the system cannot match to any known
   pattern, **When** displayed, **Then** it still appears as a finding
   (with the raw field difference) but without a named cause or fix.

---

### Edge Cases

- What happens when an uploaded file is not a valid LLB JSON artifact (e.g.,
  malformed JSON, or a recognizable-but-different file format)? The system
  must reject it with a clear, actionable message rather than a generic
  parse failure.
- What happens when two artifacts are so different (e.g., unrelated builds)
  that almost nothing aligns between them? The report should still show
  whatever added/removed operations it can identify, without pretending to
  find root causes that don't exist.
- What happens when a source operation carries an attribute that is
  expected to change on every single build by design (e.g., a local
  build-context session identifier)? It must never be reported as a
  finding.
- What happens when a root-cause operation's downstream count is zero (a
  leaf operation)? It must still appear as a finding, just with a blast
  radius of zero, sorted after every root cause with a nonzero blast
  radius.
- What happens when the two uploaded artifacts have no operations in common
  at all? The report should say so plainly rather than surfacing a
  misleading "0 root causes found."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an engineer to upload a single LLB JSON
  artifact and receive a determinism report, without requiring a second
  artifact.
- **FR-002**: System MUST allow an engineer to upload two LLB JSON
  artifacts ("before" and "after") and receive a comparison report.
- **FR-003**: For a two-artifact comparison, system MUST align operations
  between the two artifacts by their structural position in the build graph
  (kind of operation, shape of its inputs, and sibling order), not by a
  content-derived identifier, so that one changed operation does not make
  every operation downstream of it appear as an unrelated difference.
- **FR-004**: System MUST classify every operation in a two-artifact
  comparison into exactly one of: unchanged, content-modified, added,
  removed, or moved/reordered.
- **FR-005**: System MUST further classify every content-modified operation
  as either a root cause (all of its inputs are identical across both
  artifacts) or cascaded (its difference originates from an already-changed
  input).
- **FR-006**: System MUST calculate, for each root-cause finding, the
  number of downstream operations it invalidates ("blast radius"), and
  MUST present root-cause findings ordered by blast radius, largest first.
- **FR-007**: System MUST NOT present cascaded differences as independent,
  unexplained findings; they are attributed to their root cause instead.
- **FR-008**: System MUST detect, for an exec operation, when its
  environment variables, mount list, secret-environment entries, or
  extra-hosts entries contain the same set of entries on both sides in a
  different order, and MUST label this a distinct cause, separate from an
  actual content change.
- **FR-009**: System MUST detect and name at least the following
  single-artifact, guaranteed-bad constructs, wherever present: an
  operation marked to unconditionally bypass cache; a file copy using
  "current time" as its timestamp; a source reference to a mutable image
  tag with no fixed digest; a network or security setting that disables
  build isolation; and a remote source with no integrity or version pin.
  Each MUST include a named cause and a suggested fix.
- **FR-010**: System MUST detect string-pattern-based indicators of
  non-determinism (e.g., embedded date/time-like values, generated unique
  identifiers, machine-specific absolute file paths) and present these as
  advisory-only findings.
- **FR-011**: Every finding MUST be labeled with one of three confidence
  levels — Proven (established by comparing two artifacts), Structural
  (a guaranteed-bad construct detected from one artifact), or Heuristic (an
  advisory pattern match) — so the engineer can tell a verified difference
  from a guess.
- **FR-012**: System MUST exclude from comparison any source attribute
  documented to legitimately change on every build by design (e.g., a local
  build-context session identifier), so these never appear as findings.
- **FR-013**: System MUST accept the standard LLB JSON dump format (the
  default JSON output of the build tool's debug dump command) as its only
  supported input format; DOT-format artifacts are not accepted by this
  feature.
- **FR-014**: When an uploaded file cannot be parsed as a valid LLB JSON
  artifact, system MUST reject it with a clear, actionable error message
  identifying the problem.
- **FR-015**: When two compared artifacts have no divergence at all, system
  MUST report that the builds are equivalent.
- **FR-016**: This analysis capability MUST be reachable as its own,
  separate entry point in the product (not folded into the existing
  DOT-based two-artifact compare page), with the single-artifact
  determinism report as the default landing experience and two-artifact
  comparison as the deeper mode.
- **FR-017**: In a two-artifact comparison, system MUST also surface any
  Structural- or Heuristic-tier findings detectable in either artifact
  alongside the Proven root-cause findings — including a guaranteed-bad
  construct present identically in both artifacts.

### Key Entities

- **Operation**: A single step in a build graph (e.g., an execution step, a
  source fetch, a file action, a build/merge/diff step). Has an ordered
  list of inputs, a set of kind-specific fields, and metadata including
  whether it unconditionally bypasses cache.
- **Shape Key**: A structural fingerprint of an operation — derived from
  its kind and the shape of its inputs, deliberately excluding its content
  — used to align equivalent operations across two artifacts even when
  their content differs.
- **Aligned Pair**: Two operations, one from each artifact, sharing the
  same shape key and structural position.
- **Root Cause**: An aligned pair whose content differs while every one of
  its inputs is identical across both artifacts — the first point where a
  difference was introduced.
- **Cascaded Difference**: A content difference in an aligned pair that
  originates solely from one of its already-changed inputs.
- **Blast Radius**: The count of downstream operations invalidated by a
  given root cause.
- **Finding**: A single reported item combining a confidence level, an
  affected operation (or pair), a named cause where recognized, and a
  suggested fix where one exists.
- **Determinism Report**: The set of Structural- and Heuristic-tier
  findings produced from a single uploaded artifact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An engineer can get a determinism report from a single build
  artifact, with no second build required, in under 15 seconds from upload.
- **SC-002**: When one root cause invalidates many downstream operations,
  the report surfaces it as a single ranked finding rather than as one
  finding per invalidated operation — collapsing, for example, 46 cascaded
  differences down to the 1 finding that caused them.
- **SC-003**: In comparisons with at least one real difference, at least
  90% of the time the report includes at least one finding with a named
  cause and suggested fix, not just a generic "content differs" statement.
- **SC-004**: Every finding an engineer sees visibly states its confidence
  level, so a survey of users correctly distinguishes a proven difference
  from an advisory guess without consulting documentation, 100% of the
  time.
- **SC-005**: When the same build is run twice and both resulting artifacts
  are compared, the report's top-ranked finding identifies the actual
  source of nondeterminism (e.g., unsorted environment variables, a
  floating timestamp) at least 90% of the time in validation testing.

## Assumptions

- Input artifacts are the standard JSON dump produced by the build tool's
  debug/dump command (one record per operation, each carrying the
  operation's fields, its digest, and its metadata). DOT-format uploads are
  out of scope for this feature by explicit product direction — no
  degraded or partial-fidelity DOT mode is built; DOT support, if needed
  elsewhere in the product, is unaffected by this feature.
- Uploaded artifacts are processed transiently for the duration of a single
  analysis request; nothing is persisted between sessions, consistent with
  the product's existing self-contained, stateless deployment model.
- Typical build graphs are on the order of a few hundred operations; this
  feature is not required to scale to build graphs with tens of thousands
  of operations.
- The list of source attributes excluded as "expected to vary every build"
  (e.g., local build-context session identifiers) is a fixed, maintained
  list rather than something engineers configure per project.
- No execution-time or resource-cost data is available in the input
  format, so blast radius is measured strictly as a count of downstream
  operations, not weighted by cost or duration.

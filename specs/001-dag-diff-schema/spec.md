# Feature Specification: DAG Artifact Schema & Adapters

**Feature Branch**: `001-dag-diff-schema`
**Created**: 2026-07-04
**Status**: Draft
**Input**: User description: "The tool MUST accept two JSON files as input, each describing a DAG: a list of nodes (id, label, metadata object of arbitrary key/value pairs) and a list of edges (source id, target id). The tool MUST treat the metadata object per node as opaque and extensible beyond one required exception: each node's metadata MUST carry the verbatim build instruction or command string that produced it... The tool MUST also require a top-level, artifact-level builderVersion or equivalent field identifying the toolchain that produced the artifact... If an input file does not already match this shape, an adapter MUST transform it before the diff engine runs, and MUST populate both required fields above even if the source format doesn't name them the same way. Adapters MAY be format-specific; the diff engine and visualizer MUST NOT contain format-specific logic."

## Clarifications

### Session 2026-07-04

- Q: What is the actual source file format for an artifact? → A: BuildKit's LLB debug output in DOT (Graphviz `digraph`) format, not JSON. The DOT graph's node labels double as the human-readable identifier and, for operation nodes, the executed instruction text.
- Q: Does the required command field apply to every node, including source refs (e.g. `docker-image://...`, `local://context`) and the terminal output node (whose label is just its own digest)? → A: Yes, uniformly. The adapter copies each node's DOT label verbatim into the command field regardless of node kind; there is no per-node-kind special-casing in the schema or adapter contract.
- Q: (Superseded below) Where does the required builder version come from? → A: Initially explored sourcing it from a companion BuildKit build-provenance metadata JSON file (a `buildx` attestation), uploaded alongside the `.dot` file in a zip/tar.gz archive, using `buildx.build.provenance.builder.id` as the value.
- Q: Should the metadata archive and builderVersion requirement be kept? → A: No — simplified. Input is just the `.dot` file; there is no archive, no companion metadata file, and no artifact-level builder-version field or mismatch detection in this feature. The metadata/builderVersion exploration above is retained for history but does not apply to the current scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload two conforming DOT artifacts (Priority: P1)

An engineer has two BuildKit LLB `.dot` files describing the DAGs they want
to compare. They upload both files so the tool can adapt and accept them for
comparison.

**Why this priority**: This is the baseline ingestion path. Nothing else in the
tool — diffing, rendering, or LLM analysis — can happen until two artifacts are
successfully accepted as input.

**Independent Test**: Can be fully tested by uploading two well-formed `.dot`
files and confirming both are accepted with no data loss or reshaping errors.

**Acceptance Scenarios**:

1. **Given** two valid `.dot` files each describing a DAG, **When** the user
   uploads both files, **Then** the tool accepts both artifacts and reports
   them ready for comparison.
2. **Given** a valid artifact where a node's DOT label contains structured or
   free-form content beyond a simple command (e.g. `copy{src=..., dest=...}`),
   **When** the artifact is loaded, **Then** that label is preserved verbatim
   in the command field without alteration or validation of its internal
   structure.

---

### User Story 2 - Reject structurally invalid DOT input (Priority: P1)

An engineer uploads a `.dot` file that fails to parse as valid Graphviz
syntax, or whose edges reference a node id that isn't declared anywhere in
the file. The tool must catch this before any comparison is attempted,
rather than silently producing a diff over broken data.

**Why this priority**: Accepting a structurally broken artifact would let the
tool attempt to diff or render data it can't actually make sense of,
producing confusing or incorrect results downstream.

**Independent Test**: Can be fully tested by uploading a `.dot` file with
invalid Graphviz syntax, and separately one with a dangling edge reference,
and confirming both are rejected with a specific, actionable error.

**Acceptance Scenarios**:

1. **Given** a `.dot` file that fails to parse as valid Graphviz syntax,
   **When** the user uploads it, **Then** the tool rejects it and reports a
   parse error.
2. **Given** a `.dot` file whose edges reference a node id not present
   anywhere in that file's node declarations, **When** the user uploads it,
   **Then** the tool rejects it and reports the dangling reference.

---

### User Story 3 - Adapt the DOT file into the canonical schema (Priority: P2)

An engineer uploads a BuildKit LLB `.dot` file. The tool runs it through an
adapter that produces the canonical artifact: DOT nodes/edges become the
canonical nodes/edges, and each node's label is copied verbatim into its
command field.

**Why this priority**: This is what makes the tool's diff engine and
visualizer agnostic to BuildKit's specific output format, but it depends on
the canonical schema and required fields (Stories 1–2) already being defined.

**Independent Test**: Can be fully tested by uploading a sample `.dot` file
and confirming the adapter output is a valid canonical artifact with the
command field populated for every node.

**Acceptance Scenarios**:

1. **Given** an uploaded, well-formed `.dot` file, **When** the user uploads
   it, **Then** an adapter transforms it into the canonical schema before any
   diffing occurs, and the resulting artifact passes the same validation as
   any other canonical artifact.
2. **Given** an uploaded file that isn't valid Graphviz DOT at all, **When**
   the user uploads it, **Then** the tool reports that the format is
   unrecognized rather than attempting to diff malformed data.

---

### Edge Cases

- What happens when an edge references a node id that isn't present in the
  artifact's node list? The artifact MUST be rejected as structurally invalid.
- What happens when an uploaded file already conforms to the canonical schema
  (e.g. was pre-adapted) instead of being a raw `.dot` file? It is treated as
  passing through a no-op adapter, so the ingestion path is uniform
  regardless of source.
- What happens when the `.dot` file fails to parse as valid Graphviz syntax?
  The file MUST be rejected with an error identifying the parse failure.
- What happens when two uploaded files are both structurally invalid? Each
  file MUST be validated independently, and the tool MUST report errors for
  both rather than stopping at the first.
- What happens when a node has no explicit `label` attribute in the DOT
  source? Graphviz defaults an unlabeled node's label to its id; the adapter
  MUST use that same default so the command field is still populated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept two uploaded `.dot` files (BuildKit LLB
  debug output), each representing one DAG artifact to be compared against
  the other.
- **FR-002**: Each artifact's `.dot` file MUST parse into a list of nodes,
  each with a unique identifier, a label, and a metadata object.
- **FR-003**: Each artifact's `.dot` file MUST parse into a list of edges,
  each identifying a source node id and a target node id.
- **FR-004**: System MUST reject an artifact whose edges reference a node id
  not present in that artifact's node list.
- **FR-005**: System MUST treat each node's metadata object as an open,
  extensible key/value structure, preserving any keys beyond the required
  command field without validating or interpreting them.
- **FR-006**: Each node's metadata MUST include a command field populated
  verbatim from that node's DOT label, uniformly across all node kinds
  (operation nodes, source-reference nodes, and terminal output nodes alike),
  in addition to any output digest or identifier the source data already
  carries.
- **FR-007**: If an uploaded file does not already match the canonical
  artifact schema, system MUST transform it via a DOT adapter before any
  diffing occurs.
- **FR-008**: The DOT adapter MUST populate the command field per FR-006 for
  every node, including deriving it from Graphviz's default label (the node
  id) when no explicit label is present.
- **FR-009**: System MUST reject an uploaded file that fails to parse as
  valid Graphviz DOT syntax, identifying the parse failure.
- **FR-010**: System MUST support adding a new source-format adapter (for a
  build tool other than BuildKit) without requiring any change to the diff
  engine or visualizer.
- **FR-011**: System MUST reject an uploaded file in a format that is
  neither valid DOT nor already the canonical schema, rather than attempting
  to process it as malformed data.

### Key Entities

- **Build Artifact**: One snapshot of a build's DAG, submitted as a single
  `.dot` file; carries a list of nodes and a list of edges.
- **Node**: A single build step/operation, source reference, or output
  vertex within an artifact's DOT graph; has a unique id, a label, and a
  metadata object that must include the command field derived from that
  label, plus any number of additional opaque fields.
- **Edge**: A directed dependency between two nodes within the same artifact,
  identified by source and target node ids.
- **Adapter**: A format-specific transformation that converts a
  non-conforming source (currently: a BuildKit `.dot` file) into the
  canonical artifact schema, populating the required command field from
  whatever equivalent data the source format provides.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two well-formed `.dot` files can be uploaded and accepted with
  no manual editing of the input files.
- **SC-002**: 100% of structurally invalid `.dot` files (parse failures,
  dangling edge references) are rejected with an actionable error before any
  diff is attempted.
- **SC-003**: Supporting a new source format requires adding one new adapter
  only, with no changes made to the diff engine or visualizer.
- **SC-004**: For every node whose output digest differs between two
  artifacts, the corresponding command field for that node is visible to
  the user without any additional lookup step.

## Assumptions

- Malformed or structurally invalid `.dot` files (parse errors, dangling
  edge references) are rejected outright with an actionable error rather
  than accepted with warnings; comparability is treated as all-or-nothing per
  file.
- Builder/toolchain version comparison is out of scope for this feature.
  It was explored during clarification (see above) but dropped when the
  input was simplified to a single `.dot` file with no companion metadata
  source; it may be reintroduced later as a separate feature if a metadata
  source becomes available.
- "Adapter" refers to a transformation step for one specific non-conforming
  source format; a file already in the canonical schema is treated as
  passing through a no-op adapter so the ingestion path is uniform.
  BuildKit's `.dot` format is the only source format in scope for this
  feature; adapters for other build tools are future work.
- This specification covers the input contract (schema, required fields,
  validation, and adapter responsibility) only; the structural diff
  algorithm and visual rendering are covered by separate features.

# Feature Specification: Compare Accepts LLB JSON

**Feature Branch**: `005-compare-json-support`
**Created**: 2026-08-18
**Status**: Draft
**Input**: User description: "allow compare to use json, its the only format the project uses, it does not use dot, the layer comparison must exist and the difference layout must be kept"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare two builds from LLB JSON (Priority: P1)

A user has two LLB build definitions exported as JSON (the format this project produces and works with everywhere else) and wants to compare them on the Compare page. Today the Compare page only accepts `.dot` files, forcing an extra, unsupported conversion step. The user should be able to upload the two JSON files directly and get the same side-by-side comparison the page already produces for `.dot` files today.

**Why this priority**: This is the entire scope of the request — without it, the Compare page keeps requiring a file format the rest of the project no longer produces or uses.

**Independent Test**: Upload two valid LLB JSON build definitions (a baseline and a changed variant) on the Compare page and confirm a comparison result renders with the two build graphs and a diff summary.

**Acceptance Scenarios**:

1. **Given** the Compare page, **When** a user selects a valid LLB JSON file for both "Left" and "Right" and submits, **Then** the page shows both build graphs side by side and a diff summary listing added, removed, and shared layers/connections.
2. **Given** two LLB JSON files that describe an identical build, **When** the user compares them, **Then** the page reports the builds as identical, exactly as it does today for two identical `.dot` files.
3. **Given** two LLB JSON files with genuine differences, **When** the user compares them, **Then** layers and connections unique to each side are visually distinguished (highlighted) exactly as they are today for `.dot`-based comparisons, and hovering an item in the summary highlights the matching element in both graphs.

---

### User Story 2 - Clear rejection of unsupported files (Priority: P2)

A user accidentally selects a `.dot` file, or any file that isn't a valid LLB JSON build definition, for Compare. The user should get a clear, per-file error explaining that a JSON build definition is required, instead of a confusing parse failure or silent misbehavior.

**Why this priority**: Prevents user confusion once `.dot` is no longer the accepted format; not on the critical path of the primary comparison flow, but necessary for the change to be safe to ship.

**Independent Test**: Upload a `.dot` file (or a non-JSON file) as either input on the Compare page and confirm a validation error naming that side and the required format is shown, with no comparison result rendered.

**Acceptance Scenarios**:

1. **Given** the Compare page, **When** a user selects a `.dot` file for the "Left" input and a valid JSON file for "Right" and submits, **Then** the page shows a validation error for the left file only and does not render a comparison.
2. **Given** the Compare page, **When** a user selects a file with a `.json` extension that is not valid LLB JSON (malformed JSON, or JSON missing required LLB fields), **Then** the page shows a validation error identifying the parse failure for that file.
3. **Given** the Compare page, **When** a user selects a `.json` file whose op inputs reference a layer that doesn't exist in the same file, **Then** the page shows a validation error describing the dangling reference.

---

### User Story 3 - AI analysis keeps working on JSON inputs (Priority: P3)

After comparing two JSON build definitions, a user clicks "Analyze with AI" and expects the same AI-generated explanation of the differences the page already provides today, now driven by the JSON-derived comparison instead of a `.dot`-derived one.

**Why this priority**: Reuses the same two files already uploaded for User Story 1; valuable but secondary to the comparison itself working.

**Independent Test**: After a successful JSON-based comparison, click "Analyze with AI" and confirm an analysis of the differences is returned.

**Acceptance Scenarios**:

1. **Given** a completed comparison of two valid LLB JSON files, **When** the user clicks "Analyze with AI", **Then** the page returns an analysis describing the differences between the two builds.

---

### Edge Cases

- What happens when one file is a valid LLB JSON build definition and the other is a `.dot` file? Each file is validated independently; the `.dot` side is rejected with its own error while the JSON side's validity is reported separately (per User Story 2, Scenario 1).
- What happens when a `.json` file exceeds the existing upload size limit? It is rejected with the same size-limit error the page already shows today, unchanged by this feature.
- What happens when both uploaded files are byte-for-byte different JSON but describe the same build (no layer/connection differences)? The page reports the builds as identical, same as today.
- What happens to the "Analyze with AI" action if the comparison step failed validation? The action stays unavailable, exactly as it does today when comparison fails.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Compare page MUST accept LLB JSON build definition files as the "Left" and "Right" inputs, in place of `.dot` files.
- **FR-002**: The Compare page and its underlying comparison MUST reject `.dot` files and any file that is not a valid LLB JSON build definition, with a clear per-file error stating that a JSON build definition is required.
- **FR-003**: Validation of uploaded JSON MUST cover: missing file, file exceeding the upload size limit, malformed JSON, and JSON containing a dangling reference between layers — each reported as a distinct, per-file error.
- **FR-004**: The layer-by-layer (node) and connection (edge) comparison between the two builds MUST continue to classify every layer and connection as shared, added (unique to the right/second build), or removed (unique to the left/first build), unchanged from current behavior.
- **FR-005**: The comparison result MUST continue to be presented as two side-by-side build graphs plus a summary list of added/removed/shared layers and connections, with hovering an entry in either the graphs or the summary highlighting the same element across both, unchanged from current behavior.
- **FR-006**: The "Analyze with AI" action MUST continue to operate on the same two uploaded files used for the comparison, now as JSON instead of `.dot`.
- **FR-007**: The existing upload size limit MUST continue to apply to JSON uploads.
- **FR-008**: On-page labeling and file-picker affordances (e.g. field hints, accepted-file hints) MUST be updated to reflect that JSON build definitions, not `.dot` files, are expected.

### Key Entities

- **Build Definition**: An LLB JSON file describing one build (the project's standard export format); the unit uploaded for each side of a comparison.
- **Layer**: A single build step (node) within a Build Definition; the unit classified as shared, added, or removed during comparison.
- **Connection**: A dependency link (edge) between two layers within a Build Definition; classified the same way as layers.
- **Diff Summary**: The categorized list of added, removed, and shared layers/connections produced by comparing two Build Definitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from two LLB JSON build definitions to a rendered comparison without converting either file to any other format first.
- **SC-002**: For any two valid LLB JSON build definitions, the reported added/removed/shared layers and connections match what the same two builds would have produced when previously supplied as `.dot` files.
- **SC-003**: Users who upload a non-JSON or invalid-JSON file receive a specific, per-file error message (not a generic failure) identifying which file failed and why.
- **SC-004**: The comparison page's layout — dual build graphs, diff summary, hover highlighting, and the AI analysis panel — looks and behaves the same before and after this change, for a reader who cannot tell which input format produced it.

## Assumptions

- "JSON" here means the LLB JSON build-definition format already validated and parsed elsewhere in the project (the same format accepted by the existing root-cause-analysis/determinism feature), not an arbitrary JSON schema.
- `.dot` input support is being replaced, not kept alongside JSON, on the Compare page and its AI analysis companion — consistent with "it does not use dot."
- The AI analysis feature reachable from the Compare page is in scope for this change since it consumes the same two uploaded files as the comparison; other, unrelated parts of the project that already use JSON (e.g. the existing root-cause-analysis/determinism page) are out of scope since they are unaffected.
- No new error categories are needed beyond validation failures already defined for JSON build definitions elsewhere in the project (missing file, oversized file, malformed JSON, dangling reference).

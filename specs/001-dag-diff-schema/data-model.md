# Phase 1 Data Model: DAG Artifact Schema & Adapters

## Artifact (canonical schema)

The output of the adapter layer; the only shape the diff engine and
visualizer (future features) will ever consume.

| Field          | Type       | Required | Notes |
|----------------|------------|----------|-------|
| `schemaVersion`| `string`   | yes      | Versions the canonical schema itself, per the constitution's "diff artifact schema MUST be versioned" constraint. Starts at `"1.0.0"`. |
| `nodes`        | `Node[]`   | yes      | See Node below. |
| `edges`        | `Edge[]`   | yes      | See Edge below. |

## Node

| Field      | Type                     | Required | Notes |
|------------|--------------------------|----------|-------|
| `id`       | `string`                 | yes      | Unique within the artifact. Sourced from the DOT node identifier (BuildKit uses `sha256:...` digests). |
| `label`    | `string`                 | yes      | Human-readable label, copied from the DOT node's `label` attribute (or the node id, if Graphviz's default applies — see spec Edge Cases). |
| `metadata` | `Record<string, unknown>`| yes      | Open, extensible key/value bag (FR-005). Always contains `command` (below); adapters MAY add further keys (e.g. `shape` from the DOT attribute) without the diff engine or visualizer needing to know about them. |
| `metadata.command` | `string`         | yes      | Verbatim copy of the node's DOT label (FR-006, FR-008). Populated uniformly for every node kind (operation, source-reference, terminal output). |

**Validation rules**:
- `id` MUST be unique within `nodes` (dangling/duplicate detection happens at the edge/parse level per FR-004/FR-009).
- `metadata.command` MUST be present and non-empty for every node (FR-008); since it is always derived from the label (explicit or defaulted), a valid parse can never produce a node without one.

## Edge

| Field    | Type     | Required | Notes |
|----------|----------|----------|-------|
| `source` | `string` | yes      | Must reference an existing `Node.id` in the same artifact. |
| `target` | `string` | yes      | Must reference an existing `Node.id` in the same artifact. |

**Validation rules**:
- Both `source` and `target` MUST match a declared node `id` in the same artifact; otherwise the artifact is rejected (FR-004).

## Intermediate DOT AST (adapter-internal, not exposed outside `src/adapters/dot/`)

The DOT parser library's own AST (graph → statements → node/edge statements
with attribute lists) is consumed only inside `src/adapters/dot/adapt.ts`,
which maps it to the canonical `Artifact` shape above. No other module
should import the parser library or its AST types directly, per Principle I.

## State / lifecycle

Artifacts in this feature have no persistence and no state transitions:
each upload is parsed, validated, and adapted within a single request and
returned in the response body. There is no stored/mutable representation.

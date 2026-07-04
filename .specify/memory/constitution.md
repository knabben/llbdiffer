<!--
Sync Impact Report
==================
Version change: TEMPLATE → 1.0.0 (initial ratification)
Modified principles: n/a (first concrete adoption; template placeholders replaced)
Added sections:
  - Core Principles I–IV (Schema Normalization, Diff-as-Artifact,
    Static-First & Network-Optional, Advisory LLM Analysis)
  - Architecture Constraints
  - Development Workflow
  - Governance
Removed sections:
  - Generic Principle 5 slot (only 4 principles were specified; not filled)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change needed (Constitution
    Check gate is derived dynamically from this file at plan time)
  - .specify/templates/spec-template.md ✅ no change needed (no
    constitution-specific references)
  - .specify/templates/tasks-template.md ✅ no change needed (no
    constitution-specific references)
Follow-up TODOs: none
-->

# LLBDiffer Constitution

## Core Principles

### I. Normalize to One Internal Schema
All ingested artifacts MUST pass through an adapter layer before reaching the
diff engine or visualizer. If an input JSON file does not already match the
tool's common internal graph shape, an adapter MUST transform it into that
shape as a discrete, isolated step; the diff engine and visualizer MUST NOT
contain source-format-specific logic. Supporting a new source format MUST
require adding only a new adapter, never touching downstream code.
**Rationale**: Format-specific parsers scattered through the diff and
rendering logic would tie the tool to whatever inputs it first supported,
turning a reusable diff-first tool into a single-purpose script.

### II. Diff-as-Artifact (Compute Before Rendering)
The structural diff between two normalized DAGs MUST be computed as a
standalone step that produces a stable, versioned, serializable artifact
before any rendering occurs. The visualizer MUST consume this precomputed
diff rather than deriving differences on the fly while rendering.
**Rationale**: A diff that only exists as transient UI state cannot be
saved, shared, diffed-of-diffs, or handed to an LLM independently of the
visualizer running. Treating the diff as a first-class artifact keeps it
inspectable and reproducible on its own terms.

### III. Static-First, Network-Optional
The visualizer MUST function as a static local tool requiring zero network
access for loading artifacts, computing diffs, and rendering graphs. The
only permitted exception is the LLM analysis feature, which MUST be opt-in
and MUST be isolated behind a single, clearly named integration boundary
that no other part of the tool depends on. If the LLM feature is never
invoked, the rest of the tool MUST work fully offline.
**Rationale**: A backend or always-on network dependency raises the cost of
running, auditing, and trusting the tool for what is fundamentally a local,
inspectable diffing workflow; the one exception is scoped tightly so it
can't quietly expand into a hard dependency.

### IV. LLM Analysis Is Advisory, Not Ground Truth
Output from the LLM analysis feature MUST be visually and structurally
separated from the diff data throughout the UI and in any exported
artifacts (e.g., a distinct, clearly labeled panel that is never merged
into or persisted alongside the diff schema). The diff itself MUST remain
deterministic and reproducible; narrative LLM commentary MUST NOT be
written back into, or treated as equivalent to, the diff artifact.
**Rationale**: The diff is a verifiable computation; the LLM's read of it is
not. Blurring the two would let non-reproducible commentary masquerade as
ground truth about what actually changed between two graphs.

## Architecture Constraints

- No server-side or hosted backend component may be introduced except the
  narrow LLM analysis integration point described in Principle III.
- The adapter layer, diff engine, and renderer MUST be usable independently
  of one another (e.g., invocable from a CLI or script, not just through the
  full UI), so the diff artifact can be produced and inspected without ever
  opening the visualizer.
- The diff artifact's schema MUST be versioned so that changes to its shape
  are explicit and detectable by tooling that consumes saved diffs.

## Development Workflow

- New source formats are implemented as new adapters only; changes to the
  diff engine or visualizer to accommodate a specific source format are a
  sign the adapter layer has failed and MUST be treated as a bug in the
  adapter, not a reason to special-case downstream code.
- Any UI surface that displays LLM output MUST be reviewed for whether it
  could be mistaken for diff data; ambiguous presentations (e.g., inline
  merging of LLM text into diff node/edge labels) MUST be rejected in review.
- Changes that would require network access for the non-LLM code paths MUST
  be rejected or redesigned; this is treated as a violation of Principle III,
  not a performance or scope tradeoff to be weighed case by case.

## Governance

This constitution supersedes ad hoc conventions for this project. Amendments
require: (1) a documented rationale for the change, (2) an explicit version
bump following the semantic versioning policy below, and (3) a check of
whether the change affects the plan, spec, or tasks templates, with any
required updates made in the same amendment.

**Versioning policy**: MAJOR versions cover backward-incompatible removals
or redefinitions of a principle (e.g., dropping the static-first constraint
or merging LLM output into the diff schema). MINOR versions cover new
principles or materially expanded guidance. PATCH versions cover wording,
clarification, or typo fixes with no semantic change.

**Compliance review**: Any plan or PR that introduces a network dependency
outside the LLM analysis boundary, a source-format-specific branch in the
diff engine or visualizer, or a UI element that blends LLM commentary with
diff data MUST document the deviation and justification explicitly, per
Principle III and IV, before merging.

**Version**: 1.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04

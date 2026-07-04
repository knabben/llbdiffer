<!--
Sync Impact Report
==================
Version change: 1.0.0 → 2.0.0
Modified principles:
  - III. Static-First, Network-Optional → III. Self-Contained Single-Container
    Deployment, No External Dependencies
    (Backward-incompatible redefinition: the tool now ships a real Next.js
    backend as its primary architecture, running inside one Docker container,
    rather than being a purely static/no-backend tool. The part of the
    original intent that is preserved: zero dependency on any *external*
    third-party or hosted service, with the opt-in LLM analysis call as the
    sole exception.)
Added sections:
  - Architecture Constraints: new bullet on single-Docker-image deployment
    with no required external services.
Removed sections: none
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
diff engine or visualizer. If an input file does not already match the
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

### III. Self-Contained Single-Container Deployment, No External Dependencies
The tool MUST ship and run as a single Next.js application (frontend and
backend in one codebase), packaged and deployed as a single Docker
container. The backend MUST perform the tool's core job — accepting
artifact uploads, running the adapter and diff pipeline, and serving the
rendered result — entirely within that container, with zero outbound
network calls to any external or third-party service. The only exception is
the LLM analysis feature, which MUST remain opt-in and MUST be isolated
behind a single, clearly named integration boundary that no other part of
the tool depends on. If the LLM feature is never invoked, the running
container MUST require no outbound network access at all.
**Rationale**: The core diffing workflow requires a running server to accept
uploads and orchestrate the pipeline, so "no backend at all" is no longer an
accurate constraint. What must still hold is the original intent: the tool
is fully self-hosted and self-sufficient, with no external database,
third-party API, or hosted service the user doesn't control, except the one
explicit, opt-in LLM call. This keeps the tool auditable and
trustworthy-by-default without pretending it has no backend.

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

- The tool's own Next.js backend, running inside the single Docker
  container, is the primary architecture, not an exception. No OTHER
  external, third-party, or hosted service may be introduced except the
  narrow LLM analysis integration point described in Principle III.
- The entire application (frontend, backend, and all pipeline logic) MUST
  be deployable as one Docker image with no required external services
  (databases, queues, third-party APIs) other than the opt-in LLM call.
- The adapter layer, diff engine, and renderer MUST be implemented as
  modules usable independently of the HTTP/API layer (e.g., unit-testable
  without a running server), so the diff artifact's correctness can be
  verified without exercising the full upload flow.
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
- Changes that would require the non-LLM code paths to call any external or
  third-party network service MUST be rejected or redesigned; this is
  treated as a violation of Principle III. Internal calls between the
  Next.js frontend and its own backend, within the same container, are not
  a violation — only calls leaving the container (other than the opt-in LLM
  call) are.

## Governance

This constitution supersedes ad hoc conventions for this project. Amendments
require: (1) a documented rationale for the change, (2) an explicit version
bump following the semantic versioning policy below, and (3) a check of
whether the change affects the plan, spec, or tasks templates, with any
required updates made in the same amendment.

**Versioning policy**: MAJOR versions cover backward-incompatible removals
or redefinitions of a principle (e.g., redefining the deployment/network
model or merging LLM output into the diff schema). MINOR versions cover new
principles or materially expanded guidance. PATCH versions cover wording,
clarification, or typo fixes with no semantic change.

**Compliance review**: Any plan or PR that introduces a dependency on an
external or third-party service outside the LLM analysis boundary, a
source-format-specific branch in the diff engine or visualizer, or a UI
element that blends LLM commentary with diff data MUST document the
deviation and justification explicitly, per Principle III and IV, before
merging.

**Version**: 2.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04

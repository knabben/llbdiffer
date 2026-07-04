# Implementation Plan: DAG Artifact Schema & Adapters

**Branch**: `001-dag-diff-schema` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dag-diff-schema/spec.md`

## Summary

Accept two BuildKit LLB `.dot` files uploaded to a Next.js backend endpoint,
validate their structure, and adapt each into a canonical DAG artifact schema
(nodes with id/label/metadata, edges, and a verbatim command field per node)
before any diffing occurs. The adapter is the only place that knows about DOT
syntax; the (future) diff engine and visualizer consume only the canonical
schema. The whole app — frontend and this backend — ships as one Next.js
project packaged into a single Docker container with no external services.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (Next.js 14+, App Router)
**Primary Dependencies**: Next.js (frontend + backend in one project); a
TypeScript-native Graphviz DOT parser (see research.md) for the adapter; no
database or ORM
**Storage**: N/A — artifacts are parsed and adapted in-memory per request;
this feature persists nothing
**Testing**: Vitest for unit tests (adapter, validation) and integration
tests (API route); tests always run inside a container (via `make test`),
never against a host-installed Node.js
**Target Platform**: Single Docker container (Node 20-alpine), Linux,
self-hosted (no PaaS/cloud service dependency). All workflows — build, dev
server, lint, test — run exclusively through Docker via `make` targets; the
host is not assumed to have Node.js, npm, or any project dependency installed
**Project Type**: Web application — one Next.js project serving both
frontend and backend (not a split frontend/backend repo layout)
**Performance Goals**: Parse, validate, and adapt a single BuildKit `.dot`
file (typical graphs: tens to low thousands of nodes) in under a few seconds
per upload; this is a low-throughput, single/small-team tool, not a
high-concurrency service
**Constraints**: Zero outbound network calls anywhere in this feature (no
LLM involvement in ingestion); must build and run via `docker build` /
`docker run` alone, no external services; no workflow (build, dev, lint,
test) may assume a host-installed Node.js/npm — all of them run inside a
container via `make` targets (see research.md); uploads capped at a
reasonable size (assumed 20MB per `.dot` file, see research.md) to bound
parse time and memory
**Scale/Scope**: Single-user or small-team self-hosted use, per the
constitution's self-contained-container principle; not designed for
multi-tenant SaaS scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Normalize to One Internal Schema** — PASS. All DOT-specific parsing
  and field-mapping logic lives in `src/adapters/dot/`; the canonical
  `Artifact`/`Node`/`Edge` types in `src/models/` and any future diff engine
  never see DOT syntax.
- **II. Diff-as-Artifact** — PASS (not yet exercised). This feature only
  produces the canonical artifact; diff computation is out of scope here and
  will consume this artifact as input in a later feature, preserving the
  compute-before-render sequencing.
- **III. Self-Contained Single-Container Deployment, No External
  Dependencies** — PASS. Frontend and backend are one Next.js project,
  deployed as a single Docker image; the upload/adapt pipeline makes no
  outbound network calls at all (no LLM involvement in this feature).
- **IV. LLM Analysis Is Advisory** — N/A. This feature does not touch the
  LLM analysis feature.
- **Architecture Constraints**: adapter/validation modules are plain
  TypeScript functions with no dependency on the HTTP layer, so they are
  unit-testable (Vitest) without a running server, per the constraints
  requiring pipeline logic to be independently testable.

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-dag-diff-schema/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
└── api/
    └── artifacts/
        └── route.ts          # POST handler: accepts 2 .dot uploads, returns adapted artifacts

src/
├── adapters/
│   └── dot/
│       ├── parse.ts          # Graphviz DOT text -> intermediate node/edge AST
│       └── adapt.ts          # AST -> canonical Artifact schema (command field, etc.)
├── models/
│   └── artifact.ts           # Canonical Artifact/Node/Edge types + schemaVersion
└── validation/
    └── artifact.ts           # Structural validation (parse failure, dangling edges)

tests/
├── unit/
│   └── adapters/dot/         # parse.ts / adapt.ts unit tests
└── integration/
    └── api/artifacts/        # route.ts upload-flow tests

Dockerfile              # multi-stage: deps -> build -> runner (standalone)
Makefile                # build/dev/lint/test targets, all docker-only
next.config.js
package.json
```

**Structure Decision**: A single Next.js (App Router) project holds both
frontend and backend, matching Constitution Principle III. The DOT adapter,
canonical models, and validation logic live under `src/` as framework-free
TypeScript modules imported by the `app/api/artifacts/route.ts` handler —
this keeps them unit-testable in isolation and keeps all BuildKit-specific
knowledge confined to `src/adapters/dot/`, per Principle I.

## Complexity Tracking

*No constitution violations — table not applicable.*

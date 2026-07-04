# Phase 0 Research: DAG Artifact Schema & Adapters

## DOT (Graphviz) parsing library

**Decision**: Use a TypeScript-native Graphviz DOT parser (e.g. `ts-graphviz`
family) rather than hand-rolling a parser or shelling out to the system
`graphviz` binary.

**Rationale**: BuildKit's `.dot` debug output uses a constrained subset of
DOT (a single `digraph` block, quoted node ids, `label`/`shape` attributes,
plain `->` edges — no subgraphs, clusters, or ports), but node labels can
contain arbitrary text including embedded quotes and braces (e.g.
`copy{src=/app.sh, dest=/usr/local/bin/app.sh}`). A hand-rolled line/regex
parser is fragile against this kind of embedded punctuation; a real DOT
grammar parser handles quoting/escaping correctly and is a small,
well-scoped dependency.

**Alternatives considered**:
- Hand-rolled regex/line-based parser — rejected: correctness risk around
  quoted labels containing braces, colons, and slashes is exactly the kind
  of bug that would silently corrupt the command field this feature exists
  to preserve.
- Shelling out to the system `graphviz` (`dot`) binary to convert to JSON —
  rejected: adds a non-Node binary dependency to the Docker image for a
  parsing job a small JS/TS library already solves, increasing image size
  and attack surface without benefit.

## File upload handling in Next.js

**Decision**: Use a Next.js App Router Route Handler
(`app/api/artifacts/route.ts`) reading the request body via the standard
`Request.formData()` API, rather than the older Pages API
(`pages/api/*`) with a third-party body-parser like `busboy`/`multer`.

**Rationale**: App Router Route Handlers are built on the standard Fetch
`Request`/`Response` objects, which support `multipart/form-data` uploads
natively via `formData()` — no extra multipart-parsing dependency is needed.
This keeps the upload path dependency-light and consistent with Principle
III (no unnecessary external packages for something the platform already
does).

**Alternatives considered**: Pages API + `formidable`/`busboy` — rejected as
unnecessary given the App Router's native support; would also mean running
two different routing conventions in one app for no benefit.

**Assumption**: Per-file upload size is capped at 20MB, configured via the
route segment's body size limit. This is a reasonable default for
BuildKit `.dot` graphs (typically well under 1MB even for large builds); it
is not specified in the spec and can be revisited if real-world graphs
exceed it.

## Test framework

**Decision**: Vitest for both unit tests (adapter, validation modules) and
integration tests (the upload route handler).

**Rationale**: Vitest is TypeScript/ESM-native, fast, and requires minimal
configuration in a Next.js project; it can test the `src/adapters` and
`src/validation` modules directly (no server required) as well as exercise
the route handler via Next.js's testing utilities.

**Alternatives considered**: Jest — historically Next.js's default, still
viable, but has heavier ESM/TS configuration overhead than Vitest for a
greenfield project with no existing Jest setup to preserve.

## Docker packaging

**Decision**: Multi-stage Dockerfile using Next.js's `output: 'standalone'`
build mode, with a `node:20-alpine` runtime stage containing only the
standalone server output and static assets.

**Rationale**: `output: 'standalone'` produces a minimal, self-contained
server bundle (no `node_modules` pruning step required), which is the
smallest and simplest way to satisfy Principle III's single-container,
no-external-dependency requirement.

**Alternatives considered**: Full `node_modules` copy without standalone
output — rejected: larger image, slower builds, no benefit for this
project's scope.

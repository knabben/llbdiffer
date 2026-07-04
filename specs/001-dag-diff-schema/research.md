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
standalone server output and static assets. The multi-stage build exposes a
reusable `deps` stage (installed `node_modules`, no build/compile step yet)
in addition to the final `runner` stage, so the same stage can be reused for
running tests and lint, not just the production image.

**Rationale**: `output: 'standalone'` produces a minimal, self-contained
server bundle (no `node_modules` pruning step required), which is the
smallest and simplest way to satisfy Principle III's single-container,
no-external-dependency requirement.

**Alternatives considered**: Full `node_modules` copy without standalone
output — rejected: larger image, slower builds, no benefit for this
project's scope.

**Gotchas hit during implementation** (both confirmed by actually running
`make build`/`make test` against the real Docker image, not assumed):
- Next.js's SWC compiler needs `apk add --no-cache libc6-compat` in any
  Alpine-based build stage; without it, the native SWC binary fails to load
  under musl.
- `package-lock.json` must be generated (`npm install`, not just `npm ci`)
  on the same libc as the target container. A lockfile generated on a glibc
  host silently omits the musl-specific optional native dependency for at
  least one transitive dependency (`@rollup/rollup-linux-x64-musl`, pulled
  in by Vitest), which then fails inside the Alpine `deps` stage with
  `MODULE_NOT_FOUND` — a known npm optional-dependency bug
  (npm/cli#4828). Practical implication: regenerate the lockfile via
  `docker run --rm -v $(pwd):/app -w /app node:20-alpine npm install`
  (or equivalent) whenever dependencies change, not via a host npm install.

## Build/test/dev workflow: Docker-only via Make

**Decision**: All developer-facing workflows — build, dev server, lint, and
test — run exclusively inside Docker, invoked through a root-level
`Makefile` (`make build`, `make dev`, `make lint`, `make test`). None of
these targets assume Node.js, npm, or any dependency installed on the host;
each one builds (or reuses) the Dockerfile's `deps` stage and runs the
actual command (`npm run dev`, `npm test`, `npm run lint`) inside a
container, mounting the working tree as a volume for `dev`/`test`/`lint` so
edits are picked up without a rebuild.

**Rationale**: The constitution's self-contained-container principle
(Principle III) is only really honored if the *whole* workflow — not just
the shipped production image — never depends on the host environment. If
tests or the dev server are run via bare `npm` commands, host Node version
drift becomes a real source of "works on my machine" bugs and silently
reintroduces a dependency the constitution is meant to rule out. Routing
everything through `make` also gives contributors one command surface
regardless of what's installed locally.

**Alternatives considered**:
- Plain `npm` scripts run directly on the host — rejected per the above;
  this is exactly what's being ruled out.
- `docker-compose` instead of a `Makefile` — considered, but rejected as
  unnecessary complexity for a single-image project; a `Makefile` wrapping
  `docker build`/`docker run` achieves the same one-command-per-workflow
  goal without introducing a second config file and a multi-service mental
  model this project doesn't need.

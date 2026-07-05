# Phase 0 Research: Side-by-Side Diff Viewer

## Client-side DOT-to-graph rendering

**Decision**: `@hpcc-js/wasm-graphviz` — a WASM build of real Graphviz,
loaded client-side via `Graphviz.load()`, then `graphviz.dot(dotText)`
returns an SVG string synchronously.

**Rationale**: The spec requires each panel to present the artifact as an
actual rendered graph "image," faithfully reflecting the `shape`/`label`
attributes BuildKit's DOT already carries (ellipse/box/note/plaintext, per
001's sample data) — a real Graphviz layout engine reproduces this
correctly, unlike a from-scratch JS graph-layout library (e.g. `dagre`)
which uses a different layout algorithm and would render differently from
what `dot`/`buildctl` actually produces.

**Self-containment check (Constitution Principle III)**: Verified directly
by downloading and inspecting the package's bundled `dist/` output — no
`unpkg`/`jsdelivr`/CDN URLs appear anywhere in it. The WASM binary is
bundled as part of the npm package and loaded from the app's own bundle,
not fetched from a public CDN at runtime. This must be re-verified after
the actual Next.js integration (bundler asset handling can sometimes
reintroduce a CDN fetch if misconfigured), but the library itself imposes
no such dependency by default.

**Alternatives considered**:
- `d3-graphviz` (wraps the same WASM engine with D3 transitions/zoom-pan) —
  heavier dependency for animation/interactivity the spec doesn't require;
  revisit only if plain CSS scroll/zoom proves insufficient for the "large
  graph must remain usable" edge case (FR-012).
- `dagre`/`dagre-d3` (pure JS layout, no WASM) — rejected: different layout
  algorithm than Graphviz's `dot`, so the rendered graph would look
  different from the source BuildKit debug output, undermining the "this
  is literally what BuildKit produced" trust the tool depends on.
- Server-side rendering to a static image (e.g. via the Node graphviz
  binary) — rejected: would require a native `graphviz` binary in the
  Docker image and moves rendering off the client for no benefit; the
  WASM approach keeps rendering client-side and the container minimal.

## Shared/unique classification algorithm

**Decision**: Pure set operations over the two canonical `Artifact`
objects' node ids and (source, target) edge pairs — no DOT knowledge
involved. `src/compare/artifact.ts` takes two `Artifact` values (already
adapted by the existing `src/adapters/dot` pipeline) and returns, per side,
the list of shared node ids, unique node ids, shared edges, and unique
edges.

**Rationale**: Per 001-dag-diff-schema, node ids are content-addressed
digests, so id equality is *expected* to already mean content equality —
no full per-field diff of node metadata is needed or meaningful.

**Correction after real-world testing, twice**: id-only comparison was
tried first, then briefly changed to also compare each node's `label`
after a manually-authored `.dot` fixture (same node id reused for
genuinely different label content — a changed base image digest and a
changed copy destination) was reported as "no differences." That
label-comparison change was then itself reverted after further testing
showed it broke a legitimate case: a `docker-image://` source op can keep
the same LLB vertex id across two builds while its label shows a different
resolved digest (e.g. a floating tag resolved at different times), and
that node was expected to show as shared. Net result: `classify()` compares
by id only. The manually-authored fixture from the first report simply
wasn't realistic — real BuildKit output gives different ids to genuinely
different (non-source-op) content; a hand-crafted fixture that reuses ids
across different content doesn't reflect that.

**Alternatives considered**: Deep structural diff of node metadata
(comparing `command`, `shape`, etc. field-by-field even when ids match) —
rejected as unnecessary and misleading: two nodes with the same id cannot
differ in content by construction, so a field-level diff would either
always report "no change" (dead code) or, worse, invite subtle bugs if some
future adapter ever produced two different ids' worth of metadata under
the same id.

## Rendering the classification back to DOT (for the graph panels)

**Decision**: `src/adapters/dot/render.ts` takes a canonical `Artifact`
plus its per-node/per-edge shared/unique classification and serializes it
back to DOT text, adding a `style`/`color` attribute per node and edge
reflecting that classification, alongside the original `label` attribute.
One consistent highlight color is used for "unique to this side" elements
in both panels (not different colors per side) — the spec frames this as
peer builds ("conflicts" vs. "similar"), not a temporal before/after diff,
so there is no "added" vs. "removed" semantic to color differently.

**Rationale**: Keeps all DOT-format knowledge (parse AND serialize) inside
`src/adapters/dot/`, per Principle I; the comparison module never touches
DOT syntax, and the frontend never touches classification logic (FR-011)
— it only renders whatever `style`/`color` attributes are already in the
DOT text it receives.

## Summary panel data shape

**Decision**: The comparison endpoint returns, alongside each side's
annotated DOT and hash list, a top-level `summary` object with `added`,
`removed`, and `shared` arrays (each a list of `{ kind: 'node' | 'edge', ...}`
entries), computed from the same classification used to annotate the DOT.
The frontend's `DiffSummaryPanel` renders these three arrays directly (as
tabs, sections, or an accordion — a presentation-layer choice, not fixed by
the spec) without recomputing anything.

**Rationale**: Serving one `summary` object computed in the same place as
the per-panel DOT annotation guarantees the text list and the graph
coloring can never disagree (spec FR-011, Diff Summary key entity) — both
are projections of one classification result, not two independently
derived views.

## Testing the frontend with the existing Vitest setup

**Decision**: Switch `vitest.config.ts`'s default `environment` to
`'jsdom'` for new React-component tests, but add a `// @vitest-environment
node` docblock override to every backend integration test that calls a
Next.js route handler's `request.formData()` (both the existing 001 tests
and this feature's new `/api/compare` tests).

**Rationale — corrected after actually running the suite**: The initial
plan (global `jsdom`, no per-file overrides) was tried first and broke all
four existing 001 integration tests with `TypeError: Content-Type was not
one of "multipart/form-data"...`. jsdom's global `FormData`/`Request`
implementations don't serialize a real multipart boundary the way Node's
native (undici-based) Fetch API does, which Next.js route handlers rely on
via `request.formData()`. Node-environment tests are unaffected since they
use Node's real Fetch primitives throughout. `node:fs`/`node:path` usage in
those files is unaffected either way — the actual break was multipart
`FormData` encoding, not Node built-ins.

**Alternatives considered**: A single global environment for everything —
this is what was tried first and is exactly what broke; documented here so
it isn't retried. Per-file overrides are the correct approach precisely
because route-handler integration tests and React-component tests need
genuinely different global objects (real Fetch API vs. DOM), not just a
superset relationship.

## Docker/dependency update risk (carried over from 001)

**Note**: Adding `@hpcc-js/wasm-graphviz` and any new devDependencies
(e.g. `@testing-library/react`, `jsdom`) means `package-lock.json` MUST be
regenerated inside an Alpine/musl container again (per the gotcha
documented in 001's research.md), not via a host `npm install`, or the
`deps` Docker stage risks the same `MODULE_NOT_FOUND` failure seen before.

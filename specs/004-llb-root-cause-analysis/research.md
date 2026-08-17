# Phase 0 Research: LLB Root Cause Analysis

## 1. LLB JSON wire format

**Decision**: Treat `buildctl debug dump-llb`'s default (non-`--dot`)
output as the input format: a stream of records, one per operation, each
shaped `{ Op, Digest, OpMetadata }`. `Op` is BuildKit's `pb.Op` protobuf
message rendered as JSON, a oneof discriminated by which of `exec` /
`source` / `file` / `build` / `merge` / `diff` is present; `Digest` is the
content-addressed id of that op; `OpMetadata` carries at least
`ignore_cache` and `description`. `Op.inputs` is an ordered array of
`{ digest, index }` references into earlier records.

**Rationale**: This is the format explicitly specified in the feature
input and is the only one of BuildKit's two debug-dump outputs (`--dot` vs.
default JSON) that exposes per-field data at all — the DOT label is an
opaque display string with no structured fields (see 001's adapter, which
only ever reads `label`/generic attributes). Every Pass 3 rule in this
feature reads a specific `pb.Op` field, so JSON is not a preference, it's a
hard requirement — matching the feature's explicit "DOT is a dead end for
this" framing and this project's clarified decision to support JSON only,
with no DOT compatibility path for this feature.

**Alternatives considered**:
- *Accept `.dot` in a "limited fidelity" degraded mode* (the option raised
  in the original design note) — rejected per Clarifications: no
  degraded-mode banner is built; this feature's only accepted input is LLB
  JSON.
- *Parse BuildKit's binary/protobuf `Definition` directly* — rejected; it
  would require a protobuf toolchain dependency and BuildKit's own `.proto`
  schema, whereas the JSON dump is self-describing and already what
  engineers get by running one documented `buildctl` command.

**Open verification item** (carried to tasks.md, not a spec ambiguity):
exact newline-delimited-JSON vs. JSON-array framing, and exact field
casing (`Op`/`op`, `OpMetadata`/`opMetadata`), should be verified against a
real `buildctl debug dump-llb` sample captured during implementation and
used to build `tests/fixtures/llbjson/`; the parser should tolerate both
common casings defensively.

## 2. Shape-key hashing

**Decision**: Compute `shapeKey(op) = sha256(JSON.stringify({ kind:
opKind(op), inputs: op.inputs.map(i => shapeKey(inputs[i.digest]) + ':' +
i.index), ordinal }))`, bottom-up (sources first, since `Op.inputs` only
reference earlier records — the LLB graph is already a DAG with no forward
references). `ordinal` disambiguates identical-shaped siblings at the same
structural position (e.g., the Nth op with this exact shape among its
parent's fan-out). Use Node's built-in `crypto.createHash('sha256')` — no
new dependency.

**Rationale**: The feature's core insight is that shape keys must exclude
mutable content (`opKind` only, never env/args/mounts/etc.) so that a
changed op's descendants still align with their counterpart on the other
side, even though every one of those descendants' *content-addressed
digests* changed. `Op.inputs` being an ordered, indexed array (not a set)
is what makes the recursion well-defined — this is the "blocking model
change" the feature calls out: today's `Edge = {source, target}` in
`src/models/artifact.ts` discards that ordering entirely, so it must gain
an ordinal.

**Alternatives considered**:
- *Match by digest* — rejected; this is exactly the id-set-difference
  approach the feature spec is written to replace, since digest chaining
  renames every descendant of a changed op.
- *Match by label/command text similarity (fuzzy match)* — rejected;
  non-deterministic and unauditable compared to a pure structural key, and
  the feature spec requires a Proven/exact alignment, not a best-guess one.

## 3. Field-diff rule table (Pass 3)

**Decision**: One rule module (`src/detect/rules.ts`) exporting a list of
`{ id: string; tier: 'proven' | 'structural' | 'heuristic'; appliesTo:
OpKind; check: (...) => Finding | null; fix: string }` entries, grouped by
op kind, implementing exactly the rules enumerated in the feature input:

- **ExecOp** (Proven, two-artifact): `UNSORTED_ENV` / mounts-by-dest /
  `secretenv` / `extraHosts` — sort-then-compare; raw differs + sorted
  equal ⇒ ordering-only. Cache-mount `cacheOpt.ID` differing ⇒
  `PER_RUN_CACHE_MOUNT_ID`.
- **ExecOp** (Structural, single-artifact): `network: HOST`,
  `security: INSECURE`, populated `proxy_env` ⇒ `NON_HERMETIC_EXEC`.
- **SourceOp** (Structural, single-artifact): `docker-image://…:tag` with
  no `@sha256:` ⇒ `UNPINNED_BASE`; `git://` with no pinned commit ⇒
  `UNPINNED_GIT`; `http(s)://` with no `http.checksum` attr ⇒
  `UNCHECKSUMMED_HTTP`. `local://` sources are excluded from comparison
  entirely for the attrs on the ignore-list (session id and similar),
  per FR-012.
- **FileOp** (Structural single-artifact / Proven two-artifact):
  `FileActionCopy.timestamp: -1` ⇒ `CLOCK_TIMESTAMP` (Structural); two
  differing concrete epochs ⇒ `TIMESTAMP_DRIFT` (Proven).
- **OpMetadata** (Structural, single-artifact): `ignore_cache: true` ⇒
  `UNCONDITIONAL_CACHE_MISS`.
- **Heuristic** (single-artifact, any string field, esp. `meta.args`):
  RFC3339/epoch-shaped substrings, UUID-shaped substrings, 40-hex-SHA
  substrings, absolute-path-shaped substrings ⇒ advisory findings with no
  guaranteed cause, always tier `heuristic`.

**Rationale**: This is a direct transcription of the feature's own
taxonomy; keeping every rule in one table (rather than scattered per-op
logic) keeps Pass 3 auditable and lets a new rule be added without
touching `src/align/` or `src/detect/divergence.ts`.

**Alternatives considered**: Encoding rules as ad hoc conditionals inline
in the API route — rejected, since Constitution Principle II requires the
findings to be produced by a standalone, testable step, and a flat table is
far easier to unit-test rule-by-rule against fixtures than inline branches.

## 4. Divergence frontier & blast radius (Pass 2)

**Decision**: Given the Pass 1 aligned-pair set, an aligned pair is a
**root cause** iff its content differs AND every one of its inputs is
content-identical across both artifacts (content-identical = same digest,
or — for local-only volatile attrs — identical after the ignore-list is
applied). Everything else with differing content is **cascaded**. Blast
radius = count of distinct aligned pairs reachable by following the
"after" artifact's forward edges from a root cause, deduplicated by node
id (so diamond-shaped fan-in doesn't get double-counted).

**Rationale**: Matches the feature's explicit two-line definition exactly;
computing it as a graph traversal over the already-built aligned-pair
adjacency (not a re-walk of the raw op list) keeps it O(nodes + edges).

**Alternatives considered**: Weighting blast radius by op kind or estimated
cost — rejected per spec Assumptions (no execution-time/cost data is
available in the LLB JSON), and rejected as an unrequested feature-scope
expansion.

## 5. Canonical schema extension (non-breaking)

**Decision**: Extend `src/models/artifact.ts` additively:
`Edge` gains optional `inputIndex?: number` (the ordinal BuildKit assigns
this input among its consumer's `inputs` array) and optional `mountDest?:
string` (populated only for edges representing a mount, carrying the
mount's destination path — needed to key mount comparisons by dest, per
Pass 3). `Node` gains an optional `llb?: { op: LlbOp; opMetadata:
LlbOpMetadata }` field carrying the typed, discriminated-union op data this
feature needs; the existing `metadata: Record<string, unknown> & {
command: string }` bag is untouched and continues to be populated exactly
as today for DOT-derived artifacts. `SCHEMA_VERSION` bumps
(`1.0.0` → `1.1.0`, additive/backward-compatible) since the shape changed.

**Rationale**: `Edge`/`Node` are shared by the DOT adapter (001), the
DOT-based `classify()`/compare panel (002), and 003's AI-narrative prompt
builder. All three read only the fields they already know about and never
populate or depend on the new optional fields, so this is a strictly
additive change — no existing test, adapter, or route needs to change
behavior. This keeps Constitution Principle I intact: the *shape* of the
canonical schema is shared, but only `src/adapters/llbjson/` ever produces
or consumes the new `llb`/`inputIndex`/`mountDest` fields; `src/adapters/
dot/`, `src/compare/artifact.ts`, and `src/analysis/claude.ts` are
untouched.

**Alternatives considered**: A second, parallel canonical schema
specifically for LLB JSON (not sharing `Artifact`/`Node`/`Edge` at all) —
rejected; it would duplicate `id`/`label`/`metadata` concepts for no
benefit, since this feature's alignment and rendering both still want the
same node/edge shape the rest of the app already understands, just with
extra optional data attached.

# llbdiffer

Diff-first visualizer for BuildKit LLB DAGs. See `specs/001-dag-diff-schema/`
for the full spec, plan, and constitution driving this feature.

## Requirements

Docker only. No local Node.js/npm install is required or assumed — see
`.specify/memory/constitution.md` Principle III.

### Enabling AI analysis (optional)

The `/compare` page's "Analyze with AI" button is the one feature that
makes an outbound network call — a direct request to the Claude API (no
MCP server, no tool use). It's off by default in the sense that no
request is ever made unless a user explicitly clicks the button; to make
those requests succeed, set an API key in the container's environment:

```bash
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... llbdiffer
```

Without `ANTHROPIC_API_KEY` set, the rest of the app works normally — the
"Analyze with AI" button is still visible, but clicking it returns a
readable, retry-able error instead of a narrative (see
`specs/003-ai-diff-analysis/contracts/analyze.md`).

## Usage

```bash
make build   # docker build -t llbdiffer .
make dev     # dev server on :3000, source mounted for hot reload
make lint    # ESLint, run inside a container
make test    # Vitest unit + integration tests, run inside a container
```

## API

### `POST /api/artifacts`

Accepts two BuildKit LLB `.dot` files (`left`, `right`) as
`multipart/form-data` and returns each adapted into the canonical artifact
schema (`schemaVersion`, `nodes`, `edges`, each node carrying a
`metadata.command` field copied verbatim from its DOT label).

```bash
curl -X POST http://localhost:3000/api/artifacts \
  -F "left=@before.dot" \
  -F "right=@after.dot"
```

Full request/response contract, including error codes for malformed or
structurally invalid uploads: [specs/001-dag-diff-schema/contracts/artifacts-upload.md](specs/001-dag-diff-schema/contracts/artifacts-upload.md).

This endpoint does not compute a diff or render anything — see
[specs/001-dag-diff-schema/quickstart.md](specs/001-dag-diff-schema/quickstart.md)
for what's in and out of scope for this feature.

### `POST /api/analyze`

Accepts the same two `.dot` files as `/api/compare` and returns a
plain-language narrative from Claude explaining the differences between
them. Requires `ANTHROPIC_API_KEY` to be set (see "Enabling AI analysis"
above); without it, this endpoint returns a `502` rather than a narrative.

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "left=@before.dot" \
  -F "right=@after.dot"
```

Full request/response contract: [specs/003-ai-diff-analysis/contracts/analyze.md](specs/003-ai-diff-analysis/contracts/analyze.md).
The returned narrative is advisory commentary, not verified fact — the
frontend always renders it in a panel separate from the diff graphs and
diff summary (constitution Principle IV).

### `POST /api/determinism`

A separate, JSON-only analysis path — see `specs/004-llb-root-cause-analysis/`.
Unlike every other endpoint above, it does **not** accept `.dot`; it reads
BuildKit's LLB **JSON** debug dump (`buildctl debug dump-llb`'s default
output), because only that format exposes the per-field data (env, mounts,
timestamps, source pins, cache flags) this analysis reads. Upload one file
for a single-artifact determinism report (guaranteed-bad constructs and
advisory pattern matches — no second build required), or two files
(`primary`, `secondary`) for a full root-cause comparison: operations are
aligned structurally (not by content-addressed id, so one changed op
doesn't rename every downstream op into an unrelated "difference"), root
causes are separated from their cascaded descendants, and each root cause
is ranked by how many downstream operations it invalidates ("blast
radius").

```bash
# Single-artifact determinism report
curl -X POST http://localhost:3000/api/determinism -F "primary=@before.json"

# Two-artifact root-cause comparison
curl -X POST http://localhost:3000/api/determinism \
  -F "primary=@before.json" \
  -F "secondary=@after.json"
```

Try it in the browser at `/determinism`. Full request/response contract:
[specs/004-llb-root-cause-analysis/contracts/determinism.md](specs/004-llb-root-cause-analysis/contracts/determinism.md).
Like `/api/analyze`, findings are advisory where they're pattern-based
(labeled "Heuristic"); unlike `/api/analyze`, this endpoint makes zero
outbound network calls — every finding is deterministic, rule-based
computation over the parsed LLB fields, not an LLM call.

## Extracting a `.dot` file from a Dockerfile

BuildKit's `buildctl debug dump-llb --dot` command turns a serialized LLB
definition into a DOT graph. It reads that definition from stdin and does
**not** need a running buildkit daemon. To get the LLB definition for a
plain Dockerfile (without running a full build), BuildKit ships a small
example tool, `examples/dockerfile2llb`, that reads a Dockerfile from
stdin and writes the corresponding LLB definition to stdout:

```bash
# Requires Go and a checkout of github.com/moby/buildkit, plus the
# buildctl binary (ships with BuildKit releases / most buildkit packages).
git clone https://github.com/moby/buildkit
cd buildkit

go run ./examples/dockerfile2llb < /path/to/your/Dockerfile \
  | buildctl debug dump-llb --dot > before.dot
```

Run it once per build you want to compare (e.g. before and after a
Dockerfile change) to produce the two `.dot` files this project's
endpoints expect.

For `/api/determinism`, drop the `--dot` flag to get the default JSON
output instead:

```bash
go run ./examples/dockerfile2llb < /path/to/your/Dockerfile \
  | buildctl debug dump-llb > before.json
```

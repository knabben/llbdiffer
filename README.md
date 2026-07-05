# llbdiffer

Diff-first visualizer for BuildKit LLB DAGs. See `specs/001-dag-diff-schema/`
for the full spec, plan, and constitution driving this feature.

## Requirements

Docker only. No local Node.js/npm install is required or assumed — see
`.specify/memory/constitution.md` Principle III.

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

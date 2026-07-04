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

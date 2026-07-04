# Quickstart: DAG Artifact Schema & Adapters

## Run it

```bash
make build   # docker build -t llbdiffer .
make dev     # run the dev server in a container, port 3000
```

No environment variables, database, or external service is required for
this feature — the container is fully self-contained per the constitution's
Principle III. Nothing here assumes Node.js or npm installed on the host;
every target below runs inside Docker.

## Try the upload endpoint

```bash
curl -X POST http://localhost:3000/api/artifacts \
  -F "left=@before.dot" \
  -F "right=@after.dot"
```

Where `before.dot` / `after.dot` are BuildKit LLB debug output, e.g.
generated via:

```bash
buildctl debug dump-llb --dot < build-request > before.dot
```

A successful response returns both files adapted into the canonical
artifact schema (`schemaVersion`, `nodes`, `edges`, each node carrying a
`metadata.command` field copied verbatim from its DOT label). See
`contracts/artifacts-upload.md` for the full response shape and error
codes.

## Development workflow (all Docker, no local Node.js/npm)

```bash
make dev     # Next.js dev server in a container, source mounted for hot reload
make test    # Vitest unit + integration tests, run inside a container
make lint    # ESLint, run inside a container
```

## What this feature does NOT do yet

- It does not compute a diff between `left` and `right` — that's a
  separate, later feature per Principle II.
- It does not render anything — no visualizer exists yet.
- It has no LLM integration — out of scope for this feature entirely.

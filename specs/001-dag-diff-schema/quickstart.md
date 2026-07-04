# Quickstart: DAG Artifact Schema & Adapters

## Run it

```bash
docker build -t llbdiffer .
docker run -p 3000:3000 llbdiffer
```

No environment variables, database, or external service is required for
this feature — the container is fully self-contained per the constitution's
Principle III.

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

## Local development

```bash
npm install
npm run dev       # Next.js dev server
npm test          # Vitest unit + integration tests
```

## What this feature does NOT do yet

- It does not compute a diff between `left` and `right` — that's a
  separate, later feature per Principle II.
- It does not render anything — no visualizer exists yet.
- It has no LLM integration — out of scope for this feature entirely.

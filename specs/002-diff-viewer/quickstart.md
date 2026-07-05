# Quickstart: Side-by-Side Diff Viewer

## Run it

```bash
make build
make dev     # dev server on :3000, source mounted for hot reload
```

Still fully Docker-only, per the constitution — no local Node.js/npm
required.

## Try it in the browser

1. Open `http://localhost:3000/compare`.
2. Select two BuildKit LLB `.dot` files (e.g. a "before" and "after" build
   dump from `buildctl debug dump-llb --dot`).
3. Submit. The dashboard shows:
   - **Left panel**: the first file's graph, rendered visually, with its
     node hash list.
   - **Right panel**: the second file's graph, rendered the same way.
   - **Summary panel**: a categorized list of every added, removed, and
     shared node/edge.

If the two files are identical, the dashboard clearly states there are no
differences instead of showing empty-looking added/removed lists.

## Try the comparison endpoint directly

```bash
curl -X POST http://localhost:3000/api/compare \
  -F "left=@before.dot" \
  -F "right=@after.dot"
```

See `contracts/compare.md` for the full response shape and error codes.

## Development workflow (all Docker, no local Node.js/npm)

```bash
make dev
make test    # Vitest unit + integration tests, jsdom + node, run inside a container
make lint
```

## What this feature does NOT do

- It does not persist comparisons between sessions.
- It does not involve the LLM analysis feature — that remains a separate,
  opt-in capability per the constitution.

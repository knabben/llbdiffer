# Quickstart: Compare Accepts LLB JSON

## Run it

```bash
make build
make dev     # dev server on :3000, source mounted for hot reload
```

Still fully Docker-only, per the constitution — no local Node.js/npm
required.

## Generate LLB JSON build definitions

The `/compare` page now accepts BuildKit's **JSON** debug dump only — the
same format `/determinism` (004) already accepts — never `.dot`:

```bash
buildctl debug dump-llb --output=json < build-def > before.json
buildctl debug dump-llb --output=json < build-def > after.json
```

## Try it in the browser

1. Open `http://localhost:3000/compare`.
2. Upload `before.json` as the "Left" build and `after.json` as the
   "Right" build.
3. The page shows both build graphs side by side, colored by
   shared/added/removed layers and connections, plus a diff summary list —
   the same layout as before this change.
4. Hover a layer or connection in either graph or the summary list to
   highlight the matching element across both.
5. Click "Analyze with AI" for a narrative explanation of the differences,
   using the same two JSON files.

Uploading a `.dot` file, or a `.json` file that isn't valid LLB JSON,
produces a per-file error instead of a comparison result.

## Try the endpoint directly

```bash
curl -X POST http://localhost:3000/api/compare \
  -F "left=@before.json" \
  -F "right=@after.json"
```

See `contracts/compare.md` and `contracts/analyze.md` for the full response
shapes and error codes.

## Development workflow (all Docker, no local Node.js/npm)

```bash
make dev
make test    # Vitest unit + integration tests, jsdom + node, run inside a container
make lint
```

## What this feature does NOT do

- It does not keep `.dot` support on `/compare`, `/api/compare`, or
  `/api/analyze` — JSON replaces it, per the feature request.
- It does not change `/api/artifacts` (001), which keeps accepting `.dot`
  unchanged — that route is unrelated to the `/compare` page.
- It does not change `/determinism` or `/api/determinism` (004) — those
  already accept JSON and are untouched.
- It does not change the diff algorithm, the diff summary shape, or the
  visual layout of the comparison — only the accepted input format changes.

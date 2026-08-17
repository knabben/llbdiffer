# Quickstart: LLB Root Cause Analysis

## Run it

```bash
make build
make dev     # dev server on :3000, source mounted for hot reload
```

Still fully Docker-only, per the constitution — no local Node.js/npm
required.

## Generate an LLB JSON artifact

This feature only accepts BuildKit's **JSON** debug dump — never `.dot`:

```bash
buildctl debug dump-llb --output=json < build-def > before.json
buildctl debug dump-llb --output=json < build-def > after.json
```

(Exact invocation depends on your BuildKit frontend; any command that
produces the default `buildctl debug dump-llb` JSON output — one
`{Op, Digest, OpMetadata}` record per operation — works.)

## Try it in the browser — single-artifact determinism report

1. Open `http://localhost:3000/determinism`.
2. Upload one LLB JSON file.
3. The page shows a ranked list of findings: guaranteed-bad constructs
   (Structural tier — e.g. an unpinned base image, `ignore_cache: true`, a
   `timestamp: -1` file copy) and advisory pattern matches (Heuristic
   tier), each labeled with its confidence and, where known, a named cause
   and a suggested fix.

If nothing is found, the page states that plainly rather than showing an
empty screen.

## Try it in the browser — two-artifact comparison

1. On the same `/determinism` page, also upload a second LLB JSON file
   ("after" build).
2. The report now additionally includes Proven root-cause findings — each
   showing its blast radius (how many downstream operations it
   invalidated) — sorted largest first, plus the same Structural/Heuristic
   findings from either artifact shown in single-artifact mode.
3. Cascaded differences (everything downstream of a root cause) are
   collapsed into that root cause's blast-radius count, not listed
   separately.

If the two artifacts have no divergence at all, the report states the
builds are equivalent.

## Try the endpoint directly

```bash
# Single-artifact determinism report
curl -X POST http://localhost:3000/api/determinism \
  -F "primary=@before.json"

# Two-artifact comparison
curl -X POST http://localhost:3000/api/determinism \
  -F "primary=@before.json" \
  -F "secondary=@after.json"
```

See `contracts/determinism.md` for the full response shape and error
codes.

## Development workflow (all Docker, no local Node.js/npm)

```bash
make dev
make test    # Vitest unit + integration tests, jsdom + node, run inside a container
make lint
```

## What this feature does NOT do

- It does not accept `.dot` files, in any mode — that remains exclusively
  the existing `/compare` page's (001/002) input format.
- It does not persist reports between sessions.
- It does not call any LLM or make any outbound network call — unlike
  `/api/analyze` (003), this is pure, deterministic, offline computation.
- It does not modify the existing `/compare` page, `/api/compare`, or
  `/api/analyze` — those remain exactly as shipped in 001/002/003.

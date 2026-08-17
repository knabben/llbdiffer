# Contract: POST /api/determinism

## Request

`multipart/form-data`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `primary` | file | yes | An LLB JSON dump (`buildctl debug dump-llb` default output). `.dot` files are rejected — this endpoint never accepts DOT (spec FR-013). |
| `secondary` | file | no | A second LLB JSON dump. When present, the response is a two-artifact comparison (`mode: "comparison"`); when absent, a single-artifact determinism report (`mode: "single"`). |

## Success Response

`200 OK`

```json
{
  "report": {
    "schemaVersion": "1.1.0",
    "mode": "single",
    "identical": false,
    "findings": [
      {
        "id": "UNPINNED_BASE:sha256:abc123",
        "tier": "structural",
        "causeCode": "UNPINNED_BASE",
        "message": "Source references docker-image://node:20 with no @sha256 digest pin.",
        "fix": "Pin the base image to a digest, e.g. node:20@sha256:....",
        "affected": [{ "nodeId": "sha256:abc123", "label": "docker-image://node:20" }]
      }
    ]
  },
  "primary": { "dot": "digraph { ... }" }
}
```

`primary.dot` (and, in comparison mode, `secondary.dot`) is a pre-rendered
Graphviz DOT string — the same `GraphRenderer`/`@hpcc-js/wasm-graphviz`
pipeline `/compare` uses — with each node colored by its category
(root cause / blast radius / structural / heuristic / added / removed /
moved / clean), computed server-side from the report by
`src/detect/renderDot.ts`. The frontend never derives these colors itself.

Every `FindingAffected`/`StructuralChange` entry carries `label` (the
node's human-readable command/identifier, e.g. `"/bin/sh -c apk add
curl"`) alongside `nodeId` — a raw digest alone doesn't tell you which
build step a finding is about.

In `mode: "comparison"`, each `Finding.affected[]` entry additionally
carries `side: "left" | "right"` to disambiguate which artifact it came
from, and `proven`-tier findings additionally carry `blastRadius` (a count)
and `blastRadiusNodeIds` (the actual "after"-side node ids counted, so a
graph view can highlight them):

```json
{
  "id": "UNSORTED_ENV:sha256:def456",
  "tier": "proven",
  "causeCode": "UNSORTED_ENV",
  "message": "Environment variables contain the same entries in a different order.",
  "fix": "Sort environment variables before setting them in the build definition.",
  "affected": [
    { "nodeId": "sha256:def456", "label": "/bin/sh -c apk add curl", "side": "left" },
    { "nodeId": "sha256:ghi789", "label": "/bin/sh -c apk add curl", "side": "right" }
  ],
  "blastRadius": 46,
  "blastRadiusNodeIds": ["sha256:...", "..."]
}
```

A root cause matching no named Proven rule (`causeCode: "UNKNOWN_DIVERGENCE"`,
spec US4) carries a field-aware `message` (e.g. `Command differs: "apk add
curl" → "apk add curl git".`) rather than a generic "content differs",
wherever the diverging op kind has a known summary field (exec's
command/env/cwd/user, source's identifier); otherwise a generic fallback.

Per Clarifications (spec.md), `mode: "comparison"` responses include
Structural/Heuristic findings for either artifact alongside Proven
root-cause findings — not Proven-only. When the same conceptual op is
unchanged between the two artifacts (matched by shape + content, even
though digest chaining gave it two different ids), its Structural/Heuristic
finding is reported once, `affected` covering both sides — not twice.

## Error Responses

### Validation failure (bad, missing, or unsupported files)

`400 Bad Request`

```json
{
  "errors": {
    "primary": null,
    "secondary": { "code": "LLB_JSON_PARSE_ERROR", "message": "..." }
  }
}
```

`secondary` is `null` both when it was valid AND when it was simply not
provided (single-artifact mode); a `400` is only returned when a field that
*was* provided fails validation, or when `primary` is missing entirely.
Error codes: `MISSING_FILE`, `UNSUPPORTED_FORMAT` (e.g., a `.dot` upload),
`LLB_JSON_PARSE_ERROR`, `DANGLING_INPUT_REFERENCE` — the LLB-JSON-adapter
analogues of `src/validation/artifact.ts`'s existing `ArtifactErrorCode`
values, defined in the new `src/validation/llbArtifact.ts`.

## Behavioral notes

- Zero outbound network calls — unlike `/api/analyze` (003), this route has
  no exception under Constitution Principle III.
- The response is produced entirely by `src/align/` + `src/detect/`
  (Pass 1–3) from the canonical `Artifact`(s) the `llbjson` adapter
  produces; the route handler itself contains no alignment or rule logic,
  matching Constitution Principle II. `primary.dot`/`secondary.dot` are
  likewise computed server-side from the already-built `report` by
  `src/detect/renderDot.ts` — the frontend only renders the DOT string it's
  given, it never recomputes node categories/colors itself.
- No caching: every call re-parses, re-aligns, and re-detects from scratch,
  matching 002/003's existing stateless pattern.
- Entirely independent of `POST /api/compare` and `POST /api/analyze` —
  does not read, write, or share any state with the DOT-based
  compare/analyze flow.

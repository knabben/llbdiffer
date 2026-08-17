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
        "affected": [{ "nodeId": "sha256:abc123" }]
      }
    ]
  }
}
```

In `mode: "comparison"`, each `Finding.affected[]` entry carries `side:
"left" | "right"` to disambiguate which artifact it came from, and
`proven`-tier findings additionally carry `blastRadius`:

```json
{
  "id": "UNSORTED_ENV:sha256:def456",
  "tier": "proven",
  "causeCode": "UNSORTED_ENV",
  "message": "Environment variables contain the same entries in a different order.",
  "fix": "Sort environment variables before setting them in the build definition.",
  "affected": [
    { "nodeId": "sha256:def456", "side": "left" },
    { "nodeId": "sha256:ghi789", "side": "right" }
  ],
  "blastRadius": 46
}
```

Per Clarifications (spec.md), `mode: "comparison"` responses include
Structural/Heuristic findings for either artifact alongside Proven
root-cause findings — not Proven-only.

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
  matching Constitution Principle II.
- No caching: every call re-parses, re-aligns, and re-detects from scratch,
  matching 002/003's existing stateless pattern.
- Entirely independent of `POST /api/compare` and `POST /api/analyze` —
  does not read, write, or share any state with the DOT-based
  compare/analyze flow.

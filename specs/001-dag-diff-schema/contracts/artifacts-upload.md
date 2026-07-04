# Contract: POST /api/artifacts

Accepts two BuildKit LLB `.dot` files and returns each adapted into the
canonical artifact schema (see `../data-model.md`), or a structured error per
file that failed validation.

## Request

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Form fields**:
  | Field   | Type | Required | Notes |
  |---------|------|----------|-------|
  | `left`  | file | yes      | First `.dot` artifact to compare. |
  | `right` | file | yes      | Second `.dot` artifact to compare. |

Each file MUST have a `.dot` extension or `text/vnd.graphviz` /
`text/plain` content type; anything else is rejected per FR-011 without
attempting to parse it. Each file is capped at 20MB (see research.md).

## Response — 200 OK

Both files parsed, validated, and adapted successfully.

```json
{
  "left": {
    "schemaVersion": "1.0.0",
    "nodes": [
      {
        "id": "sha256:db1394...",
        "label": "docker-image://docker.io/library/alpine:3.19@sha256:6baf43...",
        "metadata": {
          "command": "docker-image://docker.io/library/alpine:3.19@sha256:6baf43...",
          "shape": "ellipse"
        }
      }
    ],
    "edges": [
      { "source": "sha256:db1394...", "target": "sha256:6eb57b..." }
    ]
  },
  "right": { "...": "same shape as left" }
}
```

## Response — 400 Bad Request

One or both files failed validation. Each side is validated independently
(spec Edge Cases); errors are reported per side rather than failing fast on
the first bad file.

```json
{
  "errors": {
    "left": null,
    "right": {
      "code": "DOT_PARSE_ERROR",
      "message": "Line 4: unexpected token '}' while parsing digraph body"
    }
  }
}
```

Possible `code` values:

| Code | Meaning |
|------|---------|
| `MISSING_FILE` | `left` or `right` form field not present. |
| `UNSUPPORTED_FORMAT` | Uploaded file is neither valid DOT nor already canonical-schema JSON (FR-011). |
| `DOT_PARSE_ERROR` | File has the right content type but fails to parse as Graphviz DOT (FR-009). |
| `DANGLING_EDGE_REFERENCE` | An edge's `source`/`target` does not match any declared node id (FR-004). |

## Non-goals for this contract

- No diff computation — this endpoint only returns the two adapted
  artifacts independently; comparing them is a separate future feature
  (Principle II: diff is computed as its own step, not inline here).
- No persistence — nothing uploaded or adapted here is stored server-side
  beyond the lifetime of the request.

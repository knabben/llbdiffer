# Contract: POST /api/compare (revised)

Supersedes `specs/002-diff-viewer/contracts/compare.md` for this route.
Accepts two BuildKit LLB **JSON** build definitions (the same format
`POST /api/determinism` accepts, per 004) and returns a full comparison
result: both sides re-rendered as classification-annotated DOT (for
display only), both sides' node id lists, and a categorized diff summary —
everything the two-panel dashboard needs in one response. Response shape
and comparison behavior are otherwise unchanged from 002.

## Request

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Form fields**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `left` | file | yes | An LLB JSON build definition. `.dot` is rejected — this endpoint no longer accepts DOT. 20MB cap. |
| `right` | file | yes | Same as `left`. |

## Response — 200 OK

Unchanged from 002 — still classification-annotated DOT for display,
regardless of the JSON input:

```json
{
  "left": {
    "dot": "digraph { \"sha256:aaa\" [label=\"...\" style=\"filled\" fillcolor=\"#f87171\"]; ... }",
    "hashes": ["sha256:aaa", "sha256:bbb", "..."]
  },
  "right": {
    "dot": "digraph { \"sha256:aaa\" [label=\"...\" style=\"filled\" fillcolor=\"#34d399\"]; ... }",
    "hashes": ["sha256:aaa", "sha256:ccc", "..."]
  },
  "summary": {
    "added": [{ "kind": "node", "ref": "sha256:ccc" }],
    "removed": [{ "kind": "node", "ref": "sha256:bbb" }],
    "shared": [{ "kind": "node", "ref": "sha256:aaa" }]
  },
  "identical": false
}
```

Styling convention, identity rule, and identical-builds behavior are
unchanged from 002 (see that contract for detail) — this feature changes
only what produces `left`/`right`'s underlying `Artifact`, not what happens
to it afterward.

## Response — 400 Bad Request

**Changed**: error codes now match `LlbArtifactErrorCode`
(`src/validation/llbArtifact.ts`, same as `/api/determinism`) instead of
the old DOT-flavored `ArtifactErrorCode`. Response shape
(`{errors: {left, right}}`, independently validated) is unchanged.

```json
{
  "errors": {
    "left": null,
    "right": { "code": "LLB_JSON_PARSE_ERROR", "message": "..." }
  }
}
```

Codes: `MISSING_FILE`, `UNSUPPORTED_FORMAT` (unchanged names) —
`LLB_JSON_PARSE_ERROR` (was `DOT_PARSE_ERROR`), `DANGLING_INPUT_REFERENCE`
(was `DANGLING_EDGE_REFERENCE`).

## Non-goals for this contract

- No persistence — nothing about a comparison is stored beyond the
  request's lifetime.
- No LLM involvement — this endpoint is unrelated to the (separate,
  opt-in) LLM analysis feature.
- `POST /api/artifacts` (001) is untouched and keeps accepting `.dot` —
  out of scope for this feature.

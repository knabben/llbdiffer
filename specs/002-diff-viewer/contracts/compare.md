# Contract: POST /api/compare

Accepts two BuildKit LLB `.dot` files and returns a full comparison result:
both sides re-rendered as classification-annotated DOT, both sides' node
hash lists, and a categorized diff summary — everything the three-panel
dashboard needs in one response.

## Request

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Form fields**: same as `POST /api/artifacts` (see
  `../../001-dag-diff-schema/contracts/artifacts-upload.md`) — `left` and
  `right`, each a required `.dot` file, 20MB cap, same format validation.

## Response — 200 OK

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

Styling convention: shared elements get a neutral gray fill (`#8b8b8b`);
elements unique to the left/first artifact are colored red (`#f87171`,
labeled "removed" in the summary); elements unique to the right/second
artifact are colored green (`#34d399`, labeled "added"). A node is `shared`
whenever its id matches on both sides, regardless of label text — node
identity is the graph vertex id alone (see research.md).

When `left` and `right` are identical, `summary.added` and `summary.removed`
are both `[]`, `identical` is `true`, and every element appears in
`summary.shared` (spec FR-008 / Story 3 Scenario 3 / Scenario 4).

## Response — 400 Bad Request

Identical shape to `POST /api/artifacts`'s error response — each side
validated independently, same error codes (`MISSING_FILE`,
`UNSUPPORTED_FORMAT`, `DOT_PARSE_ERROR`, `DANGLING_EDGE_REFERENCE`):

```json
{
  "errors": {
    "left": null,
    "right": { "code": "DOT_PARSE_ERROR", "message": "..." }
  }
}
```

## Non-goals for this contract

- No persistence — nothing about a comparison is stored beyond the
  request's lifetime.
- No LLM involvement — this endpoint is unrelated to the (separate,
  opt-in) LLM analysis feature described in the constitution.

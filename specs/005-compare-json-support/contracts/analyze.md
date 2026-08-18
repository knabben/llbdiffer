# Contract: POST /api/analyze (revised)

Supersedes `specs/003-ai-diff-analysis/contracts/analyze.md` for this
route's request validation. Behavior of the analysis call itself is
unchanged.

## Request

`multipart/form-data`, identical shape to the revised `POST /api/compare`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `left` | file | yes | An LLB JSON build definition, same validation as `/api/compare`'s `left` field. |
| `right` | file | yes | An LLB JSON build definition, same validation as `/api/compare`'s `right` field. |

The frontend resubmits the same two `File` objects already held in
`ComparePage` state from the original comparison — it does not require the
user to re-select files.

## Success Response

Unchanged.

`200 OK`

```json
{
  "analysis": "string — Claude's narrative explanation of the diff"
}
```

## Error Responses

### Validation failure (bad or unsupported files)

**Changed**: error codes now match `LlbArtifactErrorCode`, same as the
revised `/api/compare`:

`400 Bad Request`:

```json
{
  "errors": {
    "left": null,
    "right": { "code": "LLB_JSON_PARSE_ERROR", "message": "..." }
  }
}
```

Each of `left`/`right` is `null` if that field was valid, or a
`{code, message}` object (`MISSING_FILE`, `UNSUPPORTED_FORMAT`,
`LLB_JSON_PARSE_ERROR`, `DANGLING_INPUT_REFERENCE`) if invalid. Reuses
`validateUploadedLlbField` unchanged — no new validation rules for this
endpoint.

### Analysis failure (upstream Claude API call failed)

Unchanged.

`502 Bad Gateway`

```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "string — human-readable failure reason"
  }
}
```

## Behavioral notes

- This is the **only** route in the application permitted to make an
  outbound network call (Constitution Principle III), unchanged.
- The response is never merged into, or written back to, the
  `/api/compare` response or any client-side comparison state — unchanged.
- No caching: every call re-validates, re-classifies, and re-calls the
  Claude API from scratch — unchanged.
- What changed: the two input files are now LLB JSON build definitions,
  parsed via `src/adapters/llbjson/`, rather than `.dot` files. The
  `Artifact` handed to `classify()`/`buildDiffSummary()`/`analyzeDiff()` has
  the same shape either way, so `src/analysis/claude.ts` itself is
  unchanged.

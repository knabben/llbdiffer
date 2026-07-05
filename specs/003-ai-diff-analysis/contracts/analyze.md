# Contract: POST /api/analyze

## Request

`multipart/form-data`, identical shape to `POST /api/compare`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `left` | file | yes | A `.dot` file, same validation as `/api/compare`'s `left` field |
| `right` | file | yes | A `.dot` file, same validation as `/api/compare`'s `right` field |

The frontend resubmits the same two `File` objects already held in
`ComparePage` state from the original comparison — it does not require the
user to re-select files.

## Success Response

`200 OK`

```json
{
  "analysis": "string — Claude's narrative explanation of the diff"
}
```

## Error Responses

### Validation failure (bad or unsupported files)

`400 Bad Request` — identical shape to `/api/compare`'s validation error:

```json
{
  "errors": {
    "left": null,
    "right": { "code": "DOT_PARSE_ERROR", "message": "..." }
  }
}
```

Each of `left`/`right` is `null` if that field was valid, or an
`{code, message}` object (same `ArtifactErrorCode` values as
`/api/compare` — `MISSING_FILE`, `UNSUPPORTED_FORMAT`, `DOT_PARSE_ERROR`,
`DANGLING_EDGE_REFERENCE`) if invalid. Reuses `validateUploadedField`
unchanged — no new validation rules for this endpoint.

### Analysis failure (upstream Claude API call failed)

`502 Bad Gateway`

```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "string — human-readable failure reason"
  }
}
```

Covers: missing/invalid API key, network failure reaching the Claude API,
a non-success response from the API, or an empty/missing text response
(see `data-model.md` — `AnalysisResult` validation rules). Distinct from
the `400` validation-failure shape so the frontend can tell "your files
were fine but the AI call failed" (retry-able, per spec FR-009) from "your
files were invalid" (not retry-able without changing input).

## Behavioral notes

- This is the **only** route in the application permitted to make an
  outbound network call (Constitution Principle III / plan.md Constraints).
- The response is never merged into, or written back to, the
  `/api/compare` response or any client-side comparison state — it is
  rendered only in `components/AnalysisPanel.tsx` (spec FR-007, US2).
- No caching: every call re-validates, re-classifies, and re-calls the
  Claude API from scratch (spec Assumptions).

import { adaptDot, DanglingEdgeError } from '../adapters/dot/adapt';
import { DotParseError } from '../adapters/dot/parse';
import type { Artifact } from '../models/artifact';

export type ArtifactErrorCode =
  | 'MISSING_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'DOT_PARSE_ERROR'
  | 'DANGLING_EDGE_REFERENCE';

export interface ArtifactError {
  code: ArtifactErrorCode;
  message: string;
}

export type ArtifactResult = { ok: true; artifact: Artifact } | { ok: false; error: ArtifactError };

const SUPPORTED_EXTENSIONS = ['.dot'];

// Per research.md (001): reasonable default cap to bound parse time/memory.
export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * FR-011/FR-015: reject files that aren't recognizably DOT before parsing
 * them. Deliberately checks the filename extension ONLY, not the browser's
 * reported content-type: `.dot` is also the extension Microsoft Word uses
 * for legacy document templates, so on Windows the browser/OS frequently
 * reports a `.dot` file's MIME type as `application/msword` (or similar)
 * rather than anything Graphviz-related — a real false rejection observed
 * when testing this feature on Windows, not a hypothetical edge case.
 */
export function isSupportedDotFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

/**
 * Runs the DOT adapter and normalizes any failure into a structured,
 * per-side error matching contracts/artifacts-upload.md, per FR-008/FR-009.
 */
export function validateAndAdapt(dotText: string): ArtifactResult {
  try {
    const artifact = adaptDot(dotText);
    return { ok: true, artifact };
  } catch (err) {
    if (err instanceof DanglingEdgeError) {
      return { ok: false, error: { code: 'DANGLING_EDGE_REFERENCE', message: err.message } };
    }
    if (err instanceof DotParseError) {
      return { ok: false, error: { code: 'DOT_PARSE_ERROR', message: err.message } };
    }
    return {
      ok: false,
      error: { code: 'DOT_PARSE_ERROR', message: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Reads and validates one named field from an uploaded FormData request
 * (size cap, supported format, then parse+adapt). Shared by every route
 * that accepts a `.dot` upload (`/api/artifacts`, `/api/compare`), so the
 * MISSING_FILE/UNSUPPORTED_FORMAT rules stay identical across endpoints.
 */
export async function validateUploadedField(form: FormData, field: string): Promise<ArtifactResult> {
  const value = form.get(field);

  if (!(value instanceof File)) {
    return { ok: false, error: { code: 'MISSING_FILE', message: `Missing required '${field}' file` } };
  }

  if (value.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_FORMAT',
        message: `'${field}' exceeds the ${MAX_UPLOAD_SIZE_BYTES} byte upload limit`,
      },
    };
  }

  if (!isSupportedDotFile(value.name)) {
    return {
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: `'${value.name}' (${field}) is not a recognized .dot file` },
    };
  }

  const dotText = await value.text();
  return validateAndAdapt(dotText);
}

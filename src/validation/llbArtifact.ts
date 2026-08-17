import { adaptLlbJson, DanglingInputError } from '../adapters/llbjson/adapt';
import { LlbJsonParseError } from '../adapters/llbjson/parse';
import type { Artifact } from '../models/artifact';
import { MAX_UPLOAD_SIZE_BYTES } from './artifact';

export type LlbArtifactErrorCode =
  | 'MISSING_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'LLB_JSON_PARSE_ERROR'
  | 'DANGLING_INPUT_REFERENCE';

export interface LlbArtifactError {
  code: LlbArtifactErrorCode;
  message: string;
}

export type LlbArtifactResult = { ok: true; artifact: Artifact } | { ok: false; error: LlbArtifactError };

const SUPPORTED_EXTENSIONS = ['.json'];

/**
 * FR-013: this endpoint never accepts `.dot` — filename extension is the
 * only signal checked, mirroring `isSupportedDotFile`'s approach (001).
 */
export function isSupportedLlbJsonFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
}

/**
 * Runs the llbjson adapter and normalizes any failure into a structured
 * error matching contracts/determinism.md.
 */
export function validateAndAdaptLlbJson(jsonText: string): LlbArtifactResult {
  try {
    const artifact = adaptLlbJson(jsonText);
    return { ok: true, artifact };
  } catch (err) {
    if (err instanceof DanglingInputError) {
      return { ok: false, error: { code: 'DANGLING_INPUT_REFERENCE', message: err.message } };
    }
    if (err instanceof LlbJsonParseError) {
      return { ok: false, error: { code: 'LLB_JSON_PARSE_ERROR', message: err.message } };
    }
    return {
      ok: false,
      error: { code: 'LLB_JSON_PARSE_ERROR', message: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Reads and validates one named field from an uploaded FormData request.
 * `required=false` lets `POST /api/determinism`'s optional `secondary`
 * field be simply absent (single-artifact mode, spec FR-001) without that
 * being a validation error — returns `null` in that case, distinct from a
 * `{ok:false}` validation failure.
 */
export async function validateUploadedLlbField(
  form: FormData,
  field: string,
  required: boolean,
): Promise<LlbArtifactResult | null> {
  const value = form.get(field);

  if (!(value instanceof File)) {
    if (!required) return null;
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

  if (!isSupportedLlbJsonFile(value.name)) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_FORMAT',
        message: `'${value.name}' (${field}) is not a recognized LLB JSON file — .dot is not accepted by this endpoint`,
      },
    };
  }

  const jsonText = await value.text();
  return validateAndAdaptLlbJson(jsonText);
}

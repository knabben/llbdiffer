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
const SUPPORTED_CONTENT_TYPES = ['text/vnd.graphviz', 'text/plain', 'application/octet-stream', ''];

/** FR-011/FR-015: reject files that aren't recognizably DOT before parsing them. */
export function isSupportedDotFile(filename: string, contentType: string | null | undefined): boolean {
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext));
  const hasSupportedContentType = contentType == null || SUPPORTED_CONTENT_TYPES.includes(contentType);
  return hasSupportedExtension && hasSupportedContentType;
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

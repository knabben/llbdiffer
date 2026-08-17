import { describe, it, expect } from 'vitest';
import { isSupportedLlbJsonFile, validateAndAdaptLlbJson } from '../../../src/validation/llbArtifact';
import { readLlbJsonFixture } from '../../utils/fixtures';

describe('isSupportedLlbJsonFile (FR-013)', () => {
  it('accepts a .json filename', () => {
    expect(isSupportedLlbJsonFile('before.json')).toBe(true);
  });

  it('rejects a .dot filename — this endpoint never accepts DOT', () => {
    expect(isSupportedLlbJsonFile('before.dot')).toBe(false);
  });
});

describe('validateAndAdaptLlbJson', () => {
  it('returns ok:true with the canonical artifact for valid LLB JSON', () => {
    const result = validateAndAdaptLlbJson(readLlbJsonFixture('clean.json'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact.schemaVersion).toBe('1.1.0');
    }
  });

  it('returns LLB_JSON_PARSE_ERROR for malformed input', () => {
    const result = validateAndAdaptLlbJson(readLlbJsonFixture('malformed.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LLB_JSON_PARSE_ERROR');
    }
  });

  it('returns DANGLING_INPUT_REFERENCE for an input referencing an undeclared digest', () => {
    const raw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [{ digest: 'sha256:missing' }], Op: { build: {} } }, OpMetadata: {} },
    ]);
    const result = validateAndAdaptLlbJson(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DANGLING_INPUT_REFERENCE');
    }
  });
});

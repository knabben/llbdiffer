import { describe, it, expect } from 'vitest';
import { isSupportedDotFile, validateAndAdapt } from '../../../src/validation/artifact';
import { readDotFixture } from '../../utils/fixtures';

describe('isSupportedDotFile (FR-011)', () => {
  it('accepts a .dot filename regardless of reported content-type', () => {
    expect(isSupportedDotFile('before.dot')).toBe(true);
  });

  it('rejects a non-.dot filename', () => {
    expect(isSupportedDotFile('before.json')).toBe(false);
  });

  it('accepts a .dot file even when the OS/browser reports a Word-template MIME type', () => {
    // Regression test: on Windows, .dot is also the legacy Microsoft Word
    // template extension, so the browser may report content-type as
    // application/msword. Filename extension is the only signal checked.
    expect(isSupportedDotFile('before.dot')).toBe(true);
  });
});

describe('validateAndAdapt', () => {
  it('returns ok:true with the canonical artifact for valid DOT', () => {
    const result = validateAndAdapt(readDotFixture('valid-before.dot'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact.schemaVersion).toBe('1.0.0');
    }
  });

  it('returns a DOT_PARSE_ERROR for malformed syntax', () => {
    const result = validateAndAdapt(readDotFixture('invalid-syntax.dot'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DOT_PARSE_ERROR');
    }
  });

  it('returns a DANGLING_EDGE_REFERENCE for an edge to an undeclared node', () => {
    const result = validateAndAdapt(readDotFixture('dangling-edge.dot'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DANGLING_EDGE_REFERENCE');
    }
  });

  it('validates each side independently (no shared state between calls)', () => {
    const validResult = validateAndAdapt(readDotFixture('valid-before.dot'));
    const invalidResult = validateAndAdapt(readDotFixture('invalid-syntax.dot'));
    expect(validResult.ok).toBe(true);
    expect(invalidResult.ok).toBe(false);
  });
});

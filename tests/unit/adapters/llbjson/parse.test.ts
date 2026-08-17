import { describe, it, expect } from 'vitest';
import { parseLlbJson, LlbJsonParseError } from '../../../../src/adapters/llbjson/parse';
import { readLlbJsonFixture } from '../../../utils/fixtures';

describe('parseLlbJson', () => {
  it('parses a JSON-array-framed dump into typed records', () => {
    const { records } = parseLlbJson(readLlbJsonFixture('clean.json'));
    expect(records.length).toBe(5);
    expect(records[0].op.kind).toBe('source');
    expect(records[3].op.kind).toBe('exec');
  });

  it('derives input ordinals from array position (real dumps omit the wire index field)', () => {
    const { records } = parseLlbJson(readLlbJsonFixture('clean.json'));
    const copy = records[2];
    expect(copy.inputs).toEqual([
      { digest: 'sha256:aaaa000000000000000000000000000000000000000000000000000000001', index: 0 },
      { digest: 'sha256:aaaa000000000000000000000000000000000000000000000000000000002', index: 1 },
    ]);
  });

  it('parses opMetadata.ignoreCache', () => {
    const { records } = parseLlbJson(readLlbJsonFixture('clean.json'));
    expect(records.every((r) => r.opMetadata.ignoreCache === false)).toBe(true);
  });

  it('throws LlbJsonParseError for malformed input', () => {
    expect(() => parseLlbJson(readLlbJsonFixture('malformed.json'))).toThrow(LlbJsonParseError);
  });

  it('throws LlbJsonParseError for empty input', () => {
    expect(() => parseLlbJson('')).toThrow(LlbJsonParseError);
  });

  it('tolerates newline-delimited JSON framing (not just a JSON array)', () => {
    const ndjson = [
      JSON.stringify({ Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://x', attrs: {} } } }, OpMetadata: { ignoreCache: false } }),
      JSON.stringify({ Digest: 'sha256:b', Op: { inputs: [{ digest: 'sha256:a' }], Op: { build: {} } }, OpMetadata: { ignoreCache: false } }),
    ].join('\n');
    const { records } = parseLlbJson(ndjson);
    expect(records.length).toBe(2);
    expect(records[1].op.kind).toBe('build');
  });

  it('treats a genuinely empty oneof as the definition-terminator record, not an error', () => {
    const raw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://x', attrs: {} } } }, OpMetadata: {} },
      { Digest: 'sha256:b', Op: { inputs: [{ digest: 'sha256:a' }], Op: {} }, OpMetadata: {} },
    ]);
    const { records } = parseLlbJson(raw);
    expect(records[1].op.kind).toBe('meta');
  });

  it('tolerates PascalCase (Go struct) field casing', () => {
    const raw = JSON.stringify([
      {
        Digest: 'sha256:a',
        Op: { Inputs: [], Op: { Source: { Identifier: 'docker-image://x@sha256:deadbeef', Attrs: {} } } },
        OpMetadata: { IgnoreCache: true },
      },
    ]);
    const { records } = parseLlbJson(raw);
    expect(records[0].digest).toBe('sha256:a');
    expect(records[0].op.kind).toBe('source');
    expect(records[0].opMetadata.ignoreCache).toBe(true);
  });
});

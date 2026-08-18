// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/compare/route';

function buildRequest(left: File, right: File): Request {
  const form = new FormData();
  form.set('left', left);
  form.set('right', right);
  return new Request('http://localhost/api/compare', { method: 'POST', body: form });
}

function jsonFile(name: string, text: string): File {
  return new File([text], name, { type: 'application/json' });
}

describe('POST /api/compare - invalid file (US2)', () => {
  it('returns a 400 with UNSUPPORTED_FORMAT when a .dot file is uploaded — this endpoint no longer accepts DOT', async () => {
    const left = new File(['digraph {}'], 'left.dot', { type: 'text/vnd.graphviz' });
    const right = jsonFile('right.json', readLlbJsonFixture('added-op-after.json'));

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left.code).toBe('UNSUPPORTED_FORMAT');
    expect(body.errors.right).toBeNull();
  });

  it('returns a 400 with LLB_JSON_PARSE_ERROR for malformed JSON', async () => {
    const left = jsonFile('left.json', readLlbJsonFixture('malformed.json'));
    const right = jsonFile('right.json', readLlbJsonFixture('added-op-after.json'));

    const response = await POST(buildRequest(left, right));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.left.code).toBe('LLB_JSON_PARSE_ERROR');
  });

  it('returns a 400 identifying a dangling input reference', async () => {
    const danglingRaw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [{ digest: 'sha256:missing' }], Op: { build: {} } }, OpMetadata: {} },
    ]);
    const left = jsonFile('left.json', danglingRaw);
    const right = jsonFile('right.json', readLlbJsonFixture('added-op-after.json'));

    const response = await POST(buildRequest(left, right));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.left.code).toBe('DANGLING_INPUT_REFERENCE');
  });
});

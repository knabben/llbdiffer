// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readDotFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/compare/route';

function buildRequest(leftDot: string, rightDot: string): Request {
  const form = new FormData();
  form.set('left', new File([leftDot], 'left.dot', { type: 'text/vnd.graphviz' }));
  form.set('right', new File([rightDot], 'right.dot', { type: 'text/vnd.graphviz' }));
  return new Request('http://localhost/api/compare', { method: 'POST', body: form });
}

describe('POST /api/compare - invalid file (US4)', () => {
  it('returns a 400 with per-side error detail when one file is invalid', async () => {
    const left = readDotFixture('invalid-syntax.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left.code).toBe('DOT_PARSE_ERROR');
    expect(body.errors.right).toBeNull();
  });

  it('returns a 400 identifying a dangling edge reference', async () => {
    const left = readDotFixture('dangling-edge.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.left.code).toBe('DANGLING_EDGE_REFERENCE');
  });
});

import { describe, it, expect } from 'vitest';
import { readDotFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/artifacts/route';

function buildRequest(leftDot: string, rightDot: string): Request {
  const form = new FormData();
  form.set('left', new File([leftDot], 'left.dot', { type: 'text/vnd.graphviz' }));
  form.set('right', new File([rightDot], 'right.dot', { type: 'text/vnd.graphviz' }));
  return new Request('http://localhost/api/artifacts', { method: 'POST', body: form });
}

describe('POST /api/artifacts - dangling edge reference (US2)', () => {
  it('rejects a dangling edge reference with a 400 and DANGLING_EDGE_REFERENCE', async () => {
    const left = readDotFixture('dangling-edge.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left.code).toBe('DANGLING_EDGE_REFERENCE');
    expect(body.errors.right).toBeNull();
  });

  it('reports independent errors when both sides are invalid', async () => {
    const left = readDotFixture('dangling-edge.dot');
    const right = readDotFixture('invalid-syntax.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left.code).toBe('DANGLING_EDGE_REFERENCE');
    expect(body.errors.right.code).toBe('DOT_PARSE_ERROR');
  });
});

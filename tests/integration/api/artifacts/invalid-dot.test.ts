// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readDotFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/artifacts/route';

function buildRequest(leftDot: string, rightDot: string): Request {
  const form = new FormData();
  form.set('left', new File([leftDot], 'left.dot', { type: 'text/vnd.graphviz' }));
  form.set('right', new File([rightDot], 'right.dot', { type: 'text/vnd.graphviz' }));
  return new Request('http://localhost/api/artifacts', { method: 'POST', body: form });
}

describe('POST /api/artifacts - invalid DOT syntax (US2)', () => {
  it('rejects malformed DOT with a 400 and DOT_PARSE_ERROR', async () => {
    const left = readDotFixture('invalid-syntax.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left.code).toBe('DOT_PARSE_ERROR');
    expect(body.errors.right).toBeNull();
  });
});

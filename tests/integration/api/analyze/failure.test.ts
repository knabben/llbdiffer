// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readDotFixture } from '../../../utils/fixtures';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

function buildRequest(leftDot: string, rightDot: string): Request {
  const form = new FormData();
  form.set('left', new File([leftDot], 'left.dot', { type: 'text/vnd.graphviz' }));
  form.set('right', new File([rightDot], 'right.dot', { type: 'text/vnd.graphviz' }));
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}

describe('POST /api/analyze - failure handling (US3)', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('returns 502 ANALYSIS_FAILED when the Claude API call throws', async () => {
    create.mockRejectedValue(new Error('upstream provider error'));
    const { POST } = await import('../../../../app/api/analyze/route');

    const left = readDotFixture('valid-before.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.error.code).toBe('ANALYSIS_FAILED');
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 400 with per-side errors when a file is invalid, without calling Claude', async () => {
    const { POST } = await import('../../../../app/api/analyze/route');

    const form = new FormData();
    form.set('left', new File(['not a dot file'], 'left.txt', { type: 'text/plain' }));
    form.set('right', new File([readDotFixture('valid-after.dot')], 'right.dot', { type: 'text/vnd.graphviz' }));
    const request = new Request('http://localhost/api/analyze', { method: 'POST', body: form });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.errors.left).not.toBeNull();
    expect(body.errors.right).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

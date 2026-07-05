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

describe('POST /api/analyze - happy path (US1)', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('accepts two valid .dot files and returns the narrative analysis', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'These builds differ in one RUN step.' }] });
    const { POST } = await import('../../../../app/api/analyze/route');

    const left = readDotFixture('valid-before.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.analysis).toBe('These builds differ in one RUN step.');
  });
});

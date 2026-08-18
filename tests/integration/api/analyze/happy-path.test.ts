// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

function buildRequest(leftJson: string, rightJson: string): Request {
  const form = new FormData();
  form.set('left', new File([leftJson], 'left.json', { type: 'application/json' }));
  form.set('right', new File([rightJson], 'right.json', { type: 'application/json' }));
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}

describe('POST /api/analyze - happy path (US1)', () => {
  beforeEach(() => {
    create.mockReset();
  });

  it('accepts two valid LLB JSON files and returns the narrative analysis', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'These builds differ in one RUN step.' }] });
    const { POST } = await import('../../../../app/api/analyze/route');

    const left = readLlbJsonFixture('added-op-before.json');
    const right = readLlbJsonFixture('added-op-after.json');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.analysis).toBe('These builds differ in one RUN step.');
  });
});

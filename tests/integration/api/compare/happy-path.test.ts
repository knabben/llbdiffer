// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/compare/route';

function buildRequest(leftJson: string, rightJson: string): Request {
  const form = new FormData();
  form.set('left', new File([leftJson], 'left.json', { type: 'application/json' }));
  form.set('right', new File([rightJson], 'right.json', { type: 'application/json' }));
  return new Request('http://localhost/api/compare', { method: 'POST', body: form });
}

describe('POST /api/compare - happy path (US1)', () => {
  it('accepts two valid LLB JSON files and returns a well-formed ComparisonResult', async () => {
    const left = readLlbJsonFixture('added-op-before.json');
    const right = readLlbJsonFixture('added-op-after.json');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.left.dot).toBe('string');
    expect(typeof body.right.dot).toBe('string');
    expect(Array.isArray(body.left.hashes)).toBe(true);
    expect(Array.isArray(body.right.hashes)).toBe(true);
    expect(body.summary.added.length).toBeGreaterThan(0);
    expect(body.summary.shared.length).toBeGreaterThan(0);
    expect(body.identical).toBe(false);
  });

  it('reports identical: true when both files are the same', async () => {
    const json = readLlbJsonFixture('clean.json');
    const response = await POST(buildRequest(json, json));
    const body = await response.json();

    expect(body.identical).toBe(true);
    expect(body.summary.added).toEqual([]);
    expect(body.summary.removed).toEqual([]);
  });
});

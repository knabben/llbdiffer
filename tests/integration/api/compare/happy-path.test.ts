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

describe('POST /api/compare - happy path (US1)', () => {
  it('accepts two valid .dot files and returns a well-formed ComparisonResult', async () => {
    const left = readDotFixture('valid-before.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.left.dot).toBe('string');
    expect(typeof body.right.dot).toBe('string');
    expect(Array.isArray(body.left.hashes)).toBe(true);
    expect(Array.isArray(body.right.hashes)).toBe(true);
    expect(body.summary.added.length).toBeGreaterThan(0);
    expect(body.summary.removed.length).toBeGreaterThan(0);
    expect(body.summary.shared.length).toBeGreaterThan(0);
    expect(body.identical).toBe(false);
  });

  it('reports identical: true when both files are the same', async () => {
    const dot = readDotFixture('valid-before.dot');
    const response = await POST(buildRequest(dot, dot));
    const body = await response.json();

    expect(body.identical).toBe(true);
    expect(body.summary.added).toEqual([]);
    expect(body.summary.removed).toEqual([]);
  });
});

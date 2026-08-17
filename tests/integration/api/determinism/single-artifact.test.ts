// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/determinism/route';

function buildRequest(primaryJson: string, primaryName = 'primary.json'): Request {
  const form = new FormData();
  form.set('primary', new File([primaryJson], primaryName, { type: 'application/json' }));
  return new Request('http://localhost/api/determinism', { method: 'POST', body: form });
}

describe('POST /api/determinism - single-artifact mode (US1)', () => {
  it('reports mode:"single" and the expected Structural finding for an unpinned base image', async () => {
    const response = await POST(buildRequest(readLlbJsonFixture('unpinned-base.json')));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.report.mode).toBe('single');
    expect(body.report.identical).toBe(false);
    expect(body.report.findings.some((f: { causeCode: string }) => f.causeCode === 'UNPINNED_BASE')).toBe(true);
    expect(body.primary.dot).toContain('digraph');
    expect(body.secondary).toBeUndefined();
  });

  it('states nothing was found for a clean artifact', async () => {
    const response = await POST(buildRequest(readLlbJsonFixture('clean.json')));
    const body = await response.json();

    expect(body.report.identical).toBe(true);
    expect(body.report.findings).toEqual([]);
  });
});

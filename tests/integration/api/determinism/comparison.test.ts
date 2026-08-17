// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/determinism/route';

function buildRequest(primaryJson: string, secondaryJson: string): Request {
  const form = new FormData();
  form.set('primary', new File([primaryJson], 'primary.json', { type: 'application/json' }));
  form.set('secondary', new File([secondaryJson], 'secondary.json', { type: 'application/json' }));
  return new Request('http://localhost/api/determinism', { method: 'POST', body: form });
}

describe('POST /api/determinism - comparison mode (US2)', () => {
  it('reports one root-cause finding with the correct blast radius, no separate cascaded findings', async () => {
    const response = await POST(buildRequest(readLlbJsonFixture('unsorted-env-before.json'), readLlbJsonFixture('unsorted-env-after.json')));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.report.mode).toBe('comparison');
    const proven = body.report.findings.filter((f: { tier: string }) => f.tier === 'proven');
    expect(proven).toHaveLength(1);
    expect(proven[0].causeCode).toBe('UNSORTED_ENV');
    expect(proven[0].blastRadius).toBe(2);
  });

  it('reports identical:true for two identical artifacts', async () => {
    const clean = readLlbJsonFixture('clean.json');
    const response = await POST(buildRequest(clean, clean));
    const body = await response.json();

    expect(body.report.identical).toBe(true);
    expect(body.report.findings).toEqual([]);
  });
});

describe('POST /api/determinism - structural changes (US3)', () => {
  it('distinguishes an added operation from content-modified ones', async () => {
    const response = await POST(buildRequest(readLlbJsonFixture('added-op-before.json'), readLlbJsonFixture('added-op-after.json')));
    const body = await response.json();

    expect(body.report.structuralChanges.some((c: { status: string }) => c.status === 'added')).toBe(true);
    expect(body.report.findings.filter((f: { tier: string }) => f.tier === 'proven')).toEqual([]);
  });

  it('distinguishes moved operations from added/removed/modified', async () => {
    const response = await POST(buildRequest(readLlbJsonFixture('moved-inputs-before.json'), readLlbJsonFixture('moved-inputs-after.json')));
    const body = await response.json();

    const moved = body.report.structuralChanges.filter((c: { status: string }) => c.status === 'moved');
    // 2 moved ops, each contributing a left-side and right-side entry.
    expect(moved.length).toBe(4);
    expect(new Set(moved.map((c: { nodeId: string }) => c.nodeId)).size).toBe(2);
    expect(body.report.structuralChanges.some((c: { status: string }) => c.status === 'added' || c.status === 'removed')).toBe(false);
  });
});

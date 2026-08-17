// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readLlbJsonFixture } from '../../../utils/fixtures';
import { POST } from '../../../../app/api/determinism/route';

describe('POST /api/determinism - errors', () => {
  it('returns 400 with LLB_JSON_PARSE_ERROR for a malformed primary file', async () => {
    const form = new FormData();
    form.set('primary', new File([readLlbJsonFixture('malformed.json')], 'malformed.json', { type: 'application/json' }));
    const response = await POST(new Request('http://localhost/api/determinism', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.primary.code).toBe('LLB_JSON_PARSE_ERROR');
    expect(body.errors.secondary).toBeNull();
  });

  it('returns 400 with MISSING_FILE when primary is absent', async () => {
    const form = new FormData();
    const response = await POST(new Request('http://localhost/api/determinism', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.primary.code).toBe('MISSING_FILE');
  });

  it('rejects a .dot upload with UNSUPPORTED_FORMAT — this endpoint never accepts DOT (FR-013)', async () => {
    const form = new FormData();
    form.set('primary', new File(['digraph {}'], 'before.dot', { type: 'text/vnd.graphviz' }));
    const response = await POST(new Request('http://localhost/api/determinism', { method: 'POST', body: form }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.primary.code).toBe('UNSUPPORTED_FORMAT');
  });
});

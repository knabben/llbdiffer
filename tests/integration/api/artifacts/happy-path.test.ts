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

describe('POST /api/artifacts - happy path (US1)', () => {
  it('accepts two valid .dot files and returns canonical artifacts', async () => {
    const left = readDotFixture('valid-before.dot');
    const right = readDotFixture('valid-after.dot');

    const response = await POST(buildRequest(left, right));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.left.schemaVersion).toBe('1.0.0');
    expect(body.right.schemaVersion).toBe('1.0.0');
    expect(Array.isArray(body.left.nodes)).toBe(true);
    expect(body.left.nodes.length).toBe(6);
    expect(Array.isArray(body.left.edges)).toBe(true);
    expect(body.left.edges.length).toBe(5);

    const imageNode = body.left.nodes.find(
      (n: { id: string }) => n.id === 'sha256:db139405ef52076a3f9f245d778e9f130216a7bd89b5766fb6d39fc2f6fa7d68',
    );
    expect(imageNode.metadata.command).toBe(
      'docker-image://docker.io/library/alpine:3.19@sha256:6baf43584bcb78f2e5847d1de515f23499913ac9f12bdf834811a3145eb11ca1',
    );
  });
});

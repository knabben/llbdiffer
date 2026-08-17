import { describe, it, expect } from 'vitest';
import { adaptLlbJson } from '../../../src/adapters/llbjson/adapt';
import { alignArtifacts, computeShapeKeys } from '../../../src/align/shapeKey';
import { readLlbJsonFixture } from '../../utils/fixtures';

function statusOf(pairs: ReturnType<typeof alignArtifacts>, id: string, side: 'left' | 'right') {
  return pairs.find((p) => (side === 'left' ? p.left?.id === id : p.right?.id === id))?.status;
}

describe('computeShapeKeys', () => {
  it('gives two structurally-identical single-node artifacts the same shape key regardless of content', () => {
    const a = adaptLlbJson(
      JSON.stringify([{ Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'docker-image://x', attrs: {} } } }, OpMetadata: {} }]),
    );
    const b = adaptLlbJson(
      JSON.stringify([{ Digest: 'sha256:b', Op: { inputs: [], Op: { source: { identifier: 'docker-image://y', attrs: {} } } }, OpMetadata: {} }]),
    );
    const keysA = computeShapeKeys(a);
    const keysB = computeShapeKeys(b);
    expect(keysA.get('sha256:a')).toBe(keysB.get('sha256:b'));
  });

  it('gives two ops of a different kind different shape keys', () => {
    const a = adaptLlbJson(
      JSON.stringify([{ Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'docker-image://x', attrs: {} } } }, OpMetadata: {} }]),
    );
    const b = adaptLlbJson(JSON.stringify([{ Digest: 'sha256:b', Op: { inputs: [], Op: { build: {} } }, OpMetadata: {} }]));
    const keysA = computeShapeKeys(a);
    const keysB = computeShapeKeys(b);
    expect(keysA.get('sha256:a')).not.toBe(keysB.get('sha256:b'));
  });
});

describe('alignArtifacts — shared/modified (US2)', () => {
  const left = adaptLlbJson(readLlbJsonFixture('unsorted-env-before.json'));
  const right = adaptLlbJson(readLlbJsonFixture('unsorted-env-after.json'));
  const pairs = alignArtifacts(left, right);

  it('aligns unchanged upstream ops (different digests would break id-based matching) as shared', () => {
    // img/ctx/copy share the same digest across both fixtures here, but the
    // point of shape-key alignment is that this isn't required — content
    // equality is what determines 'shared', not id equality.
    expect(statusOf(pairs, 'sha256:cccc000000000000000000000000000000000000000000000000000000001', 'left')).toBe('shared');
    expect(statusOf(pairs, 'sha256:cccc000000000000000000000000000000000000000000000000000000003', 'left')).toBe('shared');
  });

  it('classifies the env-reordered op as modified', () => {
    expect(statusOf(pairs, 'sha256:cccc000000000000000000000000000000000000000000000000000000004', 'left')).toBe('modified');
  });

  it('aligns run3 (different digest, identical own content) as shared despite digest chaining from its changed ancestors', () => {
    const run3Left = pairs.find((p) => p.left?.id === 'sha256:cccc000000000000000000000000000000000000000000000000000000006');
    expect(run3Left?.status).toBe('shared');
    expect(run3Left?.right?.id).toBe('sha256:dddd000000000000000000000000000000000000000000000000000000006');
  });
});

describe('alignArtifacts — added (US3)', () => {
  const left = adaptLlbJson(readLlbJsonFixture('added-op-before.json'));
  const right = adaptLlbJson(readLlbJsonFixture('added-op-after.json'));
  const pairs = alignArtifacts(left, right);

  it('classifies the appended operation as added, not modified', () => {
    expect(statusOf(pairs, 'sha256:ffff000000000000000000000000000000000000000000000000000000005', 'right')).toBe('added');
  });

  it('does not cascade a false "modified" status onto the unchanged upstream chain', () => {
    for (const id of [
      'sha256:ffff000000000000000000000000000000000000000000000000000000001',
      'sha256:ffff000000000000000000000000000000000000000000000000000000002',
      'sha256:ffff000000000000000000000000000000000000000000000000000000003',
      'sha256:ffff000000000000000000000000000000000000000000000000000000004',
    ]) {
      expect(statusOf(pairs, id, 'left')).toBe('shared');
    }
  });
});

describe('alignArtifacts — moved (US3)', () => {
  const left = adaptLlbJson(readLlbJsonFixture('moved-inputs-before.json'));
  const right = adaptLlbJson(readLlbJsonFixture('moved-inputs-after.json'));
  const pairs = alignArtifacts(left, right);

  it('classifies two same-content ops whose input ordinal swapped as moved, not modified', () => {
    expect(statusOf(pairs, 'sha256:eeee000000000000000000000000000000000000000000000000000000001', 'left')).toBe('moved');
    expect(statusOf(pairs, 'sha256:eeee000000000000000000000000000000000000000000000000000000002', 'left')).toBe('moved');
  });

  it('leaves the consumer (whose own content is unchanged) shared', () => {
    expect(statusOf(pairs, 'sha256:eeee000000000000000000000000000000000000000000000000000000003', 'left')).toBe('shared');
  });
});

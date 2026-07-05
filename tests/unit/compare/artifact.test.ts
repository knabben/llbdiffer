// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { classify, buildDiffSummary, isIdentical } from '../../../src/compare/artifact';
import type { Artifact } from '../../../src/models/artifact';

function makeArtifact(nodeIds: string[], edges: [string, string][]): Artifact {
  return {
    schemaVersion: '1.0.0',
    nodes: nodeIds.map((id) => ({ id, label: id, metadata: { command: id } })),
    edges: edges.map(([source, target]) => ({ source, target })),
  };
}

describe('classify', () => {
  it('marks matching ids as shared and non-matching ids as unique', () => {
    const left = makeArtifact(['a', 'b'], [['a', 'b']]);
    const right = makeArtifact(['a', 'c'], [['a', 'c']]);

    const result = classify(left, right);

    expect(result.left.nodes).toEqual([
      { id: 'a', status: 'shared' },
      { id: 'b', status: 'unique' },
    ]);
    expect(result.right.nodes).toEqual([
      { id: 'a', status: 'shared' },
      { id: 'c', status: 'unique' },
    ]);
    expect(result.left.edges).toEqual([{ source: 'a', target: 'b', status: 'unique' }]);
    expect(result.right.edges).toEqual([{ source: 'a', target: 'c', status: 'unique' }]);
  });

  it('marks everything shared when both artifacts are identical', () => {
    const artifact = makeArtifact(['a', 'b'], [['a', 'b']]);
    const result = classify(artifact, artifact);

    expect(result.left.nodes.every((n) => n.status === 'shared')).toBe(true);
    expect(result.right.nodes.every((n) => n.status === 'shared')).toBe(true);
    expect(result.left.edges.every((e) => e.status === 'shared')).toBe(true);
  });

  it('reports shared when the same id has a different label on each side (e.g. a source op resolved to a different digest)', () => {
    // A docker-image:// source op can keep the same LLB vertex id across
    // two builds even when the resolved digest shown in its label differs
    // (a floating tag resolved at different times) — id is the only
    // identity signal, label content is not part of node identity.
    const left: Artifact = {
      schemaVersion: '1.0.0',
      nodes: [{ id: 'shared-id', label: 'before content', metadata: { command: 'before content' } }],
      edges: [],
    };
    const right: Artifact = {
      schemaVersion: '1.0.0',
      nodes: [{ id: 'shared-id', label: 'after content', metadata: { command: 'after content' } }],
      edges: [],
    };

    const result = classify(left, right);

    expect(result.left.nodes).toEqual([{ id: 'shared-id', status: 'shared' }]);
    expect(result.right.nodes).toEqual([{ id: 'shared-id', status: 'shared' }]);
  });
});

describe('buildDiffSummary / isIdentical', () => {
  it('reports added/removed/shared correctly', () => {
    const left = makeArtifact(['a', 'b'], [['a', 'b']]);
    const right = makeArtifact(['a', 'c'], [['a', 'c']]);
    const summary = buildDiffSummary(classify(left, right));

    expect(summary.shared).toEqual([{ kind: 'node', ref: 'a' }]);
    expect(summary.removed).toContainEqual({ kind: 'node', ref: 'b' });
    expect(summary.added).toContainEqual({ kind: 'node', ref: 'c' });
    expect(summary.removed).toContainEqual({ kind: 'edge', ref: 'a->b' });
    expect(summary.added).toContainEqual({ kind: 'edge', ref: 'a->c' });
    expect(isIdentical(summary)).toBe(false);
  });

  it('reports identical: true only when added and removed are both empty', () => {
    const artifact = makeArtifact(['a', 'b'], [['a', 'b']]);
    const summary = buildDiffSummary(classify(artifact, artifact));

    expect(summary.added).toEqual([]);
    expect(summary.removed).toEqual([]);
    expect(isIdentical(summary)).toBe(true);
  });
});

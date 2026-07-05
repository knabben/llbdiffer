// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderClassifiedDot } from '../../../../src/adapters/dot/render';
import { classify } from '../../../../src/compare/artifact';
import type { Artifact } from '../../../../src/models/artifact';

function makeArtifact(nodeIds: string[], edges: [string, string][]): Artifact {
  return {
    schemaVersion: '1.0.0',
    nodes: nodeIds.map((id) => ({ id, label: `label-${id}`, metadata: { command: `label-${id}` } })),
    edges: edges.map(([source, target]) => ({ source, target })),
  };
}

describe('renderClassifiedDot', () => {
  it('applies removed (red) for unique-left nodes and neutral gray for shared nodes', () => {
    const left = makeArtifact(['sha256:aaa', 'sha256:bbb'], [['sha256:aaa', 'sha256:bbb']]);
    const right = makeArtifact(['sha256:aaa', 'sha256:ccc'], [['sha256:aaa', 'sha256:ccc']]);
    const classification = classify(left, right);

    const dot = renderClassifiedDot(left, classification.left, 'removed');

    // Node ids containing colons must round-trip correctly (not be split as
    // Graphviz "id:port" references) — the bug this test guards against.
    expect(dot).toContain('"sha256:aaa"');
    expect(dot).toContain('"sha256:bbb"');
    expect(dot).not.toMatch(/"sha256":"aaa"/);

    const sharedNodeBlock = dot.slice(dot.indexOf('"sha256:aaa"'), dot.indexOf('"sha256:bbb"'));
    const uniqueNodeBlock = dot.slice(dot.indexOf('"sha256:bbb"'));
    expect(sharedNodeBlock).toContain('#8b8b8b');
    expect(uniqueNodeBlock).toContain('#f87171');
  });

  it('applies added (green) for unique-right nodes', () => {
    const left = makeArtifact(['sha256:aaa'], []);
    const right = makeArtifact(['sha256:aaa', 'sha256:ccc'], []);
    const classification = classify(left, right);

    const dot = renderClassifiedDot(right, classification.right, 'added');
    const uniqueNodeBlock = dot.slice(dot.indexOf('"sha256:ccc"'));
    expect(uniqueNodeBlock).toContain('#34d399');
  });

  it('preserves the original label as the rendered node label', () => {
    const artifact = makeArtifact(['sha256:aaa'], []);
    const classification = classify(artifact, artifact);
    const dot = renderClassifiedDot(artifact, classification.left, 'removed');
    expect(dot).toContain('label = "label-sha256:aaa"');
  });
});

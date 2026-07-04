import { describe, it, expect } from 'vitest';
import { adaptDot, DanglingEdgeError } from '../../../../src/adapters/dot/adapt';
import { readDotFixture } from '../../../utils/fixtures';

describe('adaptDot (US1: verbatim command preservation)', () => {
  it('preserves a structured, free-form label verbatim in metadata.command', () => {
    const artifact = adaptDot(readDotFixture('valid-before.dot'));
    const copyNode = artifact.nodes.find(
      (n) => n.id === 'sha256:6eb57b7e14687f129e08fe01962b81d7d217a8164bd30b35b6c4554f54d26d6a',
    );
    expect(copyNode).toBeDefined();
    expect(copyNode?.metadata.command).toBe('copy{src=/app.sh, dest=/usr/local/bin/app.sh}');
    expect(copyNode?.label).toBe('copy{src=/app.sh, dest=/usr/local/bin/app.sh}');
  });
});

describe('adaptDot (US3: adapter hardening)', () => {
  it('defaults metadata.command to the node id when no explicit label is present', () => {
    const artifact = adaptDot('digraph { "sha256:no-label-node"; }');
    expect(artifact.nodes).toHaveLength(1);
    expect(artifact.nodes[0].id).toBe('sha256:no-label-node');
    expect(artifact.nodes[0].label).toBe('sha256:no-label-node');
    expect(artifact.nodes[0].metadata.command).toBe('sha256:no-label-node');
  });

  it('preserves extra DOT node attributes (e.g. shape) as opaque metadata keys', () => {
    const artifact = adaptDot('digraph { "sha256:box" [label="do a thing" shape="box"]; }');
    const node = artifact.nodes[0];
    expect(node.metadata.command).toBe('do a thing');
    expect(node.metadata.shape).toBe('box');
  });

  it('rejects edges that reference an undeclared node id', () => {
    expect(() => adaptDot(readDotFixture('dangling-edge.dot'))).toThrow(DanglingEdgeError);
  });
});

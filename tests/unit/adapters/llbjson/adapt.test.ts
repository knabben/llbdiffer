import { describe, it, expect } from 'vitest';
import { adaptLlbJson, DanglingInputError } from '../../../../src/adapters/llbjson/adapt';
import { readLlbJsonFixture } from '../../../utils/fixtures';

describe('adaptLlbJson', () => {
  it('produces the canonical Artifact schema, schemaVersion 1.1.0', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    expect(artifact.schemaVersion).toBe('1.1.0');
    expect(artifact.nodes.length).toBe(5);
    expect(artifact.edges.length).toBe(4);
  });

  it('populates Node.llb with the typed op + opMetadata', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const imgNode = artifact.nodes.find((n) => n.id === 'sha256:aaaa000000000000000000000000000000000000000000000000000000001');
    expect(imgNode?.llb?.op.kind).toBe('source');
    expect(imgNode?.label).toContain('docker-image://');
  });

  it('populates Edge.inputIndex from input array position', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const copyEdges = artifact.edges.filter((e) => e.target === 'sha256:aaaa000000000000000000000000000000000000000000000000000000003');
    expect(copyEdges.map((e) => e.inputIndex).sort()).toEqual([0, 1]);
  });

  it('derives a label/command from meta.args for exec ops', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const run1 = artifact.nodes.find((n) => n.id === 'sha256:aaaa000000000000000000000000000000000000000000000000000000004');
    expect(run1?.metadata.command).toBe('/bin/sh -c echo step-one');
  });

  it('throws DanglingInputError when an input references an undeclared digest', () => {
    const raw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [{ digest: 'sha256:missing' }], Op: { build: {} } }, OpMetadata: {} },
    ]);
    expect(() => adaptLlbJson(raw)).toThrow(DanglingInputError);
  });

  it('populates Edge.mountDest for ExecOp mounts referencing a given input', () => {
    const raw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
      {
        Digest: 'sha256:b',
        Op: {
          inputs: [{ digest: 'sha256:a' }],
          Op: {
            exec: {
              meta: { args: ['/bin/sh'], env: [], cwd: '/', user: 'root' },
              mounts: [{ dest: '/mnt/cache', input: 0 }],
              network: 'UNSET',
              security: 'SANDBOX',
            },
          },
        },
        OpMetadata: {},
      },
    ]);
    const artifact = adaptLlbJson(raw);
    const edge = artifact.edges.find((e) => e.source === 'sha256:a' && e.target === 'sha256:b');
    expect(edge?.mountDest).toBe('/mnt/cache');
  });

  it('produces a "(meta)" label for the definition-terminator record', () => {
    const raw = JSON.stringify([
      { Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
      { Digest: 'sha256:b', Op: { inputs: [{ digest: 'sha256:a' }], Op: {} }, OpMetadata: {} },
    ]);
    const artifact = adaptLlbJson(raw);
    const meta = artifact.nodes.find((n) => n.id === 'sha256:b');
    expect(meta?.llb?.op.kind).toBe('meta');
    expect(meta?.label).toBe('(meta)');
  });
});

import { describe, it, expect } from 'vitest';
import { adaptLlbJson } from '../../../src/adapters/llbjson/adapt';
import {
  describeDivergence,
  detectHeuristicFindings,
  detectProvenFinding,
  detectStructuralFindings,
  nodeContentEqual,
} from '../../../src/detect/rules';
import { readLlbJsonFixture } from '../../utils/fixtures';
import type { Node } from '../../../src/models/artifact';

function nodeById(artifact: ReturnType<typeof adaptLlbJson>, id: string): Node {
  const node = artifact.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`fixture missing node ${id}`);
  return node;
}

describe('detectStructuralFindings', () => {
  it('finds nothing on a fully clean artifact', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const findings = artifact.nodes.flatMap((n) => detectStructuralFindings(n));
    expect(findings).toEqual([]);
  });

  it('flags an unpinned docker-image:// tag as UNPINNED_BASE', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const img = nodeById(artifact, 'sha256:bbbb000000000000000000000000000000000000000000000000000000001');
    const findings = detectStructuralFindings(img);
    expect(findings).toHaveLength(1);
    expect(findings[0].causeCode).toBe('UNPINNED_BASE');
    expect(findings[0].tier).toBe('structural');
    expect(findings[0].fix).toBeTruthy();
  });

  it('never flags a local:// source — excluded by design (FR-012)', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const ctx = nodeById(artifact, 'sha256:aaaa000000000000000000000000000000000000000000000000000000002');
    expect(detectStructuralFindings(ctx)).toEqual([]);
  });

  it('flags ignore_cache: true as UNCONDITIONAL_CACHE_MISS', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: { op: { kind: 'build' }, opMetadata: { ignoreCache: true } },
    };
    const findings = detectStructuralFindings(node);
    expect(findings.map((f) => f.causeCode)).toContain('UNCONDITIONAL_CACHE_MISS');
  });

  it('flags network: HOST and security: INSECURE as NON_HERMETIC_EXEC', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: {
        op: {
          kind: 'exec',
          meta: { args: [], env: [], cwd: '/', user: 'root' },
          mounts: [],
          network: 'HOST',
          security: 'INSECURE',
        },
        opMetadata: { ignoreCache: false },
      },
    };
    const causes = detectStructuralFindings(node).map((f) => f.causeCode);
    expect(causes.filter((c) => c === 'NON_HERMETIC_EXEC')).toHaveLength(2);
  });

  it('flags timestamp: -1 as CLOCK_TIMESTAMP', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: { op: { kind: 'file', actions: [{ copy: { timestamp: -1 } }] }, opMetadata: { ignoreCache: false } },
    };
    expect(detectStructuralFindings(node).map((f) => f.causeCode)).toContain('CLOCK_TIMESTAMP');
  });

  it('flags an http:// source with no checksum as UNCHECKSUMMED_HTTP', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: { op: { kind: 'source', identifier: 'https://example.com/file.tar', attrs: {} }, opMetadata: { ignoreCache: false } },
    };
    expect(detectStructuralFindings(node).map((f) => f.causeCode)).toContain('UNCHECKSUMMED_HTTP');
  });

  it('does not flag an http:// source that has a checksum attr', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: {
        op: { kind: 'source', identifier: 'https://example.com/file.tar', attrs: { 'http.checksum': 'sha256:abc' } },
        opMetadata: { ignoreCache: false },
      },
    };
    expect(detectStructuralFindings(node)).toEqual([]);
  });

  it('flags an unpinned git:// source as UNPINNED_GIT', () => {
    const node: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: { op: { kind: 'source', identifier: 'git://github.com/example/repo.git#main', attrs: {} }, opMetadata: { ignoreCache: false } },
    };
    expect(detectStructuralFindings(node).map((f) => f.causeCode)).toContain('UNPINNED_GIT');
  });
});

describe('detectHeuristicFindings', () => {
  function execNode(args: string[]): Node {
    return {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: {
        op: { kind: 'exec', meta: { args, env: [], cwd: '/', user: 'root' }, mounts: [], network: 'UNSET', security: 'SANDBOX' },
        opMetadata: { ignoreCache: false },
      },
    };
  }

  it('flags an RFC3339-shaped timestamp as EMBEDDED_TIMESTAMP', () => {
    const findings = detectHeuristicFindings(execNode(['echo', '2026-08-17T12:00:00Z']));
    expect(findings.map((f) => f.causeCode)).toContain('EMBEDDED_TIMESTAMP');
    expect(findings[0].tier).toBe('heuristic');
  });

  it('flags a UUID-shaped string as EMBEDDED_UUID', () => {
    const findings = detectHeuristicFindings(execNode(['echo', '550e8400-e29b-41d4-a716-446655440000']));
    expect(findings.map((f) => f.causeCode)).toContain('EMBEDDED_UUID');
  });

  it('flags a 40-hex-character string as EMBEDDED_SHA', () => {
    const findings = detectHeuristicFindings(execNode(['echo', 'a'.repeat(40)]));
    expect(findings.map((f) => f.causeCode)).toContain('EMBEDDED_SHA');
  });

  it('flags a deep absolute path as ABSOLUTE_BUILD_PATH', () => {
    const findings = detectHeuristicFindings(execNode(['chmod', '+x', '/usr/local/bin/app.sh']));
    expect(findings.map((f) => f.causeCode)).toContain('ABSOLUTE_BUILD_PATH');
  });

  it('finds nothing for plain args', () => {
    expect(detectHeuristicFindings(execNode(['/bin/sh', '-c', 'echo hi']))).toEqual([]);
  });

  it('is scoped to exec ops only', () => {
    const sourceNode: Node = {
      id: 'sha256:x',
      label: 'x',
      metadata: { command: 'x' },
      llb: { op: { kind: 'source', identifier: '2026-08-17T12:00:00Z', attrs: {} }, opMetadata: { ignoreCache: false } },
    };
    expect(detectHeuristicFindings(sourceNode)).toEqual([]);
  });
});

describe('nodeContentEqual', () => {
  it('treats local:// sources with different session ids as content-equal (FR-012)', () => {
    const a: Node = {
      id: 'sha256:a',
      label: 'a',
      metadata: { command: 'a' },
      llb: { op: { kind: 'source', identifier: 'local://context', attrs: { 'local.session': 'session-A' } }, opMetadata: { ignoreCache: false } },
    };
    const b: Node = {
      id: 'sha256:b',
      label: 'b',
      metadata: { command: 'b' },
      llb: { op: { kind: 'source', identifier: 'local://context', attrs: { 'local.session': 'session-B' } }, opMetadata: { ignoreCache: false } },
    };
    expect(nodeContentEqual(a, b)).toBe(true);
  });
});

describe('detectProvenFinding', () => {
  function execNode(id: string, env: string[]): Node {
    return {
      id,
      label: id,
      metadata: { command: id },
      llb: {
        op: { kind: 'exec', meta: { args: ['/bin/sh'], env, cwd: '/', user: 'root' }, mounts: [], network: 'UNSET', security: 'SANDBOX' },
        opMetadata: { ignoreCache: false },
      },
    };
  }

  it('flags same entries in a different order as UNSORTED_ENV', () => {
    const left = execNode('sha256:left', ['A=1', 'B=2']);
    const right = execNode('sha256:right', ['B=2', 'A=1']);
    const finding = detectProvenFinding(left, right);
    expect(finding?.causeCode).toBe('UNSORTED_ENV');
    expect(finding?.tier).toBe('proven');
    expect(finding?.affected).toEqual([
      { nodeId: 'sha256:left', label: 'sha256:left', side: 'left' },
      { nodeId: 'sha256:right', label: 'sha256:right', side: 'right' },
    ]);
  });

  it('returns null when env genuinely differs (not just reordered)', () => {
    const left = execNode('sha256:left', ['A=1']);
    const right = execNode('sha256:right', ['A=2']);
    expect(detectProvenFinding(left, right)).toBeNull();
  });

  it('flags a differing cache-mount id as PER_RUN_CACHE_MOUNT_ID', () => {
    const left: Node = {
      id: 'sha256:left',
      label: 'l',
      metadata: { command: 'l' },
      llb: {
        op: {
          kind: 'exec',
          meta: { args: [], env: [], cwd: '/', user: 'root' },
          mounts: [{ dest: '/cache', input: 0, cacheOpt: { id: 'run-abc123' } }],
          network: 'UNSET',
          security: 'SANDBOX',
        },
        opMetadata: { ignoreCache: false },
      },
    };
    const right: Node = {
      ...left,
      id: 'sha256:right',
      llb: {
        op: {
          kind: 'exec',
          meta: { args: [], env: [], cwd: '/', user: 'root' },
          mounts: [{ dest: '/cache', input: 0, cacheOpt: { id: 'run-def456' } }],
          network: 'UNSET',
          security: 'SANDBOX',
        },
        opMetadata: { ignoreCache: false },
      },
    };
    expect(detectProvenFinding(left, right)?.causeCode).toBe('PER_RUN_CACHE_MOUNT_ID');
  });

  it('flags two differing concrete file-copy timestamps as TIMESTAMP_DRIFT', () => {
    const left: Node = {
      id: 'sha256:left',
      label: 'l',
      metadata: { command: 'l' },
      llb: { op: { kind: 'file', actions: [{ copy: { timestamp: 1700000000 } }] }, opMetadata: { ignoreCache: false } },
    };
    const right: Node = {
      id: 'sha256:right',
      label: 'r',
      metadata: { command: 'r' },
      llb: { op: { kind: 'file', actions: [{ copy: { timestamp: 1800000000 } }] }, opMetadata: { ignoreCache: false } },
    };
    expect(detectProvenFinding(left, right)?.causeCode).toBe('TIMESTAMP_DRIFT');
  });
});

describe('describeDivergence (US4 raw-diff fallback)', () => {
  function execNode(id: string, args: string[], env: string[] = []): Node {
    return {
      id,
      label: args.join(' '),
      metadata: { command: args.join(' ') },
      llb: {
        op: { kind: 'exec', meta: { args, env, cwd: '/', user: 'root' }, mounts: [], network: 'UNSET', security: 'SANDBOX' },
        opMetadata: { ignoreCache: false },
      },
    };
  }

  it('names the command change when args differ', () => {
    const left = execNode('sha256:left', ['/bin/sh', '-c', 'apk add curl']);
    const right = execNode('sha256:right', ['/bin/sh', '-c', 'apk add curl git']);
    expect(describeDivergence(left, right)).toBe('Command differs: "/bin/sh -c apk add curl" → "/bin/sh -c apk add curl git".');
  });

  it('falls back to the env diff when args are identical but env differs', () => {
    const left = execNode('sha256:left', ['/bin/sh'], ['A=1']);
    const right = execNode('sha256:right', ['/bin/sh'], ['A=2']);
    expect(describeDivergence(left, right)).toContain('Environment variables differ');
  });

  it('names the identifier change for a differing source op', () => {
    const left: Node = {
      id: 'sha256:left',
      label: 'l',
      metadata: { command: 'l' },
      llb: { op: { kind: 'source', identifier: 'docker-image://alpine:3.19', attrs: {} }, opMetadata: { ignoreCache: false } },
    };
    const right: Node = {
      id: 'sha256:right',
      label: 'r',
      metadata: { command: 'r' },
      llb: { op: { kind: 'source', identifier: 'docker-image://alpine:3.20', attrs: {} }, opMetadata: { ignoreCache: false } },
    };
    expect(describeDivergence(left, right)).toBe(
      'Source identifier differs: "docker-image://alpine:3.19" → "docker-image://alpine:3.20".',
    );
  });
});

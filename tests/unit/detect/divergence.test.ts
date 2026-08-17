import { describe, it, expect } from 'vitest';
import { adaptLlbJson } from '../../../src/adapters/llbjson/adapt';
import { buildComparisonReport, buildSingleArtifactReport } from '../../../src/detect/divergence';
import { readLlbJsonFixture } from '../../utils/fixtures';

describe('buildSingleArtifactReport (US1)', () => {
  it('states nothing was found for a fully clean artifact', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const report = buildSingleArtifactReport(artifact);
    expect(report.mode).toBe('single');
    expect(report.identical).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('surfaces a Structural finding for an unpinned base image', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const report = buildSingleArtifactReport(artifact);
    expect(report.identical).toBe(false);
    expect(report.findings.some((f) => f.causeCode === 'UNPINNED_BASE' && f.tier === 'structural')).toBe(true);
  });
});

describe('buildComparisonReport — root cause vs cascaded, blast radius (US2)', () => {
  const left = adaptLlbJson(readLlbJsonFixture('unsorted-env-before.json'));
  const right = adaptLlbJson(readLlbJsonFixture('unsorted-env-after.json'));
  const report = buildComparisonReport(left, right);

  it('reports exactly one root-cause finding, not one per invalidated operation', () => {
    const provenFindings = report.findings.filter((f) => f.tier === 'proven');
    expect(provenFindings).toHaveLength(1);
    expect(provenFindings[0].causeCode).toBe('UNSORTED_ENV');
  });

  it('does not present the cascaded (also-reordered) downstream op as an independent finding', () => {
    const ids = report.findings.map((f) => f.id);
    expect(ids.some((id) => id.includes('cccc000000000000000000000000000000000000000000000000000000005'))).toBe(false);
    expect(ids.some((id) => id.includes('dddd000000000000000000000000000000000000000000000000000000005'))).toBe(false);
  });

  it('reports the correct blast radius (2 downstream ops invalidated)', () => {
    const rootCause = report.findings.find((f) => f.tier === 'proven');
    expect(rootCause?.blastRadius).toBe(2);
  });

  it('is not identical', () => {
    expect(report.identical).toBe(false);
  });
});

describe('buildComparisonReport — sorting by blast radius (US2)', () => {
  it('sorts proven findings by blast radius, descending', () => {
    const left = adaptLlbJson(readLlbJsonFixture('unsorted-env-before.json'));
    const right = adaptLlbJson(readLlbJsonFixture('unsorted-env-after.json'));
    const report = buildComparisonReport(left, right);
    const radii = report.findings.filter((f) => f.tier === 'proven').map((f) => f.blastRadius ?? 0);
    const sorted = [...radii].sort((a, b) => b - a);
    expect(radii).toEqual(sorted);
  });
});

describe('buildComparisonReport — identical inputs', () => {
  it('reports identical: true when both artifacts are the same', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const report = buildComparisonReport(artifact, artifact);
    expect(report.identical).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.structuralChanges).toEqual([]);
  });
});

describe('buildComparisonReport — Structural/Heuristic shown in both modes (Clarifications)', () => {
  it('still flags a guaranteed-bad construct present identically on both sides', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const report = buildComparisonReport(artifact, artifact);
    expect(report.findings.some((f) => f.causeCode === 'UNPINNED_BASE')).toBe(true);
  });

  it('reports an unchanged node present on both sides only once, not once per side', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const report = buildComparisonReport(artifact, artifact);
    const unpinned = report.findings.filter((f) => f.causeCode === 'UNPINNED_BASE');
    expect(unpinned).toHaveLength(1);
  });

  it('merges a Structural/Heuristic finding into one when digest chaining alone renamed the node (real buildctl behavior)', () => {
    // A downstream op (e.g. the file copy after a changed RUN step) keeps
    // identical content but gets a different digest on each side purely
    // from chaining — confirmed against a real `buildctl debug dump-llb`
    // sample. Its own Structural/Heuristic findings must still merge into
    // one, not appear as two separate "different" node ids.
    const left = adaptLlbJson(
      JSON.stringify([
        { Digest: 'sha256:left-a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
        {
          Digest: 'sha256:left-b',
          Op: { inputs: [{ digest: 'sha256:left-a' }], Op: { file: { actions: [{ Action: { copy: { timestamp: -1 } } }] } } },
          OpMetadata: {},
        },
      ]),
    );
    const right = adaptLlbJson(
      JSON.stringify([
        { Digest: 'sha256:right-a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
        {
          Digest: 'sha256:right-b',
          Op: { inputs: [{ digest: 'sha256:right-a' }], Op: { file: { actions: [{ Action: { copy: { timestamp: -1 } } }] } } },
          OpMetadata: {},
        },
      ]),
    );
    const report = buildComparisonReport(left, right);
    const clockTimestamp = report.findings.filter((f) => f.causeCode === 'CLOCK_TIMESTAMP');
    expect(clockTimestamp).toHaveLength(1);
    expect(clockTimestamp[0].affected).toEqual([
      { nodeId: 'sha256:left-b', label: 'file(1 action)', side: 'left' },
      { nodeId: 'sha256:right-b', label: 'file(1 action)', side: 'right' },
    ]);
  });
});

describe('buildComparisonReport — structural changes (US3)', () => {
  it('lists an appended operation under structuralChanges as added, not as a finding', () => {
    const left = adaptLlbJson(readLlbJsonFixture('added-op-before.json'));
    const right = adaptLlbJson(readLlbJsonFixture('added-op-after.json'));
    const report = buildComparisonReport(left, right);
    expect(report.structuralChanges).toContainEqual({
      nodeId: 'sha256:ffff000000000000000000000000000000000000000000000000000000005',
      label: '/bin/sh -c echo step-two-new',
      side: 'right',
      status: 'added',
    });
    expect(report.findings.some((f) => f.id.includes('ffff000000000000000000000000000000000000000000000000000000005'))).toBe(false);
  });

  it('lists swapped-input ops under structuralChanges as moved', () => {
    const left = adaptLlbJson(readLlbJsonFixture('moved-inputs-before.json'));
    const right = adaptLlbJson(readLlbJsonFixture('moved-inputs-after.json'));
    const report = buildComparisonReport(left, right);
    const movedIds = (report.structuralChanges ?? []).filter((c) => c.status === 'moved').map((c) => c.nodeId);
    expect(movedIds).toContain('sha256:eeee000000000000000000000000000000000000000000000000000000001');
    expect(movedIds).toContain('sha256:eeee000000000000000000000000000000000000000000000000000000002');
  });
});

describe('buildComparisonReport — raw-diff fallback for unmatched root causes (US4)', () => {
  it('still reports a root cause with no matching rule, without a causeCode/fix', () => {
    const left = adaptLlbJson(
      JSON.stringify([
        { Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
        {
          Digest: 'sha256:b',
          Op: { inputs: [{ digest: 'sha256:a' }], Op: { exec: { meta: { args: ['run-left'], env: [], cwd: '/', user: 'root' }, mounts: [], network: 'UNSET', security: 'SANDBOX' } } },
          OpMetadata: {},
        },
      ]),
    );
    const right = adaptLlbJson(
      JSON.stringify([
        { Digest: 'sha256:a', Op: { inputs: [], Op: { source: { identifier: 'local://ctx', attrs: {} } } }, OpMetadata: {} },
        {
          Digest: 'sha256:c',
          Op: { inputs: [{ digest: 'sha256:a' }], Op: { exec: { meta: { args: ['run-right'], env: [], cwd: '/', user: 'root' }, mounts: [], network: 'UNSET', security: 'SANDBOX' } } },
          OpMetadata: {},
        },
      ]),
    );
    const report = buildComparisonReport(left, right);
    const fallback = report.findings.find((f) => f.causeCode === 'UNKNOWN_DIVERGENCE');
    expect(fallback).toBeDefined();
    expect(fallback?.tier).toBe('proven');
    expect(fallback?.fix).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { adaptLlbJson } from '../../../src/adapters/llbjson/adapt';
import { buildComparisonReport, buildSingleArtifactReport } from '../../../src/detect/divergence';
import { categorizeNodes, renderDeterminismDot, ROOT_CAUSE_FILL, BLAST_RADIUS_FILL, STRUCTURAL_FILL } from '../../../src/detect/renderDot';
import { readLlbJsonFixture } from '../../utils/fixtures';

describe('categorizeNodes', () => {
  it('categorizes the root-cause node and its blast-radius descendants separately', () => {
    const left = adaptLlbJson(readLlbJsonFixture('unsorted-env-before.json'));
    const right = adaptLlbJson(readLlbJsonFixture('unsorted-env-after.json'));
    const report = buildComparisonReport(left, right);

    const rightCategories = categorizeNodes(report, 'right');
    const rootCauseId = 'sha256:dddd000000000000000000000000000000000000000000000000000000004';
    const descendantId = 'sha256:dddd000000000000000000000000000000000000000000000000000000005';

    expect(rightCategories.get(rootCauseId)).toBe('rootCause');
    expect(rightCategories.get(descendantId)).toBe('blastRadius');
  });

  it('gives a Structural-finding node "structural", not "clean", in single-artifact mode', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const report = buildSingleArtifactReport(artifact);
    const categories = categorizeNodes(report, undefined);
    expect(categories.get('sha256:bbbb000000000000000000000000000000000000000000000000000000001')).toBe('structural');
  });

  it('leaves an untouched node uncategorized (renders as clean)', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('clean.json'));
    const report = buildSingleArtifactReport(artifact);
    const categories = categorizeNodes(report, undefined);
    expect(categories.size).toBe(0);
  });

  it('prioritizes rootCause over blastRadius when a node is both (chained root causes)', () => {
    // Node B is both a root cause (its own env is unsorted vs. the other
    // side) AND — from a different, independent root cause upstream of it
    // — inside that root cause's blast radius. rootCause must win visually.
    const report = {
      schemaVersion: '1.1.0',
      mode: 'comparison' as const,
      identical: false,
      findings: [
        {
          id: 'A',
          tier: 'proven' as const,
          causeCode: 'UNSORTED_ENV',
          message: 'x',
          affected: [
            { nodeId: 'left-a', label: 'a', side: 'left' as const },
            { nodeId: 'right-a', label: 'a', side: 'right' as const },
          ],
          blastRadius: 1,
          blastRadiusNodeIds: ['right-b'],
        },
        {
          id: 'B',
          tier: 'proven' as const,
          causeCode: 'UNSORTED_ENV',
          message: 'y',
          affected: [
            { nodeId: 'left-b', label: 'b', side: 'left' as const },
            { nodeId: 'right-b', label: 'b', side: 'right' as const },
          ],
          blastRadius: 0,
          blastRadiusNodeIds: [],
        },
      ],
    };
    const categories = categorizeNodes(report, 'right');
    expect(categories.get('right-b')).toBe('rootCause');
  });
});

describe('renderDeterminismDot', () => {
  it('produces valid DOT text with each node filled by its category color', () => {
    const artifact = adaptLlbJson(readLlbJsonFixture('unpinned-base.json'));
    const report = buildSingleArtifactReport(artifact);
    const dot = renderDeterminismDot(artifact, report, undefined);

    expect(dot).toContain('digraph');
    expect(dot).toContain(STRUCTURAL_FILL);
  });

  it('colors the root-cause and blast-radius nodes distinctly in comparison mode', () => {
    const left = adaptLlbJson(readLlbJsonFixture('unsorted-env-before.json'));
    const right = adaptLlbJson(readLlbJsonFixture('unsorted-env-after.json'));
    const report = buildComparisonReport(left, right);
    const dot = renderDeterminismDot(right, report, 'right');

    expect(dot).toContain(ROOT_CAUSE_FILL);
    expect(dot).toContain(BLAST_RADIUS_FILL);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeterminismPanel } from '../../../components/DeterminismPanel';
import type { DeterminismReport } from '../../../src/detect/rules';

describe('DeterminismPanel', () => {
  it('states nothing was found for a single-artifact identical report (US1)', () => {
    const report: DeterminismReport = { schemaVersion: '1.1.0', mode: 'single', identical: true, findings: [] };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByText(/nothing found/i)).toBeInTheDocument();
  });

  it('states the builds are equivalent for a comparison identical report', () => {
    const report: DeterminismReport = { schemaVersion: '1.1.0', mode: 'comparison', identical: true, findings: [], structuralChanges: [] };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByText(/builds are equivalent/i)).toBeInTheDocument();
  });

  it('renders a finding with its confidence tier, cause, and fix', () => {
    const report: DeterminismReport = {
      schemaVersion: '1.1.0',
      mode: 'single',
      identical: false,
      findings: [
        {
          id: 'UNPINNED_BASE:sha256:abc',
          tier: 'structural',
          causeCode: 'UNPINNED_BASE',
          message: 'Source references a mutable tag with no @sha256 digest pin.',
          fix: 'Pin the base image to a digest.',
          affected: [{ nodeId: 'sha256:abc' }],
        },
      ],
    };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByText('Structural')).toBeInTheDocument();
    expect(screen.getByText('UNPINNED_BASE')).toBeInTheDocument();
    expect(screen.getByText(/mutable tag/)).toBeInTheDocument();
    expect(screen.getByText(/Pin the base image/)).toBeInTheDocument();
  });

  it('shows the blast radius for a proven root-cause finding', () => {
    const report: DeterminismReport = {
      schemaVersion: '1.1.0',
      mode: 'comparison',
      identical: false,
      findings: [
        {
          id: 'UNSORTED_ENV:sha256:x',
          tier: 'proven',
          causeCode: 'UNSORTED_ENV',
          message: 'Environment variables contain the same entries in a different order.',
          fix: 'Sort environment variables.',
          affected: [{ nodeId: 'sha256:x', side: 'left' }],
          blastRadius: 46,
        },
      ],
    };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByText(/blast radius: 46/)).toBeInTheDocument();
  });

  it('distinguishes a raw-diff fallback finding from a named one (US4)', () => {
    const report: DeterminismReport = {
      schemaVersion: '1.1.0',
      mode: 'comparison',
      identical: false,
      findings: [
        {
          id: 'UNKNOWN_DIVERGENCE:sha256:x',
          tier: 'proven',
          causeCode: 'UNKNOWN_DIVERGENCE',
          message: "This operation's content differs, but no known pattern matches the difference.",
          affected: [{ nodeId: 'sha256:x', side: 'left' }],
        },
      ],
    };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByText(/no known pattern matched/i)).toBeInTheDocument();
  });

  it('renders a structural changes section for added/removed/moved operations (US3)', () => {
    const report: DeterminismReport = {
      schemaVersion: '1.1.0',
      mode: 'comparison',
      identical: false,
      findings: [],
      structuralChanges: [{ nodeId: 'sha256:new', side: 'right', status: 'added' }],
    };
    render(<DeterminismPanel report={report} />);
    expect(screen.getByLabelText('Structural changes')).toBeInTheDocument();
    expect(screen.getByText('added')).toBeInTheDocument();
  });
});

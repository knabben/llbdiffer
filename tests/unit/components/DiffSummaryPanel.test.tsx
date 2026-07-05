import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DiffSummaryPanel } from '../../../components/DiffSummaryPanel';
import type { DiffSummary } from '../../../src/compare/artifact';

describe('DiffSummaryPanel', () => {
  it('lists categorized added/removed/shared entries', () => {
    const summary: DiffSummary = {
      added: [{ kind: 'node', ref: 'sha256:ccc' }],
      removed: [{ kind: 'node', ref: 'sha256:bbb' }],
      shared: [{ kind: 'node', ref: 'sha256:aaa' }],
    };

    render(<DiffSummaryPanel summary={summary} identical={false} />);

    expect(within(screen.getByLabelText('Added')).getByText('sha256:ccc')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Removed')).getByText('sha256:bbb')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Shared')).getByText('sha256:aaa')).toBeInTheDocument();
  });

  it('shows a clear "no differences" message when identical', () => {
    const summary: DiffSummary = { added: [], removed: [], shared: [{ kind: 'node', ref: 'sha256:aaa' }] };

    render(<DiffSummaryPanel summary={summary} identical={true} />);

    expect(screen.getByText(/no differences found/i)).toBeInTheDocument();
  });
});

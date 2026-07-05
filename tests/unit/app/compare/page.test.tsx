import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComparePage from '../../../../app/compare/page';

vi.mock('../../../../components/ComparePanel', () => ({
  ComparePanel: ({ title }: { title: string }) => <div>{title} panel</div>,
}));
vi.mock('../../../../components/DiffSummaryPanel', () => ({
  DiffSummaryPanel: () => <div>summary panel</div>,
}));

function makeDotFile(name: string): File {
  return new File(['digraph { a -> b; }'], name, { type: 'text/vnd.graphviz' });
}

describe('ComparePage (US1: submit gating)', () => {
  it('keeps the submit control disabled until exactly two files are selected', () => {
    render(<ComparePage />);

    const submit = screen.getByRole('button', { name: /compare/i });
    expect(submit).toBeDisabled();

    const [leftInput, rightInput] = screen.getAllByLabelText(/build \(\.dot\)/i);
    fireEvent.change(leftInput, { target: { files: [makeDotFile('left.dot')] } });
    expect(submit).toBeDisabled();

    fireEvent.change(rightInput, { target: { files: [makeDotFile('right.dot')] } });
    expect(submit).not.toBeDisabled();
  });
});

describe('ComparePage (US4: error handling)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        json: () =>
          Promise.resolve({
            errors: {
              left: { code: 'DOT_PARSE_ERROR', message: 'Line 3: unexpected token' },
              right: null,
            },
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a specific per-file error message when the API returns 400', async () => {
    render(<ComparePage />);

    const [leftInput, rightInput] = screen.getAllByLabelText(/build \(\.dot\)/i);
    fireEvent.change(leftInput, { target: { files: [makeDotFile('left.dot')] } });
    fireEvent.change(rightInput, { target: { files: [makeDotFile('right.dot')] } });
    fireEvent.click(screen.getByRole('button', { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected token/i)).toBeInTheDocument();
    });
  });

  it('shows a generic retry-able error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<ComparePage />);
    const [leftInput, rightInput] = screen.getAllByLabelText(/build \(\.dot\)/i);
    fireEvent.change(leftInput, { target: { files: [makeDotFile('left.dot')] } });
    fireEvent.change(rightInput, { target: { files: [makeDotFile('right.dot')] } });
    fireEvent.click(screen.getByRole('button', { name: /compare/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});

describe('ComparePage (US1/US2: AI analysis stays separate from the diff)', () => {
  const comparisonResult = {
    left: { dot: 'digraph { a; }', hashes: ['a'] },
    right: { dot: 'digraph { a; }', hashes: ['a'] },
    summary: { added: [], removed: [], shared: [{ kind: 'node', ref: 'a' }] },
    identical: true,
  };

  function stubFetchSequence(responses: Array<() => { status: number; ok: boolean; json: () => Promise<unknown> }>) {
    const fn = vi.fn();
    for (const response of responses) {
      fn.mockImplementationOnce(async () => response());
    }
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function runComparison() {
    const [leftInput, rightInput] = screen.getAllByLabelText(/build \(\.dot\)/i);
    fireEvent.change(leftInput, { target: { files: [makeDotFile('left.dot')] } });
    fireEvent.change(rightInput, { target: { files: [makeDotFile('right.dot')] } });
    fireEvent.click(screen.getByRole('button', { name: /compare/i }));
    await waitFor(() => expect(screen.getByText('summary panel')).toBeInTheDocument());
  }

  it('keeps "Analyze with AI" disabled until a comparison result exists (FR-001)', () => {
    render(<ComparePage />);
    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeDisabled();
  });

  it('renders the AI result in its own labeled panel, leaving the diff panels unchanged (FR-005/FR-006/FR-007)', async () => {
    stubFetchSequence([
      () => ({ status: 200, ok: true, json: async () => comparisonResult }),
      () => ({ status: 200, ok: true, json: async () => ({ analysis: 'These builds are equivalent.' }) }),
    ]);

    render(<ComparePage />);
    await runComparison();

    expect(screen.getByText('Left build panel')).toBeInTheDocument();
    expect(screen.getByText('summary panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));
    await waitFor(() => expect(screen.getByText('These builds are equivalent.')).toBeInTheDocument());

    expect(screen.getByLabelText('AI analysis')).toBeInTheDocument();
    expect(screen.getByText(/advisory, not verified/i)).toBeInTheDocument();
    // Diff panels are untouched by the AI response.
    expect(screen.getByText('Left build panel')).toBeInTheDocument();
    expect(screen.getByText('summary panel')).toBeInTheDocument();
  });

  it('clears a previous AI analysis result when a new comparison is submitted (FR-011)', async () => {
    stubFetchSequence([
      () => ({ status: 200, ok: true, json: async () => comparisonResult }),
      () => ({ status: 200, ok: true, json: async () => ({ analysis: 'First analysis.' }) }),
      () => ({ status: 200, ok: true, json: async () => comparisonResult }),
    ]);

    render(<ComparePage />);
    await runComparison();
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));
    await waitFor(() => expect(screen.getByText('First analysis.')).toBeInTheDocument());

    await runComparison();
    expect(screen.queryByText('First analysis.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('AI analysis')).not.toBeInTheDocument();
  });

  it('shows a specific, retry-able error in the AI panel without disrupting the rest of the page (US3)', async () => {
    stubFetchSequence([
      () => ({ status: 200, ok: true, json: async () => comparisonResult }),
      () => ({ status: 502, ok: false, json: async () => ({ error: { code: 'ANALYSIS_FAILED', message: 'Upstream provider error.' } }) }),
    ]);

    render(<ComparePage />);
    await runComparison();
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => expect(screen.getByText('Upstream provider error.')).toBeInTheDocument());
    expect(screen.getByText('summary panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

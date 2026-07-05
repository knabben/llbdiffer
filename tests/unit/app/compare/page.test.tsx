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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparePanel } from '../../../components/ComparePanel';

vi.mock('../../../components/GraphRenderer', () => ({
  GraphRenderer: ({ dot }: { dot: string }) => <div data-testid="graph-stub">{dot}</div>,
}));

describe('ComparePanel', () => {
  it("displays the full list of node hashes for its side", () => {
    render(
      <ComparePanel
        title="Left build"
        dot="digraph { a -> b; }"
        hashes={['sha256:aaa', 'sha256:bbb', 'sha256:ccc']}
      />,
    );

    expect(screen.getByText('sha256:aaa')).toBeInTheDocument();
    expect(screen.getByText('sha256:bbb')).toBeInTheDocument();
    expect(screen.getByText('sha256:ccc')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Left build' })).toBeInTheDocument();
  });
});

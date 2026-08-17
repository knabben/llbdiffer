import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DeterminismGraphPanel } from '../../../components/DeterminismGraphPanel';

vi.mock('@hpcc-js/wasm-graphviz', () => ({
  Graphviz: {
    load: () =>
      Promise.resolve({
        dot: (dotText: string) => `<svg data-mock-length="${dotText.length}"></svg>`,
      }),
  },
}));

describe('DeterminismGraphPanel', () => {
  it('renders the graph and a legend explaining the fill colors', async () => {
    render(<DeterminismGraphPanel title="First build" dot="digraph { a -> b; }" />);

    expect(screen.getByLabelText('First build')).toBeInTheDocument();
    expect(screen.getByText('Root cause')).toBeInTheDocument();
    expect(screen.getByText('Blast radius')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('graph-renderer').innerHTML).toContain('data-mock-length');
    });
  });
});

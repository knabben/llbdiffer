import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GraphRenderer } from '../../../components/GraphRenderer';

vi.mock('@hpcc-js/wasm-graphviz', () => ({
  Graphviz: {
    load: () =>
      Promise.resolve({
        dot: (dotText: string) => `<svg data-mock-length="${dotText.length}"></svg>`,
      }),
  },
}));

describe('GraphRenderer', () => {
  it('renders the SVG produced from the given DOT text', async () => {
    render(<GraphRenderer dot="digraph { a -> b; }" />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-renderer').innerHTML).toContain('data-mock-length');
    });
  });
});

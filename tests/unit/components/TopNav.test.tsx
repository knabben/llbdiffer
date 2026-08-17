import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopNav } from '../../../components/TopNav';

describe('TopNav', () => {
  it('renders links to all three routes', () => {
    render(<TopNav current="/compare" />);
    expect(screen.getByRole('link', { name: 'llbdiffer' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/compare');
    expect(screen.getByRole('link', { name: 'Determinism' })).toHaveAttribute('href', '/determinism');
  });

  it('marks the current route with aria-current', () => {
    render(<TopNav current="/determinism" />);
    expect(screen.getByRole('link', { name: 'Determinism' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Compare' })).not.toHaveAttribute('aria-current');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../../../app/page';

describe('HomePage', () => {
  it('links to both /compare and /determinism', () => {
    render(<HomePage />);
    // Scoped by description text — the page also renders TopNav, whose own
    // short "Compare"/"Determinism" links would otherwise collide with
    // these longer route-card links on a substring match.
    expect(screen.getByRole('link', { name: /Side-by-side diff/ })).toHaveAttribute('href', '/compare');
    expect(screen.getByRole('link', { name: /Root-cause analysis/ })).toHaveAttribute('href', '/determinism');
  });
});

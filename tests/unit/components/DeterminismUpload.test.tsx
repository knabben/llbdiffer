import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeterminismUpload } from '../../../components/DeterminismUpload';

function file(name: string) {
  return new File(['{}'], name, { type: 'application/json' });
}

describe('DeterminismUpload', () => {
  it('disables submit until a primary file is selected', () => {
    render(<DeterminismUpload onSubmit={() => {}} submitting={false} />);
    expect(screen.getByRole('button', { name: /analyze/i })).toBeDisabled();
  });

  it('submits with only the primary file (single-artifact mode) — US1', () => {
    const onSubmit = vi.fn();
    render(<DeterminismUpload onSubmit={onSubmit} submitting={false} />);

    const inputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [file('before.json')] } });

    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'before.json' }), null);
  });

  it('submits with both files (comparison mode) and labels the button "Compare" — US2', () => {
    const onSubmit = vi.fn();
    render(<DeterminismUpload onSubmit={onSubmit} submitting={false} />);

    const inputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [file('before.json')] } });
    fireEvent.change(inputs[1], { target: { files: [file('after.json')] } });

    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /compare/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'before.json' }),
      expect.objectContaining({ name: 'after.json' }),
    );
  });

  it('shows an "Analyzing…" label while submitting', () => {
    render(<DeterminismUpload onSubmit={() => {}} submitting={true} />);
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
  });
});

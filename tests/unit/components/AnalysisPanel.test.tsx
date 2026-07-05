import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisPanel } from '../../../components/AnalysisPanel';

describe('AnalysisPanel', () => {
  it('shows a loading state while the request is in flight (US1)', () => {
    render(<AnalysisPanel state={{ status: 'loading' }} onRetry={() => {}} />);
    expect(screen.getByText(/analyzing the diff/i)).toBeInTheDocument();
  });

  it('renders the narrative result and labels itself as AI-generated/advisory, distinct from the diff (US1, US2)', () => {
    render(<AnalysisPanel state={{ status: 'result', text: 'The right build adds a new RUN step.' }} onRetry={() => {}} />);

    const panel = screen.getByLabelText('AI analysis');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/advisory, not verified/i)).toBeInTheDocument();
    expect(screen.getByText('The right build adds a new RUN step.')).toBeInTheDocument();
  });

  it('shows a specific error message with a retry control on failure (US3)', () => {
    const onRetry = vi.fn();

    render(<AnalysisPanel state={{ status: 'error', message: 'AI analysis failed due to a network error.' }} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('AI analysis failed due to a network error.');

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

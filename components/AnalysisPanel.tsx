'use client';

export type AnalysisState =
  | { status: 'loading' }
  | { status: 'result'; text: string }
  | { status: 'error'; message: string };

export interface AnalysisPanelProps {
  state: AnalysisState;
  onRetry: () => void;
  className?: string;
}

/**
 * Renders the AI's narrative in a panel structurally and visually distinct
 * from the deterministic diff graphs/summary (spec FR-005/FR-006). Never
 * receives or writes to `ComparisonResult` — its state is owned separately
 * in `app/compare/page.tsx` (FR-007).
 */
export function AnalysisPanel({ state, onRetry, className = '' }: AnalysisPanelProps) {
  return (
    <section
      aria-label="AI analysis"
      className={`shrink-0 rounded-xl border border-accent/40 bg-panel p-4 text-sm text-neutral-300 ${className}`}
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
        AI analysis — advisory, not verified
      </h2>
      {state.status === 'loading' && <p className="text-neutral-400">Analyzing the diff…</p>}
      {state.status === 'result' && <p className="whitespace-pre-wrap">{state.text}</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p className="text-red-300">{state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-border px-3 py-1 text-xs text-neutral-200 hover:border-neutral-500"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}

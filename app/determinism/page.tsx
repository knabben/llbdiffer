'use client';

import { useState } from 'react';
import { DeterminismUpload } from '../../components/DeterminismUpload';
import { DeterminismPanel } from '../../components/DeterminismPanel';
import { DeterminismGraphPanel } from '../../components/DeterminismGraphPanel';
import type { DeterminismReport } from '../../src/detect/rules';

interface FieldError {
  code: string;
  message: string;
}

type SubmitError =
  | { kind: 'validation'; primary: FieldError | null; secondary: FieldError | null }
  | { kind: 'unexpected'; message: string };

interface AnalysisResult {
  report: DeterminismReport;
  primary: { dot: string };
  secondary?: { dot: string };
}

export default function DeterminismPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  async function handleSubmit(primary: File, secondary: File | null) {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.set('primary', primary);
      if (secondary) form.set('secondary', secondary);

      const response = await fetch('/api/determinism', { method: 'POST', body: form });

      if (response.status === 400) {
        const body = await response.json();
        setError({ kind: 'validation', primary: body.errors.primary, secondary: body.errors.secondary });
        return;
      }

      if (!response.ok) {
        setError({ kind: 'unexpected', message: `Analysis failed (HTTP ${response.status}). Please try again.` });
        return;
      }

      const body: AnalysisResult = await response.json();
      setResult(body);
    } catch {
      setError({ kind: 'unexpected', message: 'Analysis failed due to a network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1800px] flex-col gap-6 overflow-hidden px-6 py-8">
      <div className="flex shrink-0 flex-wrap items-center gap-6">
        <h1 className="whitespace-nowrap text-lg font-medium text-neutral-100">llbdiffer — determinism analysis</h1>
        <DeterminismUpload onSubmit={handleSubmit} submitting={submitting} />
      </div>

      {error?.kind === 'validation' && (
        <div role="alert" className="shrink-0 rounded-lg border border-removed/40 bg-removed/10 px-4 py-3 text-sm text-red-200">
          {error.primary && <p>Build file: {error.primary.message}</p>}
          {error.secondary && <p>Second build file: {error.secondary.message}</p>}
        </div>
      )}
      {error?.kind === 'unexpected' && (
        <div role="alert" className="shrink-0 rounded-lg border border-removed/40 bg-removed/10 px-4 py-3 text-sm text-red-200">
          {error.message}
        </div>
      )}

      {result && (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className={`grid min-h-0 flex-[3] grid-cols-1 gap-6 ${result.secondary ? 'md:grid-cols-2' : ''}`}>
            <DeterminismGraphPanel
              title={result.secondary ? 'First build' : 'Build'}
              dot={result.primary.dot}
              highlightedId={highlightedId}
              onHoverId={setHighlightedId}
            />
            {result.secondary && (
              <DeterminismGraphPanel
                title="Second build"
                dot={result.secondary.dot}
                highlightedId={highlightedId}
                onHoverId={setHighlightedId}
              />
            )}
          </div>
          <DeterminismPanel
            report={result.report}
            highlightedId={highlightedId}
            onHoverId={setHighlightedId}
            className="max-h-80 shrink-0 overflow-auto"
          />
        </div>
      )}
    </main>
  );
}

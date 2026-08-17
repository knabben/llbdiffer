'use client';

import { useState } from 'react';
import { DeterminismUpload } from '../../components/DeterminismUpload';
import { DeterminismPanel } from '../../components/DeterminismPanel';
import type { DeterminismReport } from '../../src/detect/rules';

interface FieldError {
  code: string;
  message: string;
}

type SubmitError =
  | { kind: 'validation'; primary: FieldError | null; secondary: FieldError | null }
  | { kind: 'unexpected'; message: string };

export default function DeterminismPage() {
  const [report, setReport] = useState<DeterminismReport | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(primary: File, secondary: File | null) {
    setSubmitting(true);
    setError(null);
    setReport(null);

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

      const body: { report: DeterminismReport } = await response.json();
      setReport(body.report);
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

      {report && (
        <div className="min-h-0 flex-1 overflow-auto">
          <DeterminismPanel report={report} />
        </div>
      )}
    </main>
  );
}

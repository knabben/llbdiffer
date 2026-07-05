'use client';

import { useState, type FormEvent } from 'react';
import { ComparePanel } from '../../components/ComparePanel';
import { DiffSummaryPanel } from '../../components/DiffSummaryPanel';
import type { DiffSummary } from '../../src/compare/artifact';

interface SidePresentation {
  dot: string;
  hashes: string[];
}

interface ComparisonResult {
  left: SidePresentation;
  right: SidePresentation;
  summary: DiffSummary;
  identical: boolean;
}

interface FieldError {
  code: string;
  message: string;
}

type SubmitError =
  | { kind: 'validation'; left: FieldError | null; right: FieldError | null }
  | { kind: 'unexpected'; message: string };

function FileChip({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="flex min-w-[280px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
      <span className="whitespace-nowrap text-xs uppercase tracking-wide text-neutral-500">{label}:</span>
      <span className="truncate">{file ? file.name : 'Select a .dot file…'}</span>
      <input
        type="file"
        accept=".dot"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export default function ComparePage() {
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<SubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const canSubmit = leftFile !== null && rightFile !== null && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!leftFile || !rightFile) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.set('left', leftFile);
      form.set('right', rightFile);

      const response = await fetch('/api/compare', { method: 'POST', body: form });

      if (response.status === 400) {
        const body = await response.json();
        setError({ kind: 'validation', left: body.errors.left, right: body.errors.right });
        return;
      }

      if (!response.ok) {
        setError({
          kind: 'unexpected',
          message: `Comparison failed (HTTP ${response.status}). Please try again.`,
        });
        return;
      }

      const body: ComparisonResult = await response.json();
      setResult(body);
    } catch {
      setError({
        kind: 'unexpected',
        message: 'Comparison failed due to a network error. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1800px] flex-col gap-6 overflow-hidden px-6 py-8">
      <div className="flex shrink-0 flex-wrap items-center gap-6">
        <h1 className="whitespace-nowrap text-lg font-medium text-neutral-100">llbdiffer — compare two builds</h1>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <FileChip label="First build (.dot)" file={leftFile} onChange={setLeftFile} />
          <FileChip label="Second build (.dot)" file={rightFile} onChange={setRightFile} />
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Comparing…' : 'Compare'}
          </button>
        </form>
      </div>

      {error?.kind === 'validation' && (
        <div
          role="alert"
          className="shrink-0 rounded-lg border border-removed/40 bg-removed/10 px-4 py-3 text-sm text-red-200"
        >
          {error.left && <p>Left file: {error.left.message}</p>}
          {error.right && <p>Right file: {error.right.message}</p>}
        </div>
      )}
      {error?.kind === 'unexpected' && (
        <div
          role="alert"
          className="shrink-0 rounded-lg border border-removed/40 bg-removed/10 px-4 py-3 text-sm text-red-200"
        >
          {error.message}
        </div>
      )}

      {result && (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="grid min-h-0 flex-[3] grid-cols-1 gap-6 md:grid-cols-2">
            <ComparePanel
              title="Left build"
              dot={result.left.dot}
              hashes={result.left.hashes}
              highlightedId={highlightedId}
              onHoverId={setHighlightedId}
            />
            <ComparePanel
              title="Right build"
              dot={result.right.dot}
              hashes={result.right.hashes}
              highlightedId={highlightedId}
              onHoverId={setHighlightedId}
            />
          </div>
          <DiffSummaryPanel
            className="max-h-56 shrink-0 overflow-auto"
            summary={result.summary}
            identical={result.identical}
            highlightedId={highlightedId}
            onHoverId={setHighlightedId}
          />
        </div>
      )}
    </main>
  );
}

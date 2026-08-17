'use client';

import { useState, type FormEvent } from 'react';

export interface DeterminismUploadProps {
  onSubmit: (primary: File, secondary: File | null) => void;
  submitting: boolean;
}

/**
 * Accepts one required LLB JSON artifact and one optional second artifact —
 * the single upload is the low-friction "front door" (spec US1); adding a
 * second file switches to the deeper root-cause comparison mode (US2),
 * without a separate page/flow (Clarifications).
 */
export function DeterminismUpload({ onSubmit, submitting }: DeterminismUploadProps) {
  const [primary, setPrimary] = useState<File | null>(null);
  const [secondary, setSecondary] = useState<File | null>(null);

  const canSubmit = primary !== null && !submitting;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!primary) return;
    onSubmit(primary, secondary);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-[280px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
        <span className="whitespace-nowrap text-xs uppercase tracking-wide text-neutral-500">Build (LLB JSON):</span>
        <span className="truncate">{primary ? primary.name : 'Select an LLB JSON dump…'}</span>
        <input
          type="file"
          accept=".json"
          className="sr-only"
          onChange={(event) => setPrimary(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="flex min-w-[280px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
        <span className="whitespace-nowrap text-xs uppercase tracking-wide text-neutral-500">Compare against (optional):</span>
        <span className="truncate">{secondary ? secondary.name : 'Select a second LLB JSON dump…'}</span>
        <input
          type="file"
          accept=".json"
          className="sr-only"
          onChange={(event) => setSecondary(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Analyzing…' : secondary ? 'Compare' : 'Analyze'}
      </button>
    </form>
  );
}

'use client';

import type { DiffSummary, DiffSummaryEntry } from '../src/compare/artifact';

export interface DiffSummaryPanelProps {
  summary: DiffSummary;
  identical: boolean;
  highlightedId?: string | null;
  onHoverId?: (id: string | null) => void;
  className?: string;
}

function EntryList({
  entries,
  highlightedId,
  onHoverId,
}: {
  entries: DiffSummaryEntry[];
  highlightedId: string | null;
  onHoverId?: (id: string | null) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-neutral-600">None</p>;
  }
  return (
    <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-xs text-neutral-400">
      {entries.map((entry) => {
        // Edge refs are "source->target"; a node hover matches either endpoint.
        const isHighlighted = highlightedId !== null && entry.ref.includes(highlightedId);
        return (
          <li
            key={`${entry.kind}-${entry.ref}`}
            className={`cursor-default truncate rounded px-1 ${
              isHighlighted ? 'bg-yellow-400/20 text-yellow-200' : ''
            }`}
            onMouseEnter={() => onHoverId?.(entry.kind === 'node' ? entry.ref : null)}
            onMouseLeave={() => onHoverId?.(null)}
          >
            {entry.ref}
          </li>
        );
      })}
    </ul>
  );
}

export function DiffSummaryPanel({
  summary,
  identical,
  highlightedId = null,
  onHoverId,
  className = '',
}: DiffSummaryPanelProps) {
  if (identical) {
    return (
      <section
        aria-label="Diff summary"
        className={`rounded-xl border border-border bg-panel p-4 text-sm text-neutral-300 ${className}`}
      >
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Diff summary</h2>
        <p>No differences found — both builds are identical.</p>
      </section>
    );
  }

  return (
    <section aria-label="Diff summary" className={`rounded-xl border border-border bg-panel p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Diff summary</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div aria-label="Added">
          <h3 className="mb-1 text-xs uppercase tracking-wide text-added">Added ({summary.added.length})</h3>
          <EntryList entries={summary.added} highlightedId={highlightedId} onHoverId={onHoverId} />
        </div>
        <div aria-label="Removed">
          <h3 className="mb-1 text-xs uppercase tracking-wide text-removed">Removed ({summary.removed.length})</h3>
          <EntryList entries={summary.removed} highlightedId={highlightedId} onHoverId={onHoverId} />
        </div>
        <div aria-label="Shared">
          <h3 className="mb-1 text-xs uppercase tracking-wide text-shared">Shared ({summary.shared.length})</h3>
          <EntryList entries={summary.shared} highlightedId={highlightedId} onHoverId={onHoverId} />
        </div>
      </div>
    </section>
  );
}

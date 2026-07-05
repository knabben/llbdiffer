'use client';

import { GraphRenderer } from './GraphRenderer';

export interface ComparePanelProps {
  title: string;
  dot: string;
  hashes: string[];
  highlightedId?: string | null;
  onHoverId?: (id: string | null) => void;
}

export function ComparePanel({
  title,
  dot,
  hashes,
  highlightedId = null,
  onHoverId,
}: ComparePanelProps) {
  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 flex-col gap-4 rounded-xl border border-border bg-panel p-4"
    >
      <h2 className="shrink-0 text-sm font-semibold text-neutral-200">{title}</h2>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-surface p-2">
        <GraphRenderer dot={dot} highlightedId={highlightedId} onHoverNode={onHoverId} />
      </div>
      <div className="shrink-0">
        <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
          Node hashes ({hashes.length})
        </h3>
        <ul className="max-h-24 space-y-0.5 overflow-auto font-mono text-xs text-neutral-400">
          {hashes.map((hash) => (
            <li
              key={hash}
              className={`cursor-default truncate rounded px-1 ${
                highlightedId === hash ? 'bg-yellow-400/20 text-yellow-200' : ''
              }`}
              onMouseEnter={() => onHoverId?.(hash)}
              onMouseLeave={() => onHoverId?.(null)}
            >
              {hash}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

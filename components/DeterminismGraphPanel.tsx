'use client';

import { GraphRenderer } from './GraphRenderer';

export interface DeterminismGraphPanelProps {
  title: string;
  dot: string;
  highlightedId?: string | null;
  onHoverId?: (id: string | null) => void;
}

// Mirrors the fill colors in src/detect/renderDot.ts — duplicated as plain
// hex here (not imported) to keep this client component decoupled from the
// `ts-graphviz`-importing render module, matching how dot/render.ts's own
// ADDED_FILL/REMOVED_FILL already duplicate tailwind.config.js's tokens
// rather than sharing a single source across the client/server boundary.
const LEGEND: { label: string; color: string }[] = [
  { label: 'Root cause', color: '#fb923c' },
  { label: 'Blast radius', color: '#fed7aa' },
  { label: 'Structural', color: '#e8b464' },
  { label: 'Heuristic', color: '#fde68a' },
  { label: 'Added', color: '#34d399' },
  { label: 'Removed', color: '#f87171' },
  { label: 'Moved', color: '#a78bfa' },
];

export function DeterminismGraphPanel({ title, dot, highlightedId = null, onHoverId }: DeterminismGraphPanelProps) {
  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border bg-panel p-4"
    >
      <h2 className="shrink-0 text-sm font-semibold text-neutral-200">{title}</h2>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-surface p-2">
        <GraphRenderer dot={dot} highlightedId={highlightedId} onHoverNode={onHoverId} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-400">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}

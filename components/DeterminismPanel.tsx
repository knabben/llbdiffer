'use client';

import type { ConfidenceTier, DeterminismReport, Finding, FindingAffected, StructuralChange } from '../src/detect/rules';

export interface DeterminismPanelProps {
  report: DeterminismReport;
  highlightedId?: string | null;
  onHoverId?: (id: string | null) => void;
  className?: string;
}

const TIER_LABEL: Record<ConfidenceTier, string> = { proven: 'Proven', structural: 'Structural', heuristic: 'Heuristic' };
const TIER_COLOR: Record<ConfidenceTier, string> = { proven: 'text-removed', structural: 'text-accent', heuristic: 'text-shared' };

function AffectedList({
  affected,
  highlightedId,
  onHoverId,
}: {
  affected: FindingAffected[];
  highlightedId: string | null;
  onHoverId?: (id: string | null) => void;
}) {
  return (
    <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
      {affected.map((a, i) => (
        <li
          key={`${a.nodeId}-${a.side ?? ''}-${i}`}
          className={`flex cursor-default items-baseline gap-2 truncate rounded px-1 text-xs ${
            highlightedId === a.nodeId ? 'bg-yellow-400/20 text-yellow-200' : ''
          }`}
          onMouseEnter={() => onHoverId?.(a.nodeId)}
          onMouseLeave={() => onHoverId?.(null)}
        >
          {a.side && (
            <span className={`shrink-0 uppercase tracking-wide ${a.side === 'left' ? 'text-removed' : 'text-added'}`}>
              {a.side}
            </span>
          )}
          <span className="truncate font-mono text-neutral-300" title={a.nodeId}>
            {a.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FindingCard({
  finding,
  highlightedId,
  onHoverId,
}: {
  finding: Finding;
  highlightedId: string | null;
  onHoverId?: (id: string | null) => void;
}) {
  const isFallback = finding.causeCode === 'UNKNOWN_DIVERGENCE';
  return (
    <li
      className={`rounded-lg border p-3 text-sm ${
        isFallback ? 'border-dashed border-neutral-600 bg-surface/50' : 'border-border bg-surface'
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${TIER_COLOR[finding.tier]}`}>
          {TIER_LABEL[finding.tier]}
        </span>
        <span className="font-mono text-xs text-neutral-500">{finding.causeCode}</span>
        {typeof finding.blastRadius === 'number' && (
          <span className="ml-auto rounded bg-removed/10 px-2 py-0.5 text-xs text-removed">
            blast radius: {finding.blastRadius}
          </span>
        )}
      </div>
      <p className="text-neutral-300">{finding.message}</p>
      {finding.fix && <p className="mt-1 text-xs text-accent">Fix: {finding.fix}</p>}
      {isFallback && <p className="mt-1 text-xs italic text-neutral-500">No known pattern matched — raw difference only.</p>}
      <AffectedList affected={finding.affected} highlightedId={highlightedId} onHoverId={onHoverId} />
    </li>
  );
}

function StructuralChangesList({
  changes,
  highlightedId,
  onHoverId,
}: {
  changes: StructuralChange[];
  highlightedId: string | null;
  onHoverId?: (id: string | null) => void;
}) {
  if (changes.length === 0) return null;
  return (
    <div aria-label="Structural changes" className="mb-4">
      <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Structural changes ({changes.length})</h3>
      <ul className="space-y-0.5 font-mono text-xs text-neutral-400">
        {changes.map((change, i) => (
          <li
            key={`${change.nodeId}-${change.side}-${i}`}
            className={`cursor-default truncate rounded px-1 ${
              highlightedId === change.nodeId ? 'bg-yellow-400/20 text-yellow-200' : ''
            }`}
            title={change.nodeId}
            onMouseEnter={() => onHoverId?.(change.nodeId)}
            onMouseLeave={() => onHoverId?.(null)}
          >
            <span
              className={
                change.status === 'added' ? 'text-added' : change.status === 'removed' ? 'text-removed' : 'text-accent'
              }
            >
              {change.status}
            </span>{' '}
            ({change.side}) {change.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders a precomputed `DeterminismReport` (single- or comparison-mode) —
 * a pure renderer, never re-derives findings itself (Constitution
 * Principle II). `highlightedId`/`onHoverId` sync hover state with the
 * graph panel(s) on the page, mirroring `DiffSummaryPanel`'s pattern.
 */
export function DeterminismPanel({ report, highlightedId = null, onHoverId, className = '' }: DeterminismPanelProps) {
  if (report.identical) {
    return (
      <section
        aria-label="Determinism report"
        className={`rounded-xl border border-border bg-panel p-4 text-sm text-neutral-300 ${className}`}
      >
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Determinism report</h2>
        <p>
          {report.mode === 'single'
            ? 'Nothing found — no guaranteed-bad or suspicious constructs detected.'
            : 'No differences found — both builds are equivalent.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Determinism report" className={`rounded-xl border border-border bg-panel p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Determinism report</h2>
      {report.structuralChanges && (
        <StructuralChangesList changes={report.structuralChanges} highlightedId={highlightedId} onHoverId={onHoverId} />
      )}
      <ul className="space-y-2">
        {report.findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} highlightedId={highlightedId} onHoverId={onHoverId} />
        ))}
      </ul>
    </section>
  );
}

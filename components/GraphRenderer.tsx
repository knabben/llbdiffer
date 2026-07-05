'use client';

import { useEffect, useRef, useState } from 'react';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

// Loaded once and reused; the WASM module is bundled with the app (no CDN
// fetch), per Constitution Principle III — see research.md.
let graphvizPromise: ReturnType<typeof Graphviz.load> | null = null;
function loadGraphviz() {
  if (!graphvizPromise) {
    graphvizPromise = Graphviz.load();
  }
  return graphvizPromise;
}

const HOVER_STROKE = '#facc15';

export interface GraphRendererProps {
  dot: string;
  /** Node id to highlight (e.g. hovered elsewhere on the page). */
  highlightedId?: string | null;
  /** Called with a node id on hover-in, and `null` on hover-out. */
  onHoverNode?: (id: string | null) => void;
}

function nodeIdOf(group: Element): string | null {
  return group.querySelector('title')?.textContent ?? null;
}

export function GraphRenderer({ dot, highlightedId = null, onHoverNode }: GraphRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedDot, setRenderedDot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    loadGraphviz()
      .then((graphviz) => {
        if (cancelled) return;
        const svg = graphviz.dot(dot);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setRenderedDot(dot);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dot]);

  // Wire hover listeners once per render of the SVG.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onHoverNode) return;

    const groups = Array.from(container.querySelectorAll<SVGGElement>('g.node'));
    const listeners: Array<{ el: SVGGElement; enter: () => void; leave: () => void }> = [];

    for (const group of groups) {
      const id = nodeIdOf(group);
      if (!id) continue;
      group.style.cursor = 'pointer';
      const enter = () => onHoverNode(id);
      const leave = () => onHoverNode(null);
      group.addEventListener('mouseenter', enter);
      group.addEventListener('mouseleave', leave);
      listeners.push({ el: group, enter, leave });
    }

    return () => {
      for (const { el, enter, leave } of listeners) {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
      }
    };
  }, [renderedDot, onHoverNode]);

  // Apply/clear the highlight outline whenever the highlighted id changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const group of Array.from(container.querySelectorAll<SVGGElement>('g.node'))) {
      const shape = group.querySelector('ellipse, polygon, path');
      if (!shape) continue;
      const isHighlighted = highlightedId !== null && nodeIdOf(group) === highlightedId;
      if (isHighlighted) {
        shape.setAttribute('stroke', HOVER_STROKE);
        shape.setAttribute('stroke-width', '4');
      } else {
        shape.setAttribute('stroke', 'black');
        shape.removeAttribute('stroke-width');
      }
    }
  }, [highlightedId, renderedDot]);

  if (error) {
    return <div role="alert">Failed to render graph: {error}</div>;
  }

  return <div ref={containerRef} data-testid="graph-renderer" />;
}

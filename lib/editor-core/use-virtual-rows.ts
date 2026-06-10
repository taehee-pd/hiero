'use client';

/**
 * D3 — minimal fixed-height row windowing
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * Dependency-free alternative to react-virtual for the simple case we
 * have: long, flat lists of fixed-height rows. Render only the rows
 * intersecting the scrollport (± overscan) inside a spacer sized to
 * the full list, so a 1,000-icon workspace scrolls without mounting
 * 1,000 buttons.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type VirtualRows = {
  /** Attach to the scrollable container. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the scrollable container's onScroll. */
  onScroll: () => void;
  /** Slice bounds into the source array. */
  start: number;
  end: number;
  /** Height of the full (unwindowed) list in px. */
  totalHeight: number;
  /** translateY for the rendered slice in px. */
  offsetY: number;
};

export function useVirtualRows(options: {
  count: number;
  rowHeight: number;
  overscan?: number;
}): VirtualRows {
  const { count, rowHeight, overscan = 8 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(count, overscan * 2 + 1),
  }));

  const update = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
    const end = Math.min(
      count,
      Math.ceil((el.scrollTop + el.clientHeight) / rowHeight) + overscan,
    );
    setRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, [count, rowHeight, overscan]);

  // Re-window when the list length changes (filtering, inserts).
  useEffect(() => {
    update();
  }, [update]);

  return {
    containerRef,
    onScroll: update,
    start: range.start,
    end: range.end,
    totalHeight: count * rowHeight,
    offsetY: range.start * rowHeight,
  };
}

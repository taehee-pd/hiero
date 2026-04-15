// useMarqueeSelection — shared drag-lifecycle hook for click-and-drag
// multi-select panes (ListPane icon grid, LayerPanel layer list).
//
// The two call sites share the entire state machine and only differ in:
//   1. Which DOM attribute identifies a hit-test target
//      (article[data-icon-id] vs [data-layer-id]).
//   2. Which selection they commit to (setSelectedIconIds for the
//      workspace icon grid, setSelection({ layerIds, pointIds: [] })
//      for the editor's variant layers).
//
// Both are parameterized here. The hit-test math (rectsIntersect) is
// inlined; it is simple enough that extracting it separately would not
// add value, and it already has coverage via the existing layout tests.
//
// Characterization tests in tests/char-marquee-{listPane,layerPanel}
// .test.tsx lock in the drag-lifecycle behaviors this hook preserves:
//
//   - Pointerdown on a hit-test target does NOT start a drag.
//   - Pointerdown on a scrollbar does NOT start a drag.
//   - Pointerdown with a non-primary button is a no-op.
//   - Pointerdown without shift/meta clears the "base" selection at
//     drag start. With shift/meta, the base is preserved so toggle
//     mode can add/remove against it.
//   - Pointerup ends the drag cleanly (no stuck overlay rect).
//
// ── Cancellation + unmount hygiene (codex adversarial finding #2) ─
//
// A drag in progress must end cleanly when any of these happen:
//   - pointerup fires (normal path)
//   - pointercancel fires (OS-level interrupt: touch cancellation,
//     gesture preemption, low-level scroll takeover)
//   - lostpointercapture fires (focus loss, alt-tab, modal open that
//     steals capture)
//   - the hosting component unmounts (route change mid-drag)
//
// Without these, dragRef.current stays set and `rect` stays non-null
// on screen — the next click is treated as a continuation of the dead
// drag. All paths funnel through the same `endDrag()` helper so any
// future cleanup (analytics, telemetry, selection commit on cancel)
// lives in one place.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react';

export type MarqueeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type DragState = {
  startX: number;
  startY: number;
  /** Selection at drag start — toggle mode adds/removes against this. */
  baseIds: string[];
  mode: 'replace' | 'toggle';
  /** Captured pointerId so we can release on any exit path. */
  pointerId: number;
  /** Element that currently holds pointer capture. Released on end. */
  captureTarget: HTMLElement | null;
};

export type MarqueeSelectionApi = {
  /**
   * The current marquee rect in viewport coordinates, or null when no
   * drag is active. Wire to an overlay div with
   * `data-marquee-overlay` for the exit-condition test to work.
   */
  rect: MarqueeRect | null;
  onPointerDown: (e: RPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: RPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: RPointerEvent<HTMLElement>) => void;
  /**
   * Bind to the same element as `onPointerDown` — releases capture
   * and clears drag state when the OS interrupts the gesture (touch
   * cancellation, gesture preemption).
   */
  onPointerCancel: (e: RPointerEvent<HTMLElement>) => void;
  /**
   * Bind to the same element as `onPointerDown` — releases drag
   * state if pointer capture is lost (focus change, alt-tab, modal
   * overlay stealing capture).
   */
  onLostPointerCapture: (e: RPointerEvent<HTMLElement>) => void;
};

export type MarqueeSelectionOptions = {
  /**
   * CSS selector for each hit-test target. The hook skips starting a
   * drag when pointerdown lands inside any element matching this.
   * Example: 'article[data-icon-id]' or '[data-layer-id]'.
   */
  itemSelector: string;
  /**
   * Attribute on each hit-test target that holds the item id. Example:
   * 'data-icon-id' or 'data-layer-id'.
   */
  itemIdAttribute: string;
  /**
   * Return the current selection at drag-start time. The hook snapshots
   * this into `baseIds` when shift/meta is held. MUST be stable across
   * renders (useCallback) — the hook uses it inside memoized handlers.
   */
  getCurrentSelection: () => string[];
  /**
   * Replace the active selection. Called from both the drag-start
   * clear (when no modifier is held) and from pointermove hit-tests.
   * MUST be stable across renders.
   */
  setSelection: (ids: string[]) => void;
  /**
   * Ref to the scrollable container that owns the hit-test targets.
   * Required because hit-testing uses ref.current.querySelectorAll
   * rather than the pointer event's currentTarget — this matches the
   * current inline implementations exactly.
   */
  containerRef: React.RefObject<HTMLElement | null>;
};

function rectsIntersect(
  a: MarqueeRect,
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function useMarqueeSelection({
  itemSelector,
  itemIdAttribute,
  getCurrentSelection,
  setSelection,
  containerRef,
}: MarqueeSelectionOptions): MarqueeSelectionApi {
  const dragRef = useRef<DragState | null>(null);
  const [rect, setRect] = useState<MarqueeRect | null>(null);

  // Single exit point for every end-of-drag path (pointerup, cancel,
  // lostpointercapture, unmount). Safe to call when no drag is active.
  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    try {
      drag.captureTarget?.releasePointerCapture(drag.pointerId);
    } catch {
      // Capture may have already been released by the time we get
      // here (e.g., element unmounted). releasePointerCapture throws
      // in that case; swallow — we only care about the hook's state
      // being reset.
    }
    dragRef.current = null;
    setRect(null);
  }, []);

  const onPointerDown = useCallback(
    (e: RPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Pointerdowns on a hit-test target are item-click territory,
      // not a marquee gesture.
      if (target.closest(itemSelector)) return;
      // Scrollbar drags come through as normal pointer events on
      // modern browsers; the original code excluded them explicitly.
      if (target.closest('[data-slot="scroll-area-scrollbar"]')) return;

      e.preventDefault();
      const captureTarget = e.currentTarget as HTMLElement;
      try {
        captureTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Rare: setPointerCapture can fail on synthetic events or
        // detached elements. Not fatal — drag still works, we just
        // lose "capture" semantics for this gesture.
      }

      const additive = e.shiftKey || e.metaKey;
      const base = additive ? [...getCurrentSelection()] : [];
      if (!additive) setSelection([]);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseIds: base,
        mode: additive ? 'toggle' : 'replace',
        pointerId: e.pointerId,
        captureTarget,
      };
    },
    [itemSelector, getCurrentSelection, setSelection],
  );

  const onPointerMove = useCallback(
    (e: RPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const left = Math.min(drag.startX, e.clientX);
      const top = Math.min(drag.startY, e.clientY);
      const right = Math.max(drag.startX, e.clientX);
      const bottom = Math.max(drag.startY, e.clientY);
      const liveRect: MarqueeRect = { left, top, right, bottom };
      setRect(liveRect);

      const container = containerRef.current;
      if (!container) {
        // Container unmounted mid-drag. End the drag cleanly rather
        // than leaving stale state; a later pointerup would also clean
        // up but callers expect the rect overlay to disappear
        // immediately when the list it belongs to is gone.
        endDrag();
        return;
      }

      const items = container.querySelectorAll<HTMLElement>(itemSelector);
      const hits: string[] = [];
      items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        if (rectsIntersect(liveRect, itemRect)) {
          const id = item.getAttribute(itemIdAttribute);
          if (id) hits.push(id);
        }
      });

      if (drag.mode === 'toggle') {
        const baseSet = new Set(drag.baseIds);
        for (const id of hits) {
          if (baseSet.has(id)) baseSet.delete(id);
          else baseSet.add(id);
        }
        setSelection([...baseSet]);
      } else {
        setSelection(hits);
      }
    },
    [itemSelector, itemIdAttribute, setSelection, containerRef, endDrag],
  );

  const onPointerUp = useCallback(
    (_e: RPointerEvent<HTMLElement>) => {
      endDrag();
    },
    [endDrag],
  );

  const onPointerCancel = useCallback(
    (_e: RPointerEvent<HTMLElement>) => {
      endDrag();
    },
    [endDrag],
  );

  const onLostPointerCapture = useCallback(
    (_e: RPointerEvent<HTMLElement>) => {
      endDrag();
    },
    [endDrag],
  );

  // Unmount cleanup — if the hosting component unmounts mid-drag we
  // still need to release pointer capture (the element is gone but
  // the pointerId may still be pinned to it on some platforms) and
  // clear state so a re-mount starts fresh.
  useEffect(() => {
    return () => {
      if (dragRef.current) {
        const drag = dragRef.current;
        try {
          drag.captureTarget?.releasePointerCapture(drag.pointerId);
        } catch {
          // See endDrag comment.
        }
        dragRef.current = null;
      }
    };
  }, []);

  return {
    rect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}

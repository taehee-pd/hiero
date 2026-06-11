/**
 * Pure pan-session helpers extracted from Canvas.tsx pointer event handlers.
 *
 * `createPanAccumulator` holds the accumulated delta between rAF flushes.
 * `shouldEndPan` mirrors the guard in `endPan` at Canvas.tsx:934-936.
 *
 * The component keeps all ref/rAF machinery and side effects; only the
 * pure accumulation and decision logic moves here so it can be unit-tested
 * without a real pointer device.
 */

export interface PanAccumulator {
  /** Add an incremental delta to the accumulator. */
  add(dx: number, dy: number): void;
  /**
   * Return the currently accumulated total and reset it to zero.
   * Mirrors the drain in `flushPanDelta` (Canvas.tsx:148-150).
   */
  drain(): { x: number; y: number };
}

/**
 * Create a mutable pan-delta accumulator.
 *
 * Usage pattern in the component:
 * ```ts
 * const acc = createPanAccumulator();
 * // on pointermove:
 * acc.add(deltaX, deltaY);
 * // in rAF flush:
 * const { x, y } = acc.drain();
 * ```
 */
export function createPanAccumulator(): PanAccumulator {
  let x = 0;
  let y = 0;
  return {
    add(dx, dy) {
      x += dx;
      y += dy;
    },
    drain() {
      const result = { x, y };
      x = 0;
      y = 0;
      return result;
    },
  };
}

/**
 * Pure guard: should the current pan session end?
 *
 * Mirrors `endPan` (Canvas.tsx:934-936):
 *   `if (pointerId !== undefined && panSessionRef.current?.pointerId !== pointerId) return;`
 *
 * Returns `true` when the session should end:
 * - There is an active session AND
 *   - `pointerId` is `undefined` (blur / mouseup — end unconditionally), OR
 *   - `pointerId` matches the session's pointerId
 *
 * Returns `false` when:
 * - There is no active session (nothing to end), OR
 * - `pointerId` is defined but does not match the session's pointerId
 */
export function shouldEndPan(
  session: { pointerId: number } | null,
  pointerId?: number,
): boolean {
  if (session === null) return false;
  if (pointerId === undefined) return true;
  return session.pointerId === pointerId;
}

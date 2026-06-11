/**
 * Pure pinch-zoom math extracted from Canvas.tsx `flushPinchZoom`.
 *
 * `computePinchViewport` is a side-effect-free function that computes
 * the next viewport state after a pinch gesture accumulation frame.
 * The component keeps all ref/rAF machinery; only the numeric decision
 * moves here so it can be unit-tested without a real pointer device.
 */

export interface PinchViewportInput {
  /** Current viewport state. */
  current: { zoom: number; panX: number; panY: number };
  /** Accumulated scale factor for this rAF frame (product of incremental factors). */
  factor: number;
  /** Cursor position in client (page) coordinates. */
  cursor: { x: number; y: number };
  /** Bounding rect of the container element. */
  rect: { left: number; top: number; width: number; height: number };
  minZoom: number;
  maxZoom: number;
}

export interface PinchViewportResult {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Compute the next viewport after a pinch-zoom gesture frame.
 *
 * Returns `null` for no-op cases:
 * - `factor` is not finite, is ≤ 0, or is `NaN`
 * - zoom is already clamped at the boundary and the factor would not move it
 *
 * This is a verbatim lift of the math from Canvas.tsx `flushPinchZoom`
 * (lines 169-193 at commit 4ffd061).
 */
export function computePinchViewport(input: PinchViewportInput): PinchViewportResult | null {
  const { current, factor, cursor, rect, minZoom, maxZoom } = input;

  if (!Number.isFinite(factor) || factor <= 0) return null;

  const nextZoom = Math.max(minZoom, Math.min(maxZoom, current.zoom * factor));
  if (nextZoom === current.zoom) return null;

  const cursorX = cursor.x - rect.left - rect.width / 2;
  const cursorY = cursor.y - rect.top - rect.height / 2;
  const scaleFactor = nextZoom / current.zoom;

  return {
    zoom: nextZoom,
    panX: cursorX - scaleFactor * (cursorX - current.panX),
    panY: cursorY - scaleFactor * (cursorY - current.panY),
  };
}

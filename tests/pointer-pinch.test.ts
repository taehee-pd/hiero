/**
 * Unit tests for lib/editor-core/pointer-pinch.ts
 *
 * Tests the pure `computePinchViewport` function extracted from
 * Canvas.tsx `flushPinchZoom`. No DOM / rAF / component required.
 */
import { describe, expect, test } from 'bun:test';
import { computePinchViewport } from '../lib/editor-core/pointer-pinch';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

/** Helper — build input with a centred cursor (rect centre == cursor) so cursorX/Y == 0,0 */
function centredInput(overrides: Partial<Parameters<typeof computePinchViewport>[0]> = {}) {
  return {
    current: { zoom: 1, panX: 0, panY: 0 },
    factor: 2,
    cursor: { x: 200, y: 150 },
    rect: { left: 100, top: 50, width: 200, height: 200 },
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    ...overrides,
  };
}

// --- No-op / null cases ---

test('returns null for factor = 0', () => {
  expect(computePinchViewport(centredInput({ factor: 0 }))).toBeNull();
});

test('returns null for factor < 0', () => {
  expect(computePinchViewport(centredInput({ factor: -1 }))).toBeNull();
});

test('returns null for NaN factor', () => {
  expect(computePinchViewport(centredInput({ factor: NaN }))).toBeNull();
});

test('returns null for Infinity factor when zoom is already at MAX_ZOOM', () => {
  // MAX_ZOOM * Infinity would clamp to MAX_ZOOM — no change when already there
  const result = computePinchViewport(
    centredInput({ factor: Infinity, current: { zoom: MAX_ZOOM, panX: 0, panY: 0 } }),
  );
  // Infinity is not finite → null (guard hits before clamp)
  expect(result).toBeNull();
});

test('returns null for factor = 1.0 when zoom is clamped at MAX_ZOOM (no zoom change)', () => {
  const result = computePinchViewport(
    centredInput({ factor: 1.0, current: { zoom: MAX_ZOOM, panX: 0, panY: 0 } }),
  );
  // zoom * 1 === zoom → clamp result equals current → null
  expect(result).toBeNull();
});

test('returns null when factor would not change clamped zoom (zoom at MIN_ZOOM, factor < 1)', () => {
  const result = computePinchViewport(
    centredInput({ factor: 0.5, current: { zoom: MIN_ZOOM, panX: 0, panY: 0 } }),
  );
  // max(0.1, min(32, 0.1*0.5=0.05)) === 0.1 === current.zoom → null
  expect(result).toBeNull();
});

// --- Zoom clamping ---

describe('zoom clamping', () => {
  test('zoom does not exceed MAX_ZOOM', () => {
    const result = computePinchViewport(
      centredInput({ factor: 100, current: { zoom: 20, panX: 0, panY: 0 } }),
    );
    expect(result).not.toBeNull();
    expect(result!.zoom).toBe(MAX_ZOOM);
  });

  test('zoom does not go below MIN_ZOOM when zooming out from near boundary', () => {
    // 0.2 * 0.1 = 0.02 → clamp to 0.1
    const result = computePinchViewport(
      centredInput({ factor: 0.1, current: { zoom: 0.2, panX: 0, panY: 0 } }),
    );
    expect(result).not.toBeNull();
    expect(result!.zoom).toBe(MIN_ZOOM);
  });

  test('zoom-in from 1 by factor 2 gives 2', () => {
    const result = computePinchViewport(centredInput({ factor: 2, current: { zoom: 1, panX: 0, panY: 0 } }));
    expect(result).not.toBeNull();
    expect(result!.zoom).toBeCloseTo(2);
  });

  test('zoom-out from 4 by factor 0.5 gives 2', () => {
    const result = computePinchViewport(centredInput({ factor: 0.5, current: { zoom: 4, panX: 0, panY: 0 } }));
    expect(result).not.toBeNull();
    expect(result!.zoom).toBeCloseTo(2);
  });
});

// --- Cursor-anchoring property ---
//
// When the cursor sits on a canvas point P, zooming should keep P in the same
// screen position. In viewport-space (where the canvas origin is at the rect
// centre), the canvas point P is at:
//   screenP = cursorX - panX ← wrong direction, see below
//
// The invariant is: the canvas coordinate under the cursor stays fixed.
// In the viewport math, the canvas offset at cursor is:
//   canvasCoord = (cursorX - panX) / zoom
// After zoom: canvasCoord' = (cursorX - panX') / nextZoom
// Invariant: canvasCoord === canvasCoord'  ←→  (cursorX - panX) / zoom === (cursorX - panX') / nextZoom

describe('cursor-anchoring invariant', () => {
  function canvasCoordUnderCursor(viewport: { zoom: number; panX: number; panY: number }, cursorX: number, cursorY: number) {
    return {
      cx: (cursorX - viewport.panX) / viewport.zoom,
      cy: (cursorY - viewport.panY) / viewport.zoom,
    };
  }

  test('pinching at a cursor off-centre keeps that canvas point fixed (zoom in)', () => {
    // rect centre is at (200, 150), cursor at (250, 180) — cursorX=50, cursorY=30
    const input = {
      current: { zoom: 1, panX: 10, panY: -5 },
      factor: 2,
      cursor: { x: 250, y: 180 },
      rect: { left: 100, top: 50, width: 200, height: 200 },
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    };
    const cursorX = input.cursor.x - input.rect.left - input.rect.width / 2;   // 50
    const cursorY = input.cursor.y - input.rect.top - input.rect.height / 2;   // 30

    const before = canvasCoordUnderCursor(input.current, cursorX, cursorY);
    const result = computePinchViewport(input)!;
    const after = canvasCoordUnderCursor(result, cursorX, cursorY);

    expect(after.cx).toBeCloseTo(before.cx, 8);
    expect(after.cy).toBeCloseTo(before.cy, 8);
  });

  test('pinching at a cursor off-centre keeps that canvas point fixed (zoom out)', () => {
    const input = {
      current: { zoom: 4, panX: 20, panY: 15 },
      factor: 0.5,
      cursor: { x: 160, y: 120 },
      rect: { left: 0, top: 0, width: 400, height: 300 },
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    };
    const cursorX = input.cursor.x - input.rect.left - input.rect.width / 2;
    const cursorY = input.cursor.y - input.rect.top - input.rect.height / 2;

    const before = canvasCoordUnderCursor(input.current, cursorX, cursorY);
    const result = computePinchViewport(input)!;
    const after = canvasCoordUnderCursor(result, cursorX, cursorY);

    expect(after.cx).toBeCloseTo(before.cx, 8);
    expect(after.cy).toBeCloseTo(before.cy, 8);
  });

  test('pinching at the rect centre (cursorX=0, cursorY=0) leaves panX/panY scaled', () => {
    // When cursor == rect centre, cursorX = 0, cursorY = 0.
    // Result: panX' = 0 - scaleFactor*(0 - panX) = scaleFactor * panX
    const input = centredInput({ factor: 2, current: { zoom: 1, panX: 50, panY: -30 } });
    const result = computePinchViewport(input)!;
    expect(result.panX).toBeCloseTo(100); // 2 * 50
    expect(result.panY).toBeCloseTo(-60); // 2 * -30
  });
});

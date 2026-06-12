/**
 * Tests for the Lottie static-shape import adapter.
 *
 * NO happy-dom / DOM imports in this file — pure bun:test only.
 */
import { describe, expect, test } from 'bun:test';
import { exportLottie } from '../lib/export/export-lottie';
import { lottieToSvg } from '../lib/import/lottie-import';
import type { Icon } from '../lib/schema/types';
import { normalizeVariant } from '../lib/schema/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal check-mark icon (single filled path, cubic segments). */
const EXAMPLE_CHECK_ICON: Icon = {
  id: 'check',
  name: 'Check',
  category: 'general',
  tags: ['check', 'confirm'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      layers: {
        path: {
          id: 'path',
          path: { d: 'M 4 13 C 6 15 9 18 12 21 C 15 17 19 11 22 4 Z' },
          style: {
            fill: { mode: 'fixed', value: '#000000' },
          },
        },
      },
    }),
  },
  transitions: {},
  effects: {},
} as Icon;

/** A play icon (filled triangle — closed path with no tangents = straight lines). */
const EXAMPLE_PLAY_ICON: Icon = {
  id: 'play',
  name: 'Play',
  category: 'media',
  tags: ['play', 'media'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      layers: {
        triangle: {
          id: 'triangle',
          // Simple triangle: M then L commands so closed path ends with Z
          path: { d: 'M 5 3 L 5 21 L 21 12 Z' },
          style: {
            fill: { mode: 'fixed', value: '#000000' },
          },
        },
      },
    }),
  },
  transitions: {},
  effects: {},
} as Icon;

// ---------------------------------------------------------------------------
// Helper — build a minimal hand-crafted Lottie document
// ---------------------------------------------------------------------------

function buildMinimalLottie(overrides: Record<string, unknown> = {}): unknown {
  return {
    v: '5.12.1',
    fr: 60,
    ip: 0,
    op: 60,
    w: 24,
    h: 24,
    nm: 'Test',
    assets: [],
    layers: [
      {
        ty: 4,
        nm: 'layer-1',
        ind: 0,
        ip: 0,
        op: 60,
        st: 0,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, a: { a: 0, k: [0, 0, 0] } },
        shapes: [
          {
            ty: 'sh',
            nm: 'path-1',
            ks: {
              a: 0,
              k: {
                v: [[4, 12], [12, 20], [20, 12], [12, 4]],
                i: [[0, 0], [0, 0], [0, 0], [0, 0]],
                o: [[0, 0], [0, 0], [0, 0], [0, 0]],
                c: true,
              },
            },
          },
          {
            ty: 'fl',
            nm: 'fill',
            c: { a: 0, k: [1, 0, 0, 1] },
            o: { a: 0, k: 100 },
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: Round-trip check icon
// ---------------------------------------------------------------------------

describe('lottie import — round-trip (check icon)', () => {
  test('exportLottie then lottieToSvg returns a valid svg', () => {
    const lottie = exportLottie(EXAMPLE_CHECK_ICON, 'v24');
    const result = lottieToSvg(lottie);

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('<path');
    // viewBox should be present with correct dimensions
    expect(result.svg).toContain('viewBox="0 0 24 24"');
    // d attribute must be non-empty
    const dMatch = result.svg.match(/d="([^"]+)"/);
    expect(dMatch).not.toBeNull();
    expect(dMatch![1]!.length).toBeGreaterThan(0);
    // name from Lottie nm field
    expect(result.name).toBe('Check');
  });
});

// ---------------------------------------------------------------------------
// Test 2: Round-trip play icon — closed path ends with Z
// ---------------------------------------------------------------------------

describe('lottie import — round-trip (play icon)', () => {
  test('exportLottie then lottieToSvg returns svg with closed path', () => {
    const lottie = exportLottie(EXAMPLE_PLAY_ICON, 'v24');
    const result = lottieToSvg(lottie);

    expect(result.svg).toContain('<path');
    // Closed bezier must end with Z
    const dMatch = result.svg.match(/d="([^"]+)"/);
    expect(dMatch).not.toBeNull();
    expect(dMatch![1]!.trim().toUpperCase().endsWith('Z')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Not-a-Lottie inputs throw
// ---------------------------------------------------------------------------

describe('lottie import — input validation', () => {
  test('null throws Not a Lottie document', () => {
    expect(() => lottieToSvg(null)).toThrow('Not a Lottie document');
  });

  test('empty object throws Not a Lottie document', () => {
    expect(() => lottieToSvg({})).toThrow('Not a Lottie document');
  });

  test('object with only w throws Not a Lottie document', () => {
    expect(() => lottieToSvg({ w: 24 })).toThrow('Not a Lottie document');
  });

  test('array throws Not a Lottie document', () => {
    expect(() => lottieToSvg([1, 2, 3])).toThrow('Not a Lottie document');
  });

  test('string throws Not a Lottie document', () => {
    expect(() => lottieToSvg('{"v":"5"}' as unknown)).toThrow('Not a Lottie document');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Unsupported features warn, never throw
// ---------------------------------------------------------------------------

describe('lottie import — unsupported features warn, not throw', () => {
  test('trim path (tm) item produces warning and still returns path', () => {
    const lottie = buildMinimalLottie();
    const doc = lottie as Record<string, unknown>;
    const layer = (doc['layers'] as Record<string, unknown>[])[0]!;
    // Inject a trim-path item alongside the existing path+fill shapes
    (layer['shapes'] as unknown[]).push({
      ty: 'tm',
      nm: 'trim',
      s: { a: 0, k: 0 },
      e: { a: 0, k: 100 },
      o: { a: 0, k: 0 },
      m: 1,
    });

    const result = lottieToSvg(lottie);

    // Must not throw — must return a result
    expect(result.svg).toContain('<path');
    // Must have a warning mentioning trim or unsupported
    const hasTrimWarning = result.warnings.some(
      (w) => w.toLowerCase().includes('trim') || w.toLowerCase().includes('unsupported'),
    );
    expect(hasTrimWarning).toBe(true);
  });

  test('non-shape layer type produces warning', () => {
    const lottie = buildMinimalLottie({
      layers: [
        {
          ty: 2, // image layer
          nm: 'image-layer',
          ind: 0,
          ip: 0,
          op: 60,
          st: 0,
          ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, a: { a: 0, k: [0, 0, 0] } },
        },
      ],
    });

    const result = lottieToSvg(lottie);
    expect(result.warnings.some((w) => w.includes('type 2'))).toBe(true);
    // No paths were emitted (image layer has no shapes), but no throw
    expect(result.svg).toContain('<svg');
  });
});

// ---------------------------------------------------------------------------
// Test 5: Color conversion
// ---------------------------------------------------------------------------

describe('lottie import — color conversion', () => {
  test('fill c.k [1, 0, 0, 1] produces fill="#ff0000"', () => {
    const lottie = buildMinimalLottie();
    // The minimal lottie already has c.k [1, 0, 0, 1] in the fill
    const result = lottieToSvg(lottie);

    expect(result.svg).toContain('fill="#ff0000"');
  });

  test('fill c.k [0, 0, 1, 1] produces fill="#0000ff"', () => {
    const lottie = buildMinimalLottie({
      layers: [
        {
          ty: 4,
          nm: 'layer-blue',
          ind: 0,
          ip: 0,
          op: 60,
          st: 0,
          ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, a: { a: 0, k: [0, 0, 0] } },
          shapes: [
            {
              ty: 'sh',
              nm: 'p',
              ks: {
                a: 0,
                k: { v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true },
              },
            },
            { ty: 'fl', nm: 'fill', c: { a: 0, k: [0, 0, 1, 1] }, o: { a: 0, k: 100 } },
          ],
        },
      ],
    });
    const result = lottieToSvg(lottie);
    expect(result.svg).toContain('fill="#0000ff"');
  });

  test('fill c.k [0, 1, 0, 1] produces fill="#00ff00"', () => {
    const lottie = buildMinimalLottie({
      layers: [
        {
          ty: 4,
          nm: 'layer-green',
          ind: 0,
          ip: 0,
          op: 60,
          st: 0,
          ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, a: { a: 0, k: [0, 0, 0] } },
          shapes: [
            {
              ty: 'sh',
              nm: 'p',
              ks: {
                a: 0,
                k: { v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true },
              },
            },
            { ty: 'fl', nm: 'fill', c: { a: 0, k: [0, 1, 0, 1] }, o: { a: 0, k: 100 } },
          ],
        },
      ],
    });
    const result = lottieToSvg(lottie);
    expect(result.svg).toContain('fill="#00ff00"');
  });
});

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe('lottie import — edge cases', () => {
  test('name falls back to "Lottie import" when nm is missing', () => {
    const lottie = buildMinimalLottie();
    delete (lottie as Record<string, unknown>)['nm'];
    const result = lottieToSvg(lottie);
    expect(result.name).toBe('Lottie import');
  });

  test('returns empty svg body for lottie with no shape layers', () => {
    const lottie = buildMinimalLottie({ layers: [] });
    const result = lottieToSvg(lottie);
    expect(result.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>');
  });

  test('warnings is an array even for clean input', () => {
    const lottie = buildMinimalLottie();
    const result = lottieToSvg(lottie);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('animated path uses first keyframe and warns', () => {
    const lottie = buildMinimalLottie({
      layers: [
        {
          ty: 4,
          nm: 'anim-layer',
          ind: 0,
          ip: 0,
          op: 60,
          st: 0,
          ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, a: { a: 0, k: [0, 0, 0] } },
          shapes: [
            {
              ty: 'sh',
              nm: 'animated-path',
              ks: {
                a: 1,
                k: [
                  {
                    t: 0,
                    s: [{ v: [[0, 0], [12, 0], [12, 12]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
                    e: [{ v: [[0, 0], [24, 0], [24, 24]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
                  },
                  {
                    t: 60,
                    s: [{ v: [[0, 0], [24, 0], [24, 24]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const result = lottieToSvg(lottie);
    // Should emit a path from first keyframe
    expect(result.svg).toContain('<path');
    // Should warn about using first keyframe
    expect(result.warnings.some((w) => w.toLowerCase().includes('first keyframe'))).toBe(true);
  });
});

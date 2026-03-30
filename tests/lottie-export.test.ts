import { describe, expect, test } from 'bun:test';
import {
  exportLottie,
  svgPathToLottieBezier,
  easingToLottie,
  type LottieJson,
  type LottieBezier,
} from '../lib/export/export-lottie';
import { collectLottieDowngrades } from '../lib/export/lottie-downgrade';
import type { Icon } from '../lib/schema/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMinimalIcon(overrides: Partial<Icon> = {}): Icon {
  return {
    id: 'test-icon',
    name: 'Test Icon',
    variants: {
      '16': {
        id: '16',
        size: 16,
        viewBox: [0, 0, 16, 16] as [number, number, number, number],
        layers: {
          'layer-1': {
            id: 'layer-1',
            path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
            style: {
              fill: { mode: 'fixed' as const, value: '#FF0000' },
            },
          },
        },
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              'layer-1': {
                id: 'layer-1',
                path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
                style: {
                  fill: { mode: 'fixed' as const, value: '#FF0000' },
                },
              },
            },
          },
        },
      },
    },
    transitions: {},
    effects: {},
    ...overrides,
  } as Icon;
}

function createAnimatedIcon(): Icon {
  return createMinimalIcon({
    variants: {
      '16': {
        id: '16',
        size: 16,
        viewBox: [0, 0, 16, 16] as [number, number, number, number],
        layers: {
          'layer-1': {
            id: 'layer-1',
            path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
            style: { fill: { mode: 'fixed' as const, value: '#000000' } },
          },
        },
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              'layer-1': {
                id: 'layer-1',
                path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
                style: { fill: { mode: 'fixed' as const, value: '#000000' } },
              },
            },
          },
          active: {
            id: 'active',
            layers: {
              'layer-1': {
                id: 'layer-1',
                path: { d: 'M 0 0 C 8 0 16 8 16 16 Z' },
                style: { fill: { mode: 'fixed' as const, value: '#FF0000' } },
              },
            },
          },
        },
      },
    },
    transitions: {
      't1': {
        id: 't1',
        fromIconId: 'test-icon',
        toIconId: 'test-icon',
        fromVariantId: '16',
        toVariantId: '16',
        from: 'default',
        to: 'active',
        strategy: 'lineAnimation' as const,
        durationMs: 500,
        easing: 'ease-in-out',
        layerBindings: [
          {
            fromLayerId: 'layer-1',
            toLayerId: 'layer-1',
            tracks: [
              { property: 'opacity' as const, keyframes: [1, 0.5, 1] },
              { property: 'rotate' as const, keyframes: [0, 180] },
            ],
          },
        ],
      },
    },
  } as Partial<Icon>);
}

// ---------------------------------------------------------------------------
// M1 — Core exporter
// ---------------------------------------------------------------------------

describe('exportLottie (M1)', () => {
  test('produces valid root structure', () => {
    const icon = createMinimalIcon();
    const result = exportLottie(icon, '16');

    expect(result.v).toBe('5.12.1');
    expect(result.fr).toBe(60);
    expect(result.ip).toBe(0);
    expect(result.w).toBe(16);
    expect(result.h).toBe(16);
    expect(result.nm).toBe('Test Icon');
    expect(result.assets).toEqual([]);
    expect(result.layers.length).toBeGreaterThan(0);
  });

  test('throws for missing variant', () => {
    const icon = createMinimalIcon();
    expect(() => exportLottie(icon, 'nonexistent')).toThrow('Variant "nonexistent" not found');
  });

  test('exports deterministic output (snapshot stability)', () => {
    const icon = createMinimalIcon();
    const result1 = JSON.stringify(exportLottie(icon, '16'));
    const result2 = JSON.stringify(exportLottie(icon, '16'));
    expect(result1).toBe(result2);
  });

  test('op is integer frame count from longest transition', () => {
    const icon = createAnimatedIcon();
    const result = exportLottie(icon, '16');
    // 500ms at 60fps = 30 frames
    expect(result.op).toBe(30);
    expect(Number.isInteger(result.op)).toBe(true);
  });

  test('op defaults to 1 second if no transitions', () => {
    const icon = createMinimalIcon();
    const result = exportLottie(icon, '16');
    expect(result.op).toBe(60); // 1 second at 60fps
  });

  test('respects custom fps option', () => {
    const icon = createMinimalIcon();
    const result = exportLottie(icon, '16', { fps: 30 });
    expect(result.fr).toBe(30);
    expect(result.op).toBe(30); // 1 second at 30fps
  });
});

// ---------------------------------------------------------------------------
// M2 — SVG path → Lottie bezier
// ---------------------------------------------------------------------------

describe('svgPathToLottieBezier (M2)', () => {
  test('converts basic cubic path', () => {
    const bezier = svgPathToLottieBezier('M 0 0 C 5 0 10 5 10 10 Z');
    expect(bezier.v.length).toBeGreaterThan(0);
    expect(bezier.i.length).toBe(bezier.v.length);
    expect(bezier.o.length).toBe(bezier.v.length);
    expect(bezier.c).toBe(true);
  });

  test('handles unclosed paths', () => {
    const bezier = svgPathToLottieBezier('M 0 0 C 5 0 10 5 10 10');
    expect(bezier.c).toBe(false);
  });

  test('handles line segments', () => {
    const bezier = svgPathToLottieBezier('M 0 0 L 10 10 L 20 0 Z');
    expect(bezier.v.length).toBe(3);
    expect(bezier.c).toBe(true);
    // Line segments have zero tangents
    expect(bezier.i[1]).toEqual([0, 0]);
    expect(bezier.o[1]).toEqual([0, 0]);
  });

  test('handles multiple cubic segments', () => {
    const bezier = svgPathToLottieBezier(
      'M 0 0 C 1 2 3 4 5 6 C 7 8 9 10 11 12 Z',
    );
    expect(bezier.v.length).toBe(3); // M + 2 C endpoints
    expect(bezier.c).toBe(true);
  });

  test('empty path returns empty bezier', () => {
    const bezier = svgPathToLottieBezier('');
    expect(bezier.v).toEqual([]);
    expect(bezier.c).toBe(false);
  });

  test('in-tangents are relative to vertex', () => {
    const bezier = svgPathToLottieBezier('M 0 0 C 2 0 8 10 10 10');
    // Second vertex is at (10, 10), control point c2 is (8, 10)
    // In-tangent = c2 - vertex = (8-10, 10-10) = (-2, 0)
    expect(bezier.i[1]).toEqual([-2, 0]);
  });
});

// ---------------------------------------------------------------------------
// M3 — Track animations
// ---------------------------------------------------------------------------

describe('Track animations (M3)', () => {
  test('animated icon produces animated transform properties', () => {
    const icon = createAnimatedIcon();
    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;

    // Opacity track should be animated
    expect(layer.ks.o.a).toBe(1);
    // Rotation track should be animated
    expect(layer.ks.r.a).toBe(1);
  });

  test('static icon has non-animated transforms', () => {
    const icon = createMinimalIcon();
    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;

    expect(layer.ks.o.a).toBe(0);
    expect(layer.ks.r.a).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// M4 — Morph keyframes
// ---------------------------------------------------------------------------

describe('Morph keyframes (M4)', () => {
  test('strictMorph transition produces shape keyframes', () => {
    const icon = createMinimalIcon({
      transitions: {
        't1': {
          id: 't1',
          fromIconId: 'test-icon',
          toIconId: 'test-icon',
          fromVariantId: '16',
          toVariantId: '16',
          from: 'default',
          to: 'default',
          strategy: 'strictMorph' as const,
          durationMs: 300,
          layerBindings: [
            {
              fromLayerId: 'layer-1',
              toLayerId: 'layer-1',
              morph: { topology: 'strict' as const },
            },
          ],
        },
      },
    } as Partial<Icon>);

    // This should not throw — morph from same path to same path
    const result = exportLottie(icon, '16');
    expect(result.layers.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// M5 — Trim path
// ---------------------------------------------------------------------------

describe('Trim path (M5)', () => {
  test('trim tracks produce trim shape on layer', () => {
    const icon = createMinimalIcon({
      transitions: {
        't1': {
          id: 't1',
          fromIconId: 'test-icon',
          toIconId: 'test-icon',
          fromVariantId: '16',
          toVariantId: '16',
          from: 'default',
          to: 'default',
          strategy: 'lineAnimation' as const,
          durationMs: 500,
          layerBindings: [
            {
              fromLayerId: 'layer-1',
              toLayerId: 'layer-1',
              tracks: [
                { property: 'trimStart' as const, keyframes: [0, 1] },
                { property: 'trimEnd' as const, keyframes: [0, 1] },
              ],
              compoundTrimMode: 'simultaneously' as const,
            },
          ],
        },
      },
    } as Partial<Icon>);

    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;
    const trimShape = layer.shapes.find((s) => s.ty === 'tm');
    expect(trimShape).toBeDefined();
    if (trimShape && 'm' in trimShape) {
      expect(trimShape.m).toBe(1); // simultaneously
    }
  });
});

// ---------------------------------------------------------------------------
// M6 — Effect animations
// ---------------------------------------------------------------------------

describe('Effect animations (M6)', () => {
  test('bounce effect produces scale animation', () => {
    const icon = createMinimalIcon({
      effects: {
        'e1': {
          id: 'e1',
          kind: 'bounce' as const,
          durationMs: 300,
        },
      },
    } as Partial<Icon>);

    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;
    expect(layer.ks.s.a).toBe(1); // scale is animated
  });

  test('lineDrawOn effect produces trim shape', () => {
    const icon = createMinimalIcon({
      effects: {
        'e1': {
          id: 'e1',
          kind: 'lineDrawOn' as const,
          durationMs: 500,
        },
      },
    } as Partial<Icon>);

    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;
    const trimShape = layer.shapes.find((s) => s.ty === 'tm');
    expect(trimShape).toBeDefined();
  });

  test('rotate effect produces rotation animation', () => {
    const icon = createMinimalIcon({
      effects: {
        'e1': {
          id: 'e1',
          kind: 'rotate' as const,
          durationMs: 1000,
        },
      },
    } as Partial<Icon>);

    const result = exportLottie(icon, '16');
    const layer = result.layers[0]!;
    expect(layer.ks.r.a).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

describe('easingToLottie', () => {
  test('maps named easings', () => {
    const result = easingToLottie('linear');
    expect(result.o).toEqual({ x: [0], y: [0] });
    expect(result.i).toEqual({ x: [1], y: [1] });
  });

  test('parses cubic-bezier strings', () => {
    const result = easingToLottie('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
    expect(result.o).toEqual({ x: [0.1], y: [0.2] });
    expect(result.i).toEqual({ x: [0.3], y: [0.4] });
  });

  test('spring config falls back to ease-in-out', () => {
    const result = easingToLottie({ type: 'spring', stiffness: 100, damping: 10 });
    expect(result.o).toBeDefined();
    expect(result.i).toBeDefined();
  });

  test('unknown easing falls back to ease-in-out', () => {
    const result = easingToLottie('unknown-easing');
    expect(result.o).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// M10 — Downgrade diagnostics
// ---------------------------------------------------------------------------

describe('collectLottieDowngrades (M10)', () => {
  test('returns empty for compatible icon', () => {
    const icon = createMinimalIcon();
    const diagnostics = collectLottieDowngrades(icon, '16');
    expect(diagnostics).toEqual([]);
  });

  test('flags variableValue', () => {
    const icon = createMinimalIcon();
    (icon.variants!['16'] as Record<string, unknown>).variableValue = 0.5;
    const diagnostics = collectLottieDowngrades(icon, '16');
    expect(diagnostics.some((d) => d.feature === 'variableValue')).toBe(true);
  });

  test('flags spring easing', () => {
    const icon = createMinimalIcon({
      transitions: {
        't1': {
          id: 't1',
          fromIconId: 'test-icon',
          toIconId: 'test-icon',
          fromVariantId: '16',
          toVariantId: '16',
          from: 'default',
          to: 'default',
          strategy: 'lineAnimation' as const,
          durationMs: 500,
          easing: { type: 'spring' as const, stiffness: 100, damping: 10 },
          layerBindings: [],
        },
      },
    } as Partial<Icon>);
    const diagnostics = collectLottieDowngrades(icon, '16');
    expect(diagnostics.some((d) => d.feature === 'spring-easing')).toBe(true);
  });

  test('flags radialGradient', () => {
    const icon = createMinimalIcon();
    const layer = icon.variants!['16']!.states!['default']!.layers!['layer-1']!;
    layer.style.fill = {
      mode: 'radialGradient' as const,
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#FFF' }],
    };
    const diagnostics = collectLottieDowngrades(icon, '16');
    expect(diagnostics.some((d) => d.feature === 'radialGradient')).toBe(true);
  });

  test('flags bestGuessMorph with mismatched commands', () => {
    const icon = createMinimalIcon({
      variants: {
        '16': {
          id: '16',
          size: 16,
          viewBox: [0, 0, 16, 16] as [number, number, number, number],
          layers: {
            'l1': {
              id: 'l1',
              path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
              style: { fill: { mode: 'fixed' as const, value: '#000' } },
            },
          },
          defaultState: 'default',
          states: {
            default: {
              id: 'default',
              layers: {
                'l1': {
                  id: 'l1',
                  path: { d: 'M 0 0 C 5 0 10 5 10 10 Z' },
                  style: { fill: { mode: 'fixed' as const, value: '#000' } },
                },
              },
            },
            active: {
              id: 'active',
              layers: {
                'l1': {
                  id: 'l1',
                  path: { d: 'M 0 0 C 5 0 10 5 10 10 C 12 12 14 14 16 16 Z' },
                  style: { fill: { mode: 'fixed' as const, value: '#000' } },
                },
              },
            },
          },
        },
      },
      transitions: {
        't1': {
          id: 't1',
          fromIconId: 'test-icon',
          toIconId: 'test-icon',
          fromVariantId: '16',
          toVariantId: '16',
          from: 'default',
          to: 'active',
          strategy: 'bestGuessMorph' as const,
          durationMs: 300,
          layerBindings: [
            {
              fromLayerId: 'l1',
              toLayerId: 'l1',
              morph: { topology: 'bestGuess' as const },
            },
          ],
        },
      },
    } as Partial<Icon>);

    const diagnostics = collectLottieDowngrades(icon, '16');
    expect(diagnostics.some((d) => d.feature === 'bestGuessMorph-mismatch')).toBe(true);
  });

  test('returns empty for nonexistent variant', () => {
    const icon = createMinimalIcon();
    expect(collectLottieDowngrades(icon, 'nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Determinism — M9 snapshot stability
// ---------------------------------------------------------------------------

describe('Export determinism (M9)', () => {
  test('static icon produces identical JSON across calls', () => {
    const icon = createMinimalIcon();
    const a = JSON.stringify(exportLottie(icon, '16'), null, 2);
    const b = JSON.stringify(exportLottie(icon, '16'), null, 2);
    expect(a).toBe(b);
  });

  test('animated icon produces identical JSON across calls', () => {
    const icon = createAnimatedIcon();
    const a = JSON.stringify(exportLottie(icon, '16'), null, 2);
    const b = JSON.stringify(exportLottie(icon, '16'), null, 2);
    expect(a).toBe(b);
  });
});

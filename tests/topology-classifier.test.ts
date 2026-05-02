import { describe, expect, test } from 'bun:test';

import { classifyLayerPair } from '../lib/runtime-core/topology-classifier';
import type { Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const STROKE: PaintRef = { mode: 'fixed', value: '#000' };

function layer(d: string, opts: Partial<Layer> & { style?: Layer['style'] } = {}): Layer {
  return {
    id: opts.id ?? 'layer',
    style: opts.style ?? { fill: FILL },
    path: opts.path ?? { d },
    ...opts,
  } as Layer;
}

const FILLED = { fill: FILL };
const STROKED = { stroke: STROKE, strokeWidth: 1 };

describe('topology-classifier', () => {
  test('T1: single closed ↔ single closed', () => {
    const a = layer('M0 0 L10 0 L10 10 L0 10 Z');
    const b = layer('M5 5 L15 5 L15 15 L5 15 Z');
    expect(classifyLayerPair(a, b)).toBe('T1');
  });

  test('T2: single open ↔ single open', () => {
    const a = layer('M0 0 L10 10', { style: STROKED });
    const b = layer('M0 10 L10 0', { style: STROKED });
    expect(classifyLayerPair(a, b)).toBe('T2');
  });

  test('T3: multi closed ↔ multi closed', () => {
    const a = layer(
      'M0 0 L5 0 L5 5 L0 5 Z M10 10 L15 10 L15 15 L10 15 Z',
    );
    const b = layer(
      'M0 0 L5 0 L5 5 L0 5 Z ' +
        'M10 10 L15 10 L15 15 L10 15 Z ' +
        'M20 20 L25 20 L25 25 L20 25 Z',
    );
    expect(classifyLayerPair(a, b)).toBe('T3');
  });

  test('T4: multi open ↔ multi open (hamburger ↔ equals)', () => {
    const hamburger = layer(
      'M0 0 L10 0 M0 5 L10 5 M0 10 L10 10',
      { style: STROKED },
    );
    const equals = layer('M0 3 L10 3 M0 7 L10 7', { style: STROKED });
    expect(classifyLayerPair(hamburger, equals)).toBe('T4');
  });

  test('T5: mixed (closed + open) on either side', () => {
    const mixed = layer(
      'M0 0 L10 0 L10 10 L0 10 Z M20 0 L30 10',
      { style: { fill: FILL, stroke: STROKE, strokeWidth: 1 } },
    );
    const closed = layer('M0 0 L5 0 L5 5 L0 5 Z');
    expect(classifyLayerPair(mixed, closed)).toBe('T5');
    expect(classifyLayerPair(closed, mixed)).toBe('T5');
  });

  test('T7: stroke-only ↔ fill-only', () => {
    const outline = layer('M0 0 L10 0 L10 10 L0 10 Z', { style: STROKED });
    const filled = layer('M0 0 L10 0 L10 10 L0 10 Z', { style: FILLED });
    expect(classifyLayerPair(outline, filled)).toBe('T7');
    expect(classifyLayerPair(filled, outline)).toBe('T7');
  });

  test('T8: single-closed ↔ single-open is hard-incompatible', () => {
    const closed = layer('M0 0 L10 0 L10 10 L0 10 Z');
    const open = layer('M0 0 L10 10', { style: STROKED });
    expect(classifyLayerPair(closed, open)).toBe('T8');
    expect(classifyLayerPair(open, closed)).toBe('T8');
  });

  test('T6: compound metadata wins over topology', () => {
    const compoundLayer = layer('M0 0 L10 0 L10 10 L0 10 Z') as Layer & {
      compound: { tree: unknown; operands: unknown; cacheVersion: number };
    };
    compoundLayer.compound = {
      tree: { kind: 'leaf', operandId: 'a' },
      operands: {},
      cacheVersion: 1,
    };
    const simple = layer('M5 5 L15 5 L15 15 L5 15 Z');
    expect(classifyLayerPair(compoundLayer, simple)).toBe('T6');
    expect(classifyLayerPair(simple, compoundLayer)).toBe('T6');
  });

  test('classification is deterministic across repeated calls', () => {
    const a = layer('M0 0 L10 0 L10 10 L0 10 Z');
    const b = layer('M5 5 L15 5 L15 15 L5 15 Z');
    const first = classifyLayerPair(a, b);
    const second = classifyLayerPair(a, b);
    const third = classifyLayerPair(a, b);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  test('mixed-style layer (both stroke + fill) is not T7', () => {
    // T7 requires *strict* asymmetry. A layer with both stroke and
    // fill falls through to topology-based classification.
    const mixedStyle = layer('M0 0 L10 0 L10 10 L0 10 Z', {
      style: { fill: FILL, stroke: STROKE, strokeWidth: 1 },
    });
    const filled = layer('M5 5 L15 5 L15 15 L5 15 Z', { style: FILLED });
    // Both pure-closed single-subpath → T1
    expect(classifyLayerPair(mixedStyle, filled)).toBe('T1');
  });
});

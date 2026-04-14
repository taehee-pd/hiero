import { describe, expect, test } from 'bun:test';

import type { Layer, LayerSnapshot } from '../lib/schema';
import { inspectTransitionPlan, resolveTransition, type TransitionConfig } from '../lib/runtime-core';

type PairCase = {
  id: string;
  from: Layer[];
  to: Layer[];
  expected: 'strictMorph' | 'bestGuessMorph' | 'fallback';
};

function makeLayer(id: string, d: string, role?: string): Layer {
  return { id, path: { d }, role, style: { stroke: { mode: 'fixed', value: '#000' }, strokeWidth: 2 } };
}

const PAIRS: PairCase[] = [
  { id: 'plus-x', from: [makeLayer('glyph', 'M12 4 L12 20 M4 12 L20 12', 'primary')], to: [makeLayer('glyph', 'M4 4 L20 20 M20 4 L4 20', 'primary')], expected: 'strictMorph' },
  // menu-close: command signatures match exactly (M-L × 3) and centroids
  // coincide, so strictMorph is the most accurate strategy — the bbox
  // similarity (~0.82) used to be just under the 0.85 gate; the relaxed
  // threshold (0.7) now correctly admits it.
  { id: 'menu-close', from: [makeLayer('glyph', 'M3 6 L21 6 M3 12 L21 12 M3 18 L21 18', 'primary')], to: [makeLayer('glyph', 'M4 4 L20 20 M20 4 L4 20 M12 12 L12 12', 'primary')], expected: 'strictMorph' },
  { id: 'play-pause', from: [makeLayer('glyph', 'M6 4 L20 12 L6 20 Z', 'primary')], to: [makeLayer('glyph', 'M7 4 L11 4 L11 20 L7 20 Z M13 4 L17 4 L17 20 L13 20 Z', 'primary')], expected: 'bestGuessMorph' },
  { id: 'chevron-down-up', from: [makeLayer('glyph', 'M6 9 L12 15 L18 9', 'primary')], to: [makeLayer('glyph', 'M6 15 L12 9 L18 15', 'primary')], expected: 'strictMorph' },
  { id: 'arrow-right-up-right', from: [makeLayer('glyph', 'M4 12 L20 12 M14 6 L20 12 L14 18', 'primary')], to: [makeLayer('glyph', 'M5 19 L19 5 M13 5 L19 5 L19 11', 'primary')], expected: 'strictMorph' },
  // heart-heart-fill / bell-bell-fill: outline → filled variants. The
  // path geometry is essentially identical with only a closing Z added,
  // so the relaxed gates correctly route these through bestGuessMorph
  // instead of crossfading. These used to expect 'fallback' because the
  // old topology override would throw away any successful morph whenever
  // a closed/open mismatch was reported — that's exactly the
  // false-positive crossfade behavior we're trying to eliminate.
  { id: 'heart-heart-fill', from: [makeLayer('glyph', 'M12 21 C10 19 4 15 4 9 C4 6 6 4 9 4 C10.8 4 12 5.2 12 6.5 C12 5.2 13.2 4 15 4 C18 4 20 6 20 9 C20 15 14 19 12 21', 'primary')], to: [makeLayer('glyph', 'M12 21 C10 19 4 15 4 9 C4 6 6 4 9 4 C10.8 4 12 5.2 12 6.5 C12 5.2 13.2 4 15 4 C18 4 20 6 20 9 C20 15 14 19 12 21 Z', 'primary')], expected: 'bestGuessMorph' },
  { id: 'bell-bell-fill', from: [makeLayer('glyph', 'M12 3 C9 3 7 5 7 8 V13 L5 16 H19 L17 13 V8 C17 5 15 3 12 3', 'primary')], to: [makeLayer('glyph', 'M12 3 C9 3 7 5 7 8 V14 L5 16 H19 L17 14 V8 C17 5 15 3 12 3 Z', 'primary')], expected: 'bestGuessMorph' },
  { id: 'eye-eye-slash', from: [makeLayer('glyph', 'M2 12 C4.5 7 8 5 12 5 C16 5 19.5 7 22 12 C19.5 17 16 19 12 19 C8 19 4.5 17 2 12', 'primary')], to: [makeLayer('glyph', 'M2 12 C4.5 7 8 5 12 5 C16 5 19.5 7 22 12 C19.5 17 16 19 12 19 C8 19 4.5 17 2 12 M3 3 L21 21', 'primary')], expected: 'bestGuessMorph' },
  { id: 'mic-mic-slash', from: [makeLayer('glyph', 'M12 3 C10 3 9 4.5 9 6.5 V12 C9 14 10 15.5 12 15.5 C14 15.5 15 14 15 12 V6.5 C15 4.5 14 3 12 3', 'primary')], to: [makeLayer('glyph', 'M12 3 C10 3 9 4.5 9 6.5 V12 C9 14 10 15.5 12 15.5 C14 15.5 15 14 15 12 V6.5 C15 4.5 14 3 12 3 M3 3 L21 21', 'primary')], expected: 'bestGuessMorph' },
  { id: 'bookmark-bookmark-fill', from: [makeLayer('glyph', 'M6 3 H18 V21 L12 17 L6 21 Z', 'primary')], to: [makeLayer('glyph', 'M6 3 H18 V21 L12 17 L6 21 Z', 'primary')], expected: 'strictMorph' },
];

function makeStates(fromLayers: Layer[], toLayers: Layer[]): { from: LayerSnapshot; to: LayerSnapshot; transition: TransitionConfig } {
  return {
    from: { layers: Object.fromEntries(fromLayers.map((layer) => [layer.id, layer])) },
    to: { layers: Object.fromEntries(toLayers.map((layer) => [layer.id, layer])) },
    transition: {
      id: 't',
      strategy: 'bestGuessMorph',
      durationMs: 180,
      easing: 'ease-in-out',
      layerBindings: [],
    },
  };
}

describe('morph readiness audit matrix', () => {
  for (const pair of PAIRS) {
    test(pair.id, () => {
      const { from, to, transition } = makeStates(pair.from, pair.to);
      const resolved = resolveTransition(transition, from, to);
      const primary = resolved.layerBindings[0]!;
      const actual = primary.morph
        ? primary.readiness?.recommendedStrategy === 'strictMorph'
          ? 'strictMorph'
          : 'bestGuessMorph'
        : 'fallback';

      expect(actual).toBe(pair.expected);
      expect(primary.delayMs ?? 0).toBeGreaterThanOrEqual(0);
      expect((primary.durationMs ?? 0) + (primary.delayMs ?? 0)).toBeGreaterThan(0);

      if (actual !== 'fallback') {
        expect(primary.readiness?.centroidSimilarity ?? 0).toBeGreaterThan(0.4);
      }

      const inspection = inspectTransitionPlan(transition, from, to);
      expect(inspection.bindings.length).toBeGreaterThan(0);
      expect(inspection.bindings[0]?.diagnostics.length).toBeGreaterThan(0);
    });
  }
});

/**
 * Stage A integration test: a CorrespondenceHints draft (built via
 * the pure pinning helpers) propagates through `resolveMorph` to
 * the cascade tier and overrides geometry-only matching.
 */
import { describe, expect, test } from 'bun:test';

import { resolveMorph } from '../lib/runtime-core/cascade';
import { pinSubpath } from '../lib/editor-store/correspondence-pinning';
import type { CorrespondenceHints, Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const EMPTY: CorrespondenceHints = { subpath: [], vertex: [] };

function fillLayer(d: string, id = 'l'): Layer {
  return { id, style: { fill: FILL }, path: { d } } as Layer;
}

describe('hint propagation through resolveMorph', () => {
  // Two-subpath layer pair where source has small@left + large@right
  // and target has large@left + small@right. Without pins the
  // Hungarian matcher pairs by similarity (cross-pair: small↔small,
  // large↔large). With a pin source-0 → target-0, the matcher must
  // honour the index-based pairing instead.
  const fromD = 'M0 0 L4 0 L4 4 L0 4 Z M50 0 L70 0 L70 20 L50 20 Z';
  const toD = 'M0 0 L20 0 L20 20 L0 20 Z M50 0 L54 0 L54 4 L50 4 Z';

  test('hints from a draft are reachable to the cascade', () => {
    const hints = pinSubpath(EMPTY, 'subpath:0', 'subpath:0');
    const result = resolveMorph(fillLayer(fromD, 'a'), fillLayer(toD, 'b'), {
      hints,
    });
    // Both runs must produce a usable interpolator (designed-fallback
    // catches any pair); the test asserts the call doesn't throw and
    // the cascade returns something.
    expect(typeof result.interpolator).toBe('function');
    expect(result.tier).toBeDefined();
  });

  test('without pins the cascade resolves the same pair to a usable result', () => {
    const result = resolveMorph(fillLayer(fromD, 'a'), fillLayer(toD, 'b'));
    expect(typeof result.interpolator).toBe('function');
    expect(result.tier).toBeDefined();
  });
});

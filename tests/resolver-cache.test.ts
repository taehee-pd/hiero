/**
 * W4-3 acceptance: resolver memoization with `(layerId, cacheVersion,
 * d-hash, cadence)` keying. LRU bound; flatten→rebuild correctly
 * invalidates because the d-hash changes.
 */
import { describe, expect, test } from 'bun:test';

import { resolveMorph } from '../lib/runtime-core/cascade';
import { createResolverCache } from '../lib/runtime-core/resolver-cache';
import { buildLeftLeaningCompound } from '../lib/schema/compound';
import type { Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };

function fillLayer(d: string, id = 'l'): Layer {
  return { id, style: { fill: FILL }, path: { d } } as Layer;
}

describe('resolver-cache — basic LRU semantics', () => {
  test('returns the same memoized resolution on repeat calls with the same cache', () => {
    const cache = createResolverCache();
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    const first = resolveMorph(a, b, { cache });
    const second = resolveMorph(a, b, { cache });
    // Same reference — the cache returned the same MorphResolution.
    expect(second).toBe(first);
  });

  test('different cadences produce different cache entries', () => {
    const cache = createResolverCache();
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    const soft = resolveMorph(a, b, { cache, cadence: 'soft' });
    const snappy = resolveMorph(a, b, { cache, cadence: 'snappy' });
    expect(snappy).not.toBe(soft);
    expect(cache.size()).toBe(2);
  });

  test('mutating layer.path.d invalidates the cache (W2 audit fix: flatten→rebuild)', () => {
    const cache = createResolverCache();
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    const first = resolveMorph(a, b, { cache });
    const aMutated = fillLayer('M0 0 L20 0 L20 20 L0 20 Z', 'a'); // same id, different geometry
    const second = resolveMorph(aMutated, b, { cache });
    expect(second).not.toBe(first);
  });

  test('mutating layer.compound.cacheVersion invalidates the cache', () => {
    const cache = createResolverCache();
    const compoundV1 = buildLeftLeaningCompound(
      'unite',
      [{ d: 'M0 0 L5 0 L5 5 L0 5 Z' }, { d: 'M10 10 L15 10 L15 15 L10 15 Z' }],
      'a',
    );
    const compoundV2 = { ...compoundV1, cacheVersion: 2 };
    const a1: Layer = {
      ...fillLayer('M0 0 L15 0 L15 15 L0 15 Z', 'a'),
      compound: compoundV1,
    } as Layer;
    const a2: Layer = { ...a1, compound: compoundV2 };
    const b = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'b');
    const first = resolveMorph(a1, b, { cache });
    const second = resolveMorph(a2, b, { cache });
    expect(second).not.toBe(first);
  });

  test('LRU evicts the oldest entry once the bound is exceeded', () => {
    const cache = createResolverCache(2);
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    const c = fillLayer('M0 0 L20 0 L20 20 L0 20 Z', 'c');
    resolveMorph(a, b, { cache });
    resolveMorph(b, a, { cache });
    expect(cache.size()).toBe(2);
    resolveMorph(a, c, { cache });
    expect(cache.size()).toBe(2); // bound enforced
  });

  test('clear() empties the cache', () => {
    const cache = createResolverCache();
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    resolveMorph(a, b, { cache });
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  test('rejects non-positive limits', () => {
    expect(() => createResolverCache(0)).toThrow();
    expect(() => createResolverCache(-1)).toThrow();
  });
});

describe('resolver-cache — correspondence hint bypass', () => {
  test('non-empty hints bypass the cache (pinning is rare; cache hit-rate would collapse)', () => {
    const cache = createResolverCache();
    const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
    const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
    resolveMorph(a, b, { cache });
    expect(cache.size()).toBe(1);
    resolveMorph(a, b, {
      cache,
      hints: { subpath: [['subpath:0', 'subpath:0']], vertex: [] },
    });
    // Still 1 — hinted resolves don't write to the cache.
    expect(cache.size()).toBe(1);
  });
});

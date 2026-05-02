/**
 * Resolver memoization (W4-3) — LRU cache over the canonicalised
 * cascade output.
 *
 * Cache key is `(fromKey, toKey)` where each side's key derives
 * from `(layer.id, layer.compound?.cacheVersion ?? 0, layer.path?.d
 * ? hash(d) : 0)`. Including a hash of `path.d` in the key dodges
 * the W2 audit's flatten-then-rebuild edge case: when a compound
 * is flattened (`cacheVersion` resets to 1 on the next applyBoolean),
 * the `d` hash differs and the memo entry is correctly invalidated.
 *
 * Bounded LRU; default 1024 entries; eviction on insertion when
 * size exceeds the limit. Pure — no globals visible to consumers.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §10
 *  + ICON_TRANSITION_ROADMAP.md W4-3.
 *
 * @module
 */
import type { Layer } from '../schema';
import type { Cadence } from './motion-curves';
import type { MorphResolution } from './morph-resolution';

const DEFAULT_LIMIT = 1024;

export type ResolverCache = {
  get(from: Layer, to: Layer, cadence: Cadence): MorphResolution | undefined;
  set(from: Layer, to: Layer, cadence: Cadence, value: MorphResolution): void;
  /** Evict everything. Used by tests + when the project loads anew. */
  clear(): void;
  /** Number of entries currently held. */
  size(): number;
};

export function createResolverCache(limit: number = DEFAULT_LIMIT): ResolverCache {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`createResolverCache: limit must be > 0 (got ${limit})`);
  }
  // Map preserves insertion order; reading + reinserting moves the
  // entry to "most recently used".
  const cache = new Map<string, MorphResolution>();

  return {
    get(from, to, cadence) {
      const key = makeKey(from, to, cadence);
      const entry = cache.get(key);
      if (entry === undefined) return undefined;
      // Touch — move to MRU end.
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    },
    set(from, to, cadence, value) {
      const key = makeKey(from, to, cadence);
      if (cache.has(key)) cache.delete(key);
      cache.set(key, value);
      // Evict from the LRU end until under the bound.
      while (cache.size > limit) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
      }
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}

function makeKey(from: Layer, to: Layer, cadence: Cadence): string {
  return `${layerKey(from)}::${layerKey(to)}::${cadence}`;
}

function layerKey(layer: Layer): string {
  const id = layer.id;
  const cacheVersion = layer.compound?.cacheVersion ?? 0;
  const dHash = layer.path?.d ? hashString(layer.path.d) : 0;
  return `${id}#${cacheVersion}#${dHash}`;
}

/**
 * 32-bit FNV-1a hash. Fast enough to call per-layer per-resolve;
 * collision probability is acceptable for cache-key disambiguation
 * (a collision means at most one cache miss when the layer's
 * geometry changes but its hash doesn't, which the cascade
 * recomputes correctly anyway).
 */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

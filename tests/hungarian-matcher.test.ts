import { describe, expect, test } from 'bun:test';

import {
  hungarianMatch,
  reorderCanonicalSubpaths,
  splitSubpaths,
} from '../lib/runtime-core/cascade-tiers/hungarian-matcher';
import { canonicalizePath } from '../lib/runtime-core/path-normalization';
import type { CorrespondenceHints } from '../lib/schema/types';

const EMPTY_HINTS: CorrespondenceHints = { subpath: [], vertex: [] };

describe('hungarianMatch', () => {
  test('pairs identical multi-subpath inputs along the diagonal', () => {
    const from = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z M50 0 L60 0 L60 10 L50 10 Z');
    const to = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z M50 0 L60 0 L60 10 L50 10 Z');
    const result = hungarianMatch(from, to, EMPTY_HINTS);
    expect(result.matches.length).toBe(2);
    for (const m of result.matches) {
      expect(m.fromIndex).toBe(m.toIndex);
    }
    expect(result.fromOrphans).toEqual([]);
    expect(result.toOrphans).toEqual([]);
  });

  test('crosses pairs when target swaps subpath order — the case greedy gets wrong', () => {
    // Source has a small square at left + large square at right.
    const from = canonicalizePath('M0 0 L4 0 L4 4 L0 4 Z M50 0 L70 0 L70 20 L50 20 Z');
    // Target has the large square at left + small square at right.
    // Greedy would pair index-0 with index-0 (small ↔ large, costly).
    // Hungarian pairs by similarity — small ↔ small and large ↔ large.
    const to = canonicalizePath('M0 0 L20 0 L20 20 L0 20 Z M50 0 L54 0 L54 4 L50 4 Z');
    const result = hungarianMatch(from, to, EMPTY_HINTS);
    expect(result.matches.length).toBe(2);
    const fromIndices = result.matches.map((m) => m.fromIndex).sort();
    const toIndices = result.matches.map((m) => m.toIndex).sort();
    expect(fromIndices).toEqual([0, 1]);
    expect(toIndices).toEqual([0, 1]);
    // The crossed pairing: source-index-0 (small @ left) → target-index-1 (small @ right);
    // source-index-1 (large @ right) → target-index-0 (large @ left).
    const fromZero = result.matches.find((m) => m.fromIndex === 0)!;
    const fromOne = result.matches.find((m) => m.fromIndex === 1)!;
    expect(fromZero.toIndex).toBe(1);
    expect(fromOne.toIndex).toBe(0);
  });

  test('rectangular cases produce orphans', () => {
    const from = canonicalizePath(
      'M0 0 L10 0 L10 10 L0 10 Z M30 0 L40 0 L40 10 L30 10 Z M60 0 L70 0 L70 10 L60 10 Z',
    );
    const to = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z M30 0 L40 0 L40 10 L30 10 Z');
    const result = hungarianMatch(from, to, EMPTY_HINTS);
    expect(result.matches.length).toBe(2);
    expect(result.fromOrphans.length).toBe(1);
    expect(result.toOrphans.length).toBe(0);
  });

  test('subpath pin hints are honoured as hard constraints', () => {
    // Same swapped-order pair as above; the pin forces the geometric-
    // similarity choice to be overridden by author intent.
    const from = canonicalizePath('M0 0 L4 0 L4 4 L0 4 Z M50 0 L70 0 L70 20 L50 20 Z');
    const to = canonicalizePath('M0 0 L20 0 L20 20 L0 20 Z M50 0 L54 0 L54 4 L50 4 Z');
    // Pin source-subpath-0 to target-subpath-0 (small ↔ large by index).
    // Hint addressing is `subpath:N`, the canonical form
    // `parseSubpathId` accepts.
    const hints: CorrespondenceHints = {
      subpath: [['subpath:0', 'subpath:0']],
      vertex: [],
    };
    const result = hungarianMatch(from, to, hints);
    expect(result.matches.length).toBe(2);
    const fromZero = result.matches.find((m) => m.fromIndex === 0)!;
    const fromOne = result.matches.find((m) => m.fromIndex === 1)!;
    // Pin overrides geometry: source-0 → target-0 (forced).
    expect(fromZero.toIndex).toBe(0);
    expect(fromOne.toIndex).toBe(1);
  });

  test('empty inputs return empty matches with everything as orphans', () => {
    const from = canonicalizePath('');
    const to = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z');
    const result = hungarianMatch(from, to, EMPTY_HINTS);
    expect(result.matches).toEqual([]);
    expect(result.fromOrphans).toEqual([]);
    expect(result.toOrphans).toEqual([0]);
  });
});

describe('splitSubpaths / reorderCanonicalSubpaths', () => {
  test('round-trips a canonical multi-subpath string', () => {
    const d = 'M0 0 L10 0 Z M30 0 L40 0 Z M60 0 L70 0 Z';
    const parts = splitSubpaths(d);
    expect(parts.length).toBe(3);
  });

  test('priority indices land first; the rest preserve canonical order', () => {
    const d = 'M0 0 L10 0 Z M30 0 L40 0 Z M60 0 L70 0 Z';
    const reordered = reorderCanonicalSubpaths(d, [2, 0]);
    const parts = splitSubpaths(reordered);
    expect(parts[0]).toBe('M60 0 L70 0 Z');
    expect(parts[1]).toBe('M0 0 L10 0 Z');
    expect(parts[2]).toBe('M30 0 L40 0 Z');
  });
});

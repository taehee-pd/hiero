import { describe, expect, test } from 'bun:test';

// Mock next/navigation so the TransitionPanel module (and its transitive
// imports) don't trip over `useRouter()` in a router-less Bun test runtime.
import { mock } from 'bun:test';
mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import {
  STAGGER_MODE_DEFAULT_MS,
  resolveEffectiveStagger,
} from '../components/editor/TransitionPanel';

/**
 * PR #128 review P2 regression: when the Advanced stagger override is set
 * to `from-center`, `from-edges`, or `random` while the playback-mode pill
 * is `Whole Symbol` or `Individually` (both default to `perLayerMs: 0`),
 * `resolveEffectiveStagger` must return a non-zero `perLayerMs` so the
 * override actually produces a visible stagger.
 */

describe('resolveEffectiveStagger — P2 override perLayerMs', () => {
  test('returns the playback-mode default when no override is active', () => {
    expect(
      resolveEffectiveStagger({
        playbackMode: 'byLayer',
        advancedOpen: false,
        advancedStaggerOverride: 'inherit',
      }),
    ).toEqual({ mode: 'linear', perLayerMs: 40 });

    expect(
      resolveEffectiveStagger({
        playbackMode: 'wholeSymbol',
        advancedOpen: false,
        advancedStaggerOverride: 'inherit',
      }),
    ).toEqual({ mode: 'simultaneous', perLayerMs: 0 });

    expect(
      resolveEffectiveStagger({
        playbackMode: 'individually',
        advancedOpen: false,
        advancedStaggerOverride: 'inherit',
      }),
    ).toEqual({ mode: 'individually', perLayerMs: 0 });
  });

  test('ignores the override when the Advanced disclosure is closed', () => {
    // Even if the user picked from-center, a closed Advanced disclosure
    // means we honor the playback-mode pill — consistent with the existing
    // `beginPreview` gate.
    const result = resolveEffectiveStagger({
      playbackMode: 'wholeSymbol',
      advancedOpen: false,
      advancedStaggerOverride: 'from-center',
    });
    expect(result).toEqual({ mode: 'simultaneous', perLayerMs: 0 });
  });

  test('from-center override produces a non-zero perLayerMs from Whole Symbol', () => {
    const result = resolveEffectiveStagger({
      playbackMode: 'wholeSymbol',
      advancedOpen: true,
      advancedStaggerOverride: 'from-center',
    });
    expect(result.mode).toBe('from-center');
    expect(result.perLayerMs).toBeGreaterThan(0);
  });

  test('from-edges override produces a non-zero perLayerMs from Individually', () => {
    const result = resolveEffectiveStagger({
      playbackMode: 'individually',
      advancedOpen: true,
      advancedStaggerOverride: 'from-edges',
    });
    expect(result.mode).toBe('from-edges');
    expect(result.perLayerMs).toBeGreaterThan(0);
  });

  test('random override produces a non-zero perLayerMs from Whole Symbol', () => {
    const result = resolveEffectiveStagger({
      playbackMode: 'wholeSymbol',
      advancedOpen: true,
      advancedStaggerOverride: 'random',
    });
    expect(result.mode).toBe('random');
    expect(result.perLayerMs).toBeGreaterThan(0);
  });

  test('override to `linear` inherits the playback-mode default', () => {
    // linear's default is 40ms regardless of which pill was active, so
    // forcing it via Advanced should still produce a sensible stagger.
    const result = resolveEffectiveStagger({
      playbackMode: 'wholeSymbol',
      advancedOpen: true,
      advancedStaggerOverride: 'linear',
    });
    expect(result.mode).toBe('linear');
    expect(result.perLayerMs).toBe(40);
  });

  test('override to `simultaneous` stays at 0 (expected)', () => {
    // The one case where an override's natural default is 0. The override
    // IS honored — simultaneous genuinely means "every layer at t=0" — so
    // this is the correct behavior, not a regression.
    const result = resolveEffectiveStagger({
      playbackMode: 'byLayer',
      advancedOpen: true,
      advancedStaggerOverride: 'simultaneous',
    });
    expect(result).toEqual({ mode: 'simultaneous', perLayerMs: 0 });
  });
});

describe('STAGGER_MODE_DEFAULT_MS — every advanced mode is non-zero', () => {
  test('from-center / from-edges / random all default to > 0', () => {
    expect(STAGGER_MODE_DEFAULT_MS['from-center']).toBeGreaterThan(0);
    expect(STAGGER_MODE_DEFAULT_MS['from-edges']).toBeGreaterThan(0);
    expect(STAGGER_MODE_DEFAULT_MS['random']).toBeGreaterThan(0);
  });

  test('linear default matches the By Layer playback default', () => {
    // If these diverge, the "inherit from playback mode" code path
    // becomes inconsistent with a `linear` override.
    expect(STAGGER_MODE_DEFAULT_MS['linear']).toBe(40);
  });
});

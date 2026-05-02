/**
 * Resolver cascade (V2) — W3-1.
 *
 * The new icon-to-icon transition resolver. Lands behind the
 * `NEXT_PUBLIC_HIERO_RESOLVER_V2=1` feature flag; the legacy
 * `autoMorph` keeps running on the flag-off path until W4 deletes
 * it.
 *
 * Each tier returns a {@link TierResult} (interpolator + distortion
 * estimate) or `null`. The cascade walks tiers in order; the first
 * non-null result whose distortion is at or below the tier's ceiling
 * is accepted. Identity has ceiling 0; T8 always accepts (ceiling
 * `+Infinity`). This guarantees every resolve produces a usable
 * {@link MorphResolution} — no path falls through to a "no
 * interpolator available" state.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §6,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §6.
 *
 * @module
 */
import {
  classifyTopologyPair,
  describeLayer,
  type LayerTopology,
  type TaxonomyId,
} from './topology-classifier';
import {
  defaultMotionCurves,
  type Cadence,
  type MotionCurves,
} from './motion-curves';
import type {
  MorphResolution,
  ResolutionSignal,
  ResolverTier,
} from './morph-resolution';
import type { Layer } from '../schema';

import { resolveIdentity } from './cascade-tiers/identity';
import { resolveCompoundIsomorphic } from './cascade-tiers/compound-isomorphic';
import { resolveIntrinsicStrict } from './cascade-tiers/intrinsic-strict';
import { resolveHierarchicalMatch } from './cascade-tiers/hierarchical-match';
import { resolveDrawCoordinated } from './cascade-tiers/draw-coordinated';
import { resolveDesignedFallback } from './cascade-tiers/designed-fallback';
import type { ResolverCache } from './resolver-cache';
import type { CorrespondenceHints } from '../schema/types';

/**
 * The input every tier sees. Pre-computed once so each tier's
 * implementation reads canonicalised paths and contour trees from
 * cache rather than recomputing.
 */
export type CascadeInput = {
  from: Layer;
  to: Layer;
  fromTopology: LayerTopology;
  toTopology: LayerTopology;
  taxonomy: TaxonomyId;
  cadence: Cadence;
  motion: MotionCurves;
  /**
   * Author-supplied correspondence hints (W4-4). Subpath hints
   * become hard constraints on the hierarchical-match cost matrix;
   * vertex hints anchor per-pair correspondence inside intrinsic-
   * strict. Empty by default; tiers ignore unless they consume.
   */
  hints: CorrespondenceHints;
};

/**
 * Per-tier output. `signal` is set when the tier landed here as a
 * fallback from a higher tier and the UI should explain why.
 */
export type TierResult = {
  interpolator: MorphResolution['interpolator'];
  motion: MotionCurves;
  distortion: number;
  signal: ResolutionSignal | null;
};

type Tier = {
  name: ResolverTier;
  /**
   * Distortion ceiling. The tier returns null OR returns a result
   * whose distortion exceeds this; either way the cascade falls
   * through. Identity is `0`; designed-fallback is `+Infinity`.
   */
  ceiling: number;
  resolve(input: CascadeInput): TierResult | null;
};

/**
 * Tier order. Conservative-first then permissive: identity →
 * compound-isomorphic → intrinsic-strict → hierarchical-match →
 * arap-quality-wrap (W4) → draw-coordinated (T7) →
 * designed-fallback (T8). ARAP is omitted in W3; the
 * hierarchical-match tier is the W3 quality ceiling for non-strict
 * morphs.
 */
const TIERS: Tier[] = [
  { name: 'identity', ceiling: 0, resolve: resolveIdentity },
  { name: 'compound-isomorphic', ceiling: 0, resolve: resolveCompoundIsomorphic },
  { name: 'intrinsic-strict', ceiling: 0.20, resolve: resolveIntrinsicStrict },
  { name: 'hierarchical-match', ceiling: 0.50, resolve: resolveHierarchicalMatch },
  { name: 'draw-coordinated', ceiling: 0.60, resolve: resolveDrawCoordinated },
  { name: 'designed-fallback', ceiling: Number.POSITIVE_INFINITY, resolve: resolveDesignedFallback },
];

export function resolverTiers(): readonly ResolverTier[] {
  return TIERS.map((t) => t.name);
}

/**
 * Resolve a layer pair through the V2 cascade. Always returns a
 * {@link MorphResolution} — the designed-fallback tier accepts any
 * input.
 *
 * @param from   source layer
 * @param to     target layer
 * @param opts   optional cadence override (defaults to `'soft'`)
 */
export type ResolveMorphOptions = {
  cadence?: Cadence;
  /**
   * W4-4 — author-supplied correspondence hints from the
   * `Transition` schema. When omitted, the cascade runs with no
   * pinned correspondences (default).
   */
  hints?: CorrespondenceHints;
  /**
   * W4-3 — optional resolver cache. Pass the same instance across
   * multiple `resolveMorph` calls (e.g., over the playback of a
   * preview) to memoize the cascade's work. Pure: no globals.
   */
  cache?: ResolverCache;
};

const EMPTY_HINTS: CorrespondenceHints = { subpath: [], vertex: [] };

export function resolveMorph(
  from: Layer,
  to: Layer,
  opts: ResolveMorphOptions = {},
): MorphResolution {
  const cadence = opts.cadence ?? 'soft';

  // Cache fast path. Hints are deliberately not part of the cache
  // key — pinning is rare and the cache hit-rate would collapse if
  // every hint mutation invalidated. Authors with non-empty hints
  // bypass the cache.
  if (opts.cache && (!opts.hints || isEmptyHints(opts.hints))) {
    const hit = opts.cache.get(from, to, cadence);
    if (hit) return hit;
  }

  const fromTopology = describeLayer(from);
  const toTopology = describeLayer(to);
  const taxonomy = classifyTopologyPair(fromTopology, toTopology);
  const motion = defaultMotionCurves(cadence);
  const hints = opts.hints ?? EMPTY_HINTS;

  const input: CascadeInput = {
    from,
    to,
    fromTopology,
    toTopology,
    taxonomy,
    cadence,
    motion,
    hints,
  };

  for (const tier of TIERS) {
    const result = tier.resolve(input);
    if (result === null) continue;
    if (!Number.isFinite(result.distortion) && tier.name !== 'designed-fallback') {
      // Defensive: only the terminal tier may emit non-finite
      // distortion. Intermediate tiers must report a real number.
      continue;
    }
    if (result.distortion > tier.ceiling) continue;
    const resolution: MorphResolution = {
      interpolator: result.interpolator,
      motion: result.motion,
      taxonomy,
      tier: tier.name,
      distortion: result.distortion,
      signal: result.signal,
    };
    if (opts.cache && isEmptyHints(hints)) {
      opts.cache.set(from, to, cadence, resolution);
    }
    return resolution;
  }

  // Unreachable — designed-fallback's ceiling is +Infinity and it
  // always returns a non-null result. This guard exists to satisfy
  // the type checker and to make a future regression loud.
  throw new Error(
    'resolveMorph: cascade fell off the end. The designed-fallback ' +
      'tier should always accept. Bug.',
  );
}

/**
 * Per-tier ceiling exposed for the metric harness so it can flag
 * tier landings whose distortion sits at the boundary.
 */
export function tierCeiling(name: ResolverTier): number {
  const tier = TIERS.find((t) => t.name === name);
  return tier?.ceiling ?? Number.POSITIVE_INFINITY;
}

function isEmptyHints(hints: CorrespondenceHints): boolean {
  return hints.subpath.length === 0 && hints.vertex.length === 0;
}

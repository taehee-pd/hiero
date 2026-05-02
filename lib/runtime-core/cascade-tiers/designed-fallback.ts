/**
 * Designed fallback tier (T8) — the cascade's terminal.
 *
 * Always accepts. Picks one of the named fallbacks from the §5.8
 * library by topological signal: stroke-heavy → `draw-replace`,
 * single-stroke ↔ closed-fill (the spinner ↔ checkmark case) →
 * `draw-replace`, navigational asymmetry → directional-replace,
 * everything else → radial-pop. The author can override the pick
 * via `Transition.fallbackOverride` (UI Layer 1).
 *
 * Each named fallback ships with its own `(g, α)` curve pair — the
 * scheduler reads these via `MorphResolution.motion`, not the
 * cadence-derived defaults.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.8.
 */
import type { FallbackName } from '../../schema/types';
import type { CascadeInput, TierResult } from '../cascade';
import type { MotionCurves } from '../motion-curves';
import { defaultMotionCurves } from '../motion-curves';
import {
  drawReplaceInterpolator,
  radialPopInterpolator,
  directionalReplaceInterpolator,
  scalePopInterpolator,
  fallbackMotion,
} from '../cascade-fallbacks';

export function resolveDesignedFallback(input: CascadeInput): TierResult {
  const fallbackName = pickFallback(input);
  const motion = fallbackMotion(fallbackName) ?? input.motion;
  const interpolator = buildInterpolator(fallbackName, input);

  return {
    interpolator,
    motion,
    distortion: 0, // T8 always accepts
    signal: {
      kind: 'distortion-floor-exceeded',
      tier: 'designed-fallback',
      // T8 fired because the upper tiers all rejected; we don't
      // know the precise upstream ceiling here, so we emit the
      // reasonable surrogate that the cascade reached the
      // terminal. UX layer translates to plain language.
      estimate: Number.POSITIVE_INFINITY,
      ceiling: 0,
      fallbackName,
    },
  };
}

/**
 * Pick a fallback by topological signal. Mirrors §5.8 routing.
 */
export function pickFallback(input: CascadeInput): FallbackName {
  const fromIsStroke =
    input.fromTopology.isStrokeOnly || input.fromTopology.openSubpathCount > 0;
  const toIsStroke =
    input.toTopology.isStrokeOnly || input.toTopology.openSubpathCount > 0;

  // Stroke-heavy on either side → draw-replace (the spinner ↔
  // checkmark canonical case).
  if (fromIsStroke || toIsStroke) return 'draw-replace';

  // Symmetric pure-closed shapes of similar visual weight →
  // radial-pop. We do not (yet) attempt to detect "navigational"
  // pairs structurally; that lands when the resolver gets access
  // to icon-set semantics in a later wave. For now, default to
  // radial-pop and let authors override.
  return 'radial-pop';
}

function buildInterpolator(
  fallbackName: FallbackName,
  input: CascadeInput,
): TierResult['interpolator'] {
  switch (fallbackName) {
    case 'draw-replace':
      return drawReplaceInterpolator(input);
    case 'radial-pop':
      return radialPopInterpolator(input);
    case 'scale-pop':
      return scalePopInterpolator(input);
    case 'directional-replace-up':
    case 'directional-replace-down':
    case 'directional-replace-left':
    case 'directional-replace-right':
    case 'directional-replace-toward':
    case 'directional-replace-away':
      return directionalReplaceInterpolator(input, fallbackName);
  }
}

// Re-export for tests.
export type { MotionCurves };
export { defaultMotionCurves };

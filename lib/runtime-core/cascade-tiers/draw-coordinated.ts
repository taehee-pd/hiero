/**
 * Draw-coordinated tier (W3-6 T7).
 *
 * Stroke ↔ fill transitions. The aligned-skeleton path
 * (Tiller-Hanson medial-axis thickening via `clipper2-ts`) lands
 * with the offsetting dependency in W3.5 / W4 once the deps are
 * installable in this environment. The W3 baseline is the
 * **misaligned-skeleton path**: the source path renders for
 * `t < 0.5`, the target for `t ≥ 0.5`, with a 0.08·duration
 * geometry/opacity offset that the runtime scheduler reads from
 * `motion.alphaOffsetRatio`.
 *
 * "No raw crossfade" is the §1 motion-contract invariant — even the
 * misaligned path produces a *designed* motion (draw-out plus
 * draw-in with offset), not a synchronous opacity blend. This tier
 * is structurally distinct from T8's `draw-replace`: T7 fires on
 * recognised stroke ↔ fill *symmetric* topology; T8 fires when
 * topology is genuinely incompatible.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.6.
 */
import type { CascadeInput, TierResult } from '../cascade';
import { fallbackMotion } from '../cascade-fallbacks';

export function resolveDrawCoordinated(input: CascadeInput): TierResult | null {
  if (input.taxonomy !== 'T7') return null;

  const fromD = input.fromTopology.canonical?.d ?? '';
  const toD = input.toTopology.canonical?.d ?? '';
  if (!fromD || !toD) return null;

  // Misaligned-skeleton path: the interpolator returns source
  // geometry for the first half, target for the second half. The
  // runtime scheduler interleaves opacity via `motion.alpha` and
  // the per-fallback offset.
  const interpolator = (t: number) => (t < 0.5 ? fromD : toD);

  // Borrow the draw-replace motion curves — same choreography
  // contract (sequential geometry + opacity-led handoff).
  const motion = fallbackMotion('draw-replace') ?? input.motion;

  return {
    interpolator,
    motion,
    // Distortion: medial-axis-skeleton Hausdorff lands with the
    // Tiller-Hanson dependency. For the W3 misaligned-skeleton
    // baseline we report the boundary as fully unmorphed (no
    // continuous geometry) — the cascade ceiling for this tier
    // (`0.60`) accommodates that.
    distortion: 0.5,
    signal: null,
  };
}

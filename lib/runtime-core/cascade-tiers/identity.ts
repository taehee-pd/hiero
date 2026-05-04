/**
 * Identity tier — equal canonicalised paths.
 *
 * When both layers canonicalise to the same `d` string, no
 * interpolation runs. The cascade returns the path verbatim at
 * every `t`.
 */
import type { CascadeInput, TierResult } from '../cascade';

export function resolveIdentity(input: CascadeInput): TierResult | null {
  // T7 stroke ↔ fill can land here with equal canonical paths and
  // different styles — the rendered output differs even though the
  // geometry is the same. Defer so the draw-coordinated tier picks
  // up the pair. (`outline-square ↔ filled-square` is the canonical
  // T7 case; both have identical `d`.)
  if (input.taxonomy === 'T7') return null;

  const fromD = input.fromTopology.canonical?.d ?? null;
  const toD = input.toTopology.canonical?.d ?? null;
  if (fromD === null || toD === null) return null;
  if (fromD !== toD) return null;
  const constant = fromD;
  return {
    interpolator: () => constant,
    motion: input.motion,
    distortion: 0,
    signal: null,
  };
}

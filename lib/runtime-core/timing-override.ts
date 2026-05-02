/**
 * Layer-2 timing-curve override scaffolding (W4-8).
 *
 * The override surface lets power-users replace the cadence-derived
 * `MotionCurves` with explicit easing references. The Inspector
 * Layer-2 disclosure (W4-8 UI) writes a serialised `TimingOverride`
 * onto the `Transition` schema; this module deserialises it back
 * to runtime `MotionCurves` for the cascade.
 *
 * The full override UI ships in a follow-up commit; the schema
 * extension + (de)serialisation contract land here so the
 * downstream resolver doesn't churn when the UI does.
 *
 * Plan: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 2.
 *
 * @module
 */
import { getEasingFunction, type EasingFunction } from './easing';
import type { MotionCurves } from './motion-curves';

/**
 * Serialised author-supplied timing curves. Mirrors the shape the
 * UI's two-curve editor produces. Each axis carries a string-named
 * easing or an explicit cubic-Bezier; the runtime reuses
 * {@link getEasingFunction} which already accepts both.
 */
export type TimingOverride = {
  g: string; // e.g. 'ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)'
  alpha: string;
  alphaOffsetRatio?: number;
};

/**
 * Resolve a {@link TimingOverride} to runtime curves. Falls through
 * to a soft default for unknown easings (matches the
 * `getEasingFunction` contract).
 */
export function resolveTimingOverride(override: TimingOverride): MotionCurves {
  const g: EasingFunction = getEasingFunction(override.g);
  const alpha: EasingFunction = getEasingFunction(override.alpha);
  const alphaOffsetRatio =
    typeof override.alphaOffsetRatio === 'number' &&
    override.alphaOffsetRatio >= 0 &&
    override.alphaOffsetRatio <= 0.5
      ? override.alphaOffsetRatio
      : 0.08;
  return { g, alpha, alphaOffsetRatio };
}

/**
 * Easing names accepted by the timing override. W4 audit §8: the
 * raw `getEasingFunction` silently falls back to `linear` for
 * unknown names, so a typo like `'ease-in-cubicc'` would resolve
 * to linear at runtime without warning. We enumerate the accepted
 * named easings here and accept the parametric `cubic-bezier(...)`
 * / `steps(...)` forms via regex shape; anything else fails
 * validation at write time.
 */
const NAMED_EASINGS = new Set<string>([
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-cubic',
  'ease-out-cubic',
]);

const PARAMETRIC_EASING_RE =
  /^(?:cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\)|steps\(\s*\d+(?:\s*,\s*(?:start|end))?\s*\))$/;

function isValidEasingName(name: string): boolean {
  if (NAMED_EASINGS.has(name)) return true;
  return PARAMETRIC_EASING_RE.test(name);
}

/**
 * Validate a {@link TimingOverride} payload — used by the schema
 * lint when the W4-8 UI writes the override field.
 */
export function isValidTimingOverride(value: unknown): value is TimingOverride {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.g !== 'string' || !isValidEasingName(v.g)) return false;
  if (typeof v.alpha !== 'string' || !isValidEasingName(v.alpha)) return false;
  if (
    v.alphaOffsetRatio !== undefined &&
    (typeof v.alphaOffsetRatio !== 'number' ||
      v.alphaOffsetRatio < 0 ||
      v.alphaOffsetRatio > 0.5)
  ) {
    return false;
  }
  return true;
}

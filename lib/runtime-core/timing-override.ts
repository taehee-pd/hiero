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
 * Validate a {@link TimingOverride} payload — used by the schema
 * lint when the W4-8 UI writes the override field.
 */
export function isValidTimingOverride(value: unknown): value is TimingOverride {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.g !== 'string' || v.g.length === 0) return false;
  if (typeof v.alpha !== 'string' || v.alpha.length === 0) return false;
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

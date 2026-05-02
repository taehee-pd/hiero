/**
 * Resolution-signal → plain-language sentence translator.
 *
 * Algorithm-side vocabulary lives in {@link ResolutionSignal} kinds.
 * Designer-facing copy lives here. The translator is the only sanctioned
 * crossing point between the two registers — no other code surfaces
 * signal kinds in user-visible strings.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.5,
 * docs_canonical/ICON_TRANSITION_UX_PLAN.md §6.3.
 *
 * @module
 */
import type { ResolutionSignal } from './morph-resolution';
import type { FallbackName } from '../schema/types';

/**
 * Designer-facing display name for each named fallback. Used in the
 * translator's sentences and in the Layer-1 fallback picker. Closed
 * list — must align with the {@link FallbackName} union.
 */
export const FALLBACK_DISPLAY_NAME: Record<FallbackName, string> = {
  'radial-pop': 'Radial Pop',
  'directional-replace-up': 'Slide Up',
  'directional-replace-down': 'Slide Down',
  'directional-replace-left': 'Slide Left',
  'directional-replace-right': 'Slide Right',
  'directional-replace-toward': 'Pull Forward',
  'directional-replace-away': 'Push Back',
  'draw-replace': 'Draw Replace',
  'scale-pop': 'Scale Pop',
};

/**
 * Translate a {@link ResolutionSignal} into a single designer-readable
 * sentence. Returns `null` when the signal is `null` — the cascade
 * landed at the topology classifier's preferred tier and there's
 * nothing to explain.
 *
 * Copy guidelines (enforced by `scripts/check-non-debug-copy.ts`):
 *   - No algorithm vocabulary (no "Hungarian", "intrinsic", "ARAP",
 *     "contour tree", "turning function", "medial axis", "tier",
 *     "cascade").
 *   - Speak in terms of *outcome* ("we're using a Slide instead")
 *     and *invitation* ("Pick a different fallback below if you'd
 *     prefer"), not mechanism.
 *   - End with a concrete next-action when one exists.
 */
export function signalToSentence(signal: ResolutionSignal | null): string | null {
  if (!signal) return null;
  const fallback = FALLBACK_DISPLAY_NAME[signal.fallbackName];
  switch (signal.kind) {
    case 'tree-shape-mismatch':
      return `These shapes don't share the same hole-and-island structure, so we're using a ${fallback}. Pick a different fallback motion below if you'd prefer.`;
    case 'distortion-floor-exceeded':
      return `These shapes are too different to morph continuously, so we're using a ${fallback} instead. Pick a different fallback motion below if you'd prefer.`;
    case 'fillrule-conflict':
      return `These shapes fill themselves in different ways, so a continuous morph would change what's painted. We're using a ${fallback} instead.`;
    case 'open-closed-mismatch':
      return `One of these shapes is a stroke and the other is a closed area, so we're using a ${fallback}. Pick a different fallback motion below if you'd prefer.`;
    case 'subpath-cardinality-mismatch':
      return `These shapes have very different numbers of pieces (${signal.from} vs ${signal.to}), so we're using a ${fallback}. Pick a different fallback motion below if you'd prefer.`;
  }
}

/**
 * Translate a signal to its raw debug string (engineer-facing only).
 * Surfaced in the debug pill behind `NEXT_PUBLIC_HIERO_DEBUG=1`. Not
 * subject to the user-facing copy lint — algorithm vocabulary is
 * expected here.
 */
export function signalToDebugString(signal: ResolutionSignal | null): string | null {
  if (!signal) return null;
  switch (signal.kind) {
    case 'tree-shape-mismatch':
      return `tree-shape-mismatch level=${signal.level} from=${signal.fromCount} to=${signal.toCount} → ${signal.fallbackName}`;
    case 'distortion-floor-exceeded':
      return `distortion-floor-exceeded tier=${signal.tier} estimate=${signal.estimate.toFixed(3)} ceiling=${signal.ceiling.toFixed(3)} → ${signal.fallbackName}`;
    case 'fillrule-conflict':
      return `fillrule-conflict from=${signal.fromRule} to=${signal.toRule} → ${signal.fallbackName}`;
    case 'open-closed-mismatch':
      return `open-closed-mismatch → ${signal.fallbackName}`;
    case 'subpath-cardinality-mismatch':
      return `subpath-cardinality-mismatch from=${signal.from} to=${signal.to} → ${signal.fallbackName}`;
  }
}

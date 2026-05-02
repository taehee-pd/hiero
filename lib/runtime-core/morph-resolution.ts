/**
 * Morph resolution — per-layer-pair output of the W3+ resolver
 * cascade. The W1-U3 contract type the new cascade emits and the UI
 * (sentence translator, debug pill) consumes.
 *
 * Distinct from `ResolvedTransition` in `transition-resolver.ts`,
 * which is the legacy per-transition multi-layer plan. W4 unifies
 * the names after the legacy shape ships out.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.3.
 *
 * @module
 */
import type { MorphInterpolator } from './morph';
import type { MotionCurves } from './motion-curves';
import type { TaxonomyId } from './topology-classifier';
import type { FallbackName } from '../schema/types';

/**
 * Resolver tier identifier — what the cascade actually picked, not
 * what the topology classifier *suggested*.
 *
 * `'identity'` — equal canonical paths, no interpolation needed.
 * `'compound-isomorphic'` — both sides have isomorphic compound trees;
 *    operands map by tree position.
 * `'intrinsic-strict'` — same command signature; Sederberg-1993
 *    intrinsic interpolation runs unmodified.
 * `'hierarchical-match'` — per-level rectangular Hungarian over the
 *    contour tree (T3, T4, T5 multi-shape paths).
 * `'arap-quality-wrap'` — ARAP wrap atop a chosen vertex
 *    correspondence (Igarashi 2005 closed-form for runtime, Alexa
 *    2000 for offline).
 * `'draw-coordinated'` — stroke ↔ fill emit (T7 medial-axis
 *    thickening or directional draw + fill-emit).
 * `'designed-fallback'` — named fallback motion from the §5.8
 *    library; `signal` carries the reason the cascade fell here.
 */
export type ResolverTier =
  | 'identity'
  | 'compound-isomorphic'
  | 'intrinsic-strict'
  | 'hierarchical-match'
  | 'arap-quality-wrap'
  | 'draw-coordinated'
  | 'designed-fallback';

/**
 * Why the cascade landed where it did. `null` when the topology
 * classifier's suggested tier ran successfully — i.e., nothing
 * needs explaining.
 *
 * Each kind is structured (not a string) so the UI's
 * signal-to-sentence translator can render plain-language copy and
 * the debug pill can render the raw values verbatim. This is the
 * sole authorized place where algorithm-side vocabulary crosses
 * into resolver output; the UI maps it through
 * {@link signalToSentence} before showing the user.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.5.
 */
export type ResolutionSignal =
  | {
      kind: 'tree-shape-mismatch';
      level: number;
      fromCount: number;
      toCount: number;
      fallbackName: FallbackName;
    }
  | {
      kind: 'distortion-floor-exceeded';
      tier: ResolverTier;
      estimate: number;
      ceiling: number;
      fallbackName: FallbackName;
    }
  | {
      kind: 'fillrule-conflict';
      fromRule: 'nonzero' | 'evenodd';
      toRule: 'nonzero' | 'evenodd';
      fallbackName: FallbackName;
    }
  | {
      kind: 'open-closed-mismatch';
      fallbackName: FallbackName;
    }
  | {
      kind: 'subpath-cardinality-mismatch';
      from: number;
      to: number;
      fallbackName: FallbackName;
    };

export type ResolutionSignalKind = ResolutionSignal['kind'];

/**
 * The per-layer-pair contract the new cascade emits.
 *
 * Authored taxonomy intent (from {@link classifyLayerPair}) is on
 * `taxonomy`; what the cascade actually picked is on `tier`.
 * Disagreement between the two means the cascade fell through to a
 * lower tier — `signal` then explains why and the UI shows the
 * fallback sentence.
 */
export type MorphResolution = {
  interpolator: MorphInterpolator;
  motion: MotionCurves;
  /** What the topology classifier suggested as the starting tier. */
  taxonomy: TaxonomyId;
  /** What the cascade actually picked. */
  tier: ResolverTier;
  /** Self-reported distortion estimate from the chosen tier. */
  distortion: number;
  /** Why the cascade landed here, or `null` when there's nothing to explain. */
  signal: ResolutionSignal | null;
};

/**
 * Topology classifier — assigns each `(source, target)` *layer pair*
 * to one of T1..T8 from the resolver taxonomy. The classifier is
 * pure, deterministic, and serves as the cascade's first stop in
 * deciding which tier to attempt.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §3,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §3.
 *
 * Note: this classifier returns a *category*, not a *strategy*. The
 * cascade may still degrade T1 → T8 if the chosen tier's distortion
 * exceeds its floor. Classification answers "what would the resolver
 * try first?", not "what will play."
 *
 * @module
 */
import type { Layer } from '../schema';
import { canonicalizeLayerPath } from './path-normalization';
import type { CanonicalPath } from './path-normalization';
import { buildContourTree } from './contour-tree';
import type { ContourTree, FillRule } from './contour-tree';

export type TaxonomyId =
  | 'T1' // single closed ↔ single closed
  | 'T2' // single open   ↔ single open
  | 'T3' // multi closed  ↔ multi closed
  | 'T4' // multi open    ↔ multi open
  | 'T5' // mixed (closed + open) on at least one side
  | 'T6' // compound (boolean tree) present on either side
  | 'T7' // stroke style ↔ fill style
  | 'T8'; // hard-incompatible (e.g. single-closed ↔ single-open)

/**
 * Information used by the classifier per layer. Pre-computing this
 * lets the cascade reuse the same canonical / tree work for the
 * downstream tier implementations.
 */
export type LayerTopology = {
  hasGeometry: boolean;
  hasCompound: boolean;
  isStrokeOnly: boolean;
  isFillOnly: boolean;
  canonical: CanonicalPath | null;
  tree: ContourTree | null;
  closedSubpathCount: number;
  openSubpathCount: number;
};

export function describeLayer(layer: Layer): LayerTopology {
  const canonical = canonicalizeLayerPath(layer);
  const tree = canonical
    ? buildContourTree(canonical, fillRuleOf(layer))
    : null;

  const closedSubpathCount = tree?.rings.length ?? 0;
  const openSubpathCount = tree?.openSubpathIndices.length ?? 0;

  return {
    hasGeometry: !!canonical,
    hasCompound: hasCompoundField(layer),
    isStrokeOnly: isStrokeOnlyStyle(layer),
    isFillOnly: isFillOnlyStyle(layer),
    canonical,
    tree,
    closedSubpathCount,
    openSubpathCount,
  };
}

export function classifyLayerPair(from: Layer, to: Layer): TaxonomyId {
  return classifyTopologyPair(describeLayer(from), describeLayer(to));
}

export function classifyTopologyPair(
  from: LayerTopology,
  to: LayerTopology,
): TaxonomyId {
  // Compound metadata wins regardless of stroke/fill or topology
  // distribution: T6 owns the compound-aware reduction.
  if (from.hasCompound || to.hasCompound) return 'T6';

  // From here on we only care about subpath cardinality + open/closed
  // distribution.
  const fromShape = shapeOf(from);
  const toShape = shapeOf(to);

  // Stroke ↔ fill is the SF-Symbols-class case (outline-heart ↔
  // filled-heart). It requires both sides to be pure-closed and
  // style-asymmetric (one stroke-only, one fill-only). Open stroke
  // morphs against closed fill are structurally incompatible — they
  // fall through to T8 below.
  if (
    fromShape === 'pure-closed' &&
    toShape === 'pure-closed' &&
    ((from.isStrokeOnly && to.isFillOnly) ||
      (from.isFillOnly && to.isStrokeOnly))
  ) {
    return 'T7';
  }

  // Mixed on either side → T5.
  if (fromShape === 'mixed' || toShape === 'mixed') return 'T5';

  // Symmetric pure-closed.
  if (fromShape === 'pure-closed' && toShape === 'pure-closed') {
    return from.closedSubpathCount === 1 && to.closedSubpathCount === 1
      ? 'T1'
      : 'T3';
  }

  // Symmetric pure-open.
  if (fromShape === 'pure-open' && toShape === 'pure-open') {
    return from.openSubpathCount === 1 && to.openSubpathCount === 1
      ? 'T2'
      : 'T4';
  }

  // Asymmetric pure-closed ↔ pure-open or one side has no geometry —
  // no continuous morph fits. Cascade routes to T8 fallback library.
  return 'T8';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LayerShape = 'pure-closed' | 'pure-open' | 'mixed' | 'empty';

function shapeOf(t: LayerTopology): LayerShape {
  if (t.closedSubpathCount === 0 && t.openSubpathCount === 0) return 'empty';
  if (t.closedSubpathCount > 0 && t.openSubpathCount === 0) return 'pure-closed';
  if (t.openSubpathCount > 0 && t.closedSubpathCount === 0) return 'pure-open';
  return 'mixed';
}

function fillRuleOf(layer: Layer): FillRule {
  return layer.path?.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
}

function hasCompoundField(layer: Layer): boolean {
  // Compound metadata is added in W2-1; until then, no layer carries
  // the field. The classifier reads it via a tolerant property lookup
  // so it lights up automatically once the schema lands.
  return Boolean((layer as { compound?: unknown }).compound);
}

function isStrokeOnlyStyle(layer: Layer): boolean {
  const style = layer.style;
  return Boolean(style?.stroke) && !style?.fill;
}

function isFillOnlyStyle(layer: Layer): boolean {
  const style = layer.style;
  return Boolean(style?.fill) && !style?.stroke;
}

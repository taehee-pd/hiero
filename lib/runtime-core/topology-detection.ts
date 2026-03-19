/**
 * Topology incompatibility detection and crossfade strategies (Phase 8.3).
 *
 * Detects when source and target icons have incompatible topology for morphing
 * (different sub-path counts, different open/closed status, fill mode changes)
 * and provides coordinated crossfade strategies as fallback.
 *
 * SF Symbols approach: Apple does NOT morph geometry between outline and filled
 * variants. They use layer-level crossfade, which is correct because topology
 * changes fundamentally (open stroked paths vs. closed filled paths).
 *
 * @module
 */

import type { Layer, State } from '../schema/types';
import type { RuntimeDrawAnnotation } from '../export/export-runtime-json';
import { canonicalizeLayerPath } from './path-normalization';

// ---------------------------------------------------------------------------
// 8.3a — Topology incompatibility detection
// ---------------------------------------------------------------------------

export type TopologyIncompatibility =
  | 'subpath-count-mismatch'
  | 'closed-open-mismatch'
  | 'fill-mode-change'
  | 'stroke-to-fill-change'
  | 'path-type-mismatch';

export type TopologyAnalysis = {
  compatible: boolean;
  incompatibilities: TopologyIncompatibility[];
  recommendedStrategy: 'morph' | 'crossfade' | 'draw-crossfade';
  details: string[];
};

/**
 * Analyze topology compatibility between two states.
 *
 * Returns whether the states can be morphed or need crossfade fallback.
 */
export function analyzeTopologyCompatibility(
  fromState: State,
  toState: State,
): TopologyAnalysis {
  const incompatibilities: TopologyIncompatibility[] = [];
  const details: string[] = [];

  const fromLayers = Object.values(fromState.layers);
  const toLayers = Object.values(toState.layers);

  // Check each paired layer for topology compatibility
  for (const fromLayer of fromLayers) {
    const toLayer = toLayers.find((l) => l.id === fromLayer.id);
    if (!toLayer) continue;

    const layerIncompat = analyzeLayerTopology(fromLayer, toLayer);
    for (const issue of layerIncompat) {
      if (!incompatibilities.includes(issue.type)) {
        incompatibilities.push(issue.type);
      }
      details.push(`Layer "${fromLayer.id}": ${issue.detail}`);
    }
  }

  // Check for stroke-to-fill transitions across all layers
  const fromHasStroked = fromLayers.some(isStrokedLayer);
  const toHasStroked = toLayers.some(isStrokedLayer);
  const fromHasFilled = fromLayers.some(isFilledLayer);
  const toHasFilled = toLayers.some(isFilledLayer);

  if ((fromHasStroked && !toHasStroked && toHasFilled) ||
      (toHasStroked && !fromHasStroked && fromHasFilled)) {
    if (!incompatibilities.includes('stroke-to-fill-change')) {
      incompatibilities.push('stroke-to-fill-change');
      details.push('Transition involves stroke-to-fill or fill-to-stroke change');
    }
  }

  const compatible = incompatibilities.length === 0;
  const recommendedStrategy = compatible
    ? 'morph'
    : incompatibilities.includes('stroke-to-fill-change')
      ? 'draw-crossfade'
      : 'crossfade';

  return { compatible, incompatibilities, recommendedStrategy, details };
}

type LayerIssue = { type: TopologyIncompatibility; detail: string };

function analyzeLayerTopology(from: Layer, to: Layer): LayerIssue[] {
  const issues: LayerIssue[] = [];
  const fromPath = canonicalizeLayerPath(from);
  const toPath = canonicalizeLayerPath(to);

  if (!fromPath || !toPath) {
    if ((fromPath && !toPath) || (!fromPath && toPath)) {
      issues.push({
        type: 'path-type-mismatch',
        detail: 'One state has path data and the other does not',
      });
    }
    return issues;
  }

  // Sub-path count mismatch
  if (fromPath.stats.subpathCount !== toPath.stats.subpathCount) {
    issues.push({
      type: 'subpath-count-mismatch',
      detail: `Sub-path count: ${fromPath.stats.subpathCount} → ${toPath.stats.subpathCount}`,
    });
  }

  // Closed/open mismatch
  const fromClosed = fromPath.stats.closed;
  const toClosed = toPath.stats.closed;
  const closedLen = Math.min(fromClosed.length, toClosed.length);
  for (let i = 0; i < closedLen; i++) {
    if (fromClosed[i] !== toClosed[i]) {
      issues.push({
        type: 'closed-open-mismatch',
        detail: `Sub-path ${i}: ${fromClosed[i] ? 'closed' : 'open'} → ${toClosed[i] ? 'closed' : 'open'}`,
      });
      break;
    }
  }

  // Fill mode change detection
  const fromIsFilled = isFilledLayer(from);
  const toIsFilled = isFilledLayer(to);
  const fromIsStroked = isStrokedLayer(from);
  const toIsStroked = isStrokedLayer(to);

  if ((fromIsFilled && toIsStroked && !toIsFilled) ||
      (fromIsStroked && !fromIsFilled && toIsFilled)) {
    issues.push({
      type: 'fill-mode-change',
      detail: `Layer changes from ${fromIsFilled ? 'filled' : 'stroked'} to ${toIsFilled ? 'filled' : 'stroked'}`,
    });
  }

  return issues;
}

function isStrokedLayer(layer: Layer): boolean {
  return !!(layer.style.stroke && layer.style.strokeWidth && layer.style.strokeWidth > 0);
}

function isFilledLayer(layer: Layer): boolean {
  return !!layer.style.fill && layer.style.fill.mode !== 'currentColor'
    ? true
    : !!layer.style.fill;
}

// ---------------------------------------------------------------------------
// 8.3b — Coordinated crossfade with emphasis
// ---------------------------------------------------------------------------

export type CrossfadeFrame = {
  outgoingOpacity: number;
  incomingOpacity: number;
  incomingScale: number;
};

/**
 * Compute crossfade frame values for a given progress (0-1).
 *
 * Outgoing icon fades out (1→0) while incoming fades in (0→1).
 * Add scale pulse on incoming (1.0→1.12→1.0 via spring-like easing)
 * for tactile feedback.
 */
export function computeCrossfadeFrame(progress: number): CrossfadeFrame {
  const t = Math.max(0, Math.min(1, progress));

  // Outgoing: linear fade out
  const outgoingOpacity = 1 - t;

  // Incoming: slightly delayed fade in (starts at t=0.1)
  const incomingT = Math.max(0, (t - 0.1) / 0.9);
  const incomingOpacity = easeOutCubic(incomingT);

  // Scale pulse: 1.0 → 1.12 → 1.0 with spring-like overshoot
  const scaleT = easeOutBack(t);
  const incomingScale = 1 + 0.12 * Math.sin(scaleT * Math.PI);

  return { outgoingOpacity, incomingOpacity, incomingScale };
}

// ---------------------------------------------------------------------------
// 8.3c — Draw-coordinated crossfade (SF Symbols 7 style)
// ---------------------------------------------------------------------------

export type DrawCrossfadeFrame = CrossfadeFrame & {
  outgoingDrawProgress: number;
  incomingDrawProgress: number;
};

/**
 * Compute draw-coordinated crossfade frame values.
 *
 * When Magic Replace + Draw metadata are available:
 * - Outgoing layers use Draw Off (stroke erases)
 * - Incoming layers use Draw On (stroke reveals)
 * - Creates the handwriting-style transition from SF Symbols 7
 */
export function computeDrawCrossfadeFrame(
  progress: number,
  hasDrawAnnotation: boolean,
): DrawCrossfadeFrame {
  const base = computeCrossfadeFrame(progress);
  const t = Math.max(0, Math.min(1, progress));

  if (!hasDrawAnnotation) {
    return {
      ...base,
      outgoingDrawProgress: 1,
      incomingDrawProgress: 1,
    };
  }

  // Draw Off for outgoing (1→0, slightly ahead of fade)
  const outgoingDrawT = Math.min(1, t * 1.2);
  const outgoingDrawProgress = 1 - easeInCubic(outgoingDrawT);

  // Draw On for incoming (0→1, slightly behind)
  const incomingDrawT = Math.max(0, (t - 0.15) / 0.85);
  const incomingDrawProgress = easeOutCubic(incomingDrawT);

  return {
    ...base,
    outgoingDrawProgress,
    incomingDrawProgress,
  };
}

/**
 * Check if draw-coordinated crossfade should be used.
 *
 * True when both states have draw annotations or when the transition
 * involves Magic Replace with Draw metadata.
 */
export function shouldUseDrawCrossfade(
  drawAnnotation: RuntimeDrawAnnotation | undefined,
  _preserveLayerIds: string[] | undefined,
): boolean {
  if (!drawAnnotation) return false;
  // Draw-coordinated crossfade requires at least 2 layers with draw data
  return Object.keys(drawAnnotation.layers).length >= 2;
}

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

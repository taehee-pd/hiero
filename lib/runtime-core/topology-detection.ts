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

import type { Layer, LayerSnapshot } from '../schema/types';
import type { RuntimeDrawAnnotation } from '../export/export-runtime-json';
import { canonicalizeLayerPath, type GeometryStats } from './path-normalization';

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
  /** Per-subpath strategy breakdown (populated when both layers have path data). */
  subPathStrategies?: SubPathStrategyResult[];
};

// ---------------------------------------------------------------------------
// Phase G1 — Per-subpath animation strategy classifier
// ---------------------------------------------------------------------------

export type SubPathStrategy = 'morph' | 'trim' | 'crossfade';

export type SubPathStrategyResult = {
  fromIndex: number;
  toIndex: number | null; // null = unmatched (added/removed subpath)
  strategy: SubPathStrategy;
  reason: string;
};

/**
 * Classify animation strategy for each subpath pair between two GeometryStats.
 *
 * Classification rules:
 * 1. Match subpaths by index (when counts match) or best geometric match
 *    (when counts differ).
 * 2. For each matched pair:
 *    - Both closed → 'morph'
 *    - Both open with matching command signature → 'morph' (G3: open-path morphing)
 *    - Both open with mismatched command signature → 'trim'
 *    - One closed, one open → 'crossfade'
 * 3. Unmatched subpaths (when counts differ): 'trim' for open, 'crossfade' for closed
 */
export function classifySubPathStrategies(
  fromStats: GeometryStats,
  toStats: GeometryStats,
): SubPathStrategyResult[] {
  const results: SubPathStrategyResult[] = [];
  const fromSigs = splitSubPathSignatures(fromStats.commandSignature);
  const toSigs = splitSubPathSignatures(toStats.commandSignature);

  const fromCount = fromStats.subpathCount;
  const toCount = toStats.subpathCount;
  const matchedCount = Math.min(fromCount, toCount);

  // --- Matched subpath pairs (by index for equal counts, or sequential for unequal) ---
  for (let i = 0; i < matchedCount; i++) {
    const fromClosed = fromStats.closed[i] ?? false;
    const toClosed = toStats.closed[i] ?? false;

    if (fromClosed && toClosed) {
      // Both closed → morph
      results.push({
        fromIndex: i,
        toIndex: i,
        strategy: 'morph',
        reason: 'Both subpaths are closed — geometric morph',
      });
    } else if (!fromClosed && !toClosed) {
      // Both open — check command signature match (G3)
      const fromSig = fromSigs[i] ?? '';
      const toSig = toSigs[i] ?? '';
      if (fromSig === toSig) {
        results.push({
          fromIndex: i,
          toIndex: i,
          strategy: 'morph',
          reason: 'Both subpaths are open with matching command signature — geometric morph',
        });
      } else {
        results.push({
          fromIndex: i,
          toIndex: i,
          strategy: 'trim',
          reason: `Both subpaths are open but command signatures differ (${fromSig} vs ${toSig}) — trim`,
        });
      }
    } else {
      // One closed, one open → crossfade
      results.push({
        fromIndex: i,
        toIndex: i,
        strategy: 'crossfade',
        reason: `Closed/open mismatch (${fromClosed ? 'closed' : 'open'} → ${toClosed ? 'closed' : 'open'}) — crossfade`,
      });
    }
  }

  // --- Unmatched from-subpaths (removed in target) ---
  for (let i = matchedCount; i < fromCount; i++) {
    const isClosed = fromStats.closed[i] ?? false;
    results.push({
      fromIndex: i,
      toIndex: null,
      strategy: isClosed ? 'crossfade' : 'trim',
      reason: `Unmatched source subpath ${i} (${isClosed ? 'closed → crossfade' : 'open → trim'})`,
    });
  }

  // --- Unmatched to-subpaths (added in target) ---
  for (let i = matchedCount; i < toCount; i++) {
    const isClosed = toStats.closed[i] ?? false;
    results.push({
      fromIndex: -1,
      toIndex: i,
      strategy: isClosed ? 'crossfade' : 'trim',
      reason: `Unmatched target subpath ${i} (${isClosed ? 'closed → crossfade' : 'open → trim'})`,
    });
  }

  return results;
}

/**
 * Split a flat command signature array into per-subpath signature strings.
 *
 * Each subpath starts with an 'M' command. The signature string for a subpath
 * is the concatenation of its command letters (e.g. "MLCZ").
 */
function splitSubPathSignatures(commandSignature: string[]): string[] {
  const signatures: string[] = [];
  let current = '';
  for (const cmd of commandSignature) {
    if (cmd === 'M' && current.length > 0) {
      signatures.push(current);
      current = '';
    }
    current += cmd;
  }
  if (current.length > 0) {
    signatures.push(current);
  }
  return signatures;
}

/**
 * Analyze topology compatibility between two layer snapshots.
 *
 * Returns whether the snapshots can be morphed or need crossfade fallback.
 * Includes per-subpath strategy classification via classifySubPathStrategies.
 */
export function analyzeTopologyCompatibility(
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
): TopologyAnalysis {
  const incompatibilities: TopologyIncompatibility[] = [];
  const details: string[] = [];

  const fromLayers = Object.values(fromSnapshot.layers);
  const toLayers = Object.values(toSnapshot.layers);

  let subPathStrategies: SubPathStrategyResult[] | undefined;

  // Check each paired layer for topology compatibility
  for (const fromLayer of fromLayers) {
    const toLayer = toLayers.find((l) => l.id === fromLayer.id);
    if (!toLayer) continue;

    const layerResult = analyzeLayerTopology(fromLayer, toLayer);
    for (const issue of layerResult.issues) {
      if (!incompatibilities.includes(issue.type)) {
        incompatibilities.push(issue.type);
      }
      details.push(`Layer "${fromLayer.id}": ${issue.detail}`);
    }

    // Attach per-subpath strategies from the first layer pair that has them
    if (layerResult.subPathStrategies && !subPathStrategies) {
      subPathStrategies = layerResult.subPathStrategies;
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

  return { compatible, incompatibilities, recommendedStrategy, details, subPathStrategies };
}

type LayerIssue = { type: TopologyIncompatibility; detail: string };

type LayerTopologyResult = {
  issues: LayerIssue[];
  subPathStrategies?: SubPathStrategyResult[];
};

function analyzeLayerTopology(from: Layer, to: Layer): LayerTopologyResult {
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
    return { issues };
  }

  // Compute per-subpath strategies using the G1 classifier
  const strategies = classifySubPathStrategies(fromPath.stats, toPath.stats);

  // Sub-path count mismatch
  if (fromPath.stats.subpathCount !== toPath.stats.subpathCount) {
    issues.push({
      type: 'subpath-count-mismatch',
      detail: `Sub-path count: ${fromPath.stats.subpathCount} → ${toPath.stats.subpathCount}`,
    });
  }

  // G3: Only flag 'closed-open-mismatch' when one subpath is truly closed
  // and the other is open. Two open subpaths with matching command signatures
  // can morph geometrically and should NOT be flagged.
  const fromClosed = fromPath.stats.closed;
  const toClosed = toPath.stats.closed;
  const closedLen = Math.min(fromClosed.length, toClosed.length);
  for (let i = 0; i < closedLen; i++) {
    const fc = fromClosed[i] ?? false;
    const tc = toClosed[i] ?? false;
    if (fc !== tc) {
      // Only flag when one is closed and the other is open
      // (both-open cases are handled by the subpath strategy classifier)
      issues.push({
        type: 'closed-open-mismatch',
        detail: `Sub-path ${i}: ${fc ? 'closed' : 'open'} → ${tc ? 'closed' : 'open'}`,
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

  return { issues, subPathStrategies: strategies };
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

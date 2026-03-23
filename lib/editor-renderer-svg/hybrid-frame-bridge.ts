/**
 * HybridFrame to SVG rendering bridge (Phase J, Task J0).
 *
 * Routes each subpath strategy from a {@link HybridFrame} to the
 * appropriate SVG rendering technique:
 * - morphedPaths  -> update `<path>` `d` attribute with interpolated geometry
 * - trimmedPaths  -> set `stroke-dasharray` / `stroke-dashoffset` for trim animation
 * - crossfadePaths -> set `opacity` for crossfade transitions
 *
 * @module
 */

import type { HybridFrame } from '@/lib/runtime-core/hybrid-compositor';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Data-attribute constants
// ---------------------------------------------------------------------------

const HYBRID_SUBPATH_ATTR = 'data-hybrid-subpath';
const HYBRID_STRATEGY_ATTR = 'data-hybrid-strategy';

// ---------------------------------------------------------------------------
// applyHybridFrameToSVG
// ---------------------------------------------------------------------------

/**
 * Apply a {@link HybridFrame} to an SVG element, routing each subpath type
 * to its appropriate rendering strategy.
 *
 * - morphedPaths: update `<path>` `d` attribute with interpolated geometry
 * - trimmedPaths: set `stroke-dasharray` and `stroke-dashoffset` for trim animation
 * - crossfadePaths: set `opacity` for crossfade transitions
 *
 * When a frame uses mixed strategies the original single `<path>` element is
 * split into multiple `<path>` elements — one per subpath strategy.
 */
export function applyHybridFrameToSVG(
  frame: HybridFrame,
  svgElement: SVGSVGElement,
  layerId: string,
): void {
  const escapedId = CSS.escape(layerId);
  const pathEl = svgElement.querySelector<SVGPathElement>(
    `path[data-layer-id="${escapedId}"]`,
  );
  if (!pathEl) return;

  const totalEntries =
    frame.morphedPaths.length +
    frame.trimmedPaths.length +
    frame.crossfadePaths.length;

  // Nothing to render — leave element untouched
  if (totalEntries === 0) return;

  // Fast path: single strategy with a single subpath — update in-place
  if (totalEntries === 1) {
    applySingleEntry(pathEl, frame);
    return;
  }

  // Mixed strategies: replace the original path with one <path> per subpath
  replaceSinglePathWithHybridGroup(pathEl, frame, layerId, svgElement);
}

// ---------------------------------------------------------------------------
// renderHybridFrameElements
// ---------------------------------------------------------------------------

/**
 * Create SVG `<path>` elements for a hybrid frame — one per subpath strategy.
 *
 * This is useful when the caller needs DOM elements without inserting them
 * into a live SVG tree (e.g. for off-screen measurement or export).
 */
export function renderHybridFrameElements(
  frame: HybridFrame,
  layerId: string,
  baseStyle: { fill?: string; stroke?: string; strokeWidth?: number },
): SVGPathElement[] {
  const elements: SVGPathElement[] = [];

  for (let i = 0; i < frame.morphedPaths.length; i++) {
    const entry = frame.morphedPaths[i]!;
    const el = createPathElement();
    el.setAttribute('d', entry.d);
    el.setAttribute('data-layer-id', layerId);
    el.setAttribute(HYBRID_SUBPATH_ATTR, String(entry.fromIndex));
    el.setAttribute(HYBRID_STRATEGY_ATTR, 'morph');
    applyBaseStyle(el, baseStyle);
    elements.push(el);
  }

  for (let i = 0; i < frame.trimmedPaths.length; i++) {
    const entry = frame.trimmedPaths[i]!;
    const el = createPathElement();
    el.setAttribute('d', entry.d);
    el.setAttribute('data-layer-id', layerId);
    el.setAttribute(HYBRID_SUBPATH_ATTR, String(entry.fromIndex));
    el.setAttribute(HYBRID_STRATEGY_ATTR, 'trim');
    applyBaseStyle(el, baseStyle);
    // For trim animation, ensure the path is stroked (not just filled)
    // so that dasharray is visible. Preserve fill from base style.
    el.style.strokeDasharray = entry.dashArray;
    el.style.strokeDashoffset = entry.dashOffset;
    elements.push(el);
  }

  for (let i = 0; i < frame.crossfadePaths.length; i++) {
    const entry = frame.crossfadePaths[i]!;
    const el = createPathElement();
    el.setAttribute('d', entry.d);
    el.setAttribute('data-layer-id', layerId);
    el.setAttribute(HYBRID_SUBPATH_ATTR, String(entry.fromIndex));
    el.setAttribute(HYBRID_STRATEGY_ATTR, 'crossfade');
    applyBaseStyle(el, baseStyle);
    el.style.opacity = String(entry.opacity);
    elements.push(el);
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply a single-entry frame directly to an existing `<path>` element
 * without creating additional DOM nodes.
 */
function applySingleEntry(pathEl: SVGPathElement, frame: HybridFrame): void {
  if (frame.morphedPaths.length === 1) {
    const entry = frame.morphedPaths[0]!;
    pathEl.setAttribute('d', entry.d);
    // Clear any leftover trim/crossfade styles
    clearTrimStyles(pathEl);
    pathEl.style.removeProperty('opacity');
    return;
  }

  if (frame.trimmedPaths.length === 1) {
    const entry = frame.trimmedPaths[0]!;
    pathEl.setAttribute('d', entry.d);
    pathEl.style.strokeDasharray = entry.dashArray;
    pathEl.style.strokeDashoffset = entry.dashOffset;
    pathEl.style.removeProperty('opacity');
    return;
  }

  if (frame.crossfadePaths.length === 1) {
    const entry = frame.crossfadePaths[0]!;
    pathEl.setAttribute('d', entry.d);
    clearTrimStyles(pathEl);
    pathEl.style.opacity = String(entry.opacity);
    return;
  }
}

/**
 * Remove a single `<path>` and insert multiple `<path>` elements in its
 * place — one per subpath strategy in the {@link HybridFrame}.
 */
function replaceSinglePathWithHybridGroup(
  originalPath: SVGPathElement,
  frame: HybridFrame,
  layerId: string,
  svgElement: SVGSVGElement,
): void {
  // Remove any previously injected hybrid paths for this layer
  svgElement
    .querySelectorAll<SVGPathElement>(
      `path[data-layer-id="${CSS.escape(layerId)}"][${HYBRID_STRATEGY_ATTR}]`,
    )
    .forEach((el) => el.remove());

  // Capture styling from the original element so cloned subpaths inherit it
  const baseStyle = extractBaseStyle(originalPath);
  const anchor = originalPath.nextSibling;
  const parent = originalPath.parentNode;
  if (!parent) return;

  // Hide the original path (keep it in DOM so other systems can find it)
  originalPath.style.display = 'none';

  const elements = renderHybridFrameElements(frame, layerId, baseStyle);
  for (const el of elements) {
    parent.insertBefore(el, anchor);
  }
}

/**
 * Extract base style values from an existing SVG path element.
 */
function extractBaseStyle(el: SVGPathElement): {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
} {
  const fill = el.getAttribute('fill') ?? undefined;
  const stroke = el.getAttribute('stroke') ?? undefined;
  const strokeWidthRaw = el.getAttribute('stroke-width');
  const strokeWidth =
    strokeWidthRaw !== null ? parseFloat(strokeWidthRaw) : undefined;

  return {
    fill,
    stroke,
    strokeWidth: strokeWidth !== undefined && !Number.isNaN(strokeWidth)
      ? strokeWidth
      : undefined,
  };
}

/**
 * Apply base fill/stroke/strokeWidth to a `<path>` element.
 */
function applyBaseStyle(
  el: SVGPathElement,
  style: { fill?: string; stroke?: string; strokeWidth?: number },
): void {
  if (style.fill !== undefined) {
    el.setAttribute('fill', style.fill);
  }
  if (style.stroke !== undefined) {
    el.setAttribute('stroke', style.stroke);
  }
  if (style.strokeWidth !== undefined) {
    el.setAttribute('stroke-width', String(style.strokeWidth));
  }
}

function createPathElement(): SVGPathElement {
  return document.createElementNS(SVG_NS, 'path');
}

function clearTrimStyles(el: SVGPathElement): void {
  el.style.removeProperty('stroke-dasharray');
  el.style.removeProperty('stroke-dashoffset');
}

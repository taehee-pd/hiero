import type { Icon, Layer, PaintRef, RenderingMode } from '@/lib/schema/types';
import {
  applyVariableValue,
  resolveLayerStyleForRendering,
  resolveVariantRenderingMode,
} from '@/lib/rendering/resolve-layer-style';
import { computeVariableValue } from '@/lib/runtime-core/variable-value';
import { generateAutoGradient } from '@/lib/rendering/auto-gradient';

export type RenderSvgInput = {
  icon: Icon;
  variantId: string;
  stateId: string;
  renderingMode?: RenderingMode;
  tokens?: Record<string, string>;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const MANAGED_DEFS_ATTR = 'data-managed-by';
const MANAGED_DEFS_VALUE = 'render-svg';

/**
 * Imperatively render icon geometry into an existing SVG element.
 * Handles create/update/remove of child `<path>` elements.
 */
export function renderSvg(input: RenderSvgInput, target: SVGSVGElement): void {
  const { icon, variantId, stateId, tokens } = input;
  const variant = icon.variants[variantId];
  const state = variant?.states[stateId];
  if (!variant || !state) return;
  const renderingMode = resolveVariantRenderingMode(
    input.renderingMode ?? variant.renderingMode,
  );

  // Set viewBox
  const [vx, vy, vw, vh] = variant.viewBox;
  target.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);

  const defs = ensureManagedDefs(target);
  defs.replaceChildren();

  // Collect existing path elements keyed by data-layer-id
  const existing = new Map<string, SVGPathElement>();
  target.querySelectorAll<SVGPathElement>('path[data-layer-id]').forEach(
    (el) => {
      const id = el.getAttribute('data-layer-id');
      if (id) existing.set(id, el);
    },
  );
  const existingHit = new Map<string, SVGPathElement>();
  target.querySelectorAll<SVGPathElement>('path[data-layer-hit-id]').forEach((el) => {
    const id = el.getAttribute('data-layer-hit-id');
    if (id) existingHit.set(id, el);
  });

  const layers = Object.values(state.layers);
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const variableValues = computeVariableValue(state.layers, variant.variableValue ?? 1);
  const rendered = new Set<string>();

  for (const layer of layers) {
    rendered.add(layer.id);

    if (layer.visible === false || !layer.path?.d || layer.isClipMask) {
      // Remove hidden/pathless layers from DOM
      const el = existing.get(layer.id);
      if (el) el.remove();
      continue;
    }

    let pathEl = existing.get(layer.id);
    if (!pathEl) {
      pathEl = document.createElementNS(SVG_NS, 'path');
      pathEl.setAttribute('data-layer-id', layer.id);
      target.appendChild(pathEl);
    }

    // Path data
    pathEl.setAttribute('d', layer.path.d);
    if (layer.path.fillRule) {
      pathEl.setAttribute('fill-rule', layer.path.fillRule);
    } else {
      pathEl.removeAttribute('fill-rule');
    }

    // Styles
    applyLayerStyle(pathEl, layer, defs, renderingMode, tokens, variableValues[layer.id]);

    // Transform
    applyTransform(pathEl, layer);

    applyClipPath(pathEl, layer, layerById, defs);

    let hitPathEl = existingHit.get(layer.id);
    if (!hitPathEl) {
      hitPathEl = document.createElementNS(SVG_NS, 'path');
      hitPathEl.setAttribute('data-layer-hit-id', layer.id);
      target.insertBefore(hitPathEl, pathEl);
    }
    applyHitPathStyle(hitPathEl, pathEl, layer);
  }

  // Remove stale elements
  existing.forEach((el, id) => {
    if (!rendered.has(id)) el.remove();
  });
  existingHit.forEach((el, id) => {
    if (!rendered.has(id)) el.remove();
  });

  if (defs.childNodes.length === 0) {
    defs.remove();
  }
}


function applyHitPathStyle(hitEl: SVGPathElement, sourcePathEl: SVGPathElement, layer: Layer): void {
  hitEl.setAttribute('d', layer.path?.d ?? '');
  const strokeWidth = Math.max(layer.style.strokeWidth ?? 0, 8);
  hitEl.setAttribute('fill', 'none');
  hitEl.setAttribute('stroke', 'transparent');
  hitEl.setAttribute('stroke-width', String(strokeWidth));
  hitEl.setAttribute('vector-effect', 'non-scaling-stroke');
  hitEl.style.pointerEvents = 'stroke';
  hitEl.style.cursor = 'move';

  const fillRule = sourcePathEl.getAttribute('fill-rule');
  if (fillRule) {
    hitEl.setAttribute('fill-rule', fillRule);
  } else {
    hitEl.removeAttribute('fill-rule');
  }

  const transform = sourcePathEl.getAttribute('transform');
  if (transform) {
    hitEl.setAttribute('transform', transform);
  } else {
    hitEl.removeAttribute('transform');
  }

  const clipPath = sourcePathEl.getAttribute('clip-path');
  if (clipPath) {
    hitEl.setAttribute('clip-path', clipPath);
  } else {
    hitEl.removeAttribute('clip-path');
  }
}

function resolvePaint(
  paint: PaintRef | undefined,
  layerId: string,
  role: 'fill' | 'stroke',
  defs: SVGDefsElement,
  tokens?: Record<string, string>,
): string {
  if (!paint) return 'none';
  switch (paint.mode) {
    case 'currentColor':
      return 'currentColor';
    case 'fixed':
      return paint.value;
    case 'token':
      return tokens?.[paint.token] ?? 'currentColor';
    case 'linearGradient': {
      const gradientId = buildGradientId(layerId, role);
      defs.appendChild(createLinearGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    case 'radialGradient': {
      const gradientId = buildGradientId(layerId, role);
      defs.appendChild(createRadialGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return 'none';
  }
}

function applyLayerStyle(
  el: SVGPathElement,
  layer: Layer,
  defs: SVGDefsElement,
  renderingMode: RenderingMode,
  tokens?: Record<string, string>,
  variableValue?: { opacity: number; visible: boolean },
): void {
  const baseStyle = resolveLayerStyleForRendering(layer, renderingMode, tokens);
  const s = variableValue ? applyVariableValue(baseStyle, variableValue) : baseStyle;

  // Auto-gradient: replace solid fills with a generated linear gradient
  if (s.autoGradient) {
    const fillColor = extractFixedColor(s.fill);
    if (fillColor) {
      const gradientId = `auto-gradient-${layer.id}-fill`;
      defs.appendChild(createAutoGradientDef(gradientId, fillColor));
      el.setAttribute('fill', `url(#${gradientId})`);
    } else {
      el.setAttribute('fill', resolvePaint(s.fill, layer.id, 'fill', defs, tokens));
    }

    const strokeColor = extractFixedColor(s.stroke);
    if (strokeColor) {
      const gradientId = `auto-gradient-${layer.id}-stroke`;
      defs.appendChild(createAutoGradientDef(gradientId, strokeColor));
      el.setAttribute('stroke', `url(#${gradientId})`);
    } else {
      el.setAttribute('stroke', resolvePaint(s.stroke, layer.id, 'stroke', defs, tokens));
    }
  } else {
    el.setAttribute('fill', resolvePaint(s.fill, layer.id, 'fill', defs, tokens));
    el.setAttribute(
      'stroke',
      resolvePaint(s.stroke, layer.id, 'stroke', defs, tokens),
    );
  }

  if (s.strokeWidth !== undefined) {
    el.setAttribute('stroke-width', String(s.strokeWidth));
  } else {
    el.removeAttribute('stroke-width');
  }

  if (s.fillOpacity !== undefined) {
    el.setAttribute('fill-opacity', String(s.fillOpacity));
  } else {
    el.removeAttribute('fill-opacity');
  }

  if (s.strokeOpacity !== undefined) {
    el.setAttribute('stroke-opacity', String(s.strokeOpacity));
  } else {
    el.removeAttribute('stroke-opacity');
  }

  if (s.lineCap) {
    el.setAttribute('stroke-linecap', s.lineCap);
  } else {
    el.removeAttribute('stroke-linecap');
  }

  if (s.lineJoin) {
    el.setAttribute('stroke-linejoin', s.lineJoin);
  } else {
    el.removeAttribute('stroke-linejoin');
  }
}

function applyTransform(el: SVGPathElement, layer: Layer): void {
  const t = layer.transform;
  if (!t) {
    el.removeAttribute('transform');
    return;
  }

  const parts: string[] = [];
  if (t.x !== undefined || t.y !== undefined) {
    parts.push(`translate(${t.x ?? 0}, ${t.y ?? 0})`);
  }
  if (t.rotate !== undefined) {
    parts.push(`rotate(${t.rotate})`);
  }
  if (t.scaleX !== undefined || t.scaleY !== undefined) {
    parts.push(`scale(${t.scaleX ?? 1}, ${t.scaleY ?? 1})`);
  }

  if (parts.length > 0) {
    el.setAttribute('transform', parts.join(' '));
  } else {
    el.removeAttribute('transform');
  }
}

function applyClipPath(
  el: SVGPathElement,
  layer: Layer,
  layerById: Map<string, Layer>,
  defs: SVGDefsElement,
): void {
  const maskLayerId = layer.clipPathLayerId;
  if (!maskLayerId) {
    el.removeAttribute('clip-path');
    return;
  }

  const maskLayer = layerById.get(maskLayerId);
  if (!isValidClipMaskLayer(maskLayer)) {
    el.removeAttribute('clip-path');
    return;
  }

  const clipPathId = buildClipPathId(layer.id);
  defs.appendChild(createClipPath(clipPathId, maskLayer));
  el.setAttribute('clip-path', `url(#${clipPathId})`);
}

function ensureManagedDefs(target: SVGSVGElement): SVGDefsElement {
  const existing = target.querySelector<SVGDefsElement>(
    `defs[${MANAGED_DEFS_ATTR}="${MANAGED_DEFS_VALUE}"]`,
  );
  if (existing) return existing;

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.setAttribute(MANAGED_DEFS_ATTR, MANAGED_DEFS_VALUE);
  target.insertBefore(defs, target.firstChild);
  return defs;
}

function buildGradientId(layerId: string, role: 'fill' | 'stroke'): string {
  return `gradient-${layerId}-${role}`;
}

function buildClipPathId(layerId: string): string {
  return `clip-${layerId}`;
}

function isValidClipMaskLayer(layer: Layer | undefined): layer is Layer & {
  path: { d: string; fillRule?: 'nonzero' | 'evenodd' };
} {
  return Boolean(layer && layer.visible !== false && layer.path?.d);
}

function createClipPath(id: string, maskLayer: Layer): SVGClipPathElement {
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  const pathEl = document.createElementNS(SVG_NS, 'path');

  clipPath.setAttribute('id', id);
  pathEl.setAttribute('d', maskLayer.path!.d);

  if (maskLayer.path?.fillRule) {
    pathEl.setAttribute('fill-rule', maskLayer.path.fillRule);
  }

  applyTransform(pathEl, maskLayer);
  clipPath.appendChild(pathEl);

  return clipPath;
}

function createLinearGradient(
  id: string,
  paint: Extract<PaintRef, { mode: 'linearGradient' }>,
): SVGLinearGradientElement {
  const gradient = document.createElementNS(SVG_NS, 'linearGradient');
  const [x1, y1, x2, y2] = getLinearGradientVector(paint.angle);

  gradient.setAttribute('id', id);
  gradient.setAttribute('x1', formatNumber(x1));
  gradient.setAttribute('y1', formatNumber(y1));
  gradient.setAttribute('x2', formatNumber(x2));
  gradient.setAttribute('y2', formatNumber(y2));
  appendGradientStops(gradient, paint.stops);

  return gradient;
}

function createRadialGradient(
  id: string,
  paint: Extract<PaintRef, { mode: 'radialGradient' }>,
): SVGRadialGradientElement {
  const gradient = document.createElementNS(SVG_NS, 'radialGradient');

  gradient.setAttribute('id', id);
  gradient.setAttribute('cx', formatNumber(paint.cx));
  gradient.setAttribute('cy', formatNumber(paint.cy));
  gradient.setAttribute('r', formatNumber(paint.r));
  appendGradientStops(gradient, paint.stops);

  return gradient;
}

function appendGradientStops(
  gradient: SVGLinearGradientElement | SVGRadialGradientElement,
  stops: Array<{ offset: number; color: string; opacity?: number }>,
): void {
  for (const stop of stops) {
    const stopEl = document.createElementNS(SVG_NS, 'stop');
    stopEl.setAttribute('offset', formatNumber(stop.offset));
    stopEl.setAttribute('stop-color', stop.color);
    if (stop.opacity !== undefined) {
      stopEl.setAttribute('stop-opacity', formatNumber(stop.opacity));
    }
    gradient.appendChild(stopEl);
  }
}

function getLinearGradientVector(
  angle: number,
): [number, number, number, number] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scale = 0.5 / Math.max(Math.abs(cos), Math.abs(sin), 1e-6);

  return [
    0.5 - cos * scale,
    0.5 - sin * scale,
    0.5 + cos * scale,
    0.5 + sin * scale,
  ];
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Extract a fixed hex color from a PaintRef, returning undefined if the
 * paint is not a simple fixed color.
 */
function extractFixedColor(paint: PaintRef | undefined): string | undefined {
  if (!paint) return undefined;
  if (paint.mode === 'fixed' && paint.value !== 'none') return paint.value;
  return undefined;
}

/**
 * Create a `<linearGradient>` SVG def from a fixed color using the
 * auto-gradient algorithm (lighter → original → darker, top-to-bottom).
 */
function createAutoGradientDef(
  id: string,
  sourceColor: string,
): SVGLinearGradientElement {
  const stops = generateAutoGradient(sourceColor);
  const [x1, y1, x2, y2] = getLinearGradientVector(180); // top-to-bottom
  const gradient = document.createElementNS(SVG_NS, 'linearGradient');

  gradient.setAttribute('id', id);
  gradient.setAttribute('x1', formatNumber(x1));
  gradient.setAttribute('y1', formatNumber(y1));
  gradient.setAttribute('x2', formatNumber(x2));
  gradient.setAttribute('y2', formatNumber(y2));
  appendGradientStops(gradient, stops);

  return gradient;
}

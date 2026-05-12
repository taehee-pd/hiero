import type {
  AnimatedValue,
  InterpolatedValues,
  ResolvedTransition,
} from '@/lib/runtime-core';
import type { Layer, LayerSnapshot, PaintRef, RenderingMode } from '@/lib/schema/types';
import { resolveLayerStyleForRendering } from '@/lib/rendering/resolve-layer-style';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_DEFS_ATTR = 'data-managed-by';
const PREVIEW_DEFS_VALUE = 'transition-preview';

export type ApplyTransitionPreviewInput = {
  baseState: LayerSnapshot;
  targetState?: LayerSnapshot | null;
  progress: number;
  resolvedTransition: ResolvedTransition;
  interpolatedValues: InterpolatedValues;
  renderingMode: RenderingMode;
  tokens?: Record<string, string>;
};

export function applyTransitionPreview(
  target: SVGSVGElement,
  input: ApplyTransitionPreviewInput,
): void {
  clearTransitionPreview(target, input.baseState);

  const previewDefs = ensurePreviewDefs(target);
  previewDefs.replaceChildren();
  const targetLayerById = new Map(
    Object.values(input.targetState?.layers ?? {}).map((layer) => [layer.id, layer]),
  );

  for (const [layerId, values] of Object.entries(input.interpolatedValues)) {
    const baseEntry = getBaseElements(target, layerId);
    if (baseEntry.path) {
      applyAnimatedValues(baseEntry.path, values);
    }
  }

  input.resolvedTransition.layerBindings.forEach((binding, index) => {
    const sourceId = binding.fromLayer?.id;
    const targetId = binding.toLayer?.id;

    if (sourceId && binding.morph) {
      const baseEntry = getBaseElements(target, sourceId);
      if (baseEntry.path) {
        const d = binding.morph(input.progress);
        baseEntry.path.setAttribute('d', d);
        if (baseEntry.hitPath) {
          baseEntry.hitPath.setAttribute('d', d);
        }
      }
    }

    // All four fallback modes (fade-through, scale-through, slide-through,
    // replace-with-delay) render the target as a fading overlay and fade
    // the source out. Without this branch covering every mode, target-only
    // bindings — which the resolver assigns `replace-with-delay` whenever a
    // cross-icon transition has more target layers than source layers —
    // never reach the canvas at all (e.g. Star→Home dropping the `house`
    // outline because Star's only layer pairs with Home's `roof`).
    if (binding.fallback) {
      if (sourceId) {
        const baseEntry = getBaseElements(target, sourceId);
        if (baseEntry.path) {
          baseEntry.path.style.opacity = String(1 - clamp01(input.progress));
        }
      }

      if (binding.toLayer?.path?.d) {
        const overlay = createPreviewPath(
          target.ownerDocument,
          binding.toLayer,
          previewDefs,
          input.renderingMode,
          input.tokens,
          `${index}-${binding.toLayer.id}`,
          targetLayerById,
        );
        overlay.setAttribute('data-preview-layer-id', binding.toLayer.id);
        overlay.setAttribute('data-transition-role', 'to');
        overlay.style.opacity = String(clamp01(input.progress));

        const targetValues = targetId ? input.interpolatedValues[targetId] : undefined;
        if (targetValues) {
          applyAnimatedValues(overlay, targetValues);
        }
        target.appendChild(overlay);
      }
    }
  });

  if (previewDefs.childNodes.length === 0) {
    previewDefs.remove();
  }
}

export function clearTransitionPreview(target: SVGSVGElement, baseState: LayerSnapshot): void {
  target.querySelectorAll<SVGPathElement>('path[data-preview-layer-id]').forEach((element) => {
    element.remove();
  });
  target
    .querySelectorAll<SVGDefsElement>(`defs[${PREVIEW_DEFS_ATTR}="${PREVIEW_DEFS_VALUE}"]`)
    .forEach((element) => element.remove());

  for (const layer of Object.values(baseState.layers)) {
    if (!layer.path?.d || layer.isClipMask) continue;
    const baseEntry = getBaseElements(target, layer.id);
    if (baseEntry.path) {
      baseEntry.path.setAttribute('d', layer.path.d);
      clearAnimatedValues(baseEntry.path);
    }
    if (baseEntry.hitPath) {
      baseEntry.hitPath.setAttribute('d', layer.path.d);
    }
  }
}

function getBaseElements(target: SVGSVGElement, layerId: string) {
  return {
    path: target.querySelector<SVGPathElement>(`path[data-layer-id="${CSS.escape(layerId)}"]`),
    hitPath: target.querySelector<SVGPathElement>(
      `path[data-layer-hit-id="${CSS.escape(layerId)}"]`,
    ),
  };
}

function applyAnimatedValues(element: SVGPathElement, values: Record<string, AnimatedValue>) {
  if (values.opacity !== undefined) {
    element.style.opacity = String(clamp01(asNumber(values.opacity)));
  }

  if (values.fill !== undefined && typeof values.fill === 'string') {
    element.setAttribute('fill', values.fill);
  }

  if (values.stroke !== undefined && typeof values.stroke === 'string') {
    element.setAttribute('stroke', values.stroke);
  }

  const transform = buildAnimatedTransform(values);
  if (transform) {
    element.style.transform = transform;
    element.style.transformBox = 'fill-box';
    element.style.transformOrigin = 'center';
  } else {
    element.style.removeProperty('transform');
    element.style.removeProperty('transform-box');
    element.style.removeProperty('transform-origin');
  }

  if (values.pathLength !== undefined) {
    const normalized = clamp01(asNumber(values.pathLength));
    const pathLength = Math.max(element.getAttribute('d')?.length ?? 1, 1);
    element.style.strokeDasharray = String(pathLength);
    element.style.strokeDashoffset = String(pathLength * (1 - normalized));
  } else {
    element.style.removeProperty('stroke-dasharray');
    element.style.removeProperty('stroke-dashoffset');
  }
}

function clearAnimatedValues(element: SVGPathElement) {
  element.style.removeProperty('opacity');
  element.style.removeProperty('transform');
  element.style.removeProperty('transform-box');
  element.style.removeProperty('transform-origin');
  element.style.removeProperty('stroke-dasharray');
  element.style.removeProperty('stroke-dashoffset');
}

function buildAnimatedTransform(values: Record<string, AnimatedValue>): string {
  const parts: string[] = [];
  if (values.translateX !== undefined || values.translateY !== undefined) {
    parts.push(`translate(${asNumber(values.translateX)}px, ${asNumber(values.translateY)}px)`);
  }
  if (values.rotate !== undefined) {
    parts.push(`rotate(${asNumber(values.rotate)}deg)`);
  }
  if (values.scale !== undefined) {
    parts.push(`scale(${asNumber(values.scale)})`);
  }
  return parts.join(' ');
}

function asNumber(value: AnimatedValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function createPreviewPath(
  doc: Document,
  layer: Layer,
  defs: SVGDefsElement,
  renderingMode: RenderingMode,
  tokens: Record<string, string> | undefined,
  assetKey: string,
  layerById: Map<string, Layer>,
): SVGPathElement {
  const pathEl = doc.createElementNS(SVG_NS, 'path');
  pathEl.setAttribute('d', layer.path!.d);
  pathEl.setAttribute('data-layer-id', layer.id);

  if (layer.path?.fillRule) {
    pathEl.setAttribute('fill-rule', layer.path.fillRule);
  }

  applyLayerStyle(pathEl, layer, defs, renderingMode, tokens, assetKey);
  applyTransform(pathEl, layer);
  applyClipPath(pathEl, layer, layerById, defs, assetKey);
  return pathEl;
}

function applyLayerStyle(
  el: SVGPathElement,
  layer: Layer,
  defs: SVGDefsElement,
  renderingMode: RenderingMode,
  tokens?: Record<string, string>,
  assetKey = layer.id,
): void {
  const s = resolveLayerStyleForRendering(layer, renderingMode, tokens);
  el.setAttribute('fill', resolvePaint(s.fill, assetKey, 'fill', defs, tokens));
  el.setAttribute('stroke', resolvePaint(s.stroke, assetKey, 'stroke', defs, tokens));

  if (s.strokeWidth !== undefined) {
    el.setAttribute('stroke-width', String(s.strokeWidth));
  }
  if (s.fillOpacity !== undefined) {
    el.setAttribute('fill-opacity', String(s.fillOpacity));
  }
  if (s.strokeOpacity !== undefined) {
    el.setAttribute('stroke-opacity', String(s.strokeOpacity));
  }
  if (s.lineCap) {
    el.setAttribute('stroke-linecap', s.lineCap);
  }
  if (s.lineJoin) {
    el.setAttribute('stroke-linejoin', s.lineJoin);
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
      const gradientId = `preview-gradient-${layerId}-${role}`;
      defs.appendChild(createLinearGradient(defs.ownerDocument, gradientId, paint));
      return `url(#${gradientId})`;
    }
    case 'radialGradient': {
      const gradientId = `preview-gradient-${layerId}-${role}`;
      defs.appendChild(createRadialGradient(defs.ownerDocument, gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return 'none';
  }
}

function applyTransform(el: SVGPathElement, layer: Layer): void {
  const t = layer.transform;
  if (!t) return;

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
  }
}

function applyClipPath(
  el: SVGPathElement,
  layer: Layer,
  layerById: Map<string, Layer>,
  defs: SVGDefsElement,
  clipKey: string,
): void {
  if (!layer.clipPathLayerId) {
    return;
  }

  const maskLayer = layerById.get(layer.clipPathLayerId);
  if (!maskLayer?.path?.d) {
    return;
  }

  const clipPathId = `preview-clip-${clipKey}`;
  defs.appendChild(createClipPath(defs.ownerDocument, clipPathId, maskLayer));
  el.setAttribute('clip-path', `url(#${clipPathId})`);
}

function ensurePreviewDefs(target: SVGSVGElement): SVGDefsElement {
  const existing = target.querySelector<SVGDefsElement>(
    `defs[${PREVIEW_DEFS_ATTR}="${PREVIEW_DEFS_VALUE}"]`,
  );
  if (existing) {
    return existing;
  }

  const defs = target.ownerDocument.createElementNS(SVG_NS, 'defs');
  defs.setAttribute(PREVIEW_DEFS_ATTR, PREVIEW_DEFS_VALUE);
  target.insertBefore(defs, target.firstChild);
  return defs;
}

function createClipPath(doc: Document, id: string, maskLayer: Layer): SVGClipPathElement {
  const clipPath = doc.createElementNS(SVG_NS, 'clipPath');
  const pathEl = doc.createElementNS(SVG_NS, 'path');

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
  doc: Document,
  id: string,
  paint: Extract<PaintRef, { mode: 'linearGradient' }>,
): SVGLinearGradientElement {
  const gradient = doc.createElementNS(SVG_NS, 'linearGradient');
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
  doc: Document,
  id: string,
  paint: Extract<PaintRef, { mode: 'radialGradient' }>,
): SVGRadialGradientElement {
  const gradient = doc.createElementNS(SVG_NS, 'radialGradient');
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
) {
  for (const stop of stops) {
    const stopEl = gradient.ownerDocument.createElementNS(SVG_NS, 'stop');
    stopEl.setAttribute('offset', formatNumber(stop.offset));
    stopEl.setAttribute('stop-color', stop.color);
    if (stop.opacity !== undefined) {
      stopEl.setAttribute('stop-opacity', formatNumber(stop.opacity));
    }
    gradient.appendChild(stopEl);
  }
}

function getLinearGradientVector(angle: number): [number, number, number, number] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scale = 0.5 / Math.max(Math.abs(cos), Math.abs(sin), 1e-6);
  return [0.5 - cos * scale, 0.5 - sin * scale, 0.5 + cos * scale, 0.5 + sin * scale];
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

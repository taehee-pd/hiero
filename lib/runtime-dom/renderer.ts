import type { Icon, Layer, PaintRef, Variant } from '../schema';
import type { InterpolatedValues, ResolvedTransition } from '../runtime-core';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MANAGED_DEFS_ATTR = 'data-managed-by';
const MANAGED_DEFS_VALUE = 'runtime-dom';

type LayerRenderEntry = {
  element: SVGPathElement;
  layer: Layer;
  baseTransform: string;
  pathLength: number;
};

export class DomRenderer {
  private readonly container: HTMLElement;
  private readonly icon: Icon;
  private readonly doc: Document;
  private svg: SVGSVGElement | null = null;
  private variant: Variant | null = null;
  private renderedStateId: string | null = null;
  private layerElements = new Map<string, LayerRenderEntry>();
  private transitionLayerElements = new Map<string, LayerRenderEntry>();
  private activeTransitionStateId: string | null = null;

  constructor(container: HTMLElement, icon: Icon) {
    this.container = container;
    this.icon = icon;
    this.doc = resolveDocument(container);
  }

  mount(variantId: string, renderSize?: number): void {
    const variant = this.icon.variants[variantId];
    if (!variant) {
      throw new Error(`Variant "${variantId}" does not exist in icon "${this.icon.id}".`);
    }

    this.unmount();

    const svg = this.doc.createElementNS(SVG_NS, 'svg');
    const [vx, vy, vw, vh] = variant.viewBox;
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    const resolvedSize = renderSize ?? variant.size;
    svg.setAttribute('width', String(resolvedSize));
    svg.setAttribute('height', String(resolvedSize));
    svg.setAttribute('fill', 'none');

    this.container.appendChild(svg);
    this.svg = svg;
    this.variant = variant;
    this.setState(variant.defaultState);
  }

  applyFrame(
    stateId: string,
    progress: number,
    interpolatedValues: InterpolatedValues,
    transition?: ResolvedTransition,
  ): void {
    this.ensureMounted();
    const hasTransitionVisuals = hasVisualTransitionBindings(transition);

    if (
      this.renderedStateId !== stateId &&
      !hasTransitionVisuals &&
      (Object.keys(interpolatedValues).length === 0 || !this.hasRenderedLayerValues(interpolatedValues))
    ) {
      this.setState(stateId);
    }

    if (transition && hasTransitionVisuals) {
      this.ensureTransitionElements(stateId, transition);
      this.applyMorphBindings(progress, transition);
    } else {
      this.clearTransitionElements();
    }

    for (const [layerId, values] of Object.entries(interpolatedValues)) {
      const entry = this.layerElements.get(layerId);
      if (!entry) {
        continue;
      }

      applyAnimatedValues(entry, values);
    }

    if (transition && hasTransitionVisuals) {
      this.applyCrossfadeBindings(progress, transition);
    }
  }

  setState(stateId: string): void {
    this.ensureMounted();

    const state = this.variant!.states[stateId];
    if (!state) {
      throw new Error(`State "${stateId}" does not exist in variant "${this.variant!.id}".`);
    }

    const svg = this.svg!;
    const defs = ensureManagedDefs(svg);
    defs.replaceChildren();
    this.clearTransitionElements();

    for (const entry of this.layerElements.values()) {
      entry.element.remove();
    }
    this.layerElements.clear();

    const layers = getRenderableLayers(state.layers);
    const layerById = new Map(layers.map((layer) => [layer.id, layer]));

    for (const layer of layers) {
      const pathEl = createLayerElement(
        this.doc,
        layer,
        defs,
        layerById,
        layer.id,
      );
      svg.appendChild(pathEl);
      this.layerElements.set(layer.id, {
        element: pathEl,
        layer,
        baseTransform: buildAttributeTransform(layer),
        pathLength: getPathLength(pathEl),
      });
    }

    if (defs.childNodes.length === 0) {
      defs.remove();
    }

    this.renderedStateId = stateId;
  }

  unmount(): void {
    this.clearTransitionElements();
    if (this.svg) {
      this.svg.remove();
    }
    this.svg = null;
    this.variant = null;
    this.renderedStateId = null;
    this.layerElements.clear();
  }

  private ensureMounted(): void {
    if (!this.svg || !this.variant) {
      throw new Error('DomRenderer must be mounted before rendering.');
    }
  }

  private hasRenderedLayerValues(interpolatedValues: InterpolatedValues): boolean {
    return Object.keys(interpolatedValues).some((layerId) => this.layerElements.has(layerId));
  }

  private ensureTransitionElements(stateId: string, transition: ResolvedTransition) {
    if (!this.svg || !this.variant) {
      return;
    }

    if (this.activeTransitionStateId !== stateId) {
      this.clearTransitionElements();
      this.activeTransitionStateId = stateId;
    }

    const defs = ensureManagedDefs(this.svg);
    const targetState = this.variant.states[stateId];
    const targetLayers = getRenderableLayers(targetState?.layers ?? {});
    const targetLayerById = new Map(targetLayers.map((layer) => [layer.id, layer]));

    transition.layerBindings.forEach((binding, index) => {
      if (binding.fallback !== 'crossfade' || !binding.toLayer?.path?.d) {
        return;
      }

      const key = buildTransitionBindingKey(binding, index);
      if (this.transitionLayerElements.has(key)) {
        return;
      }

      const pathEl = createLayerElement(
        this.doc,
        binding.toLayer,
        defs,
        targetLayerById,
        `${key}-${binding.toLayer.id}`,
      );
      pathEl.setAttribute('data-transition-role', 'to');
      pathEl.style.opacity = '0';

      this.svg!.appendChild(pathEl);
      this.transitionLayerElements.set(key, {
        element: pathEl,
        layer: binding.toLayer,
        baseTransform: buildAttributeTransform(binding.toLayer),
        pathLength: getPathLength(pathEl),
      });
    });
  }

  private applyMorphBindings(progress: number, transition: ResolvedTransition) {
    for (const binding of transition.layerBindings) {
      if (!binding.morph) {
        continue;
      }

      const sourceId = binding.fromLayer?.id ?? binding.toLayer?.id;
      if (!sourceId) {
        continue;
      }

      const entry = this.layerElements.get(sourceId);
      if (!entry) {
        continue;
      }

      entry.element.setAttribute('d', binding.morph(progress));
      entry.pathLength = getPathLength(entry.element);
    }
  }

  private applyCrossfadeBindings(progress: number, transition: ResolvedTransition) {
    transition.layerBindings.forEach((binding, index) => {
      if (binding.fallback !== 'crossfade') {
        return;
      }

      const sourceId = binding.fromLayer?.id;
      if (sourceId) {
        const entry = this.layerElements.get(sourceId);
        if (entry) {
          entry.element.style.opacity = String(1 - clamp01(progress));
        }
      }

      const targetEntry = this.transitionLayerElements.get(buildTransitionBindingKey(binding, index));
      if (targetEntry) {
        targetEntry.element.style.opacity = String(clamp01(progress));
      }
    });
  }

  private clearTransitionElements() {
    for (const entry of this.transitionLayerElements.values()) {
      entry.element.remove();
    }
    this.transitionLayerElements.clear();
    this.activeTransitionStateId = null;
  }
}

function getRenderableLayers(layers: Record<string, Layer>): Layer[] {
  return Object.keys(layers)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => layers[id]!)
    .filter((layer) => layer.visible !== false && !!layer.path?.d && !layer.isClipMask);
}

function applyLayerGeometry(el: SVGPathElement, layer: Layer): void {
  el.setAttribute('d', layer.path!.d);
  if (layer.path?.fillRule) {
    el.setAttribute('fill-rule', layer.path.fillRule);
  } else {
    el.removeAttribute('fill-rule');
  }
}

function applyLayerStyle(
  el: SVGPathElement,
  layer: Layer,
  defs: SVGDefsElement,
  paintKey = layer.id,
): void {
  const s = layer.style;
  el.setAttribute('fill', resolvePaint(s.fill, paintKey, 'fill', defs));
  el.setAttribute('stroke', resolvePaint(s.stroke, paintKey, 'stroke', defs));

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

function applyTransformAttribute(el: SVGPathElement, layer: Layer): void {
  const transform = buildAttributeTransform(layer);
  if (transform) {
    el.setAttribute('transform', transform);
  } else {
    el.removeAttribute('transform');
  }
}

function resolvePaint(
  paint: PaintRef | undefined,
  layerId: string,
  role: 'fill' | 'stroke',
  defs: SVGDefsElement,
): string {
  if (!paint) return 'none';

  switch (paint.mode) {
    case 'currentColor':
      return 'currentColor';
    case 'fixed':
      return paint.value;
    case 'token':
      return 'currentColor';
    case 'linearGradient': {
      const gradientId = buildGradientId(layerId, role);
      defs.appendChild(createLinearGradient(defs.ownerDocument, gradientId, paint));
      return `url(#${gradientId})`;
    }
    case 'radialGradient': {
      const gradientId = buildGradientId(layerId, role);
      defs.appendChild(createRadialGradient(defs.ownerDocument, gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return 'none';
  }
}

function applyClipPath(
  el: SVGPathElement,
  layer: Layer,
  layerById: Map<string, Layer>,
  defs: SVGDefsElement,
  clipKey = layer.id,
): void {
  if (!layer.clipPathLayerId) {
    el.removeAttribute('clip-path');
    return;
  }

  const maskLayer = layerById.get(layer.clipPathLayerId);
  if (!isValidClipMaskLayer(maskLayer)) {
    el.removeAttribute('clip-path');
    return;
  }

  const clipPathId = buildClipPathId(clipKey);
  defs.appendChild(createClipPath(defs.ownerDocument, clipPathId, maskLayer));
  el.setAttribute('clip-path', `url(#${clipPathId})`);
}

function createLayerElement(
  doc: Document,
  layer: Layer,
  defs: SVGDefsElement,
  layerById: Map<string, Layer>,
  assetKey: string,
): SVGPathElement {
  const pathEl = doc.createElementNS(SVG_NS, 'path');
  pathEl.setAttribute('data-layer-id', layer.id);
  applyLayerGeometry(pathEl, layer);
  applyLayerStyle(pathEl, layer, defs, assetKey);
  applyTransformAttribute(pathEl, layer);
  applyClipPath(pathEl, layer, layerById, defs, assetKey);
  return pathEl;
}

function applyAnimatedValues(entry: LayerRenderEntry, values: Record<string, number>) {
  if (values.opacity !== undefined) {
    entry.element.style.opacity = String(values.opacity);
  }

  const transform = buildAnimatedTransform(entry.baseTransform, values);
  if (transform) {
    entry.element.style.transform = transform;
    entry.element.style.transformBox = 'fill-box';
    entry.element.style.transformOrigin = 'center';
  } else {
    entry.element.style.removeProperty('transform');
    entry.element.style.removeProperty('transform-box');
    entry.element.style.removeProperty('transform-origin');
  }

  if (values.pathLength !== undefined) {
    const normalized = clamp01(values.pathLength);
    const pathLength = entry.pathLength;
    entry.element.style.strokeDasharray = String(pathLength);
    entry.element.style.strokeDashoffset = String(pathLength * (1 - normalized));
  } else {
    entry.element.style.removeProperty('stroke-dasharray');
    entry.element.style.removeProperty('stroke-dashoffset');
  }
}

function hasVisualTransitionBindings(transition: ResolvedTransition | undefined): boolean {
  return Boolean(
    transition?.layerBindings.some((binding) => binding.morph || binding.fallback === 'crossfade'),
  );
}

function buildTransitionBindingKey(
  binding: ResolvedTransition['layerBindings'][number],
  index: number,
) {
  return `transition-${index}-${binding.fromLayer?.id ?? 'none'}-${binding.toLayer?.id ?? 'none'}`;
}

function ensureManagedDefs(target: SVGSVGElement): SVGDefsElement {
  const existing = target.querySelector<SVGDefsElement>(
    `defs[${MANAGED_DEFS_ATTR}="${MANAGED_DEFS_VALUE}"]`,
  );
  if (existing) {
    return existing;
  }

  const defs = target.ownerDocument.createElementNS(SVG_NS, 'defs');
  defs.setAttribute(MANAGED_DEFS_ATTR, MANAGED_DEFS_VALUE);
  target.insertBefore(defs, target.firstChild);
  return defs;
}

function buildAttributeTransform(layer: Layer): string {
  const t = layer.transform;
  if (!t) return '';

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
  return parts.join(' ');
}

function buildAnimatedTransform(
  baseTransform: string,
  values: Record<string, number>,
): string {
  const parts: string[] = [];
  if (baseTransform) {
    parts.push(baseTransform);
  }

  if (values.translateX !== undefined || values.translateY !== undefined) {
    parts.push(`translate(${values.translateX ?? 0}px, ${values.translateY ?? 0}px)`);
  }
  if (values.rotate !== undefined) {
    parts.push(`rotate(${values.rotate}deg)`);
  }
  if (values.scale !== undefined) {
    parts.push(`scale(${values.scale})`);
  }

  return parts.join(' ');
}

function getPathLength(pathEl: SVGPathElement): number {
  if (typeof pathEl.getTotalLength === 'function') {
    try {
      const length = pathEl.getTotalLength();
      if (Number.isFinite(length) && length > 0) {
        return length;
      }
    } catch {
      // Fall through to deterministic fallback.
    }
  }

  const d = pathEl.getAttribute('d') ?? '';
  return Math.max(d.length, 1);
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

function createClipPath(
  doc: Document,
  id: string,
  maskLayer: Layer,
): SVGClipPathElement {
  const clipPath = doc.createElementNS(SVG_NS, 'clipPath');
  const pathEl = doc.createElementNS(SVG_NS, 'path');

  clipPath.setAttribute('id', id);
  pathEl.setAttribute('d', maskLayer.path!.d);

  if (maskLayer.path?.fillRule) {
    pathEl.setAttribute('fill-rule', maskLayer.path.fillRule);
  }

  applyTransformAttribute(pathEl, maskLayer);
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
): void {
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

function resolveDocument(container: HTMLElement): Document {
  if (container.ownerDocument) {
    return container.ownerDocument;
  }
  return resolveGlobalDocument();
}

function resolveGlobalDocument(): Document {
  if (typeof document !== 'undefined') {
    return document;
  }
  throw new Error('DomRenderer requires a Document implementation.');
}

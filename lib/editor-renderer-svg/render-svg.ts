import type { Icon, Layer, PaintRef, RenderingMode } from '@/lib/schema/types';

export type RenderSvgInput = {
  icon: Icon;
  variantId: string;
  stateId: string;
  renderingMode?: RenderingMode;
  tokens?: Record<string, string>;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Imperatively render icon geometry into an existing SVG element.
 * Handles create/update/remove of child `<path>` elements.
 */
export function renderSvg(input: RenderSvgInput, target: SVGSVGElement): void {
  const { icon, variantId, stateId, tokens } = input;
  const variant = icon.variants[variantId];
  const state = icon.states[stateId];
  if (!variant || !state) return;

  // Set viewBox
  const [vx, vy, vw, vh] = variant.viewBox;
  target.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);

  // Collect existing path elements keyed by data-layer-id
  const existing = new Map<string, SVGPathElement>();
  target.querySelectorAll<SVGPathElement>('path[data-layer-id]').forEach(
    (el) => {
      const id = el.getAttribute('data-layer-id');
      if (id) existing.set(id, el);
    },
  );

  const layers = Object.values(state.layers);
  const rendered = new Set<string>();

  for (const layer of layers) {
    rendered.add(layer.id);

    if (layer.visible === false || !layer.path?.d) {
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
    }

    // Styles
    applyLayerStyle(pathEl, layer, tokens);

    // Transform
    applyTransform(pathEl, layer);
  }

  // Remove stale elements
  existing.forEach((el, id) => {
    if (!rendered.has(id)) el.remove();
  });
}

function resolvePaint(
  paint: PaintRef | undefined,
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
    default:
      return 'none';
  }
}

function applyLayerStyle(
  el: SVGPathElement,
  layer: Layer,
  tokens?: Record<string, string>,
): void {
  const s = layer.style;
  el.setAttribute('fill', resolvePaint(s.fill, tokens));
  el.setAttribute('stroke', resolvePaint(s.stroke, tokens));

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
  }
  if (s.lineJoin) {
    el.setAttribute('stroke-linejoin', s.lineJoin);
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

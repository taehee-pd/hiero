import type { Icon, Layer, PaintRef, RenderingMode } from '@/lib/schema/types';
import { getVariantType } from '@/lib/schema/types';
import {
  applyVariableValue,
  resolveLayerStyleForRendering,
  resolveVariantRenderingMode,
} from '@/lib/rendering/resolve-layer-style';
import { computeVariableValue } from '@/lib/runtime-core/variable-value';

/**
 * Generate a clean SVG string for export.
 * Strips all editor metadata (guides, selection, data-layer-id).
 * Output is deterministic — same input always produces same output.
 */
export function exportSvgString(
  icon: Icon,
  variantId: string,
  stateId: string,
  tokens?: Record<string, string>,
  renderingMode?: RenderingMode,
): string {
  const variant = icon.variants[variantId];
  if (!variant) return '';
  const state = getVariantType(variant, stateId);
  const effectiveRenderingMode = resolveVariantRenderingMode(
    renderingMode ?? variant.renderingMode,
  );

  const [vx, vy, vw, vh] = variant.viewBox;
  const lines: string[] = [];
  const pathLines: string[] = [];
  const defs = new Map<string, string>();

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${variant.size}" height="${variant.size}" fill="none">`,
  );

  const layers = Object.keys(state.layers)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => state.layers[id]!);
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const variableValues = computeVariableValue(state.layers, variant.variableValue ?? 1);
  for (const layer of layers) {
    if (layer.visible === false || !layer.path?.d || layer.isClipMask) continue;

    const attrs: string[] = [];
    attrs.push(`id="${escapeAttr(layer.id)}"`);
    attrs.push(`d="${escapeAttr(layer.path.d)}"`);

    if (layer.path.fillRule) {
      attrs.push(`fill-rule="${layer.path.fillRule}"`);
    }

    const baseStyle = resolveLayerStyleForRendering(
      layer,
      effectiveRenderingMode,
      tokens,
    );
    const resolvedStyle = applyVariableValue(
      baseStyle,
      variableValues[layer.id] ?? { opacity: 1, visible: true },
    );

    // Fill
    const fill = resolvePaint(resolvedStyle.fill, layer.id, 'fill', defs, tokens);
    if (fill !== 'none') {
      attrs.push(`fill="${escapeAttr(fill)}"`);
    }

    // Stroke
    const stroke = resolvePaint(
      resolvedStyle.stroke,
      layer.id,
      'stroke',
      defs,
      tokens,
    );
    if (stroke !== 'none') {
      attrs.push(`stroke="${escapeAttr(stroke)}"`);
    }

    if (resolvedStyle.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${resolvedStyle.strokeWidth}"`);
    }
    if (resolvedStyle.fillOpacity !== undefined) {
      attrs.push(`fill-opacity="${resolvedStyle.fillOpacity}"`);
    }
    if (resolvedStyle.strokeOpacity !== undefined) {
      attrs.push(`stroke-opacity="${resolvedStyle.strokeOpacity}"`);
    }
    if (resolvedStyle.lineCap) {
      attrs.push(`stroke-linecap="${resolvedStyle.lineCap}"`);
    }
    if (resolvedStyle.lineJoin) {
      attrs.push(`stroke-linejoin="${resolvedStyle.lineJoin}"`);
    }

    // Transform
    const transform = buildTransform(layer);
    if (transform) {
      attrs.push(`transform="${escapeAttr(transform)}"`);
    }

    const clipPath = resolveClipPath(layer, layerById, defs);
    if (clipPath) {
      attrs.push(`clip-path="${escapeAttr(clipPath)}"`);
    }

    pathLines.push(`  <path ${attrs.join(' ')}/>`);
  }

  if (defs.size > 0) {
    lines.push('  <defs>');
    for (const definition of defs.values()) {
      lines.push(`    ${definition}`);
    }
    lines.push('  </defs>');
  }

  lines.push(...pathLines);
  lines.push('</svg>');
  return lines.join('\n');
}

function resolvePaint(
  paint: PaintRef | undefined,
  layerId: string,
  role: 'fill' | 'stroke',
  defs: Map<string, string>,
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
      defs.set(gradientId, serializeLinearGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    case 'radialGradient': {
      const gradientId = buildGradientId(layerId, role);
      defs.set(gradientId, serializeRadialGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return 'none';
  }
}

function buildTransform(layer: Layer): string | null {
  const t = layer.transform;
  if (!t) return null;
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
  return parts.length > 0 ? parts.join(' ') : null;
}

function resolveClipPath(
  layer: Layer,
  layerById: Map<string, Layer>,
  defs: Map<string, string>,
): string | null {
  const maskLayerId = layer.clipPathLayerId;
  if (!maskLayerId) return null;

  const maskLayer = layerById.get(maskLayerId);
  if (!isValidClipMaskLayer(maskLayer)) return null;

  const clipPathId = buildClipPathId(layer.id);
  defs.set(clipPathId, serializeClipPath(clipPathId, maskLayer));
  return `url(#${clipPathId})`;
}

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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

function serializeClipPath(id: string, maskLayer: Layer): string {
  const attrs = [
    `d="${escapeAttr(maskLayer.path!.d)}"`,
  ];
  if (maskLayer.path?.fillRule) {
    attrs.push(`fill-rule="${maskLayer.path.fillRule}"`);
  }
  const transform = buildTransform(maskLayer);
  if (transform) {
    attrs.push(`transform="${escapeAttr(transform)}"`);
  }

  return `<clipPath id="${escapeAttr(id)}"><path ${attrs.join(
    ' ',
  )}/></clipPath>`;
}

function serializeLinearGradient(
  id: string,
  paint: Extract<PaintRef, { mode: 'linearGradient' }>,
): string {
  const [x1, y1, x2, y2] = getLinearGradientVector(paint.angle);

  return `<linearGradient id="${escapeAttr(id)}" x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}">${serializeGradientStops(
    paint.stops,
  )}</linearGradient>`;
}

function serializeRadialGradient(
  id: string,
  paint: Extract<PaintRef, { mode: 'radialGradient' }>,
): string {
  return `<radialGradient id="${escapeAttr(id)}" cx="${formatNumber(
    paint.cx,
  )}" cy="${formatNumber(paint.cy)}" r="${formatNumber(
    paint.r,
  )}">${serializeGradientStops(paint.stops)}</radialGradient>`;
}

function serializeGradientStops(
  stops: Array<{ offset: number; color: string; opacity?: number }>,
): string {
  return stops
    .map((stop) => {
      const attrs = [
        `offset="${formatNumber(stop.offset)}"`,
        `stop-color="${escapeAttr(stop.color)}"`,
      ];
      if (stop.opacity !== undefined) {
        attrs.push(`stop-opacity="${formatNumber(stop.opacity)}"`);
      }
      return `<stop ${attrs.join(' ')}/>`;
    })
    .join('');
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

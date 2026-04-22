/**
 * Pure-function SVG string serializer.
 *
 * Used by the RSC path (`HieroIconServer`) to emit static SVG on the
 * server with zero DOM dependency. The interactive client path in
 * `lib/runtime-dom/renderer.ts` uses `createElementNS`; this module is
 * the equivalent for Node / React Server Components.
 *
 * Only handles the static first-paint case. Gradients, transitions,
 * effects, and draw animation are not supported here — callers that
 * need those features must use the client path.
 */

import type { Icon, Layer, Variant, PaintRef } from '../schema';
import {
  getVariantDefaultTypeId,
  getVariantType,
} from '../schema/types';

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return ch;
    }
  });
}

function resolvePaintForString(paint: PaintRef | undefined): string {
  if (!paint) return 'none';
  if (paint.mode === 'currentColor') return 'currentColor';
  if (paint.mode === 'fixed') return paint.value;
  if (paint.mode === 'token') {
    const fallback = paint.fallback ?? 'currentColor';
    return `var(--${paint.token}, ${fallback})`;
  }
  return 'none';
}

function serializeLayer(layer: Layer): string {
  if (!layer.path?.d) return '';
  if (layer.visible === false) return '';
  if (layer.isClipMask) return '';

  const parts: string[] = [`d="${escapeXml(layer.path.d)}"`];
  if (layer.path.fillRule) parts.push(`fill-rule="${layer.path.fillRule}"`);

  const style = layer.style ?? {};
  parts.push(`fill="${resolvePaintForString(style.fill)}"`);
  parts.push(`stroke="${resolvePaintForString(style.stroke)}"`);
  if (style.strokeWidth !== undefined) {
    parts.push(`stroke-width="${style.strokeWidth}"`);
  }
  if (style.fillOpacity !== undefined) {
    parts.push(`fill-opacity="${style.fillOpacity}"`);
  }
  if (style.strokeOpacity !== undefined) {
    parts.push(`stroke-opacity="${style.strokeOpacity}"`);
  }
  if (style.lineCap) parts.push(`stroke-linecap="${style.lineCap}"`);
  if (style.lineJoin) parts.push(`stroke-linejoin="${style.lineJoin}"`);

  const transform = layer.transform;
  if (transform) {
    const ops: string[] = [];
    if (transform.x !== undefined || transform.y !== undefined) {
      ops.push(`translate(${transform.x ?? 0} ${transform.y ?? 0})`);
    }
    if (transform.rotate !== undefined) ops.push(`rotate(${transform.rotate})`);
    if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
      ops.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`);
    }
    if (ops.length > 0) parts.push(`transform="${ops.join(' ')}"`);
  }

  return `<path ${parts.join(' ')} />`;
}

function pickVariant(icon: Icon, size?: number): Variant {
  const variants = Object.values(icon.variants);
  if (variants.length === 0) {
    throw new Error(`Icon "${icon.id}" has no variants.`);
  }
  if (size === undefined) return variants[0]!;

  let best = variants[0]!;
  let bestDelta = Math.abs(best.size - size);
  for (const v of variants) {
    const delta = Math.abs(v.size - size);
    if (delta < bestDelta) {
      best = v;
      bestDelta = delta;
    }
  }
  return best;
}

export type SerializeSvgOptions = {
  size?: number;
  label?: string;
  typeId?: string;
  className?: string;
};

export function serializeIconToSvgString(
  icon: Icon,
  options: SerializeSvgOptions = {},
): string {
  const variant = pickVariant(icon, options.size);
  const typeId = options.typeId ?? getVariantDefaultTypeId(variant);
  const iconType = getVariantType(variant, typeId);
  const [minX, minY, w, h] = variant.viewBox;
  const renderSize = options.size ?? variant.size;

  const layers = Object.keys(iconType.layers)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => iconType.layers[id]!)
    .filter((layer) => layer.visible !== false && !!layer.path?.d && !layer.isClipMask);

  const body = layers.map(serializeLayer).filter(Boolean).join('');

  const a11y = options.label
    ? `role="img" aria-label="${escapeXml(options.label)}"`
    : `aria-hidden="true"`;
  const classAttr = options.className
    ? ` class="${escapeXml(options.className)}"`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${renderSize}" height="${renderSize}"`,
    ` viewBox="${minX} ${minY} ${w} ${h}"`,
    ` fill="none" focusable="false"`,
    ` ${a11y}${classAttr}>`,
    body,
    `</svg>`,
  ].join('');
}

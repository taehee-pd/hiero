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
 *
 * Security note: output is concatenated into markup and consumed via
 * `dangerouslySetInnerHTML` in `HieroIconServer`. Every attribute
 * value — including values sourced from the icon schema, which may
 * have come from imported or externally supplied JSON — MUST pass
 * through `attr()` so quotes, angle brackets, and ampersands are
 * escaped. Do not emit a raw template string like `fill="${x}"`.
 */

import type { Icon, Layer, Variant, PaintRef } from '../schema';
import {
  getVariantDefaultTypeId,
  getVariantType,
} from '../schema/types';

function escapeXml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return s.replace(/[&<>"']/g, (ch) => map[ch]!);
}

/** Emit a single SVG attribute. Always escape the value. */
function attr(name: string, value: string | number): string {
  return `${name}="${escapeXml(String(value))}"`;
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

  const parts: string[] = [attr('d', layer.path.d)];
  if (layer.path.fillRule) parts.push(attr('fill-rule', layer.path.fillRule));

  const style = layer.style ?? {};
  parts.push(attr('fill', resolvePaintForString(style.fill)));
  parts.push(attr('stroke', resolvePaintForString(style.stroke)));
  if (style.strokeWidth !== undefined) {
    parts.push(attr('stroke-width', style.strokeWidth));
  }
  if (style.fillOpacity !== undefined) {
    parts.push(attr('fill-opacity', style.fillOpacity));
  }
  if (style.strokeOpacity !== undefined) {
    parts.push(attr('stroke-opacity', style.strokeOpacity));
  }
  if (style.lineCap) parts.push(attr('stroke-linecap', style.lineCap));
  if (style.lineJoin) parts.push(attr('stroke-linejoin', style.lineJoin));

  const transform = layer.transform;
  if (transform) {
    const ops: string[] = [];
    if (transform.x !== undefined || transform.y !== undefined) {
      ops.push(`translate(${Number(transform.x ?? 0)} ${Number(transform.y ?? 0)})`);
    }
    if (transform.rotate !== undefined) {
      ops.push(`rotate(${Number(transform.rotate)})`);
    }
    if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
      ops.push(
        `scale(${Number(transform.scaleX ?? 1)} ${Number(transform.scaleY ?? 1)})`,
      );
    }
    if (ops.length > 0) parts.push(attr('transform', ops.join(' ')));
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
    ? `${attr('role', 'img')} ${attr('aria-label', options.label)}`
    : attr('aria-hidden', 'true');
  const classAttr = options.className ? ` ${attr('class', options.className)}` : '';

  const viewBox = `${Number(minX)} ${Number(minY)} ${Number(w)} ${Number(h)}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` ${attr('width', renderSize)} ${attr('height', renderSize)}`,
    ` ${attr('viewBox', viewBox)}`,
    ` fill="none" focusable="false"`,
    ` ${a11y}${classAttr}>`,
    body,
    `</svg>`,
  ].join('');
}

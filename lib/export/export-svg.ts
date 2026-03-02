import type { Icon, Layer, PaintRef } from '@/lib/schema/types';

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
): string {
  const variant = icon.variants[variantId];
  const state = icon.states[stateId];
  if (!variant || !state) return '';

  const [vx, vy, vw, vh] = variant.viewBox;
  const lines: string[] = [];

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${variant.size}" height="${variant.size}" fill="none">`,
  );

  const layers = Object.values(state.layers);
  for (const layer of layers) {
    if (layer.visible === false || !layer.path?.d) continue;

    const attrs: string[] = [];
    attrs.push(`d="${escapeAttr(layer.path.d)}"`);

    if (layer.path.fillRule) {
      attrs.push(`fill-rule="${layer.path.fillRule}"`);
    }

    // Fill
    const fill = resolvePaint(layer.style.fill, tokens);
    if (fill !== 'none') {
      attrs.push(`fill="${escapeAttr(fill)}"`);
    }

    // Stroke
    const stroke = resolvePaint(layer.style.stroke, tokens);
    if (stroke !== 'none') {
      attrs.push(`stroke="${escapeAttr(stroke)}"`);
    }

    if (layer.style.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${layer.style.strokeWidth}"`);
    }
    if (layer.style.fillOpacity !== undefined) {
      attrs.push(`fill-opacity="${layer.style.fillOpacity}"`);
    }
    if (layer.style.strokeOpacity !== undefined) {
      attrs.push(`stroke-opacity="${layer.style.strokeOpacity}"`);
    }
    if (layer.style.lineCap) {
      attrs.push(`stroke-linecap="${layer.style.lineCap}"`);
    }
    if (layer.style.lineJoin) {
      attrs.push(`stroke-linejoin="${layer.style.lineJoin}"`);
    }

    // Transform
    const transform = buildTransform(layer);
    if (transform) {
      attrs.push(`transform="${escapeAttr(transform)}"`);
    }

    lines.push(`  <path ${attrs.join(' ')}/>`);
  }

  lines.push('</svg>');
  return lines.join('\n');
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

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

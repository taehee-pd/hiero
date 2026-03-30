/**
 * Generates a preview SVG for each icon.
 *
 * Uses the first variant's layers as the preview representation.
 * Delegates to the existing `exportSvgString` function to avoid duplicating
 * SVG rendering logic.
 */

import type { Icon } from '@/lib/schema/types';
import { exportSvgString } from '@/lib/export/export-svg';

/**
 * Returns a preview SVG string for the given icon, or `null` if the icon
 * has no variants or the layers produce an empty SVG.
 */
export function generatePreviewSvg(
  icon: Icon,
  tokens?: Record<string, string>,
): string | null {
  // Pick the first variant by sorted key for determinism
  const variantIds = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b));
  const variantId = variantIds[0];
  if (!variantId) return null;

  const variant = icon.variants[variantId]!;

  const svg = exportSvgString(icon, variantId, '', tokens, variant.renderingMode);
  return svg || null;
}

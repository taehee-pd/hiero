import type { Layer, PaintRef, RenderingMode } from '@/lib/schema/types';

export const DEFAULT_RENDERING_MODE: RenderingMode = 'multicolor';

const ROLE_OPACITY: Record<string, number> = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.3,
};

type EffectivePaint = PaintRef | undefined;

export type ResolvedLayerStyle = {
  fill: EffectivePaint;
  stroke: EffectivePaint;
  fillOpacity: number | undefined;
  strokeOpacity: number | undefined;
  strokeWidth: number | undefined;
  lineCap: Layer['style']['lineCap'];
  lineJoin: Layer['style']['lineJoin'];
};

export function resolveVariantRenderingMode(
  renderingMode: RenderingMode | undefined,
): RenderingMode {
  return renderingMode ?? DEFAULT_RENDERING_MODE;
}

export function resolveLayerStyleForRendering(
  layer: Layer,
  renderingMode: RenderingMode,
  tokens?: Record<string, string>,
): ResolvedLayerStyle {
  const role = layer.role ?? 'primary';
  const style = layer.style;

  let fill = style.fill;
  let stroke = style.stroke;
  let fillOpacity = style.fillOpacity;
  let strokeOpacity = style.strokeOpacity;

  if (renderingMode === 'monochrome') {
    fill = coercePaint(fill, 'currentColor');
    stroke = coercePaint(stroke, 'currentColor');
  } else if (renderingMode === 'hierarchical') {
    const opacity = ROLE_OPACITY[role] ?? ROLE_OPACITY.primary;
    fillOpacity = opacity;
    strokeOpacity = opacity;
  } else if (renderingMode === 'palette') {
    const paletteColor = tokens?.[role];
    fill = coercePaint(fill, paletteColor);
    stroke = coercePaint(stroke, paletteColor);
  }

  return {
    fill,
    stroke,
    fillOpacity,
    strokeOpacity,
    strokeWidth: style.strokeWidth,
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
  };
}

function coercePaint(
  paint: PaintRef | undefined,
  nextColor: string | 'currentColor' | undefined,
): EffectivePaint {
  if (!hasVisiblePaint(paint)) return paint;
  if (!nextColor) return paint;
  if (nextColor === 'currentColor') {
    return { mode: 'currentColor' };
  }
  return { mode: 'fixed', value: nextColor };
}

/**
 * Apply variable-value opacity/visibility to a resolved layer style.
 *
 * Multiplies existing fillOpacity and strokeOpacity by the variable
 * result's opacity so that the effect composes with rendering-mode
 * opacity (e.g. hierarchical) and per-layer author opacity.
 */
export function applyVariableValue(
  style: ResolvedLayerStyle,
  variableResult: { opacity: number; visible: boolean },
): ResolvedLayerStyle {
  if (!variableResult.visible) {
    return {
      ...style,
      fillOpacity: 0,
      strokeOpacity: 0,
    };
  }

  return {
    ...style,
    fillOpacity:
      style.fillOpacity != null
        ? style.fillOpacity * variableResult.opacity
        : variableResult.opacity,
    strokeOpacity:
      style.strokeOpacity != null
        ? style.strokeOpacity * variableResult.opacity
        : variableResult.opacity,
  };
}

function hasVisiblePaint(paint: PaintRef | undefined): boolean {
  if (!paint) return false;
  return !(paint.mode === 'fixed' && paint.value === 'none');
}

import { useEffect, type RefObject } from 'react';
import type { ViewportState, SelectionState } from '@/lib/editor-store/types';
import type { Layer } from '@/lib/schema/types';

export type OverlayOptions = {
  viewport: ViewportState;
  selection: SelectionState;
  layers: Record<string, Layer>;
  viewBox: [number, number, number, number];
};

/**
 * Canvas overlay hook.
 * Draws selection outlines, anchor handles, and pixel grid over the SVG canvas.
 * This is editor-only — none of this appears in exported SVG.
 */
export function useCanvasOverlay(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  options: OverlayOptions,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match container
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    const { viewport, selection, layers, viewBox } = options;
    const iconSize = viewBox[2];
    const scale = viewport.zoom;
    const renderSize = iconSize * scale;

    // Center coordinates
    const cx = rect.width / 2 + viewport.panX;
    const cy = rect.height / 2 + viewport.panY;
    const left = cx - renderSize / 2;
    const top = cy - renderSize / 2;

    // ── Pixel grid ──────────────────────────────────────────
    if (scale >= 4) {
      const gridStep = scale; // 1 SVG unit = scale pixels
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = left; x <= left + renderSize; x += gridStep) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + renderSize);
      }
      for (let y = top; y <= top + renderSize; y += gridStep) {
        ctx.moveTo(left, y);
        ctx.lineTo(left + renderSize, y);
      }
      ctx.stroke();
    }

    // ── Canvas boundary ─────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, renderSize, renderSize);

    // ── Selection highlight ─────────────────────────────────
    if (selection.layerIds.length > 0) {
      // Draw a highlight around the icon bounds for selected layers
      // In a full implementation this would compute per-layer bounding boxes
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      for (const layerId of selection.layerIds) {
        const layer = layers[layerId];
        if (!layer || !layer.path?.d) continue;

        // Simple: outline the full icon boundary as a selection indicator
        // TODO: compute actual path bounding box for precise selection
        const padding = 2;
        ctx.strokeRect(
          left - padding,
          top - padding,
          renderSize + padding * 2,
          renderSize + padding * 2,
        );
      }

      ctx.setLineDash([]);
    }

    // ── Crosshair at center (when zoomed) ──────────────────
    if (scale >= 2) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, top - 8);
      ctx.lineTo(cx, top + renderSize + 8);
      ctx.moveTo(left - 8, cy);
      ctx.lineTo(left + renderSize + 8, cy);
      ctx.stroke();
    }
  }, [canvasRef, containerRef, options]);
}

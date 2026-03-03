import { useEffect, type RefObject } from 'react';
import type { ViewportState, SelectionState } from '@/lib/editor-store/types';
import type { Layer, GuideSet, GuideItem } from '@/lib/schema/types';

export type OverlayOptions = {
  viewport: ViewportState;
  selection: SelectionState;
  layers: Record<string, Layer>;
  viewBox: [number, number, number, number];
  guideSet?: GuideSet;
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

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const { viewport, selection, layers, viewBox, guideSet } = options;
    const iconSize = viewBox[2];
    const scale = viewport.zoom;
    const renderSize = iconSize * scale;

    const cx = rect.width / 2 + viewport.panX;
    const cy = rect.height / 2 + viewport.panY;
    const left = cx - renderSize / 2;
    const top = cy - renderSize / 2;

    const toScreen = (x: number, y: number) => ({
      x: left + (x - viewBox[0]) * scale,
      y: top + (y - viewBox[1]) * scale,
    });

    if (scale >= 4) {
      const gridStep = scale;
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

    // Built-in guide presets: safe zone and keylines.
    drawGuidePresets(ctx, viewBox, toScreen);

    if (guideSet?.items?.length) {
      drawGuideItems(ctx, guideSet.items, viewBox, toScreen);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, renderSize, renderSize);

    if (selection.layerIds.length > 0) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      for (const layerId of selection.layerIds) {
        const layer = layers[layerId];
        if (!layer || !layer.path?.d) continue;
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

function drawGuidePresets(
  ctx: CanvasRenderingContext2D,
  viewBox: [number, number, number, number],
  toScreen: (x: number, y: number) => { x: number; y: number },
) {
  const [vx, vy, vw, vh] = viewBox;
  const inset = Math.min(vw, vh) * 0.08;

  // Safe zone rectangle
  const safeTopLeft = toScreen(vx + inset, vy + inset);
  const safeBottomRight = toScreen(vx + vw - inset, vy + vh - inset);
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(
    safeTopLeft.x,
    safeTopLeft.y,
    safeBottomRight.x - safeTopLeft.x,
    safeBottomRight.y - safeTopLeft.y,
  );
  ctx.restore();

  // Keyline circle + square
  const center = toScreen(vx + vw / 2, vy + vh / 2);
  const edgeX = toScreen(vx + vw * 0.85, vy).x;
  const radius = Math.abs(edgeX - center.x);

  ctx.save();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawGuideItems(
  ctx: CanvasRenderingContext2D,
  items: GuideItem[],
  viewBox: [number, number, number, number],
  toScreen: (x: number, y: number) => { x: number; y: number },
) {
  const [vx, vy, vw, vh] = viewBox;
  ctx.save();
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
  ctx.fillStyle = 'rgba(244, 114, 182, 0.6)';
  ctx.lineWidth = 1;

  for (const item of items) {
    switch (item.kind) {
      case 'hline': {
        const a = toScreen(vx, item.y);
        const b = toScreen(vx + vw, item.y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'vline': {
        const a = toScreen(item.x, vy);
        const b = toScreen(item.x, vy + vh);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'rect': {
        const p = toScreen(item.x, item.y);
        const q = toScreen(item.x + item.width, item.y + item.height);
        ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y);
        break;
      }
      case 'ellipse': {
        const center = toScreen(item.cx, item.cy);
        const rx = Math.abs(toScreen(item.cx + item.rx, item.cy).x - center.x);
        const ry = Math.abs(toScreen(item.cx, item.cy + item.ry).y - center.y);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'drawPoint': {
        // Placeholder marker for draw point guides.
        const marker = toScreen(vx + vw / 2, vy + vh / 2);
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  ctx.restore();
}

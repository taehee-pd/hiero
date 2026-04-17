import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ViewportState, SelectionState } from '@/lib/editor-store/types';
import type { SnapTarget } from '@/lib/editor-core/snap-engine';
import type { Layer, GuideItem, GuideSet } from '@/lib/schema/types';
import {
  loadPaperGlobal,
  type PaperGlobal,
  type PaperPoint,
  type PaperRectangle,
  type PaperScopeInstance,
} from '@/lib/editor-core/paper-runtime';

type OverlayGuideSet = GuideSet & {
  viewBox?: [number, number, number, number];
};

export type OverlayOptions = {
  viewport: ViewportState;
  selection: SelectionState;
  layers: Record<string, Layer>;
  viewBox: [number, number, number, number];
  guideSet?: OverlayGuideSet;
  guidesVisible?: boolean;
  guideStyle?: 'subtle' | 'strong';
  /**
   * True when the canvas is editing a guide master (not an icon). Promotes
   * the master's `items` rendering to the `strong` style for legibility —
   * the master's `layers` are already rendered as first-class content via
   * the usual layer render path.
   */
  guideEditingActive?: boolean;
  pointBBox?: { minX: number; minY: number; maxX: number; maxY: number } | null;
  pointMarquee?: { minX: number; minY: number; maxX: number; maxY: number } | null;
  pointBBoxLabel?: { width: number; height: number } | null;
  activeSnapGuides?: SnapTarget[];
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
  const paperRef = useRef<PaperGlobal | null>(null);
  const scopeRef = useRef<PaperScopeInstance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const draw = useCallback(() => {
    const paperGlobal = paperRef.current;
    const scope = scopeRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!paperGlobal || !scope || !canvas || !container) return;

    try {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        scope.view.viewSize = new paperGlobal.Size(width, height);
      }

      scope.activate();
      scope.project.clear();

      const {
        viewport,
        selection,
        layers,
        viewBox,
        guideSet,
        guidesVisible,
        guideStyle,
        guideEditingActive,
        pointBBox,
        pointMarquee,
        pointBBoxLabel,
        activeSnapGuides,
      } =
        optionsRef.current;
      const [vx, vy, vw, vh] = viewBox;
      const scale = viewport.zoom;
      const renderWidth = vw * scale;
      const renderHeight = vh * scale;

      const cx = width / 2 + viewport.panX;
      const cy = height / 2 + viewport.panY;
      const left = cx - renderWidth / 2;
      const top = cy - renderHeight / 2;

      const toScreen = (x: number, y: number) =>
        new scope.Point(left + (x - vx) * scale, top + (y - vy) * scale);

      if (guidesVisible !== false && guideSet?.items?.length) {
        // Promote parametric guide rendering (hline / vline / rect / ellipse)
        // to the `strong` style while the user is editing guides on canvas,
        // so they read as active reference while the master's `layers` are
        // the live-editable content.
        const effectiveGuideStyle: 'subtle' | 'strong' = guideEditingActive
          ? 'strong'
          : guideStyle ?? 'subtle';
        drawGuideItems(
          scope,
          guideSet.items,
          viewBox,
          guideSet.viewBox,
          toScreen,
          effectiveGuideStyle,
        );
      }
      const boundary = new scope.Path.Rectangle({
        rectangle: new scope.Rectangle(left, top, renderWidth, renderHeight),
        strokeColor: new scope.Color('rgba(255,255,255,0.12)'),
        strokeWidth: 1,
      });
      boundary.fillColor = null;

      if (selection.layerIds.length > 0) {
        const strokeColor = new scope.Color('rgba(96,165,250,0.7)');
        const fallbackRect = new scope.Rectangle(
          left - 2,
          top - 2,
          renderWidth + 4,
          renderHeight + 4,
        );

        for (const layerId of selection.layerIds) {
          const layer = layers[layerId];
          if (!layer || !layer.path?.d) continue;

          let bounds: PaperRectangle | null = null;
          try {
            const item = new scope.CompoundPath(layer.path.d);
            item.fillColor = null;
            item.strokeColor = null;

            const t = layer.transform;
            if (t) {
              if (t.x !== undefined || t.y !== undefined) {
                item.translate(new scope.Point(t.x ?? 0, t.y ?? 0));
              }
              if (t.rotate !== undefined) {
                item.rotate(t.rotate, new scope.Point(0, 0));
              }
              if (t.scaleX !== undefined || t.scaleY !== undefined) {
                item.scale(t.scaleX ?? 1, t.scaleY ?? 1, new scope.Point(0, 0));
              }
            }

            item.translate(new scope.Point(-vx, -vy));
            item.scale(scale, scale, new scope.Point(0, 0));
            item.translate(new scope.Point(left, top));

            bounds = item.strokeBounds.clone();
            item.remove();
          } catch {
            bounds = fallbackRect;
          }

          const rectToDraw =
            !bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
              ? fallbackRect
              : new scope.Rectangle(
                  bounds.x - 3,
                  bounds.y - 3,
                  bounds.width + 6,
                  bounds.height + 6,
                );

          const selectionRect = new scope.Path.Rectangle({
            rectangle: rectToDraw,
            strokeColor,
            strokeWidth: 1,
            dashArray: [4, 3],
          });
          selectionRect.fillColor = null;
        }
      }

      if (scale >= 2) {
        const vertical = new scope.Path.Line(
          new scope.Point(cx, top - 8),
          new scope.Point(cx, top + renderHeight + 8),
        );
        vertical.strokeColor = new scope.Color('rgba(96,165,250,0.3)');
        vertical.strokeWidth = 0.5;

        const horizontal = new scope.Path.Line(
          new scope.Point(left - 8, cy),
          new scope.Point(left + renderWidth + 8, cy),
        );
        horizontal.strokeColor = new scope.Color('rgba(96,165,250,0.3)');
        horizontal.strokeWidth = 0.5;
      }

      if (pointBBox) {
        drawPointSelectionBoundingBox(scope, pointBBox, pointBBoxLabel, toScreen);
      }

      if (pointMarquee) {
        drawPointMarquee(scope, pointMarquee, toScreen);
      }

      if (activeSnapGuides?.length) {
        drawActiveSnapGuides(scope, activeSnapGuides, viewBox, toScreen);
      }

      scope.view.update();
    } catch (err) {
      console.error('[CanvasOverlay] draw failed', err);
    }
  }, [canvasRef, containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    void loadPaperGlobal()
      .then((paperGlobal) => {
        if (cancelled) return;

        try {
          paperRef.current = paperGlobal;
          const scope = new paperGlobal.PaperScope();
          scope.setup(canvas);
          scopeRef.current = scope;

          draw();

          let removeResizeListener: (() => void) | null = null;
          if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
              draw();
            });
            resizeObserver.observe(container);
            removeResizeListener = () => resizeObserver.disconnect();
          } else {
            const onResize = () => draw();
            window.addEventListener('resize', onResize);
            removeResizeListener = () => window.removeEventListener('resize', onResize);
          }

          cleanup = () => {
            removeResizeListener?.();
            try {
              scope.project.clear();
              scope.view.remove?.();
            } catch (err) {
              console.error('[CanvasOverlay] cleanup failed', err);
            }
            scopeRef.current = null;
          };
        } catch (err) {
          console.error('[CanvasOverlay] initialization failed', err);
        }
      })
      .catch((err) => {
        console.error('[CanvasOverlay] paper runtime load failed', err);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [canvasRef, containerRef, draw]);

  useEffect(() => {
    draw();
  }, [draw, options]);
}

function drawPointSelectionBoundingBox(
  scope: PaperScopeInstance,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  label: { width: number; height: number } | null | undefined,
  toScreen: (x: number, y: number) => PaperPoint,
) {
  const strokeColor = new scope.Color('rgba(96,165,250,0.7)');
  const outline = new scope.Path.Rectangle({
    rectangle: new scope.Rectangle(toScreen(bbox.minX, bbox.minY), toScreen(bbox.maxX, bbox.maxY)),
    strokeColor,
    strokeWidth: 1,
  });
  outline.fillColor = null;

  const midX = (bbox.minX + bbox.maxX) / 2;
  const midY = (bbox.minY + bbox.maxY) / 2;
  const handleSize = 4;
  const halfSize = handleSize / 2;
  const handlePoints = [
    [bbox.minX, bbox.minY],
    [midX, bbox.minY],
    [bbox.maxX, bbox.minY],
    [bbox.maxX, midY],
    [bbox.maxX, bbox.maxY],
    [midX, bbox.maxY],
    [bbox.minX, bbox.maxY],
    [bbox.minX, midY],
  ];

  handlePoints.forEach(([x, y]) => {
    const point = toScreen(x, y);
    const handle = new scope.Path.Rectangle({
      rectangle: new scope.Rectangle(point.x - halfSize, point.y - halfSize, handleSize, handleSize),
      strokeColor,
      strokeWidth: 1,
      fillColor: new scope.Color('rgba(255,255,255,0.95)'),
    });
    handle.strokeColor = strokeColor;
  });

  if (label) {
    const anchor = toScreen(bbox.maxX, bbox.minY);
    const text = new scope.PointText({
      point: new scope.Point(anchor.x - 6, anchor.y - 10),
      content: `${formatMeasure(label.width)} x ${formatMeasure(label.height)}`,
      fillColor: new scope.Color('#eff6ff'),
      fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 10,
      justification: 'right',
    });
    const background = new scope.Path.Rectangle({
      rectangle: text.bounds.expand(6, 3),
      radius: 4,
      fillColor: new scope.Color('rgba(30,41,59,0.92)'),
      strokeColor,
      strokeWidth: 1,
    });
    background.sendToBack?.();
    text.bringToFront();
  }
}

function drawPointMarquee(
  scope: PaperScopeInstance,
  marquee: { minX: number; minY: number; maxX: number; maxY: number },
  toScreen: (x: number, y: number) => PaperPoint,
) {
  const topLeft = toScreen(marquee.minX, marquee.minY);
  const bottomRight = toScreen(marquee.maxX, marquee.maxY);
  const rect = new scope.Rectangle(topLeft, bottomRight);
  const fill = new scope.Color('rgba(96,165,250,0.14)');
  const stroke = new scope.Color('rgba(96,165,250,0.72)');

  const outline = new scope.Path.Rectangle({
    rectangle: rect,
    strokeColor: stroke,
    strokeWidth: 1,
    dashArray: [5, 4],
    fillColor: fill,
  });
  outline.fillColor = fill;
}

function formatMeasure(value: number): string {
  return `${Math.round(value * 1000) / 1000}`;
}

function drawGuideItems(
  scope: PaperScopeInstance,
  items: GuideItem[],
  viewBox: [number, number, number, number],
  guideViewBox: [number, number, number, number] | undefined,
  toScreen: (x: number, y: number) => PaperPoint,
  guideStyle: 'subtle' | 'strong',
) {
  const [vx, vy, vw, vh] = viewBox;
  const [guideX, guideY, guideW, guideH] = guideViewBox ?? viewBox;
  const scaleX = guideW > 0 ? vw / guideW : 1;
  const scaleY = guideH > 0 ? vh / guideH : 1;
  const mapX = (x: number) => vx + (x - guideX) * scaleX;
  const mapY = (y: number) => vy + (y - guideY) * scaleY;
  const guideStroke = new scope.Color(
    guideStyle === 'strong' ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.18)',
  );
  const guideFill = new scope.Color('rgba(148,163,184,0.30)');
  const dashArray = guideStyle === 'strong' ? undefined : [4, 6];

  for (const item of items) {
    switch (item.kind) {
      case 'hline': {
        const y = mapY(item.y);
        const a = toScreen(vx, y);
        const b = toScreen(vx + vw, y);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = guideStroke;
        line.strokeWidth = 1;
        line.dashArray = dashArray;
        break;
      }
      case 'vline': {
        const x = mapX(item.x);
        const a = toScreen(x, vy);
        const b = toScreen(x, vy + vh);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = guideStroke;
        line.strokeWidth = 1;
        line.dashArray = dashArray;
        break;
      }
      case 'rect': {
        const p = toScreen(mapX(item.x), mapY(item.y));
        const q = toScreen(mapX(item.x + item.width), mapY(item.y + item.height));
        const rect = new scope.Path.Rectangle({
          from: p,
          to: q,
          strokeColor: guideStroke,
          strokeWidth: 1,
        });
        rect.fillColor = null;
        rect.dashArray = dashArray;
        break;
      }
      case 'ellipse': {
        const centerX = mapX(item.cx);
        const centerY = mapY(item.cy);
        const center = toScreen(centerX, centerY);
        const rx = Math.abs(toScreen(mapX(item.cx + item.rx), centerY).x - center.x);
        const ry = Math.abs(toScreen(centerX, mapY(item.cy + item.ry)).y - center.y);
        const ellipse = new scope.Path.Ellipse({
          center,
          radius: new scope.Size(rx, ry),
          strokeColor: guideStroke,
          strokeWidth: 1,
        });
        ellipse.fillColor = null;
        ellipse.dashArray = dashArray;
        break;
      }
      case 'drawPoint': {
        const marker = toScreen(vx + vw / 2, vy + vh / 2);
        const point = new scope.Path.Circle({
          center: marker,
          radius: 3,
          fillColor: guideFill,
        });
        point.strokeColor = null;
        break;
      }
    }
  }
}

function drawActiveSnapGuides(
  scope: PaperScopeInstance,
  guides: SnapTarget[],
  viewBox: [number, number, number, number],
  toScreen: (x: number, y: number) => PaperPoint,
) {
  const [vx, vy, vw, vh] = viewBox;
  const drawn = new Set<string>();

  for (const guide of guides) {
    const strokeColor = getSnapGuideColor(scope, guide.type);
    const dashArray = guide.type === 'center' ? [10, 4] : [7, 5];

    if (guide.x !== undefined) {
      const key = `x:${guide.type}:${guide.sourceLayerId ?? ''}:${guide.x}`;
      if (!drawn.has(key)) {
        drawn.add(key);
        const a = toScreen(guide.x, vy);
        const b = toScreen(guide.x, vy + vh);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = strokeColor;
        line.strokeWidth = 1.25;
        line.dashArray = dashArray;
      }
    }

    if (guide.y !== undefined) {
      const key = `y:${guide.type}:${guide.sourceLayerId ?? ''}:${guide.y}`;
      if (!drawn.has(key)) {
        drawn.add(key);
        const a = toScreen(vx, guide.y);
        const b = toScreen(vx + vw, guide.y);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = strokeColor;
        line.strokeWidth = 1.25;
        line.dashArray = dashArray;
      }
    }
  }
}

function getSnapGuideColor(scope: PaperScopeInstance, type: SnapTarget['type']) {
  switch (type) {
    case 'center':
      return new scope.Color('rgba(34, 211, 238, 0.72)');
    case 'edge':
    case 'guide':
    case 'spacing':
    case 'grid':
    default:
      return new scope.Color('rgba(236, 72, 153, 0.7)');
  }
}

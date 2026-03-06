import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ViewportState, SelectionState } from '@/lib/editor-store/types';
import type { Layer, GuideSet, GuideItem } from '@/lib/schema/types';

type PaperGlobal = any;
type PaperWindow = Window & { paper?: PaperGlobal };

const PAPER_SCRIPT_ID = 'paper-core-runtime';
const PAPER_SCRIPT_SRC = '/vendor/paper-core.min.js';
let paperLoadPromise: Promise<PaperGlobal> | null = null;

function getPaperGlobal(): PaperGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as PaperWindow).paper ?? null;
}

function loadPaperGlobal(): Promise<PaperGlobal> {
  const loaded = getPaperGlobal();
  if (loaded) return Promise.resolve(loaded);
  if (paperLoadPromise) return paperLoadPromise;

  paperLoadPromise = new Promise<PaperGlobal>((resolve, reject) => {
    const onLoaded = () => {
      const runtime = getPaperGlobal();
      if (!runtime) {
        paperLoadPromise = null;
        reject(new Error('Paper.js runtime did not attach to window.'));
        return;
      }
      resolve(runtime);
    };

    const onError = () => {
      paperLoadPromise = null;
      reject(new Error('Failed to load Paper.js runtime script.'));
    };

    const existing = document.getElementById(PAPER_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existing) {
      const runtime = getPaperGlobal();
      if (runtime) {
        resolve(runtime);
        return;
      }

      if (existing.dataset.paperStatus === 'error') {
        onError();
        return;
      }

      existing.addEventListener('load', onLoaded, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = PAPER_SCRIPT_ID;
    script.src = PAPER_SCRIPT_SRC;
    script.async = true;
    script.dataset.paperStatus = 'loading';
    script.addEventListener(
      'load',
      () => {
        script.dataset.paperStatus = 'loaded';
        onLoaded();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        script.dataset.paperStatus = 'error';
        onError();
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return paperLoadPromise;
}

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
  const paperRef = useRef<PaperGlobal | null>(null);
  const scopeRef = useRef<any>(null);
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

      const { viewport, selection, layers, viewBox, guideSet } = optionsRef.current;
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

      if (scale >= 4) {
        const gridStep = scale;
        for (let x = left; x <= left + renderWidth; x += gridStep) {
          const line = new scope.Path.Line(
            new scope.Point(x, top),
            new scope.Point(x, top + renderHeight),
          );
          line.strokeColor = new scope.Color('rgba(255,255,255,0.06)');
          line.strokeWidth = 0.5;
        }

        for (let y = top; y <= top + renderHeight; y += gridStep) {
          const line = new scope.Path.Line(
            new scope.Point(left, y),
            new scope.Point(left + renderWidth, y),
          );
          line.strokeColor = new scope.Color('rgba(255,255,255,0.06)');
          line.strokeWidth = 0.5;
        }
      }

      drawGuidePresets(scope, viewBox, toScreen);
      if (guideSet?.items?.length) {
        drawGuideItems(scope, guideSet.items, viewBox, toScreen);
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

          let bounds: any = null;
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
            strokeWidth: 1.5,
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
              scope.view.remove();
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

function drawGuidePresets(
  scope: any,
  viewBox: [number, number, number, number],
  toScreen: (x: number, y: number) => any,
) {
  const [vx, vy, vw, vh] = viewBox;
  const inset = Math.min(vw, vh) * 0.08;

  const safeTopLeft = toScreen(vx + inset, vy + inset);
  const safeBottomRight = toScreen(vx + vw - inset, vy + vh - inset);
  const safeRect = new scope.Path.Rectangle({
    from: safeTopLeft,
    to: safeBottomRight,
    strokeColor: new scope.Color('rgba(148,163,184,0.18)'),
    strokeWidth: 0.8,
    dashArray: [4, 6],
  });
  safeRect.fillColor = null;

  const center = toScreen(vx + vw / 2, vy + vh / 2);
  const edgeX = toScreen(vx + vw * 0.85, vy).x;
  const radius = Math.abs(edgeX - center.x);

  const keylineCircle = new scope.Path.Circle({
    center,
    radius,
    strokeColor: new scope.Color('rgba(148,163,184,0.14)'),
    strokeWidth: 0.8,
    dashArray: [3, 5],
  });
  keylineCircle.fillColor = null;

  const keylineSquare = new scope.Path.Rectangle({
    rectangle: new scope.Rectangle(
      center.x - radius,
      center.y - radius,
      radius * 2,
      radius * 2,
    ),
    strokeColor: new scope.Color('rgba(148,163,184,0.14)'),
    strokeWidth: 0.8,
    dashArray: [3, 5],
  });
  keylineSquare.fillColor = null;
}

function drawGuideItems(
  scope: any,
  items: GuideItem[],
  viewBox: [number, number, number, number],
  toScreen: (x: number, y: number) => any,
) {
  const [vx, vy, vw, vh] = viewBox;
  const guideStroke = new scope.Color('rgba(148,163,184,0.24)');
  const guideFill = new scope.Color('rgba(148,163,184,0.30)');

  for (const item of items) {
    switch (item.kind) {
      case 'hline': {
        const a = toScreen(vx, item.y);
        const b = toScreen(vx + vw, item.y);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = guideStroke;
        line.strokeWidth = 1;
        break;
      }
      case 'vline': {
        const a = toScreen(item.x, vy);
        const b = toScreen(item.x, vy + vh);
        const line = new scope.Path.Line(a, b);
        line.strokeColor = guideStroke;
        line.strokeWidth = 1;
        break;
      }
      case 'rect': {
        const p = toScreen(item.x, item.y);
        const q = toScreen(item.x + item.width, item.y + item.height);
        const rect = new scope.Path.Rectangle({
          from: p,
          to: q,
          strokeColor: guideStroke,
          strokeWidth: 1,
        });
        rect.fillColor = null;
        break;
      }
      case 'ellipse': {
        const center = toScreen(item.cx, item.cy);
        const rx = Math.abs(toScreen(item.cx + item.rx, item.cy).x - center.x);
        const ry = Math.abs(toScreen(item.cx, item.cy + item.ry).y - center.y);
        const ellipse = new scope.Path.Ellipse({
          center,
          radius: new scope.Size(rx, ry),
          strokeColor: guideStroke,
          strokeWidth: 1,
        });
        ellipse.fillColor = null;
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

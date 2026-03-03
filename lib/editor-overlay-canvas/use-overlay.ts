import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ViewportState, SelectionState } from '@/lib/editor-store/types';
import type { Layer } from '@/lib/schema/types';

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

    const existing = document.getElementById(PAPER_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    if (existing) {
      existing.addEventListener('load', onLoaded, { once: true });
      existing.addEventListener(
        'error',
        () => {
          paperLoadPromise = null;
          reject(new Error('Failed to load existing Paper.js runtime script.'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = PAPER_SCRIPT_ID;
    script.src = PAPER_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', onLoaded, { once: true });
    script.addEventListener(
      'error',
      () => {
        paperLoadPromise = null;
        reject(new Error('Failed to load Paper.js runtime script.'));
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

    const { viewport, selection, layers, viewBox } = optionsRef.current;
    const [vx, vy, vw, vh] = viewBox;
    const scale = viewport.zoom;
    const renderWidth = vw * scale;
    const renderHeight = vh * scale;

    // Center coordinates
    const cx = width / 2 + viewport.panX;
    const cy = height / 2 + viewport.panY;
    const left = cx - renderWidth / 2;
    const top = cy - renderHeight / 2;

    // ── Pixel grid ──────────────────────────────────────────
    if (scale >= 4) {
      const gridStep = scale; // 1 SVG unit = scale pixels
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

    // ── Canvas boundary ─────────────────────────────────────
    const boundary = new scope.Path.Rectangle({
      rectangle: new scope.Rectangle(left, top, renderWidth, renderHeight),
      strokeColor: new scope.Color('rgba(255,255,255,0.12)'),
      strokeWidth: 1,
    });
    boundary.fillColor = null;

    // ── Selection highlight ─────────────────────────────────
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

          // Convert SVG coordinates to screen coordinates.
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

    // ── Crosshair at center (when zoomed) ──────────────────
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

        paperRef.current = paperGlobal;
        const scope = new paperGlobal.PaperScope();
        scope.setup(canvas);
        scopeRef.current = scope;

        draw();

        const resizeObserver = new ResizeObserver(() => {
          draw();
        });
        resizeObserver.observe(container);

        cleanup = () => {
          resizeObserver.disconnect();
          scope.project.clear();
          scope.view.remove();
          scopeRef.current = null;
        };
      })
      .catch((err) => {
        console.error(err);
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

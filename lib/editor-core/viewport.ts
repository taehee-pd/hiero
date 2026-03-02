import { editorStore } from '@/lib/editor-store/store';

/**
 * ViewportController handles zoom and pan for the editor canvas.
 * Coordinates: screen -> canvas -> SVG
 */
export class ViewportController {
  private container: HTMLElement;
  private cleanup: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.attach();
  }

  private attach() {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { viewport, setViewport } = editorStore.getState();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom around cursor
        const rect = this.container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;

        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.max(0.1, Math.min(64, viewport.zoom * delta));
        const scale = newZoom / viewport.zoom;

        setViewport({
          zoom: newZoom,
          panX: cursorX - scale * (cursorX - viewport.panX),
          panY: cursorY - scale * (cursorY - viewport.panY),
        });
      } else {
        // Scroll to pan
        setViewport({
          panX: viewport.panX - e.deltaX,
          panY: viewport.panY - e.deltaY,
        });
      }
    };

    this.container.addEventListener('wheel', handleWheel, { passive: false });

    this.cleanup = () => {
      this.container.removeEventListener('wheel', handleWheel);
    };
  }

  /**
   * Convert screen coordinates to SVG coordinates.
   */
  screenToSvg(
    screenX: number,
    screenY: number,
    viewBox: [number, number, number, number],
  ): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();
    const { viewport } = editorStore.getState();
    const iconSize = viewBox[2];
    const renderSize = iconSize * viewport.zoom;

    const cx = rect.width / 2 + viewport.panX;
    const cy = rect.height / 2 + viewport.panY;
    const left = cx - renderSize / 2;
    const top = cy - renderSize / 2;

    const svgX = viewBox[0] + ((screenX - rect.left - left) / renderSize) * iconSize;
    const svgY = viewBox[1] + ((screenY - rect.top - top) / renderSize) * iconSize;

    return { x: svgX, y: svgY };
  }

  /**
   * Fit the icon to the visible area with some padding.
   */
  fitToContent() {
    editorStore.getState().setViewport({ zoom: 12, panX: 0, panY: 0 });
  }

  destroy() {
    this.cleanup?.();
  }
}

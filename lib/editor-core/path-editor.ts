import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { ViewportController } from './viewport';

/**
 * PathEditor: imperative interaction engine for the canvas.
 * Handles pointer events for select, direct-select, and pen tools.
 * Uses a requestAnimationFrame loop during drag to bypass React.
 */
export class PathEditor {
  private svg: SVGSVGElement;
  private viewport: ViewportController;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragLayerId: string | null = null;
  private originalTransform: { x: number; y: number } | null = null;
  private animFrameId = 0;
  private cleanup: (() => void) | null = null;

  constructor(svg: SVGSVGElement, viewport: ViewportController) {
    this.svg = svg;
    this.viewport = viewport;
    this.attach();
  }

  private attach() {
    const onDown = this.onPointerDown.bind(this);
    const onMove = this.onPointerMove.bind(this);
    const onUp = this.onPointerUp.bind(this);

    this.svg.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    this.cleanup = () => {
      this.svg.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    };
  }

  private onPointerDown(e: PointerEvent) {
    const state = editorStore.getState();
    const tool = state.tool;
    const target = e.target as Element;
    const layerId = target.getAttribute?.('data-layer-id');

    if (tool === 'select' || tool === 'direct-select') {
      if (layerId) {
        state.setSelection({ layerIds: [layerId], pointIds: [] });

        // Start drag
        this.isDragging = true;
        this.dragLayerId = layerId;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // Get current transform
        const icon = selectCurrentIcon(state);
        const currentState = selectCurrentState(state);
        if (icon && currentState) {
          const layer = currentState.layers[layerId];
          this.originalTransform = {
            x: layer?.transform?.x ?? 0,
            y: layer?.transform?.y ?? 0,
          };
        }

        (e.target as Element).setPointerCapture?.(e.pointerId);
      } else {
        state.clearSelection();
      }
    } else if (tool === 'pen' && layerId) {
      // Pen tool: select layer for future point addition
      state.setSelection({ layerIds: [layerId], pointIds: [] });
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.isDragging || !this.dragLayerId || !this.originalTransform) return;

    const state = editorStore.getState();
    const variant = selectCurrentVariant(state);
    if (!variant) return;

    // Calculate delta in SVG units
    const zoom = state.viewport.zoom;
    const iconSize = variant.viewBox[2];
    const renderSize = iconSize * zoom;
    const svgPerPx = iconSize / renderSize;

    const dx = (e.clientX - this.dragStartX) * svgPerPx;
    const dy = (e.clientY - this.dragStartY) * svgPerPx;

    // Apply transform via RAF to bypass React
    const layerId = this.dragLayerId;
    const newX = this.originalTransform.x + dx;
    const newY = this.originalTransform.y + dy;

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      // Direct DOM update for smooth dragging
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${layerId}"]`,
      ) as SVGPathElement | null;
      if (pathEl) {
        const parts: string[] = [];
        parts.push(`translate(${newX}, ${newY})`);
        pathEl.setAttribute('transform', parts.join(' '));
      }
    });
  }

  private onPointerUp(_e: PointerEvent) {
    if (!this.isDragging || !this.dragLayerId || !this.originalTransform) {
      this.isDragging = false;
      return;
    }

    const state = editorStore.getState();
    const variant = selectCurrentVariant(state);
    if (!variant) {
      this.isDragging = false;
      return;
    }

    // Calculate final delta
    const zoom = state.viewport.zoom;
    const iconSize = variant.viewBox[2];
    const renderSize = iconSize * zoom;
    const svgPerPx = iconSize / renderSize;

    const dx = (_e.clientX - this.dragStartX) * svgPerPx;
    const dy = (_e.clientY - this.dragStartY) * svgPerPx;

    // Commit to store (this triggers undo/redo tracking)
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      const iconId = state.currentIconId;
      const stateId = state.currentStateId;
      if (iconId && stateId) {
        const icon = state.project?.icons[iconId];
        const st = icon?.states[stateId];
        const layer = st?.layers[this.dragLayerId];
        if (layer) {
          state.patchLayer(iconId, stateId, this.dragLayerId, {
            transform: {
              ...(layer.transform ?? {}),
              x: this.originalTransform.x + dx,
              y: this.originalTransform.y + dy,
            },
          });
        }
      }
    }

    this.isDragging = false;
    this.dragLayerId = null;
    this.originalTransform = null;
  }

  destroy() {
    this.cleanup?.();
  }
}

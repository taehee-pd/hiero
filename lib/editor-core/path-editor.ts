import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';
import { SnapEngine, type SnapResult } from './snap-engine';
import { pauseHistory, resumeHistory, commitHistory } from '@/lib/editor-store/history';

type DragMode = 'layer' | 'point' | null;
type PenPlacement = {
  layerId: string;
  pointKey: string;
  anchor: { x: number; y: number };
  pointerId: number;
  basePathD: string;
};

const PEN_CLOSE_DIST_SQ = 1;

/**
 * PathEditor: imperative interaction engine for the canvas.
 * Handles pointer events for select, direct-select, and pen tools.
 * Uses a requestAnimationFrame loop during drag to bypass React.
 */
export class PathEditor {
  private svg: SVGSVGElement;
  private isDragging = false;
  private dragMode: DragMode = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragLayerId: string | null = null;
  private dragPointKey: string | null = null;
  private originalTransform: { x: number; y: number } | null = null;
  private originalPathD: string | null = null;
  private animFrameId = 0;
  private penPlacement: PenPlacement | null = null;
  private cleanup: (() => void) | null = null;
  private snapEngine = new SnapEngine(editorStore);

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.attach();
  }

  private attach() {
    const onDown = this.onPointerDown.bind(this);
    const onMove = this.onPointerMove.bind(this);
    const onUp = this.onPointerUp.bind(this);
    const onCancel = this.onPointerCancel.bind(this);
    const onKeyDown = this.onKeyDown.bind(this);
    const onDblClick = this.onDoubleClick.bind(this);

    this.svg.addEventListener('pointerdown', onDown);
    this.svg.addEventListener('dblclick', onDblClick);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);

    this.cleanup = () => {
      this.svg.removeEventListener('pointerdown', onDown);
      this.svg.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKeyDown);
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.snapEngine.destroy();
    };
  }

  private onPointerDown(e: PointerEvent) {
    const state = editorStore.getState();
    const tool = state.tool;
    const target = e.target as Element;
    const layerId = target.getAttribute?.('data-layer-id');
    const pointKey = target.getAttribute?.('data-point-key');

    if (tool === 'pen') {
      const activeLayerId = layerId ?? this.resolvePenLayerAtPointer();
      if (!activeLayerId) {
        const createdLayerId = this.createNewPenLayerAt(e.clientX, e.clientY);
        if (createdLayerId) {
          state.setSelection({ layerIds: [createdLayerId], pointIds: ['0:0'] });
        }
        return;
      }

      const result = this.beginPenPlacement(activeLayerId, e.clientX, e.clientY, e.pointerId);
      if (result === 'closed') {
        this.clearActiveSnapGuides();
        state.setSelection({ layerIds: [activeLayerId], pointIds: [] });
        return;
      }

      if (result) {
        state.setSelection({ layerIds: [activeLayerId], pointIds: [result.pointKey] });
        (target as Element).setPointerCapture?.(e.pointerId);
      }
      return;
    }

    if (tool === 'direct-select') {
      if (layerId && pointKey) {
        state.setSelection({ layerIds: [layerId], pointIds: [pointKey] });
        this.startPointDrag(layerId, pointKey, e.clientX, e.clientY);
        (target as Element).setPointerCapture?.(e.pointerId);
      } else if (layerId) {
        const nearestPointKey = this.findNearestPointKey(layerId, e.clientX, e.clientY);
        state.setSelection({
          layerIds: [layerId],
          pointIds: nearestPointKey ? [nearestPointKey] : [],
        });
      } else {
        state.clearSelection();
      }
      return;
    }

    if (tool === 'select') {
      if (layerId) {
        state.setSelection({ layerIds: [layerId], pointIds: [] });
        this.startLayerDrag(layerId, e.clientX, e.clientY);
        (target as Element).setPointerCapture?.(e.pointerId);
      } else {
        state.clearSelection();
      }
    }
  }

  private onDoubleClick(e: MouseEvent) {
    const state = editorStore.getState();
    const target = e.target as Element;
    const layerId = target.getAttribute?.('data-layer-id');

    state.setTool('direct-select');

    if (!layerId) {
      state.clearSelection();
      return;
    }

    const nearestPointKey = this.findNearestPointKey(layerId, e.clientX, e.clientY);
    state.setSelection({
      layerIds: [layerId],
      pointIds: nearestPointKey ? [nearestPointKey] : [],
    });
  }

  private resolvePenLayerAtPointer(): string | null {
    const state = editorStore.getState();
    const selectedLayerId = state.selection.layerIds[0] ?? null;
    if (!selectedLayerId) return null;

    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const selectedPath =
      state.project?.icons[iconId].states[stateId].layers[selectedLayerId]?.path?.d;
    if (!selectedPath || !isPathDirectlyEditable(selectedPath)) return null;

    return selectedLayerId;
  }

  private createNewPenLayerAt(clientX: number, clientY: number): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId || !state.project) return null;

    const svgPoint = this.clientToSvg(clientX, clientY);
    if (!svgPoint) return null;
    const snappedPoint = this.computeSnappedPoint(svgPoint);

    const icon = state.project.icons[iconId];
    const currentState = icon?.states[stateId];
    if (!icon || !currentState) return null;

    const ids = Object.keys(currentState.layers);
    let index = 1;
    let nextLayerId = `path-${index}`;
    while (ids.includes(nextLayerId)) {
      index += 1;
      nextLayerId = `path-${index}`;
    }

    editorStore.setState((s) => {
      if (!s.project) return s;
      const currentIcon = s.project.icons[iconId];
      const currentIconState = currentIcon?.states[stateId];
      if (!currentIcon || !currentIconState) return s;

      return {
        project: {
          ...s.project,
          icons: {
            ...s.project.icons,
            [iconId]: {
              ...currentIcon,
              states: {
                ...currentIcon.states,
                [stateId]: {
                  ...currentIconState,
                  layers: {
                    ...currentIconState.layers,
                    [nextLayerId]: {
                      id: nextLayerId,
                      role: 'primary',
                      visible: true,
                      path: { d: `M${snappedPoint.x} ${snappedPoint.y}` },
                      style: {
                        fill: { mode: 'fixed', value: 'none' },
                        stroke: { mode: 'currentColor' },
                        strokeWidth: 2,
                        lineCap: 'round',
                        lineJoin: 'round',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
    });

    return nextLayerId;
  }

  private beginPenPlacement(
    layerId: string,
    clientX: number,
    clientY: number,
    pointerId: number,
  ): PenPlacement | 'closed' | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const layer = state.project?.icons[iconId].states[stateId].layers[layerId];
    if (!layer?.path?.d || !isPathDirectlyEditable(layer.path.d)) return null;

    const svgPoint = this.clientToSvg(clientX, clientY);
    if (!svgPoint) return null;
    const snappedPoint = this.computeSnappedPoint(svgPoint, layerId, true);

    const editable = parseSvgPath(layer.path.d);
    const subPath = editable.subPaths[0];
    if (!subPath) return null;

    const firstPoint = subPath.points[0]?.position;
    const canClose = !!firstPoint && subPath.points.length >= 3 && !subPath.closed;
    if (canClose) {
      const dx = firstPoint.x - snappedPoint.x;
      const dy = firstPoint.y - snappedPoint.y;
      if (dx * dx + dy * dy <= PEN_CLOSE_DIST_SQ) {
        subPath.closed = true;
        state.patchLayer(iconId, stateId, layerId, {
          path: { ...layer.path, d: serializePath(editable) },
        });
        return 'closed';
      }
    }

    const newPointIndex = subPath.points.length;
    subPath.points.push({
      id: `${subPath.id}-pt-${newPointIndex}`,
      position: { x: snappedPoint.x, y: snappedPoint.y },
      handleIn: null,
      handleOut: null,
      nodeType: 'corner',
    });

    const basePathD = serializePath(editable);
    state.patchLayer(iconId, stateId, layerId, {
      path: { ...layer.path, d: basePathD },
    });

    this.penPlacement = {
      layerId,
      pointKey: `0:${newPointIndex}`,
      anchor: snappedPoint,
      pointerId,
      basePathD,
    };
    pauseHistory();

    return this.penPlacement;
  }

  private startLayerDrag(layerId: string, clientX: number, clientY: number) {
    const state = editorStore.getState();
    const icon = selectCurrentIcon(state);
    const currentState = selectCurrentState(state);
    if (!icon || !currentState) return;
    const layer = currentState.layers[layerId];
    if (!layer) return;

    this.dragMode = 'layer';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.originalTransform = {
      x: layer.transform?.x ?? 0,
      y: layer.transform?.y ?? 0,
    };
    pauseHistory();
  }

  private startPointDrag(
    layerId: string,
    pointKey: string,
    clientX: number,
    clientY: number,
  ) {
    const state = editorStore.getState();
    const currentState = selectCurrentState(state);
    const pathD = currentState?.layers[layerId]?.path?.d;
    if (!pathD || !isPathDirectlyEditable(pathD)) return;

    this.dragMode = 'point';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragPointKey = pointKey;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.originalPathD = pathD;
    pauseHistory();
  }

  private onPointerMove(e: PointerEvent) {
    if (this.penPlacement && e.pointerId === this.penPlacement.pointerId) {
      this.updatePenCurvePreview(e);
      return;
    }

    if (!this.isDragging || !this.dragLayerId) return;

    if (this.dragMode === 'layer') {
      this.dragLayer(e);
      return;
    }

    if (this.dragMode === 'point' && this.dragPointKey && this.originalPathD) {
      this.dragPoint(e);
    }
  }

  private dragLayer(e: PointerEvent) {
    if (!this.originalTransform || !this.dragLayerId) return;
    const svgPerPx = this.svgUnitsPerScreenPx();
    const dx = (e.clientX - this.dragStartX) * svgPerPx;
    const dy = (e.clientY - this.dragStartY) * svgPerPx;

    const layerId = this.dragLayerId;
    const newX = this.originalTransform.x + dx;
    const newY = this.originalTransform.y + dy;

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${layerId}"]`,
      ) as SVGPathElement | null;
      if (!pathEl) return;
      pathEl.setAttribute('transform', `translate(${newX}, ${newY})`);
    });
  }

  private dragPoint(e: PointerEvent) {
    if (!this.dragPointKey || !this.dragLayerId || !this.originalPathD) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;
    const snappedPoint = this.computeSnappedPoint(svgPoint, this.dragLayerId, true);

    const editable = parseSvgPath(this.originalPathD);
    const point = this.resolvePoint(editable, this.dragPointKey);
    if (!point) return;

    point.position.x = snappedPoint.x;
    point.position.y = snappedPoint.y;

    const nextD = serializePath(editable);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${this.dragLayerId}"]`,
      ) as SVGPathElement | null;
      if (!pathEl) return;
      pathEl.setAttribute('d', nextD);
      this.updateDraggedPointHandles(snappedPoint.x, snappedPoint.y);
    });
  }

  private updatePenCurvePreview(e: PointerEvent) {
    if (!this.penPlacement) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;

    const snappedPoint = this.computeSnappedPoint(svgPoint, this.penPlacement.layerId, true);
    const editable = parseSvgPath(this.penPlacement.basePathD);
    const point = this.resolvePoint(editable, this.penPlacement.pointKey);
    if (!point) return;

    const [subPathIdxRaw, pointIdxRaw] = this.penPlacement.pointKey.split(':');
    const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
    const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
    const subPath = editable.subPaths[subPathIdx];
    if (!subPath) return;

    const prev = subPath.points[pointIdx - 1] ?? null;
    const dx = snappedPoint.x - this.penPlacement.anchor.x;
    const dy = snappedPoint.y - this.penPlacement.anchor.y;
    const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

    if (prev) {
      if (moved) {
        prev.handleOut = {
          x: this.penPlacement.anchor.x + dx,
          y: this.penPlacement.anchor.y + dy,
        };
        prev.nodeType = 'smooth';
        point.handleIn = {
          x: this.penPlacement.anchor.x - dx,
          y: this.penPlacement.anchor.y - dy,
        };
        point.nodeType = 'smooth';
      } else {
        prev.handleOut = null;
        point.handleIn = null;
        point.nodeType = 'corner';
      }
    }

    const nextD = serializePath(editable);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${this.penPlacement?.layerId}"]`,
      ) as SVGPathElement | null;
      if (!pathEl) return;
      pathEl.setAttribute('d', nextD);
    });
  }

  private onPointerCancel() {
    this.clearActiveSnapGuides();
    if (this.penPlacement) {
      resumeHistory();
      this.penPlacement = null;
    }

    if (!this.isDragging) return;
    resumeHistory();
    this.resetDrag();
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;

    this.clearActiveSnapGuides();
    if (this.penPlacement) {
      resumeHistory();
      this.penPlacement = null;
      return;
    }

    if (!this.isDragging) return;
    resumeHistory();
    this.resetDrag();
  }

  private onPointerUp(e: PointerEvent) {
    if (this.penPlacement && e.pointerId === this.penPlacement.pointerId) {
      this.commitPenPlacement(e);
      resumeHistory();
      commitHistory('pen-point');
      this.penPlacement = null;
      this.clearActiveSnapGuides();
      return;
    }

    if (!this.isDragging || !this.dragLayerId) {
      this.clearActiveSnapGuides();
      this.resetDrag();
      return;
    }

    if (this.dragMode === 'layer') {
      this.commitLayerDrag(e);
    } else if (this.dragMode === 'point') {
      this.commitPointDrag(e);
    }

    resumeHistory();
    commitHistory('pointer-up');
    this.clearActiveSnapGuides();
    this.resetDrag();
  }

  private commitPenPlacement(e: PointerEvent) {
    if (!this.penPlacement) return;

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const layer = state.project?.icons[iconId].states[stateId].layers[this.penPlacement.layerId];
    if (!layer?.path) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;

    const snappedPoint = this.computeSnappedPoint(svgPoint, this.penPlacement.layerId);
    const editable = parseSvgPath(this.penPlacement.basePathD);
    const point = this.resolvePoint(editable, this.penPlacement.pointKey);
    if (!point) return;

    const [subPathIdxRaw, pointIdxRaw] = this.penPlacement.pointKey.split(':');
    const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
    const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
    const subPath = editable.subPaths[subPathIdx];
    const prev = subPath?.points[pointIdx - 1] ?? null;

    const dx = snappedPoint.x - this.penPlacement.anchor.x;
    const dy = snappedPoint.y - this.penPlacement.anchor.y;
    const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

    if (prev) {
      if (moved) {
        prev.handleOut = {
          x: this.penPlacement.anchor.x + dx,
          y: this.penPlacement.anchor.y + dy,
        };
        prev.nodeType = 'smooth';
        point.handleIn = {
          x: this.penPlacement.anchor.x - dx,
          y: this.penPlacement.anchor.y - dy,
        };
        point.nodeType = 'smooth';
      } else {
        prev.handleOut = null;
        point.handleIn = null;
        point.nodeType = 'corner';
      }
    }

    state.patchLayer(iconId, stateId, this.penPlacement.layerId, {
      path: { ...layer.path, d: serializePath(editable) },
    });
  }

  private commitLayerDrag(e: PointerEvent) {
    if (!this.originalTransform || !this.dragLayerId) return;

    const state = editorStore.getState();
    const svgPerPx = this.svgUnitsPerScreenPx();
    const dx = (e.clientX - this.dragStartX) * svgPerPx;
    const dy = (e.clientY - this.dragStartY) * svgPerPx;

    if (Math.abs(dx) <= 0.01 && Math.abs(dy) <= 0.01) return;

    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const icon = state.project?.icons[iconId];
    const currentState = icon?.states[stateId];
    const layer = currentState?.layers[this.dragLayerId];
    if (!layer) return;

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      transform: {
        ...(layer.transform ?? {}),
        x: this.originalTransform.x + dx,
        y: this.originalTransform.y + dy,
      },
    });
  }

  private commitPointDrag(e: PointerEvent) {
    if (!this.dragLayerId || !this.dragPointKey || !this.originalPathD) return;
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;
    const snappedPoint = this.computeSnappedPoint(svgPoint, this.dragLayerId);

    const editable = parseSvgPath(this.originalPathD);
    const point = this.resolvePoint(editable, this.dragPointKey);
    if (!point) return;

    point.position.x = snappedPoint.x;
    point.position.y = snappedPoint.y;

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      path: {
        ...(state.project?.icons[iconId].states[stateId].layers[this.dragLayerId]
          .path ?? { d: '' }),
        d: serializePath(editable),
      },
    });
  }

  private findNearestPointKey(layerId: string, clientX: number, clientY: number): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const d = state.project?.icons[iconId].states[stateId].layers[layerId]?.path?.d;
    if (!d || !isPathDirectlyEditable(d)) return null;

    const pointer = this.clientToSvg(clientX, clientY);
    if (!pointer) return null;

    const editable = parseSvgPath(d);
    let nearest: { key: string; distSq: number } | undefined;

    editable.subPaths.forEach((subPath, subPathIndex) => {
      subPath.points.forEach((point, pointIndex) => {
        const dx = point.position.x - pointer.x;
        const dy = point.position.y - pointer.y;
        const distSq = dx * dx + dy * dy;
        if (!nearest || distSq < nearest.distSq) {
          nearest = { key: `${subPathIndex}:${pointIndex}`, distSq };
        }
      });
    });

    // Avoid selecting a far-away point when user clicks empty area on the path fill.
    if (!nearest || nearest.distSq > 2.25) return null;
    return nearest.key;
  }

  private addPointAtPointer(layerId: string, clientX: number, clientY: number): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const layer = state.project?.icons[iconId].states[stateId].layers[layerId];
    if (!layer?.path?.d || !isPathDirectlyEditable(layer.path.d)) return null;

    const svgPoint = this.clientToSvg(clientX, clientY);
    if (!svgPoint) return null;
    const snappedPoint = this.computeSnappedPoint(svgPoint, layerId);

    const editable = parseSvgPath(layer.path.d);
    const subPath = editable.subPaths[0];
    if (!subPath) return null;

    subPath.points.push({
      id: `${subPath.id}-pt-${subPath.points.length}`,
      position: { x: snappedPoint.x, y: snappedPoint.y },
      handleIn: null,
      handleOut: null,
      nodeType: 'corner',
    });

    state.patchLayer(iconId, stateId, layerId, {
      path: { ...layer.path, d: serializePath(editable) },
    });

    return `0:${subPath.points.length - 1}`;
  }

  private resolvePoint(
    editable: ReturnType<typeof parseSvgPath>,
    pointKey: string,
  ) {
    const [subPathIdxRaw, pointIdxRaw] = pointKey.split(':');
    const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
    const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
    const subPath = editable.subPaths[subPathIdx];
    if (!subPath) return null;
    return subPath.points[pointIdx] ?? null;
  }

  private svgUnitsPerScreenPx(): number {
    const state = editorStore.getState();
    const variant = selectCurrentVariant(state);
    if (!variant) return 0;

    const rect = this.svg.getBoundingClientRect();
    return rect.width <= 0 ? 0 : variant.viewBox[2] / rect.width;
  }

  private clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const state = editorStore.getState();
    const variant = selectCurrentVariant(state);
    if (!variant) return null;

    const rect = this.svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const [vx, vy, vw, vh] = variant.viewBox;
    return {
      x: vx + ((clientX - rect.left) / rect.width) * vw,
      y: vy + ((clientY - rect.top) / rect.height) * vh,
    };
  }

  private computeSnappedPoint(
    point: { x: number; y: number },
    sourceLayerId?: string,
    publishGuides = false,
  ): SnapResult {
    const result = this.snapEngine.computeSnap(point, { sourceLayerId });
    if (publishGuides) {
      editorStore.getState().setActiveSnapGuides(result.guides);
    }
    return result;
  }

  private clearActiveSnapGuides() {
    editorStore.getState().setActiveSnapGuides([]);
  }

  private updateDraggedPointHandles(x: number, y: number) {
    if (!this.dragLayerId || !this.dragPointKey) return;
    const handles = this.svg.querySelectorAll<SVGCircleElement>(
      `[data-editor-handle="true"][data-layer-id="${this.dragLayerId}"][data-point-key="${this.dragPointKey}"]`,
    );

    handles.forEach((handle) => {
      handle.setAttribute('cx', `${x}`);
      handle.setAttribute('cy', `${y}`);
    });
  }

  private resetDrag() {
    this.clearActiveSnapGuides();
    this.isDragging = false;
    this.dragMode = null;
    this.dragLayerId = null;
    this.dragPointKey = null;
    this.originalTransform = null;
    this.originalPathD = null;
  }

  destroy() {
    this.clearActiveSnapGuides();
    this.cleanup?.();
  }
}

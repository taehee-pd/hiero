import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';
import { SnapEngine, type SnapResult } from './snap-engine';
import { pauseHistory, resumeHistory, commitHistory } from '@/lib/editor-store/history';

type ControlDirection = 'in' | 'out';
type DragMode = 'layer' | 'point' | 'control' | null;
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
  private dragControlDirection: ControlDirection | null = null;
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
    const controlDirection = target.getAttribute?.('data-control-direction') as ControlDirection | null;

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
      if (layerId && pointKey && controlDirection) {
        state.setSelection({ layerIds: [layerId], pointIds: [`${pointKey}@${controlDirection}`] });
        this.startControlDrag(layerId, pointKey, controlDirection, e.clientX, e.clientY);
        (target as Element).setPointerCapture?.(e.pointerId);
      } else if (layerId && pointKey) {
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
      segment: { type: 'line' },
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

  private startControlDrag(
    layerId: string,
    pointKey: string,
    direction: ControlDirection,
    clientX: number,
    clientY: number,
  ) {
    const state = editorStore.getState();
    const currentState = selectCurrentState(state);
    const pathD = currentState?.layers[layerId]?.path?.d;
    if (!pathD || !isPathDirectlyEditable(pathD)) return;

    this.dragMode = 'control';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragPointKey = pointKey;
    this.dragControlDirection = direction;
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
      return;
    }

    if (
      this.dragMode === 'control' &&
      this.dragPointKey &&
      this.dragControlDirection &&
      this.originalPathD
    ) {
      this.dragControl(e);
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
    const context = this.resolvePointContext(editable, this.dragPointKey);
    if (!context) return;

    const dx = snappedPoint.x - context.point.position.x;
    const dy = snappedPoint.y - context.point.position.y;
    this.translatePoint(context.subPath, context.pointIdx, dx, dy);

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

  private dragControl(e: PointerEvent) {
    if (!this.dragPointKey || !this.dragLayerId || !this.dragControlDirection || !this.originalPathD) {
      return;
    }

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;

    const editable = parseSvgPath(this.originalPathD);
    const context = this.resolvePointContext(editable, this.dragPointKey);
    if (!context) return;

    const controlPosition = this.applyControlPosition(
      context.subPath,
      context.pointIdx,
      this.dragControlDirection,
      svgPoint,
    );
    if (!controlPosition) return;

    const nextD = serializePath(editable);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${this.dragLayerId}"]`,
      ) as SVGPathElement | null;
      if (!pathEl) return;
      pathEl.setAttribute('d', nextD);
      this.updateDraggedControlHandle(
        this.dragLayerId!,
        this.dragPointKey!,
        this.dragControlDirection!,
        controlPosition,
        context.point.position,
      );
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
    } else if (this.dragMode === 'control') {
      this.commitControlDrag(e);
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
    const context = this.resolvePointContext(editable, this.dragPointKey);
    if (!context) return;

    const dx = snappedPoint.x - context.point.position.x;
    const dy = snappedPoint.y - context.point.position.y;
    this.translatePoint(context.subPath, context.pointIdx, dx, dy);

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      path: {
        ...(state.project?.icons[iconId].states[stateId].layers[this.dragLayerId]
          .path ?? { d: '' }),
        d: serializePath(editable),
      },
    });
  }

  private commitControlDrag(e: PointerEvent) {
    if (!this.dragLayerId || !this.dragPointKey || !this.dragControlDirection || !this.originalPathD) {
      return;
    }

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;

    const editable = parseSvgPath(this.originalPathD);
    const context = this.resolvePointContext(editable, this.dragPointKey);
    if (!context) return;

    const controlPosition = this.applyControlPosition(
      context.subPath,
      context.pointIdx,
      this.dragControlDirection,
      svgPoint,
    );
    if (!controlPosition) return;

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      path: {
        ...(state.project?.icons[iconId].states[stateId].layers[this.dragLayerId].path ?? {
          d: '',
        }),
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
      segment: { type: 'line' },
    });

    state.patchLayer(iconId, stateId, layerId, {
      path: { ...layer.path, d: serializePath(editable) },
    });

    return `0:${subPath.points.length - 1}`;
  }

  private resolvePointContext(editable: ReturnType<typeof parseSvgPath>, pointKey: string) {
    const [subPathIdxRaw, pointIdxRaw] = pointKey.split(':');
    const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
    const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
    const subPath = editable.subPaths[subPathIdx];
    if (!subPath) return null;
    const point = subPath.points[pointIdx] ?? null;
    if (!point) return null;
    return { point, subPath, pointIdx };
  }

  private resolvePoint(editable: ReturnType<typeof parseSvgPath>, pointKey: string) {
    return this.resolvePointContext(editable, pointKey)?.point ?? null;
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
      `[data-editor-handle="true"][data-handle-type="anchor"][data-layer-id="${this.dragLayerId}"][data-point-key="${this.dragPointKey}"]`,
    );

    handles.forEach((handle) => {
      handle.setAttribute('cx', `${x}`);
      handle.setAttribute('cy', `${y}`);
    });
  }

  private updateDraggedControlHandle(
    layerId: string,
    pointKey: string,
    direction: ControlDirection,
    control: { x: number; y: number },
    anchor: { x: number; y: number },
  ) {
    const hitTargets = this.svg.querySelectorAll<SVGCircleElement>(
      `[data-editor-handle="true"][data-handle-type="control"][data-handle-role="control-hit"][data-layer-id="${layerId}"][data-point-key="${pointKey}"][data-control-direction="${direction}"]`,
    );
    hitTargets.forEach((handle) => {
      handle.setAttribute('cx', `${control.x}`);
      handle.setAttribute('cy', `${control.y}`);
    });

    const visibleTargets = this.svg.querySelectorAll<SVGRectElement>(
      `[data-editor-handle="true"][data-handle-type="control"][data-handle-role="control-visible"][data-layer-id="${layerId}"][data-point-key="${pointKey}"][data-control-direction="${direction}"]`,
    );
    visibleTargets.forEach((handle) => {
      handle.setAttribute('transform', `translate(${control.x} ${control.y}) rotate(45)`);
    });

    const lines = this.svg.querySelectorAll<SVGLineElement>(
      `[data-editor-handle="true"][data-handle-type="control-line"][data-layer-id="${layerId}"][data-point-key="${pointKey}"][data-control-direction="${direction}"]`,
    );
    lines.forEach((line) => {
      line.setAttribute('x1', `${anchor.x}`);
      line.setAttribute('y1', `${anchor.y}`);
      line.setAttribute('x2', `${control.x}`);
      line.setAttribute('y2', `${control.y}`);
    });
  }

  private applyControlPosition(
    subPath: ReturnType<typeof parseSvgPath>['subPaths'][number],
    pointIdx: number,
    direction: ControlDirection,
    position: { x: number; y: number },
  ) {
    const point = subPath.points[pointIdx];
    if (!point) return null;

    if (direction === 'in') {
      const prev = subPath.points[pointIdx - 1];
      if (!prev) return null;
      if (point.segment?.type !== 'cubic') {
        prev.handleOut ??= this.defaultControlPoint(prev.position, point.position);
        point.segment = { type: 'cubic' };
      }
      point.handleIn = { x: position.x, y: position.y };
      point.nodeType = 'smooth';
      return point.handleIn;
    }

    const next = subPath.points[pointIdx + 1];
    if (!next) return null;
    if (next.segment?.type !== 'cubic') {
      next.handleIn ??= this.defaultControlPoint(next.position, point.position);
      next.segment = { type: 'cubic' };
    }
    point.handleOut = { x: position.x, y: position.y };
    point.nodeType = 'smooth';
    return point.handleOut;
  }

  private defaultControlPoint(from: { x: number; y: number }, toward: { x: number; y: number }) {
    return {
      x: from.x + (toward.x - from.x) / 3,
      y: from.y + (toward.y - from.y) / 3,
    };
  }

  private translatePoint(
    subPath: ReturnType<typeof parseSvgPath>['subPaths'][number],
    pointIdx: number,
    dx: number,
    dy: number,
  ) {
    const point = subPath.points[pointIdx];
    if (!point) return;

    point.position.x += dx;
    point.position.y += dy;
    if (point.handleIn) {
      point.handleIn.x += dx;
      point.handleIn.y += dy;
    }
    if (point.handleOut) {
      point.handleOut.x += dx;
      point.handleOut.y += dy;
    }

    const prev = subPath.points[pointIdx - 1];
    if (point.segment?.type === 'quadratic' && prev?.handleOut) {
      prev.handleOut.x += dx;
      prev.handleOut.y += dy;
    }

    const next = subPath.points[pointIdx + 1];
    if (next?.segment?.type === 'quadratic' && next.handleIn) {
      next.handleIn.x += dx;
      next.handleIn.y += dy;
    }
  }

  private resetDrag() {
    this.clearActiveSnapGuides();
    this.isDragging = false;
    this.dragMode = null;
    this.dragLayerId = null;
    this.dragPointKey = null;
    this.dragControlDirection = null;
    this.originalTransform = null;
    this.originalPathD = null;
  }

  destroy() {
    this.clearActiveSnapGuides();
    this.cleanup?.();
  }
}

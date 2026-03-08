import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';
import {
  commitHistory,
  discardHistory,
  pauseHistory,
  resumeHistory,
} from '@/lib/editor-store/history';
import {
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectPath,
  createStarPath,
} from './path-shapes';
import { getSelectedPointsBoundingBox } from './vector-commands';
import type { PathPoint } from './path-model';
import type { SelectionState, ShapeType } from '@/lib/editor-store/types';
import { SnapEngine, type SnapResult } from './snap-engine';

type ControlDirection = 'in' | 'out';
type DragMode =
  | 'layer'
  | 'point'
  | 'control'
  | 'point-marquee'
  | 'shape'
  | 'selection-move'
  | 'selection-resize'
  | null;
type PenPlacement = {
  layerId: string;
  pointKey: string;
  anchor: { x: number; y: number };
  pointerId: number;
  basePathD: string;
};
type ShapePlacement = {
  layerId: string;
  pointerId: number;
  start: { x: number; y: number };
  previousSelection: SelectionState;
};
type BBoxHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type SelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
type SelectionTransformPlacement = {
  layerId: string;
  pointerId: number;
  pointKeys: string[];
  start: { x: number; y: number };
  bounds: SelectionBounds;
  mode: 'move' | 'resize';
  handle: BBoxHandle | null;
  basePathD: string;
};
type PointMarqueePlacement = {
  layerId: string;
  pointerId: number;
  start: { x: number; y: number };
  baseSelection: string[];
  mode: 'replace' | 'toggle';
  clickLayerId: string | null;
};

const PEN_CLOSE_DIST_SQ = 1;
const SHAPE_EMPTY_EPSILON = 0.001;
const BBOX_HIT_PADDING_PX = 12;
const POINT_HIT_RADIUS_PX = 18;
const MARQUEE_DRAG_THRESHOLD_PX = 4;

function getActiveVariantState(
  state: ReturnType<typeof editorStore.getState>,
  iconId: string | null | undefined,
  stateId: string | null | undefined,
) {
  if (!iconId || !state.currentVariantId || !stateId) return null;
  return state.project?.icons[iconId]?.variants[state.currentVariantId]?.states[stateId] ?? null;
}

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
  private shapePlacement: ShapePlacement | null = null;
  private pointMarqueePlacement: PointMarqueePlacement | null = null;
  private selectionTransformPlacement: SelectionTransformPlacement | null = null;
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

    if (tool === 'shape') {
      const placement = this.beginShapePlacement(e);
      if (placement) {
        state.setSelection({ layerIds: [placement.layerId], pointIds: [] });
        this.svg.setPointerCapture?.(e.pointerId);
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
      } else if (this.beginSelectionBoundsDrag(e)) {
        this.svg.setPointerCapture?.(e.pointerId);
      } else if (this.beginPointMarquee(e, layerId)) {
        this.svg.setPointerCapture?.(e.pointerId);
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

    const selectedPath = getActiveVariantState(state, iconId, stateId)?.layers[selectedLayerId]?.path?.d;
    if (!selectedPath || !isPathDirectlyEditable(selectedPath)) return null;

    return selectedLayerId;
  }

  private createNewPenLayerAt(clientX: number, clientY: number): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId || !state.project || !state.currentVariantId) return null;

    const svgPoint = this.clientToSvg(clientX, clientY);
    if (!svgPoint) return null;
    const snappedPoint = this.computeSnappedPoint(svgPoint);

    const icon = state.project.icons[iconId];
    const currentState = getActiveVariantState(state, iconId, stateId);
    if (!icon || !currentState) return null;

    const ids = Object.keys(currentState.layers);
    let index = 1;
    let nextLayerId = `path-${index}`;
    while (ids.includes(nextLayerId)) {
      index += 1;
      nextLayerId = `path-${index}`;
    }

    editorStore.setState((s) => {
      if (!s.project || !s.currentVariantId) return s;
      const currentIcon = s.project.icons[iconId];
      const currentIconState = getActiveVariantState(s, iconId, stateId);
      if (!currentIcon || !currentIconState) return s;

      return {
        project: {
          ...s.project,
          icons: {
            ...s.project.icons,
            [iconId]: {
              ...currentIcon,
              variants: {
                ...currentIcon.variants,
                [s.currentVariantId]: {
                  ...currentIcon.variants[s.currentVariantId],
                  states: {
                    ...currentIcon.variants[s.currentVariantId].states,
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

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[layerId];
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
      nodeType: 'static',
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

    if (this.shapePlacement && e.pointerId === this.shapePlacement.pointerId) {
      this.updateShapePreview(e);
      return;
    }

    if (
      this.selectionTransformPlacement &&
      e.pointerId === this.selectionTransformPlacement.pointerId
    ) {
      this.updateSelectionTransformPreview(e);
      return;
    }

    if (this.pointMarqueePlacement && e.pointerId === this.pointMarqueePlacement.pointerId) {
      this.updatePointMarquee(e);
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

  private beginSelectionBoundsDrag(e: PointerEvent): boolean {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    const layerId = state.selection.layerIds[0] ?? null;
    if (!iconId || !stateId || !layerId) return false;

    const bbox = getSelectedPointsBoundingBox();
    if (!bbox) return false;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return false;
    const hit = this.hitTestSelectionBounds(svgPoint, bbox);
    if (!hit) return false;

    const pathD = getActiveVariantState(state, iconId, stateId)?.layers[layerId]?.path?.d;
    if (!pathD || !isPathDirectlyEditable(pathD)) return false;

    this.dragMode = hit.type === 'move' ? 'selection-move' : 'selection-resize';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.originalPathD = pathD;
    this.selectionTransformPlacement = {
      layerId,
      pointerId: e.pointerId,
      pointKeys: state.selection.pointIds,
      start: this.snapPointToGrid(svgPoint),
      bounds: {
        minX: bbox.minX,
        minY: bbox.minY,
        maxX: bbox.maxX,
        maxY: bbox.maxY,
      },
      mode: hit.type,
      handle: hit.handle,
      basePathD: pathD,
    };
    state.setPointTransformLabel({
      width: bbox.maxX - bbox.minX,
      height: bbox.maxY - bbox.minY,
    });
    pauseHistory();
    return true;
  }

  private beginPointMarquee(e: PointerEvent, clickLayerId: string | null): boolean {
    const state = editorStore.getState();
    const layerId = this.resolveMarqueeLayerId(clickLayerId);
    if (!layerId) return false;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return false;

    this.dragMode = 'point-marquee';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.pointMarqueePlacement = {
      layerId,
      pointerId: e.pointerId,
      start: svgPoint,
      baseSelection: uniquePointKeys(state.selection.pointIds),
      mode: e.shiftKey ? 'toggle' : 'replace',
      clickLayerId,
    };
    state.setPointMarquee({
      minX: svgPoint.x,
      minY: svgPoint.y,
      maxX: svgPoint.x,
      maxY: svgPoint.y,
    });
    return true;
  }

  private resolveMarqueeLayerId(clickLayerId: string | null): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const candidates = [clickLayerId, state.selection.layerIds[0] ?? null];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const d = getActiveVariantState(state, iconId, stateId)?.layers[candidate]?.path?.d;
      if (d && isPathDirectlyEditable(d)) return candidate;
    }

    return null;
  }

  private updatePointMarquee(e: PointerEvent) {
    const placement = this.pointMarqueePlacement;
    if (!placement) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;

    const marquee = normalizeBounds(placement.start, svgPoint);
    const state = editorStore.getState();
    state.setPointMarquee(marquee);

    const matchedPointKeys = this.collectPointsInMarquee(placement.layerId, marquee);
    if (placement.mode === 'toggle') {
      const baseSelection = new Set(placement.baseSelection);
      for (const key of matchedPointKeys) {
        if (baseSelection.has(key)) {
          baseSelection.delete(key);
        } else {
          baseSelection.add(key);
        }
      }
      state.setSelection({
        layerIds: [placement.layerId],
        pointIds: [...baseSelection],
      });
      return;
    }

    state.setSelection({
      layerIds: [placement.layerId],
      pointIds: matchedPointKeys,
    });
  }

  private updateSelectionTransformPreview(e: PointerEvent) {
    if (!this.selectionTransformPlacement || !this.dragLayerId) return;

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const preview = this.buildSelectionTransformPreview(e);
    if (!preview) return;

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      path: { d: preview.d },
    });
    state.setPointTransformLabel(preview.label);
  }

  private beginShapePlacement(e: PointerEvent): ShapePlacement | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId || !state.project) return null;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return null;
    const start = this.snapPointToGrid(svgPoint);
    const layerId = this.createShapeLayer(start);
    if (!layerId) return null;

    this.dragMode = 'shape';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.shapePlacement = {
      layerId,
      pointerId: e.pointerId,
      start,
      previousSelection: state.selection,
    };

    return this.shapePlacement;
  }

  private updateShapePreview(e: PointerEvent) {
    if (!this.shapePlacement) return;

    const preview = this.buildShapePreview(this.shapePlacement.start, e);
    if (!preview) return;

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    state.patchLayer(iconId, stateId, this.shapePlacement.layerId, {
      path: { d: preview.d },
    });
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
        point.nodeType = 'static';
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

    if (this.shapePlacement) {
      this.cancelShapePlacement();
      return;
    }

    if (this.selectionTransformPlacement) {
      discardHistory();
      editorStore.getState().setPointTransformLabel(null);
      this.resetDrag();
      return;
    }

    if (this.pointMarqueePlacement) {
      editorStore.getState().setPointMarquee(null);
      this.resetDrag();
      return;
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

    if (this.shapePlacement) {
      this.cancelShapePlacement();
      return;
    }

    if (this.selectionTransformPlacement) {
      discardHistory();
      editorStore.getState().setPointTransformLabel(null);
      this.resetDrag();
      return;
    }

    if (this.pointMarqueePlacement) {
      editorStore.getState().setPointMarquee(null);
      this.resetDrag();
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

    if (this.shapePlacement && e.pointerId === this.shapePlacement.pointerId) {
      this.commitShapePlacement(e);
      return;
    }

    if (
      this.selectionTransformPlacement &&
      e.pointerId === this.selectionTransformPlacement.pointerId
    ) {
      this.commitSelectionTransform(e);
      return;
    }

    if (this.pointMarqueePlacement && e.pointerId === this.pointMarqueePlacement.pointerId) {
      this.commitPointMarquee(e);
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

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[this.penPlacement.layerId];
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
        point.nodeType = 'static';
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
    const currentState = getActiveVariantState(state, iconId, stateId);
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
        ...(getActiveVariantState(state, iconId, stateId)?.layers[this.dragLayerId]
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
        ...(getActiveVariantState(state, iconId, stateId)?.layers[this.dragLayerId].path ?? {
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

    const d = getActiveVariantState(state, iconId, stateId)?.layers[layerId]?.path?.d;
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

    const hitRadius = this.svgUnitsPerScreenPx() * POINT_HIT_RADIUS_PX;
    const nearestPoint = nearest;
    if (!nearestPoint || nearestPoint.distSq > hitRadius * hitRadius) return null;
    return nearestPoint.key;
  }

  private collectPointsInMarquee(
    layerId: string,
    marquee: { minX: number; minY: number; maxX: number; maxY: number },
  ): string[] {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return [];

    const d = getActiveVariantState(state, iconId, stateId)?.layers[layerId]?.path?.d;
    if (!d || !isPathDirectlyEditable(d)) return [];

    const editable = parseSvgPath(d);
    const hitRadius = this.svgUnitsPerScreenPx() * POINT_HIT_RADIUS_PX;
    const matches: string[] = [];

    editable.subPaths.forEach((subPath, subPathIndex) => {
      subPath.points.forEach((point, pointIndex) => {
        if (
          point.position.x + hitRadius >= marquee.minX &&
          point.position.x - hitRadius <= marquee.maxX &&
          point.position.y + hitRadius >= marquee.minY &&
          point.position.y - hitRadius <= marquee.maxY
        ) {
          matches.push(`${subPathIndex}:${pointIndex}`);
        }
      });
    });

    return matches;
  }

  private addPointAtPointer(layerId: string, clientX: number, clientY: number): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return null;

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[layerId];
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
      nodeType: 'static',
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

  private snapPointToGrid(point: { x: number; y: number }) {
    return this.computeSnappedPoint(point);
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
    editorStore.getState().setPointMarquee(null);
    this.isDragging = false;
    this.dragMode = null;
    this.dragLayerId = null;
    this.dragPointKey = null;
    this.dragControlDirection = null;
    this.originalTransform = null;
    this.originalPathD = null;
    this.shapePlacement = null;
    this.pointMarqueePlacement = null;
    this.selectionTransformPlacement = null;
  }

  destroy() {
    this.clearActiveSnapGuides();
    this.cleanup?.();
  }

  private createShapeLayer(start: { x: number; y: number }): string | null {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId || !state.project || !state.currentVariantId) return null;

    const icon = state.project.icons[iconId];
    const currentState = getActiveVariantState(state, iconId, stateId);
    if (!icon || !currentState) return null;

    const ids = Object.keys(currentState.layers);
    let index = 1;
    let nextLayerId = `shape-${index}`;
    while (ids.includes(nextLayerId)) {
      index += 1;
      nextLayerId = `shape-${index}`;
    }

    const initialPath = buildShapePathFromDrag({
      shapeType: state.shapeSubTool,
      start,
      current: start,
      shiftKey: false,
      altKey: false,
      polygonSides: state.shapePolygonSides,
      starPoints: state.shapeStarPoints,
    }).d;

    pauseHistory();
    editorStore.setState((s) => {
      if (!s.project || !s.currentVariantId) return s;
      const currentIcon = s.project.icons[iconId];
      const currentIconState = getActiveVariantState(s, iconId, stateId);
      if (!currentIcon || !currentIconState) return s;

      return {
        project: {
          ...s.project,
          icons: {
            ...s.project.icons,
            [iconId]: {
              ...currentIcon,
              variants: {
                ...currentIcon.variants,
                [s.currentVariantId]: {
                  ...currentIcon.variants[s.currentVariantId],
                  states: {
                    ...currentIcon.variants[s.currentVariantId].states,
                    [stateId]: {
                      ...currentIconState,
                      layers: {
                        ...currentIconState.layers,
                        [nextLayerId]: {
                          id: nextLayerId,
                          role: 'primary',
                          visible: true,
                          path: { d: initialPath },
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
          },
        },
      };
    });

    return nextLayerId;
  }

  private buildShapePreview(start: { x: number; y: number }, e: PointerEvent) {
    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return null;

    const current = this.snapPointToGrid(svgPoint);
    const state = editorStore.getState();

    return buildShapePathFromDrag({
      shapeType: state.shapeSubTool,
      start,
      current,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      polygonSides: state.shapePolygonSides,
      starPoints: state.shapeStarPoints,
    });
  }

  private commitShapePlacement(e: PointerEvent) {
    if (!this.shapePlacement) return;

    const preview = this.buildShapePreview(this.shapePlacement.start, e);
    if (!preview || preview.isEmpty) {
      this.cancelShapePlacement();
      return;
    }

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) {
      this.cancelShapePlacement();
      return;
    }

    state.patchLayer(iconId, stateId, this.shapePlacement.layerId, {
      path: { d: preview.d },
    });

    resumeHistory();
    commitHistory('shape-draw');
    this.resetDrag();
  }

  private cancelShapePlacement() {
    const previousSelection = this.shapePlacement?.previousSelection ?? {
      layerIds: [],
      pointIds: [],
    };

    discardHistory();
    editorStore.getState().setSelection(previousSelection);
    this.resetDrag();
  }

  private commitSelectionTransform(e: PointerEvent) {
    if (!this.selectionTransformPlacement || !this.dragLayerId) return;

    const preview = this.buildSelectionTransformPreview(e);
    if (!preview) {
      discardHistory();
      editorStore.getState().setPointTransformLabel(null);
      this.resetDrag();
      return;
    }

    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) {
      discardHistory();
      state.setPointTransformLabel(null);
      this.resetDrag();
      return;
    }

    state.patchLayer(iconId, stateId, this.dragLayerId, {
      path: { d: preview.d },
    });
    state.setPointTransformLabel(null);
    resumeHistory();
    commitHistory(
      this.selectionTransformPlacement.mode === 'move'
        ? 'point-group-move'
        : 'point-group-resize',
    );
    this.resetDrag();
  }

  private commitPointMarquee(e: PointerEvent) {
    const placement = this.pointMarqueePlacement;
    if (!placement) return;

    const moved =
      Math.abs(e.clientX - this.dragStartX) > MARQUEE_DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - this.dragStartY) > MARQUEE_DRAG_THRESHOLD_PX;

    const state = editorStore.getState();
    if (!moved) {
      if (placement.clickLayerId) {
        const nearestPointKey = this.findNearestPointKey(
          placement.clickLayerId,
          e.clientX,
          e.clientY,
        );
        if (nearestPointKey) {
          state.setSelection({
            layerIds: [placement.clickLayerId],
            pointIds: [nearestPointKey],
          });
        } else {
          state.setSelection({
            layerIds: [placement.layerId],
            pointIds: [],
          });
        }
      } else {
        state.clearSelection();
      }
    }

    this.resetDrag();
  }

  private buildSelectionTransformPreview(
    e: PointerEvent,
  ): { d: string; label: { width: number; height: number } } | null {
    const placement = this.selectionTransformPlacement;
    if (!placement) return null;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return null;
    const current = this.snapPointToGrid(svgPoint);
    const editable = parseSvgPath(placement.basePathD);
    const resolvedPoints = placement.pointKeys
      .map((key) => {
        const point = this.resolvePoint(editable, key);
        if (!point) return null;
        return { key, point };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (resolvedPoints.length === 0) return null;

    if (placement.mode === 'move') {
      const dx = current.x - placement.start.x;
      const dy = current.y - placement.start.y;
      resolvedPoints.forEach(({ point }) => {
        translatePathPoint(point, dx, dy);
      });
      return {
        d: serializePath(editable),
        label: {
          width: placement.bounds.maxX - placement.bounds.minX,
          height: placement.bounds.maxY - placement.bounds.minY,
        },
      };
    }

    const nextBounds = computeResizedBounds(
      placement.bounds,
      placement.handle ?? 'se',
      current,
      e.shiftKey,
      e.altKey,
    );
    const scaleX = (nextBounds.maxX - nextBounds.minX) / Math.max(
      placement.bounds.maxX - placement.bounds.minX,
      SHAPE_EMPTY_EPSILON,
    );
    const scaleY = (nextBounds.maxY - nextBounds.minY) / Math.max(
      placement.bounds.maxY - placement.bounds.minY,
      SHAPE_EMPTY_EPSILON,
    );

    resolvedPoints.forEach(({ point }) => {
      const originalPosition = { ...point.position };
      const nextPosition = mapPointIntoBounds(point.position, placement.bounds, nextBounds);
      point.position.x = nextPosition.x;
      point.position.y = nextPosition.y;

      if (point.handleIn) {
        point.handleIn = scaleHandleRelativeToPoint(point.handleIn, originalPosition, nextPosition, scaleX, scaleY);
      }
      if (point.handleOut) {
        point.handleOut = scaleHandleRelativeToPoint(point.handleOut, originalPosition, nextPosition, scaleX, scaleY);
      }
    });

    return {
      d: serializePath(editable),
      label: {
        width: nextBounds.maxX - nextBounds.minX,
        height: nextBounds.maxY - nextBounds.minY,
      },
    };
  }

  private hitTestSelectionBounds(
    point: { x: number; y: number },
    bbox: SelectionBounds,
  ): { type: 'move'; handle: null } | { type: 'resize'; handle: BBoxHandle } | null {
    const svgPadding = this.svgUnitsPerScreenPx() * BBOX_HIT_PADDING_PX;
    const handlePositions = getSelectionHandlePositions(bbox);

    for (const [handle, position] of Object.entries(handlePositions) as Array<
      [BBoxHandle, { x: number; y: number }]
    >) {
      if (
        Math.abs(point.x - position.x) <= svgPadding &&
        Math.abs(point.y - position.y) <= svgPadding
      ) {
        return { type: 'resize', handle };
      }
    }

    if (
      point.x >= bbox.minX &&
      point.x <= bbox.maxX &&
      point.y >= bbox.minY &&
      point.y <= bbox.maxY
    ) {
      return { type: 'move', handle: null };
    }

    return null;
  }
}

export function buildShapePathFromDrag(input: {
  shapeType: ShapeType;
  start: { x: number; y: number };
  current: { x: number; y: number };
  shiftKey: boolean;
  altKey: boolean;
  polygonSides: number;
  starPoints: number;
}): { d: string; isEmpty: boolean } {
  const { shapeType, start, current, shiftKey, altKey, polygonSides, starPoints } = input;
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  if (shapeType === 'line') {
    const constrained = shiftKey ? constrainEqualDelta(dx, dy) : { dx, dy };
    const startPoint = altKey
      ? {
          x: start.x - constrained.dx,
          y: start.y - constrained.dy,
        }
      : start;
    const endPoint = altKey
      ? {
          x: start.x + constrained.dx,
          y: start.y + constrained.dy,
        }
      : {
          x: start.x + constrained.dx,
          y: start.y + constrained.dy,
        };

    return {
      d: createLinePath(startPoint.x, startPoint.y, endPoint.x, endPoint.y),
      isEmpty:
        Math.abs(constrained.dx) <= SHAPE_EMPTY_EPSILON &&
        Math.abs(constrained.dy) <= SHAPE_EMPTY_EPSILON,
    };
  }

  const box = resolveDragBox(start, current, shiftKey, altKey);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  switch (shapeType) {
    case 'rectangle':
      return {
        d: createRectPath(box.x, box.y, box.width, box.height),
        isEmpty: box.width <= SHAPE_EMPTY_EPSILON || box.height <= SHAPE_EMPTY_EPSILON,
      };
    case 'ellipse':
      return {
        d: createEllipsePath(centerX, centerY, box.width / 2, box.height / 2),
        isEmpty: box.width <= SHAPE_EMPTY_EPSILON || box.height <= SHAPE_EMPTY_EPSILON,
      };
    case 'polygon': {
      const radius = Math.min(box.width, box.height) / 2;
      return {
        d: createPolygonPath(centerX, centerY, radius, polygonSides),
        isEmpty: radius <= SHAPE_EMPTY_EPSILON,
      };
    }
    case 'star': {
      const outerRadius = Math.min(box.width, box.height) / 2;
      return {
        d: createStarPath(centerX, centerY, outerRadius, outerRadius / 2, starPoints),
        isEmpty: outerRadius <= SHAPE_EMPTY_EPSILON,
      };
    }
  }
}

function resolveDragBox(
  start: { x: number; y: number },
  current: { x: number; y: number },
  shiftKey: boolean,
  altKey: boolean,
) {
  const rawDx = current.x - start.x;
  const rawDy = current.y - start.y;

  if (altKey) {
    let halfWidth = Math.abs(rawDx);
    let halfHeight = Math.abs(rawDy);

    if (shiftKey) {
      const size = Math.max(halfWidth, halfHeight);
      halfWidth = size;
      halfHeight = size;
    }

    return {
      x: start.x - halfWidth,
      y: start.y - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    };
  }

  const constrained = shiftKey ? constrainEqualDelta(rawDx, rawDy) : { dx: rawDx, dy: rawDy };
  const endX = start.x + constrained.dx;
  const endY = start.y + constrained.dy;

  return {
    x: Math.min(start.x, endX),
    y: Math.min(start.y, endY),
    width: Math.abs(constrained.dx),
    height: Math.abs(constrained.dy),
  };
}

function constrainEqualDelta(dx: number, dy: number) {
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    dx: resolveSignedLength(dx, dy, size),
    dy: resolveSignedLength(dy, dx, size),
  };
}

function resolveSignedLength(primary: number, secondary: number, length: number): number {
  if (length <= SHAPE_EMPTY_EPSILON) return 0;
  if (primary > 0) return length;
  if (primary < 0) return -length;
  if (secondary > 0) return length;
  if (secondary < 0) return -length;
  return length;
}

function translatePathPoint(point: PathPoint, dx: number, dy: number): void {
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
}

function normalizeBounds(
  a: { x: number; y: number },
  b: { x: number; y: number },
): SelectionBounds {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

function uniquePointKeys(pointIds: string[]): string[] {
  return Array.from(
    new Set(
      pointIds.map((pointId) => pointId.split('@')[0] ?? pointId).filter(Boolean),
    ),
  );
}

function getSelectionHandlePositions(bounds: SelectionBounds): Record<BBoxHandle, { x: number; y: number }> {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  return {
    nw: { x: bounds.minX, y: bounds.minY },
    n: { x: midX, y: bounds.minY },
    ne: { x: bounds.maxX, y: bounds.minY },
    e: { x: bounds.maxX, y: midY },
    se: { x: bounds.maxX, y: bounds.maxY },
    s: { x: midX, y: bounds.maxY },
    sw: { x: bounds.minX, y: bounds.maxY },
    w: { x: bounds.minX, y: midY },
  };
}

function computeResizedBounds(
  bounds: SelectionBounds,
  handle: BBoxHandle,
  current: { x: number; y: number },
  preserveAspect: boolean,
  resizeFromCenter: boolean,
): SelectionBounds {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const edges = getHandleEdges(handle);
  const originalWidth = Math.max(bounds.maxX - bounds.minX, SHAPE_EMPTY_EPSILON);
  const originalHeight = Math.max(bounds.maxY - bounds.minY, SHAPE_EMPTY_EPSILON);
  const aspectRatio = originalWidth / originalHeight;

  let minX = bounds.minX;
  let maxX = bounds.maxX;
  let minY = bounds.minY;
  let maxY = bounds.maxY;

  if (resizeFromCenter) {
    if (edges.left || edges.right) {
      const halfWidth = Math.max(Math.abs(current.x - center.x), SHAPE_EMPTY_EPSILON / 2);
      minX = center.x - halfWidth;
      maxX = center.x + halfWidth;
    }
    if (edges.top || edges.bottom) {
      const halfHeight = Math.max(Math.abs(current.y - center.y), SHAPE_EMPTY_EPSILON / 2);
      minY = center.y - halfHeight;
      maxY = center.y + halfHeight;
    }
  } else {
    if (edges.left) minX = Math.min(current.x, bounds.maxX - SHAPE_EMPTY_EPSILON);
    if (edges.right) maxX = Math.max(current.x, bounds.minX + SHAPE_EMPTY_EPSILON);
    if (edges.top) minY = Math.min(current.y, bounds.maxY - SHAPE_EMPTY_EPSILON);
    if (edges.bottom) maxY = Math.max(current.y, bounds.minY + SHAPE_EMPTY_EPSILON);
  }

  if (preserveAspect) {
    ({ minX, minY, maxX, maxY } = applyAspectRatioToBounds({
      bounds,
      current: { minX, minY, maxX, maxY },
      center,
      edges,
      aspectRatio,
      resizeFromCenter,
    }));
  }

  return { minX, minY, maxX, maxY };
}

function getHandleEdges(handle: BBoxHandle) {
  return {
    left: handle.includes('w'),
    right: handle.includes('e'),
    top: handle.includes('n'),
    bottom: handle.includes('s'),
  };
}

function applyAspectRatioToBounds(input: {
  bounds: SelectionBounds;
  current: SelectionBounds;
  center: { x: number; y: number };
  edges: ReturnType<typeof getHandleEdges>;
  aspectRatio: number;
  resizeFromCenter: boolean;
}): SelectionBounds {
  const { bounds, current, center, edges, aspectRatio, resizeFromCenter } = input;
  let width = Math.max(current.maxX - current.minX, SHAPE_EMPTY_EPSILON);
  let height = Math.max(current.maxY - current.minY, SHAPE_EMPTY_EPSILON);

  if ((edges.left || edges.right) && !(edges.top || edges.bottom)) {
    height = width / aspectRatio;
  } else if ((edges.top || edges.bottom) && !(edges.left || edges.right)) {
    width = height * aspectRatio;
  } else {
    const widthRatio = width / Math.max(bounds.maxX - bounds.minX, SHAPE_EMPTY_EPSILON);
    const heightRatio = height / Math.max(bounds.maxY - bounds.minY, SHAPE_EMPTY_EPSILON);
    if (widthRatio >= heightRatio) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }
  }

  if (resizeFromCenter) {
    return {
      minX: center.x - width / 2,
      maxX: center.x + width / 2,
      minY: center.y - height / 2,
      maxY: center.y + height / 2,
    };
  }

  const anchorX = edges.left ? bounds.maxX : edges.right ? bounds.minX : center.x;
  const anchorY = edges.top ? bounds.maxY : edges.bottom ? bounds.minY : center.y;

  return {
    minX: edges.left ? anchorX - width : edges.right ? anchorX : anchorX - width / 2,
    maxX: edges.left ? anchorX : edges.right ? anchorX + width : anchorX + width / 2,
    minY: edges.top ? anchorY - height : edges.bottom ? anchorY : anchorY - height / 2,
    maxY: edges.top ? anchorY : edges.bottom ? anchorY + height : anchorY + height / 2,
  };
}

export function mapPointIntoBounds(
  point: { x: number; y: number },
  oldBounds: SelectionBounds,
  newBounds: SelectionBounds,
) {
  return {
    x: remapAxis(point.x, oldBounds.minX, oldBounds.maxX, newBounds.minX, newBounds.maxX),
    y: remapAxis(point.y, oldBounds.minY, oldBounds.maxY, newBounds.minY, newBounds.maxY),
  };
}

function remapAxis(
  value: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number,
) {
  const oldSize = oldMax - oldMin;
  if (Math.abs(oldSize) <= SHAPE_EMPTY_EPSILON) {
    return (newMin + newMax) / 2;
  }
  return newMin + ((value - oldMin) / oldSize) * (newMax - newMin);
}

function scaleHandleRelativeToPoint(
  handle: { x: number; y: number },
  oldPoint: { x: number; y: number },
  newPoint: { x: number; y: number },
  scaleX: number,
  scaleY: number,
) {
  return {
    x: newPoint.x + (handle.x - oldPoint.x) * scaleX,
    y: newPoint.y + (handle.y - oldPoint.y) * scaleY,
  };
}

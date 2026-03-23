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
import { getSelectedPointsBoundingBox, splitSegmentAtPoint } from './vector-commands';
import type { PathPoint } from './path-model';
import type { GuideItem, Layer } from '@/lib/schema/types';
import type { SelectionState, ShapeType } from '@/lib/editor-store/types';
import { SnapEngine, type SnapResult } from './snap-engine';

type ControlDirection = 'in' | 'out';
type DragMode =
  | 'layer'
  | 'layer-resize'
  | 'point'
  | 'control'
  | 'point-marquee'
  | 'select-marquee'
  | 'shape'
  | 'selection-move'
  | 'selection-resize'
  | null;

type LayerResizePlacement = {
  layerId: string;
  pointerId: number;
  handle: BBoxHandle;
  startSvg: { x: number; y: number };
  bbox: { x: number; y: number; width: number; height: number };
  originalTransform: { x?: number; y?: number; scaleX?: number; scaleY?: number };
};
type PenPlacement = {
  layerId: string;
  pointKey: string;
  anchor: { x: number; y: number };
  pointerId: number;
  basePathD: string;
};
type PenHandlePreview = {
  anchor: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
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
  layerId: string | null;
  pointerId: number;
  start: { x: number; y: number };
  baseSelection: string[];
  baseLayerIds: string[];
  baseGuideIndexes: number[];
  mode: 'replace' | 'toggle';
  clickLayerId: string | null;
  tool: 'select' | 'direct-select';
};

const PEN_CLOSE_DIST_SQ = 1;
const SHAPE_EMPTY_EPSILON = 0.001;
const BBOX_HIT_PADDING_PX = 12;
const POINT_HIT_RADIUS_PX = 22;
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
  private container: HTMLElement | SVGSVGElement;
  private eventTarget: HTMLElement | SVGSVGElement;
  private isDragging = false;
  private dragMode: DragMode = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartSvg: { x: number; y: number } | null = null;
  private activePointerId: number | null = null;
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
  private layerResizePlacement: LayerResizePlacement | null = null;
  private cleanup: (() => void) | null = null;
  private snapEngine = new SnapEngine(editorStore);

  constructor(
    svg: SVGSVGElement,
    container?: HTMLElement | SVGSVGElement,
    eventTarget?: HTMLElement | SVGSVGElement,
  ) {
    this.svg = svg;
    const svgRoot = (svg as Element & { closest?: (selector: string) => Element | null }).closest?.('[data-canvas-root]') as HTMLElement | null;
    this.container = container ?? svgRoot ?? svg.parentElement ?? svg;
    this.eventTarget = eventTarget ?? this.container;
    this.attach();
  }

  private attach() {
    const onDown = this.onPointerDown.bind(this);
    const onMove = this.onPointerMove.bind(this);
    const onUp = this.onPointerUp.bind(this);
    const onCancel = this.onPointerCancel.bind(this);
    const onKeyDown = this.onKeyDown.bind(this);
    const onDblClick = this.onDoubleClick.bind(this);

    this.eventTarget.addEventListener('pointerdown', onDown as EventListener);
    this.eventTarget.addEventListener('dblclick', onDblClick as EventListener);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);

    this.cleanup = () => {
      this.eventTarget.removeEventListener('pointerdown', onDown as EventListener);
      this.eventTarget.removeEventListener('dblclick', onDblClick as EventListener);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKeyDown);
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.snapEngine.destroy();
    };
  }

  private capturePointer(pointerId: number) {
    this.eventTarget.setPointerCapture?.(pointerId);
    this.activePointerId = pointerId;
  }

  private releasePointer(pointerId?: number) {
    const id = pointerId ?? this.activePointerId;
    if (id === null || id === undefined) return;
    try {
      this.eventTarget.releasePointerCapture?.(id);
    } catch {
      // ignore release failures for already-released pointers.
    }
    if (pointerId === undefined || this.activePointerId === id) {
      this.activePointerId = null;
    }
  }

  private onPointerDown(e: PointerEvent) {
    const state = editorStore.getState();
    const tool = state.tool;
    const target = e.target as Element;
    const layerId = target.getAttribute?.('data-layer-id') ?? target.getAttribute?.('data-layer-hit-id');
    const selectionHandle = target.getAttribute?.('data-selection-handle') as BBoxHandle | null;
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
      }
      return;
    }

    if (tool === 'shape') {
      const placement = this.beginShapePlacement(e);
      if (placement) {
        state.setSelection({ layerIds: [placement.layerId], pointIds: [] });
        this.capturePointer(e.pointerId);
      }
      return;
    }

    if (tool === 'direct-select') {
      if (layerId && pointKey && controlDirection) {
        state.setSelection({ layerIds: [layerId], pointIds: [`${pointKey}@${controlDirection}`] });
        this.startControlDrag(layerId, pointKey, controlDirection, e.clientX, e.clientY);
        this.capturePointer(e.pointerId);
      } else if (layerId && pointKey) {
        // Shift-click to toggle multi-select points (like Figma/Illustrator)
        if (e.shiftKey) {
          const currentPointIds = [...state.selection.pointIds];
          const existing = currentPointIds.indexOf(pointKey);
          if (existing >= 0) {
            currentPointIds.splice(existing, 1);
          } else {
            currentPointIds.push(pointKey);
          }
          const layerIds = state.selection.layerIds.includes(layerId)
            ? state.selection.layerIds
            : [layerId];
          state.setSelection({ layerIds, pointIds: currentPointIds });
        } else {
          state.setSelection({ layerIds: [layerId], pointIds: [pointKey] });
        }
        this.startPointDrag(layerId, pointKey, e.clientX, e.clientY);
        this.capturePointer(e.pointerId);
      } else if (this.beginSelectionBoundsDrag(e)) {
        this.capturePointer(e.pointerId);
      } else if (this.beginPointMarquee(e, layerId, 'direct-select')) {
        this.capturePointer(e.pointerId);
      }
      return;
    }

    if (tool === 'select') {
      if (selectionHandle && this.beginLayerBoundsResize(e, selectionHandle)) {
        this.capturePointer(e.pointerId);
      } else if (this.beginLayerBoundsMove(e)) {
        this.capturePointer(e.pointerId);
      } else if (layerId) {
        state.setSelection({ layerIds: [layerId], pointIds: [] });
        this.startLayerDrag(layerId, e.clientX, e.clientY);
        this.capturePointer(e.pointerId);
      } else if (this.beginPointMarquee(e, null, 'select')) {
        this.capturePointer(e.pointerId);
      }
    }
  }

  private onDoubleClick(e: MouseEvent) {
    const state = editorStore.getState();
    const target = e.target as Element;
    const layerId = target.getAttribute?.('data-layer-id') ?? target.getAttribute?.('data-layer-hit-id');
    const pointKey = target.getAttribute?.('data-point-key');

    // If already in direct-select and double-clicking on a path (not a point),
    // add a new point on the segment at the click position
    if (state.tool === 'direct-select' && layerId && !pointKey) {
      const svgPoint = this.clientToSvg(e.clientX, e.clientY);
      if (svgPoint) {
        const tolerance = this.svgUnitsPerScreenPx() * POINT_HIT_RADIUS_PX;
        if (splitSegmentAtPoint(layerId, svgPoint, tolerance)) {
          return;
        }
      }
    }

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

    this.clearPendingPenHandle();
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
    this.materializePendingPenHandle(editable, layerId);

    const firstPoint = subPath.points[0]?.position;
    const canClose = !!firstPoint && subPath.points.length >= 3 && !subPath.closed;
    if (canClose) {
      const dx = firstPoint.x - snappedPoint.x;
      const dy = firstPoint.y - snappedPoint.y;
      if (dx * dx + dy * dy <= PEN_CLOSE_DIST_SQ) {
        subPath.closed = true;
        this.clearPendingPenHandle();
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
    this.dragStartSvg = this.clientToSvg(clientX, clientY);
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

    if (
      this.layerResizePlacement &&
      e.pointerId === this.layerResizePlacement.pointerId
    ) {
      this.updateLayerResizePreview(e);
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


  private beginLayerBoundsMove(e: PointerEvent): boolean {
    const state = editorStore.getState();
    const layerId = state.selection.layerIds[0] ?? null;
    if (!layerId) return false;

    const target = e.target as Element;
    const handleType = target.getAttribute?.('data-handle-type');
    if (handleType !== 'selection-bbox') return false;

    this.startLayerDrag(layerId, e.clientX, e.clientY);
    return true;
  }

  private beginLayerBoundsResize(e: PointerEvent, handle: BBoxHandle): boolean {
    const state = editorStore.getState();
    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    const layerId = state.selection.layerIds[0] ?? null;
    if (!iconId || !stateId || !layerId) return false;

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[layerId];
    const pathD = layer?.path?.d;
    if (!pathD) return false;

    // For non-editable paths (circles, etc.), use transform-based resize
    if (!isPathDirectlyEditable(pathD)) {
      return this.beginLayerTransformResize(e, handle, layerId, layer!);
    }

    const editable = parseSvgPath(pathD);
    const layerTransformX = layer?.transform?.x ?? 0;
    const layerTransformY = layer?.transform?.y ?? 0;
    if (layerTransformX !== 0 || layerTransformY !== 0) {
      editable.subPaths.forEach((subPath) => {
        subPath.points.forEach((point) => {
          translatePathPoint(point, layerTransformX, layerTransformY);
        });
      });
    }

    const normalizedBasePathD = serializePath(editable);
    const keys: string[] = [];
    editable.subPaths.forEach((subPath, subPathIndex) => {
      subPath.points.forEach((_, pointIndex) => {
        keys.push(`${subPathIndex}:${pointIndex}`);
      });
    });

    if (keys.length === 0) return false;

    const bbox = getPathBoundsFromEditable(editable);
    if (!bbox) return false;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return false;

    this.dragMode = 'selection-resize';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.originalPathD = normalizedBasePathD;
    this.selectionTransformPlacement = {
      layerId,
      pointerId: e.pointerId,
      pointKeys: keys,
      start: this.snapPointToGrid(svgPoint),
      bounds: bbox,
      mode: 'resize',
      handle,
      basePathD: normalizedBasePathD,
    };

    if (layerTransformX !== 0 || layerTransformY !== 0) {
      state.patchLayer(iconId, stateId, layerId, {
        path: { ...(layer?.path ?? { d: '' }), d: normalizedBasePathD },
        transform: {
          ...(layer?.transform ?? {}),
          x: 0,
          y: 0,
        },
      });
    }

    state.setPointTransformLabel({
      width: bbox.maxX - bbox.minX,
      height: bbox.maxY - bbox.minY,
    });
    pauseHistory();
    return true;
  }

  /**
   * Handle resize for non-directly-editable paths (circles, complex shapes)
   * by using scaleX/scaleY transforms instead of modifying path points.
   */
  private beginLayerTransformResize(
    e: PointerEvent,
    handle: BBoxHandle,
    layerId: string,
    layer: Layer,
  ): boolean {
    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return false;

    // Get bounding box from the SVG element directly
    const pathEl = this.svg.querySelector<SVGPathElement>(
      `path[data-layer-id="${CSS.escape(layerId)}"]`,
    );
    if (!pathEl) return false;

    let bounds: DOMRect;
    try {
      bounds = pathEl.getBBox();
      if (!Number.isFinite(bounds.x + bounds.y + bounds.width + bounds.height)) return false;
      if (bounds.width < 0.001 || bounds.height < 0.001) return false;
    } catch {
      return false;
    }

    this.dragMode = 'layer-resize';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.layerResizePlacement = {
      layerId,
      pointerId: e.pointerId,
      handle,
      startSvg: svgPoint,
      bbox: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      originalTransform: {
        x: layer.transform?.x,
        y: layer.transform?.y,
        scaleX: layer.transform?.scaleX,
        scaleY: layer.transform?.scaleY,
      },
    };

    const state = editorStore.getState();
    state.setPointTransformLabel({
      width: bounds.width,
      height: bounds.height,
    });
    pauseHistory();
    return true;
  }

  private updateLayerResizePreview(e: PointerEvent) {
    if (!this.layerResizePlacement || !this.dragLayerId) return;

    const currentSvg = this.clientToSvg(e.clientX, e.clientY);
    if (!currentSvg) return;

    const p = this.layerResizePlacement;
    const dx = currentSvg.x - p.startSvg.x;
    const dy = currentSvg.y - p.startSvg.y;

    const { scaleX: sx, scaleY: sy, tx, ty } = this.computeLayerResizeTransform(p, dx, dy);

    // Apply visual preview directly to SVG elements
    const transformStr = `translate(${tx}, ${ty}) scale(${sx}, ${sy})`;
    const pathEl = this.svg.querySelector(`[data-layer-id="${this.dragLayerId}"]`);
    const hitEl = this.svg.querySelector(`[data-layer-hit-id="${this.dragLayerId}"]`);
    if (pathEl) pathEl.setAttribute('transform', transformStr);
    if (hitEl) hitEl.setAttribute('transform', transformStr);

    editorStore.getState().setPointTransformLabel({
      width: Math.abs(p.bbox.width * sx),
      height: Math.abs(p.bbox.height * sy),
    });
  }

  private commitLayerResize(e: PointerEvent) {
    if (!this.layerResizePlacement || !this.dragLayerId) {
      discardHistory();
      this.resetDrag();
      return;
    }

    const currentSvg = this.clientToSvg(e.clientX, e.clientY);
    if (!currentSvg) {
      discardHistory();
      editorStore.getState().setPointTransformLabel(null);
      this.resetDrag();
      return;
    }

    const p = this.layerResizePlacement;
    const dx = currentSvg.x - p.startSvg.x;
    const dy = currentSvg.y - p.startSvg.y;

    if (Math.abs(dx) <= 0.01 && Math.abs(dy) <= 0.01) {
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

    const { scaleX, scaleY, tx, ty } = this.computeLayerResizeTransform(p, dx, dy);

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[this.dragLayerId];
    state.patchLayer(iconId, stateId, this.dragLayerId, {
      transform: {
        ...(layer?.transform ?? {}),
        x: tx,
        y: ty,
        scaleX,
        scaleY,
      },
    });

    state.setPointTransformLabel(null);
    resumeHistory();
    commitHistory('layer-resize');
    this.resetDrag();
  }

  private computeLayerResizeTransform(
    p: LayerResizePlacement,
    dx: number,
    dy: number,
  ): { scaleX: number; scaleY: number; tx: number; ty: number } {
    const baseScaleX = p.originalTransform.scaleX ?? 1;
    const baseScaleY = p.originalTransform.scaleY ?? 1;
    const baseTx = p.originalTransform.x ?? 0;
    const baseTy = p.originalTransform.y ?? 0;

    // Compute new scale factors based on handle direction
    let newScaleX = baseScaleX;
    let newScaleY = baseScaleY;
    let newTx = baseTx;
    let newTy = baseTy;

    const w = p.bbox.width;
    const h = p.bbox.height;
    const handle = p.handle;

    const isRight = handle === 'e' || handle === 'ne' || handle === 'se';
    const isLeft = handle === 'w' || handle === 'nw' || handle === 'sw';
    const isBottom = handle === 's' || handle === 'se' || handle === 'sw';
    const isTop = handle === 'n' || handle === 'ne' || handle === 'nw';

    if (isRight) {
      newScaleX = baseScaleX * ((w + dx) / w);
    } else if (isLeft) {
      newScaleX = baseScaleX * ((w - dx) / w);
      newTx = baseTx + dx;
    }

    if (isBottom) {
      newScaleY = baseScaleY * ((h + dy) / h);
    } else if (isTop) {
      newScaleY = baseScaleY * ((h - dy) / h);
      newTy = baseTy + dy;
    }

    // Prevent collapsing to zero
    if (Math.abs(newScaleX) < 0.01) newScaleX = 0.01 * Math.sign(newScaleX || 1);
    if (Math.abs(newScaleY) < 0.01) newScaleY = 0.01 * Math.sign(newScaleY || 1);

    return { scaleX: newScaleX, scaleY: newScaleY, tx: newTx, ty: newTy };
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

  private beginPointMarquee(
    e: PointerEvent,
    clickLayerId: string | null,
    tool: 'select' | 'direct-select',
  ): boolean {
    const state = editorStore.getState();
    const layerId = this.resolveMarqueeLayerId(clickLayerId);

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return false;

    this.dragMode = tool === 'select' ? 'select-marquee' : 'point-marquee';
    this.isDragging = true;
    this.dragLayerId = layerId;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.pointMarqueePlacement = {
      layerId,
      pointerId: e.pointerId,
      start: svgPoint,
      baseSelection: uniquePointKeys(state.selection.pointIds),
      baseLayerIds: [...state.selection.layerIds],
      baseGuideIndexes: [...(state.selection.guideIndexes ?? [])],
      mode: e.shiftKey ? 'toggle' : 'replace',
      clickLayerId,
      tool,
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

    const matchedPointKeys =
      placement.tool === 'direct-select' && placement.layerId
        ? this.collectPointsInMarquee(placement.layerId, marquee)
        : [];
    const matchedLayerIds = this.collectLayerIdsInMarquee(marquee, placement.layerId);
    const matchedGuideIndexes = this.collectGuideIndexesInMarquee(marquee);

    const directSelectLayerIds =
      placement.tool === 'direct-select' && placement.layerId
        ? uniqueStrings([
            placement.layerId,
            ...matchedLayerIds.filter((layerId) => layerId !== placement.layerId),
          ])
        : matchedLayerIds;

    if (placement.mode === 'toggle') {
      const baseSelection = new Set(placement.baseSelection);
      for (const key of matchedPointKeys) {
        if (baseSelection.has(key)) {
          baseSelection.delete(key);
        } else {
          baseSelection.add(key);
        }
      }
      const nextLayerIds = toggleStringSelection(placement.baseLayerIds, matchedLayerIds);
      const nextGuideIndexes = toggleNumberSelection(
        placement.baseGuideIndexes,
        matchedGuideIndexes,
      );
      state.setSelection({
        layerIds:
          placement.tool === 'direct-select' && placement.layerId
            ? uniqueStrings([
                placement.layerId,
                ...nextLayerIds.filter((layerId) => layerId !== placement.layerId),
              ])
            : nextLayerIds,
        pointIds: [...baseSelection],
        guideIndexes: nextGuideIndexes,
      });
      return;
    }

    state.setSelection({
      layerIds: directSelectLayerIds,
      pointIds: matchedPointKeys,
      guideIndexes: matchedGuideIndexes,
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
    const startSvg = this.dragStartSvg ?? this.clientToSvg(this.dragStartX, this.dragStartY);
    const currentSvg = this.clientToSvg(e.clientX, e.clientY);
    if (!startSvg || !currentSvg) return;

    const dx = currentSvg.x - startSvg.x;
    const dy = currentSvg.y - startSvg.y;

    const layerId = this.dragLayerId;
    const newX = this.originalTransform.x + dx;
    const newY = this.originalTransform.y + dy;

    const pathEl = this.svg.querySelector(
      `[data-layer-id="${layerId}"]`,
    ) as SVGPathElement | null;
    const hitPathEl = this.svg.querySelector(
      `[data-layer-hit-id="${layerId}"]`,
    ) as SVGPathElement | null;
    if (pathEl) {
      pathEl.setAttribute('transform', `translate(${newX}, ${newY})`);
    }
    if (hitPathEl) {
      hitPathEl.setAttribute('transform', `translate(${newX}, ${newY})`);
    }
  }

  private dragPoint(e: PointerEvent) {
    if (!this.dragPointKey || !this.dragLayerId || !this.originalPathD) return;

    const svgPoint = this.clientToSvg(e.clientX, e.clientY);
    if (!svgPoint) return;
    const snappedPoint = this.computeSnappedPoint(svgPoint, this.dragLayerId, true);

    const editable = parseSvgPath(this.originalPathD);
    const context = this.resolvePointContext(editable, this.dragPointKey);
    if (!context) return;

    let dx = snappedPoint.x - context.point.position.x;
    let dy = snappedPoint.y - context.point.position.y;

    // Shift-constrain movement to axis-aligned
    if (e.shiftKey) {
      const constrained = constrainDeltaToAxis(dx, dy);
      dx = constrained.dx;
      dy = constrained.dy;
    }

    // Move all selected points together (multi-point drag)
    const state = editorStore.getState();
    const selectedKeys = uniquePointKeys(state.selection.pointIds);
    if (selectedKeys.length > 1 && selectedKeys.includes(this.dragPointKey)) {
      for (const key of selectedKeys) {
        const ctx = this.resolvePointContext(editable, key);
        if (ctx) this.translatePoint(ctx.subPath, ctx.pointIdx, dx, dy);
      }
    } else {
      this.translatePoint(context.subPath, context.pointIdx, dx, dy);
    }

    const finalX = context.point.position.x;
    const finalY = context.point.position.y;

    const nextD = serializePath(editable);
    const pathEl = this.svg.querySelector(
      `[data-layer-id="${this.dragLayerId}"]`,
    ) as SVGPathElement | null;
    const hitPathEl = this.svg.querySelector(
      `[data-layer-hit-id="${this.dragLayerId}"]`,
    ) as SVGPathElement | null;
    if (!pathEl) return;
    pathEl.setAttribute('d', nextD);
    if (hitPathEl) {
      hitPathEl.setAttribute('d', nextD);
    }
    this.updateDraggedPointHandles(finalX, finalY);
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

    const snappedPoint = this.computeSnappedPoint(svgPoint, this.dragLayerId, true);
    const constrainedPoint = e.shiftKey
      ? constrainAngle(context.point.position, snappedPoint)
      : snappedPoint;

    const controlPosition = this.applyControlPosition(
      context.subPath,
      context.pointIdx,
      this.dragControlDirection,
      constrainedPoint,
      e.altKey,
    );
    if (!controlPosition) return;

    const nextD = serializePath(editable);
    const pathEl = this.svg.querySelector(
      `[data-layer-id="${this.dragLayerId}"]`,
    ) as SVGPathElement | null;
    const hitPathEl = this.svg.querySelector(
      `[data-layer-hit-id="${this.dragLayerId}"]`,
    ) as SVGPathElement | null;
    if (!pathEl) return;
    pathEl.setAttribute('d', nextD);
    if (hitPathEl) {
      hitPathEl.setAttribute('d', nextD);
    }
    this.updateDraggedControlHandle(
      this.dragLayerId!,
      this.dragPointKey!,
      this.dragControlDirection!,
      controlPosition,
      context.point.position,
    );
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
    const previewPoint = e.shiftKey
      ? constrainAngle(this.penPlacement.anchor, snappedPoint)
      : snappedPoint;
    const preview = this.buildPenHandlePreview(previewPoint, { altKey: e.altKey });
    applyPenPreviewToPoint(point, preview);

    if (prev) {
      prev.handleOut = preview.handleOut ? { ...preview.handleOut } : null;
      prev.nodeType = preview.handleOut ? (e.altKey ? 'corner' : 'smooth') : 'static';
    }

    this.publishPendingPenHandle(this.penPlacement.layerId, this.penPlacement.pointKey, preview);

    const nextD = serializePath(editable);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => {
      const pathEl = this.svg.querySelector(
        `[data-layer-id="${this.penPlacement?.layerId}"]`,
      ) as SVGPathElement | null;
      const hitPathEl = this.svg.querySelector(
        `[data-layer-hit-id="${this.penPlacement?.layerId}"]`,
      ) as SVGPathElement | null;
      if (pathEl) {
        pathEl.setAttribute('d', nextD);
      }
      if (hitPathEl) {
        hitPathEl.setAttribute('d', nextD);
      }
    });
  }

  private onPointerCancel(e: PointerEvent) {
    this.releasePointer(e.pointerId);
    this.clearActiveSnapGuides();
    if (this.penPlacement) {
      resumeHistory();
      this.clearPendingPenHandle();
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

    if (this.layerResizePlacement) {
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
      this.clearPendingPenHandle();
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

    if (this.layerResizePlacement) {
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
    this.releasePointer(e.pointerId);

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

    if (
      this.layerResizePlacement &&
      e.pointerId === this.layerResizePlacement.pointerId
    ) {
      this.commitLayerResize(e);
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
    const previewPoint = e.shiftKey
      ? constrainAngle(this.penPlacement.anchor, snappedPoint)
      : snappedPoint;
    const preview = this.buildPenHandlePreview(previewPoint, { altKey: e.altKey });
    applyPenPreviewToPoint(point, preview);

    if (prev) {
      prev.handleOut = preview.handleOut ? { ...preview.handleOut } : null;
      prev.nodeType = preview.handleOut ? (e.altKey ? 'corner' : 'smooth') : 'static';
    }

    state.patchLayer(iconId, stateId, this.penPlacement.layerId, {
      path: { ...layer.path, d: serializePath(editable) },
    });
    this.publishPendingPenHandle(this.penPlacement.layerId, this.penPlacement.pointKey, preview);
  }

  private commitLayerDrag(e: PointerEvent) {
    if (!this.originalTransform || !this.dragLayerId) return;

    const state = editorStore.getState();
    const startSvg = this.dragStartSvg ?? this.clientToSvg(this.dragStartX, this.dragStartY);
    const currentSvg = this.clientToSvg(e.clientX, e.clientY);
    if (!startSvg || !currentSvg) return;

    const dx = currentSvg.x - startSvg.x;
    const dy = currentSvg.y - startSvg.y;

    if (Math.abs(dx) <= 0.01 && Math.abs(dy) <= 0.01) return;

    const iconId = state.currentIconId;
    const stateId = state.currentStateId;
    if (!iconId || !stateId) return;

    const layer = getActiveVariantState(state, iconId, stateId)?.layers[this.dragLayerId];
    if (!layer?.path?.d) return;

    if (isPathDirectlyEditable(layer.path.d)) {
      // For editable paths, translate the path points directly and reset the transform offset
      const editable = parseSvgPath(layer.path.d);
      editable.subPaths.forEach((subPath) => {
        subPath.points.forEach((point) => {
          translatePathPoint(point, dx, dy);
        });
      });

      state.patchLayer(iconId, stateId, this.dragLayerId, {
        path: {
          ...layer.path,
          d: serializePath(editable),
        },
        transform: {
          ...(layer.transform ?? {}),
          x: 0,
          y: 0,
        },
      });
    } else {
      // For non-editable paths (circles, complex shapes), persist the move via transform
      state.patchLayer(iconId, stateId, this.dragLayerId, {
        transform: {
          ...(layer.transform ?? {}),
          x: (layer.transform?.x ?? 0) + dx,
          y: (layer.transform?.y ?? 0) + dy,
        },
      });
    }
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

    let dx = snappedPoint.x - context.point.position.x;
    let dy = snappedPoint.y - context.point.position.y;

    if (e.shiftKey) {
      const constrained = constrainDeltaToAxis(dx, dy);
      dx = constrained.dx;
      dy = constrained.dy;
    }

    // Move all selected points together
    const selectedKeys = uniquePointKeys(state.selection.pointIds);
    if (selectedKeys.length > 1 && selectedKeys.includes(this.dragPointKey)) {
      for (const key of selectedKeys) {
        const ctx = this.resolvePointContext(editable, key);
        if (ctx) this.translatePoint(ctx.subPath, ctx.pointIdx, dx, dy);
      }
    } else {
      this.translatePoint(context.subPath, context.pointIdx, dx, dy);
    }

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

    const snappedPoint = this.computeSnappedPoint(svgPoint, this.dragLayerId);
    const constrainedPoint = e.shiftKey
      ? constrainAngle(context.point.position, snappedPoint)
      : snappedPoint;

    const controlPosition = this.applyControlPosition(
      context.subPath,
      context.pointIdx,
      this.dragControlDirection,
      constrainedPoint,
      e.altKey,
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

  private collectLayerIdsInMarquee(
    marquee: { minX: number; minY: number; maxX: number; maxY: number },
    preferredLayerId: string | null,
  ): string[] {
    const state = editorStore.getState();
    const currentState = selectCurrentState(state);
    if (!currentState) return [];

    const matched = new Set<string>();
    for (const pathEl of this.svg.querySelectorAll<SVGPathElement>('path[data-layer-id]')) {
      const layerId = pathEl.getAttribute('data-layer-id');
      if (!layerId || !currentState.layers[layerId]) continue;
      try {
        const bounds = pathEl.getBBox();
        if (
          bounds.x + bounds.width >= marquee.minX &&
          bounds.x <= marquee.maxX &&
          bounds.y + bounds.height >= marquee.minY &&
          bounds.y <= marquee.maxY
        ) {
          matched.add(layerId);
        }
      } catch {
        continue;
      }
    }

    const ordered = [...matched];
    if (preferredLayerId && matched.has(preferredLayerId)) {
      return [preferredLayerId, ...ordered.filter((layerId) => layerId !== preferredLayerId)];
    }
    return ordered;
  }

  private collectGuideIndexesInMarquee(marquee: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): number[] {
    const state = editorStore.getState();
    const guides = state.currentIconId ? state.project?.icons[state.currentIconId]?.customGuides ?? [] : [];
    const matches: number[] = [];

    guides.forEach((guide, index) => {
      if (guideIntersectsMarquee(guide, marquee)) {
        matches.push(index);
      }
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
    const zoom = state.viewport.zoom;
    if (!Number.isFinite(zoom) || zoom <= 0) return 0;
    return 1 / zoom;
  }

  private clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const state = editorStore.getState();
    const variant = selectCurrentVariant(state);
    if (!variant) return null;

    const [vx, vy, vw, vh] = variant.viewBox;
    const root =
      ((this.svg as Element & { closest?: (selector: string) => Element | null }).closest?.(
        '[data-canvas-root]',
      ) as HTMLElement | null) ?? this.container;
    const containerRect = root.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    const canUseContainer =
      containerRect.width > 0 && containerRect.height > 0 && root !== this.svg;

    if (!canUseContainer) {
      if (svgRect.width <= 0 || svgRect.height <= 0) return null;
      return {
        x: vx + ((clientX - svgRect.left) / svgRect.width) * vw,
        y: vy + ((clientY - svgRect.top) / svgRect.height) * vh,
      };
    }

    const renderWidth = vw * state.viewport.zoom;
    const renderHeight = vh * state.viewport.zoom;
    if (!Number.isFinite(renderWidth) || !Number.isFinite(renderHeight)) return null;
    if (renderWidth <= 0 || renderHeight <= 0) return null;

    const cx = containerRect.width / 2 + state.viewport.panX;
    const cy = containerRect.height / 2 + state.viewport.panY;
    const left = cx - renderWidth / 2;
    const top = cy - renderHeight / 2;

    return {
      x: vx + ((clientX - containerRect.left - left) / renderWidth) * vw,
      y: vy + ((clientY - containerRect.top - top) / renderHeight) * vh,
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
    altKey = false,
  ) {
    const point = subPath.points[pointIdx];
    if (!point) return null;

    // Alt key breaks handle symmetry → convert to corner node
    if (altKey && point.nodeType !== 'corner') {
      point.nodeType = 'corner';
    }

    if (direction === 'in') {
      const prev = subPath.points[pointIdx - 1] ?? (subPath.closed ? subPath.points[subPath.points.length - 1] : null);
      if (!prev) return null;
      if (point.segment?.type !== 'cubic') {
        prev.handleOut ??= this.defaultControlPoint(prev.position, point.position);
        point.segment = { type: 'cubic' };
      }
      point.handleIn = { x: position.x, y: position.y };

      // Mirror opposite handle based on node type
      if (point.nodeType === 'smooth') {
        const dx = position.x - point.position.x;
        const dy = position.y - point.position.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const oppositeLen = point.handleOut
            ? Math.hypot(
                point.handleOut.x - point.position.x,
                point.handleOut.y - point.position.y,
              )
            : len;
          point.handleOut = {
            x: point.position.x - (dx / len) * oppositeLen,
            y: point.position.y - (dy / len) * oppositeLen,
          };
        }
      } else if (point.nodeType === 'symmetric') {
        point.handleOut = {
          x: 2 * point.position.x - position.x,
          y: 2 * point.position.y - position.y,
        };
      }
      // corner: no mirroring

      if (!altKey && point.nodeType !== 'corner') {
        point.nodeType = point.nodeType === 'symmetric' ? 'symmetric' : 'smooth';
      }
      return point.handleIn;
    }

    const next = subPath.points[pointIdx + 1] ?? (subPath.closed ? subPath.points[0] : null);
    if (next && next.segment?.type !== 'cubic') {
      next.handleIn ??= this.defaultControlPoint(next.position, point.position);
      next.segment = { type: 'cubic' };
    }
    point.handleOut = { x: position.x, y: position.y };

    // Mirror opposite handle based on node type
    if (point.nodeType === 'smooth') {
      const dx = position.x - point.position.x;
      const dy = position.y - point.position.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const oppositeLen = point.handleIn
          ? Math.hypot(
              point.handleIn.x - point.position.x,
              point.handleIn.y - point.position.y,
            )
          : len;
        point.handleIn = {
          x: point.position.x - (dx / len) * oppositeLen,
          y: point.position.y - (dy / len) * oppositeLen,
        };
      }
    } else if (point.nodeType === 'symmetric') {
      point.handleIn = {
        x: 2 * point.position.x - position.x,
        y: 2 * point.position.y - position.y,
      };
    }
    // corner: no mirroring

    if (!altKey && point.nodeType !== 'corner') {
      point.nodeType = point.nodeType === 'symmetric' ? 'symmetric' : 'smooth';
    }
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
    this.releasePointer();
    this.dragLayerId = null;
    this.dragPointKey = null;
    this.dragControlDirection = null;
    this.dragStartSvg = null;
    this.originalTransform = null;
    this.originalPathD = null;
    this.shapePlacement = null;
    this.pointMarqueePlacement = null;
    this.selectionTransformPlacement = null;
    this.layerResizePlacement = null;
  }

  private buildPenHandlePreview(
    snappedPoint: { x: number; y: number },
    options?: { altKey?: boolean },
  ): PenHandlePreview {
    const dx = snappedPoint.x - this.penPlacement!.anchor.x;
    const dy = snappedPoint.y - this.penPlacement!.anchor.y;
    const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

    if (!moved) {
      return {
        anchor: this.penPlacement!.anchor,
        handleIn: null,
        handleOut: null,
      };
    }

    if (options?.altKey) {
      return {
        anchor: this.penPlacement!.anchor,
        handleIn: null,
        handleOut: null,
      };
    }

    return {
      anchor: this.penPlacement!.anchor,
      handleIn: {
        x: this.penPlacement!.anchor.x - dx,
        y: this.penPlacement!.anchor.y - dy,
      },
      handleOut: {
        x: this.penPlacement!.anchor.x + dx,
        y: this.penPlacement!.anchor.y + dy,
      },
    };
  }

  private publishPendingPenHandle(
    layerId: string,
    pointKey: string,
    preview: PenHandlePreview,
  ) {
    const hasVisibleHandle = Boolean(preview.handleIn || preview.handleOut);
    editorStore
      .getState()
      .setPendingPenHandle(
        hasVisibleHandle
          ? {
              layerId,
              pointKey,
              anchor: preview.anchor,
              handleIn: preview.handleIn,
              handleOut: preview.handleOut,
            }
          : null,
      );
  }

  private clearPendingPenHandle() {
    editorStore.getState().setPendingPenHandle(null);
  }

  private materializePendingPenHandle(
    editable: ReturnType<typeof parseSvgPath>,
    layerId: string,
  ) {
    const pending = editorStore.getState().pendingPenHandle;
    if (!pending || pending.layerId !== layerId || !pending.handleOut) return;

    const context = this.resolvePointContext(editable, pending.pointKey);
    if (!context) {
      this.clearPendingPenHandle();
      return;
    }

    const isTerminalPoint = context.pointIdx === context.subPath.points.length - 1;
    if (!isTerminalPoint) {
      this.clearPendingPenHandle();
      return;
    }

    context.point.handleOut = { ...pending.handleOut };
    context.point.nodeType = context.point.handleIn ? 'smooth' : 'corner';
    this.clearPendingPenHandle();
  }

  destroy() {
    this.clearActiveSnapGuides();
    this.releasePointer();
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
        const nearestPointKey =
          placement.tool === 'direct-select'
            ? this.findNearestPointKey(placement.clickLayerId, e.clientX, e.clientY)
            : null;
        if (nearestPointKey && placement.tool === 'direct-select') {
          state.setSelection({
            layerIds: [placement.clickLayerId],
            pointIds: [nearestPointKey],
            guideIndexes: [],
          });
        } else {
          state.setSelection({
            layerIds: [placement.clickLayerId],
            pointIds: [],
            guideIndexes: [],
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

function applyPenPreviewToPoint(
  point: PathPoint,
  preview: PenHandlePreview,
): void {
  point.handleIn = preview.handleIn ? { ...preview.handleIn } : null;
  point.handleOut = preview.handleOut ? { ...preview.handleOut } : null;
  if (point.handleIn || point.handleOut) {
    point.nodeType = 'smooth';
    point.segment = { type: 'cubic' };
    return;
  }

  point.nodeType = 'static';
  point.segment = { type: 'line' };
}

function getPathBoundsFromEditable(editable: ReturnType<typeof parseSvgPath>): SelectionBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  editable.subPaths.forEach((subPath) => {
    subPath.points.forEach((point) => {
      minX = Math.min(minX, point.position.x);
      minY = Math.min(minY, point.position.y);
      maxX = Math.max(maxX, point.position.x);
      maxY = Math.max(maxY, point.position.y);

      if (point.handleIn) {
        minX = Math.min(minX, point.handleIn.x);
        minY = Math.min(minY, point.handleIn.y);
        maxX = Math.max(maxX, point.handleIn.x);
        maxY = Math.max(maxY, point.handleIn.y);
      }
      if (point.handleOut) {
        minX = Math.min(minX, point.handleOut.x);
        minY = Math.min(minY, point.handleOut.y);
        maxX = Math.max(maxX, point.handleOut.x);
        maxY = Math.max(maxY, point.handleOut.y);
      }
    });
  });

  if (!Number.isFinite(minX + minY + maxX + maxY)) return null;
  return { minX, minY, maxX, maxY };
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toggleStringSelection(base: string[], matches: string[]): string[] {
  const next = new Set(base);
  for (const match of matches) {
    if (next.has(match)) {
      next.delete(match);
    } else {
      next.add(match);
    }
  }
  return [...next];
}

function toggleNumberSelection(base: number[], matches: number[]): number[] {
  const next = new Set(base);
  for (const match of matches) {
    if (next.has(match)) {
      next.delete(match);
    } else {
      next.add(match);
    }
  }
  return [...next].sort((a, b) => a - b);
}

function guideIntersectsMarquee(
  guide: GuideItem,
  marquee: SelectionBounds,
): boolean {
  switch (guide.kind) {
    case 'hline':
      return guide.y >= marquee.minY && guide.y <= marquee.maxY;
    case 'vline':
      return guide.x >= marquee.minX && guide.x <= marquee.maxX;
    case 'rect':
      return (
        guide.x + guide.width >= marquee.minX &&
        guide.x <= marquee.maxX &&
        guide.y + guide.height >= marquee.minY &&
        guide.y <= marquee.maxY
      );
    case 'ellipse':
      return (
        guide.cx + guide.rx >= marquee.minX &&
        guide.cx - guide.rx <= marquee.maxX &&
        guide.cy + guide.ry >= marquee.minY &&
        guide.cy - guide.ry <= marquee.maxY
      );
    case 'drawPoint':
      return false;
    default:
      return false;
  }
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

/**
 * Constrain a target point to the nearest 45° angle from an origin.
 * Used for Shift-constrained point/handle movement (like Figma/Illustrator).
 */
function constrainAngle(
  origin: { x: number; y: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return { ...target };

  const angle = Math.atan2(dy, dx);
  const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: origin.x + distance * Math.cos(snapAngle),
    y: origin.y + distance * Math.sin(snapAngle),
  };
}

/**
 * Constrain a movement delta to the nearest axis (horizontal or vertical)
 * when Shift is held during point dragging.
 */
function constrainDeltaToAxis(dx: number, dy: number): { dx: number; dy: number } {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx, dy: 0 };
  }
  return { dx: 0, dy };
}

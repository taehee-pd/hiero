import { editorStore } from '@/lib/editor-store/store';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';

const NUDGE_STEP = 0.5;

type SelectionTarget = {
  iconId: string;
  stateId: string;
  layerId: string;
  pointKey: string;
  pathD: string;
};

function getSelectionTarget(): SelectionTarget | null {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  const pointKey = state.selection.pointIds[0];

  if (!iconId || !stateId || !layerId || !pointKey) return null;

  const pathD = state.project?.icons[iconId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return null;

  return { iconId, stateId, layerId, pointKey, pathD };
}

function resolvePoint(pathD: string, pointKey: string) {
  const editable = parseSvgPath(pathD);
  const [subPathIdxRaw, pointIdxRaw] = pointKey.split(':');
  const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
  const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
  const subPath = editable.subPaths[subPathIdx];
  if (!subPath) return null;

  const point = subPath.points[pointIdx];
  if (!point) return null;

  return {
    editable,
    subPath,
    point,
    subPathIdx,
    pointIdx,
  };
}

function patchPath(iconId: string, stateId: string, layerId: string, nextD: string) {
  const state = editorStore.getState();
  const layer = state.project?.icons[iconId]?.states[stateId]?.layers[layerId];
  if (!layer?.path) return;

  state.patchLayer(iconId, stateId, layerId, {
    path: {
      ...layer.path,
      d: nextD,
    },
  });
}

export function deleteSelectedPoint(): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;
  const { editable, subPath, subPathIdx, pointIdx } = resolved;

  if (subPath.points.length <= 1) return false;

  subPath.points.splice(pointIdx, 1);
  const nextIndex = Math.max(0, pointIdx - 1);

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  editorStore.getState().setSelection({
    layerIds: [target.layerId],
    pointIds: [`${subPathIdx}:${Math.min(nextIndex, subPath.points.length - 1)}`],
  });
  return true;
}

export function toggleSelectedPointType(): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;
  const { editable, subPath, point, pointIdx } = resolved;

  if (point.nodeType === 'corner') {
    const prev = subPath.points[pointIdx - 1] ?? null;
    const next = subPath.points[pointIdx + 1] ?? null;
    const px = prev?.position.x ?? point.position.x - 1;
    const py = prev?.position.y ?? point.position.y;
    const nx = next?.position.x ?? point.position.x + 1;
    const ny = next?.position.y ?? point.position.y;

    point.handleIn = {
      x: point.position.x + (px - point.position.x) / 3,
      y: point.position.y + (py - point.position.y) / 3,
    };
    point.handleOut = {
      x: point.position.x + (nx - point.position.x) / 3,
      y: point.position.y + (ny - point.position.y) / 3,
    };
    point.nodeType = 'smooth';
  } else {
    point.handleIn = null;
    point.handleOut = null;
    point.nodeType = 'corner';
  }

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  return true;
}

export function insertPointAfterSelection(): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;
  const { editable, subPath, subPathIdx, point, pointIdx } = resolved;

  const nextPoint = subPath.points[pointIdx + 1] ?? (subPath.closed ? subPath.points[0] : null);
  if (!nextPoint) return false;

  const inserted = {
    id: `${subPath.id}-pt-${Date.now()}`,
    position: {
      x: (point.position.x + nextPoint.position.x) / 2,
      y: (point.position.y + nextPoint.position.y) / 2,
    },
    handleIn: null,
    handleOut: null,
    nodeType: 'corner' as const,
    segment: { type: 'line' as const },
  };

  subPath.points.splice(pointIdx + 1, 0, inserted);
  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));

  editorStore.getState().setSelection({
    layerIds: [target.layerId],
    pointIds: [`${subPathIdx}:${pointIdx + 1}`],
  });
  return true;
}

export function toggleSelectedPathClosed(): boolean {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  if (!iconId || !stateId || !layerId) return false;

  const pathD = state.project?.icons[iconId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return false;

  const editable = parseSvgPath(pathD);
  const subPath = editable.subPaths[0];
  if (!subPath) return false;

  subPath.closed = !subPath.closed;
  patchPath(iconId, stateId, layerId, serializePath(editable));
  return true;
}

export function nudgeSelectedPointByArrow(key: string): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;

  const delta = {
    ArrowLeft: { x: -NUDGE_STEP, y: 0 },
    ArrowRight: { x: NUDGE_STEP, y: 0 },
    ArrowUp: { x: 0, y: -NUDGE_STEP },
    ArrowDown: { x: 0, y: NUDGE_STEP },
  }[key];

  if (!delta) return false;

  resolved.point.position.x += delta.x;
  resolved.point.position.y += delta.y;
  patchPath(target.iconId, target.stateId, target.layerId, serializePath(resolved.editable));
  return true;
}

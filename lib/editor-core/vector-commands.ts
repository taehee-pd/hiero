import { editorStore } from '@/lib/editor-store/store';
import type { NodeType, PathPoint, SubPath } from './path-model';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';

const NUDGE_STEP = 0.5;

type SelectionTarget = {
  iconId: string;
  stateId: string;
  layerId: string;
  pointKey: string;
  pathD: string;
};
type MultiSelectionTarget = {
  iconId: string;
  stateId: string;
  layerId: string;
  pointKeys: string[];
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

function getMultiSelectionTarget(minPoints = 1): MultiSelectionTarget | null {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  const pointKeys = Array.from(new Set(state.selection.pointIds));

  if (!iconId || !stateId || !layerId || pointKeys.length < minPoints) return null;

  const pathD = state.project?.icons[iconId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return null;

  return { iconId, stateId, layerId, pointKeys, pathD };
}

function resolvePoint(pathD: string, pointKey: string) {
  const editable = parseSvgPath(pathD);
  return resolvePointInEditable(editable, pointKey);
}

function resolvePointInEditable(editable: ReturnType<typeof parseSvgPath>, pointKey: string) {
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

export function deleteSelectedPoints(): boolean {
  const target = getMultiSelectionTarget(1);
  if (!target) return false;

  const editable = parseSvgPath(target.pathD);
  const grouped = new Map<number, number[]>();

  for (const key of target.pointKeys) {
    const [subPathIdxRaw, pointIdxRaw] = key.split(':');
    const subPathIdx = Number.parseInt(subPathIdxRaw ?? '-1', 10);
    const pointIdx = Number.parseInt(pointIdxRaw ?? '-1', 10);
    if (!Number.isInteger(subPathIdx) || !Number.isInteger(pointIdx)) continue;
    const indices = grouped.get(subPathIdx) ?? [];
    indices.push(pointIdx);
    grouped.set(subPathIdx, indices);
  }

  let changed = false;
  grouped.forEach((pointIndices, subPathIdx) => {
    const subPath = editable.subPaths[subPathIdx];
    if (!subPath) return;
    const sorted = [...new Set(pointIndices)].sort((a, b) => b - a);
    for (const pointIdx of sorted) {
      if (subPath.points.length <= 1) continue;
      if (pointIdx < 0 || pointIdx >= subPath.points.length) continue;
      subPath.points.splice(pointIdx, 1);
      changed = true;
    }
  });

  if (!changed) return false;

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  editorStore.getState().setSelection({
    layerIds: [target.layerId],
    pointIds: [],
  });
  return true;
}

export function toggleSelectedPointType(): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;
  const { editable } = resolved;
  const nextType = resolved.point.nodeType === 'corner' ? 'smooth' : 'corner';
  applyPointNodeType(resolved.subPath, resolved.pointIdx, nextType);

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  return true;
}

export function setSelectedPointType(nodeType: NodeType): boolean {
  const target = getMultiSelectionTarget(1);
  if (!target) return false;

  const editable = parseSvgPath(target.pathD);
  const resolvedPoints = target.pointKeys
    .map((pointKey) => resolvePointInEditable(editable, pointKey))
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (resolvedPoints.length === 0) return false;

  for (const resolved of resolvedPoints) {
    applyPointNodeType(resolved.subPath, resolved.pointIdx, nodeType);
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
  const target = getMultiSelectionTarget(1);
  if (!target) return false;

  const delta = {
    ArrowLeft: { x: -NUDGE_STEP, y: 0 },
    ArrowRight: { x: NUDGE_STEP, y: 0 },
    ArrowUp: { x: 0, y: -NUDGE_STEP },
    ArrowDown: { x: 0, y: NUDGE_STEP },
  }[key];

  if (!delta) return false;

  const editable = parseSvgPath(target.pathD);
  const resolvedPoints = target.pointKeys
    .map((pointKey) => resolvePointInEditable(editable, pointKey))
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (resolvedPoints.length === 0) return false;

  resolvedPoints.forEach(({ point }) => translatePoint(point, delta.x, delta.y));
  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  return true;
}

export function alignSelectedPoints(
  axis: 'x' | 'y',
  anchor: 'min' | 'center' | 'max',
): boolean {
  const target = getMultiSelectionTarget(2);
  if (!target) return false;

  const editable = parseSvgPath(target.pathD);
  const resolvedPoints = target.pointKeys
    .map((pointKey) => resolvePointInEditable(editable, pointKey))
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (resolvedPoints.length < 2) return false;

  const values = resolvedPoints.map(({ point }) => point.position[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const nextValue =
    anchor === 'min' ? min : anchor === 'max' ? max : (min + max) / 2;

  for (const { point } of resolvedPoints) {
    translatePoint(point, axis === 'x' ? nextValue - point.position.x : 0, axis === 'y' ? nextValue - point.position.y : 0);
  }

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  return true;
}

export function distributeSelectedPoints(axis: 'x' | 'y'): boolean {
  const target = getMultiSelectionTarget(3);
  if (!target) return false;

  const editable = parseSvgPath(target.pathD);
  const resolvedPoints = target.pointKeys
    .map((pointKey) => resolvePointInEditable(editable, pointKey))
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  if (resolvedPoints.length < 3) return false;

  const sorted = [...resolvedPoints].sort(
    (a, b) => a.point.position[axis] - b.point.position[axis],
  );
  const min = sorted[0]?.point.position[axis];
  const max = sorted[sorted.length - 1]?.point.position[axis];
  if (min === undefined || max === undefined) return false;
  if (Math.abs(max - min) <= Number.EPSILON) return false;

  const step = (max - min) / (sorted.length - 1);
  sorted.forEach((resolved, index) => {
    const nextValue = min + step * index;
    translatePoint(
      resolved.point,
      axis === 'x' ? nextValue - resolved.point.position.x : 0,
      axis === 'y' ? nextValue - resolved.point.position.y : 0,
    );
  });

  patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));
  return true;
}

export function getSelectedPointsBoundingBox(): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  points: Array<{ key: string; x: number; y: number }>;
} | null {
  const target = getMultiSelectionTarget(2);
  if (!target) return null;

  const editable = parseSvgPath(target.pathD);
  const points = target.pointKeys
    .map((key) => {
      const resolved = resolvePointInEditable(editable, key);
      if (!resolved) return null;
      return { key, x: resolved.point.position.x, y: resolved.point.position.y };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  if (points.length < 2) return null;

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    points,
  };
}

function applyPointNodeType(
  subPath: SubPath,
  pointIdx: number,
  nodeType: NodeType,
): void {
  const point = subPath.points[pointIdx];
  if (!point) return;

  if (nodeType === 'corner') {
    point.handleIn = null;
    point.handleOut = null;
    point.nodeType = 'corner';
    return;
  }

  const tangent = getPointTangentDirection(subPath, pointIdx);
  const baseLength =
    getHandleLength(point.handleOut, point.position) ||
    getHandleLength(point.handleIn, point.position) ||
    1;

  if (nodeType === 'smooth') {
    const handleInLength = getHandleLength(point.handleIn, point.position) || baseLength;
    const handleOutLength = getHandleLength(point.handleOut, point.position) || baseLength;
    point.handleIn = {
      x: point.position.x - tangent.x * handleInLength,
      y: point.position.y - tangent.y * handleInLength,
    };
    point.handleOut = {
      x: point.position.x + tangent.x * handleOutLength,
      y: point.position.y + tangent.y * handleOutLength,
    };
    point.nodeType = 'smooth';
    return;
  }

  point.handleIn = {
    x: point.position.x - tangent.x * baseLength,
    y: point.position.y - tangent.y * baseLength,
  };
  point.handleOut = {
    x: point.position.x + tangent.x * baseLength,
    y: point.position.y + tangent.y * baseLength,
  };
  point.nodeType = 'symmetric';
}

function translatePoint(point: PathPoint, dx: number, dy: number): void {
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

function getPointTangentDirection(subPath: SubPath, pointIdx: number) {
  const point = subPath.points[pointIdx];
  const prev = getNeighborPoint(subPath, pointIdx, -1);
  const next = getNeighborPoint(subPath, pointIdx, 1);

  const incoming = prev
    ? normalize({
        x: point.position.x - prev.position.x,
        y: point.position.y - prev.position.y,
      })
    : null;
  const outgoing = next
    ? normalize({
        x: next.position.x - point.position.x,
        y: next.position.y - point.position.y,
      })
    : null;

  if (incoming && outgoing) {
    const bisector = normalize({
      x: incoming.x + outgoing.x,
      y: incoming.y + outgoing.y,
    });
    if (bisector) return bisector;
  }

  return outgoing ?? incoming ?? { x: 1, y: 0 };
}

function getNeighborPoint(subPath: SubPath, pointIdx: number, direction: -1 | 1) {
  const nextIndex = pointIdx + direction;
  if (nextIndex >= 0 && nextIndex < subPath.points.length) {
    return subPath.points[nextIndex];
  }

  if (!subPath.closed || subPath.points.length === 0) return null;
  return direction === -1
    ? subPath.points[subPath.points.length - 1]
    : subPath.points[0];
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) return null;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getHandleLength(
  handle: { x: number; y: number } | null,
  position: { x: number; y: number },
) {
  if (!handle) return 0;
  return Math.hypot(handle.x - position.x, handle.y - position.y);
}

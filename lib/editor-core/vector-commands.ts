import { editorStore } from '@/lib/editor-store/store';
import type { NodeType, PathPoint, SubPath } from './path-model';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from './parse';

const NUDGE_STEP = 0.5;

type SelectionTarget = {
  iconId: string;
  stateId: string;
  layerId: string;
  pointKey: string;
  handleDirection: 'in' | 'out' | null;
  pathD: string;
};
type MultiSelectionTarget = {
  iconId: string;
  stateId: string;
  layerId: string;
  rawPointKeys: string[];
  pointKeys: string[];
  pathD: string;
};

function getSelectionTarget(): SelectionTarget | null {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const variantId = state.currentVariantId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  const rawPointKey = state.selection.pointIds[0];

  if (!iconId || !variantId || !stateId || !layerId || !rawPointKey) return null;

  const { pointKey, handleDirection } = parseSelectionPointKey(rawPointKey);

  const pathD = state.project?.icons[iconId]?.variants[variantId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return null;

  return { iconId, stateId, layerId, pointKey, handleDirection, pathD };
}

function parseSelectionPointKey(rawPointKey: string): {
  pointKey: string;
  handleDirection: 'in' | 'out' | null;
} {
  const [pointKey, suffix] = rawPointKey.split('@');
  if (suffix === 'in' || suffix === 'out') {
    return { pointKey, handleDirection: suffix };
  }
  return { pointKey: rawPointKey, handleDirection: null };
}

function getMultiSelectionTarget(minPoints = 1): MultiSelectionTarget | null {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const variantId = state.currentVariantId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  const rawPointKeys = Array.from(new Set(state.selection.pointIds));
  const pointKeys = Array.from(
    new Set(rawPointKeys.map((rawPointKey) => parseSelectionPointKey(rawPointKey).pointKey)),
  );

  if (!iconId || !variantId || !stateId || !layerId || pointKeys.length < minPoints) return null;

  const pathD = state.project?.icons[iconId]?.variants[variantId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return null;

  return { iconId, stateId, layerId, rawPointKeys, pointKeys, pathD };
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
  const layer =
    state.currentVariantId
      ? state.project?.icons[iconId]?.variants[state.currentVariantId]?.states[stateId]?.layers[layerId]
      : null;
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
  return deleteSelectionEntries(target.iconId, target.stateId, target.layerId, target.pathD, [
    {
      rawPointKey: target.handleDirection
        ? `${target.pointKey}@${target.handleDirection}`
        : target.pointKey,
      pointKey: target.pointKey,
      handleDirection: target.handleDirection,
    },
  ]);
}

export function deleteSelectedPoints(): boolean {
  const target = getMultiSelectionTarget(1);
  if (!target) return false;
  return deleteSelectionEntries(
    target.iconId,
    target.stateId,
    target.layerId,
    target.pathD,
    target.rawPointKeys.map((rawPointKey) => ({
      rawPointKey,
      ...parseSelectionPointKey(rawPointKey),
    })),
  );
}

export function toggleSelectedPointType(): boolean {
  const target = getSelectionTarget();
  if (!target) return false;

  const resolved = resolvePoint(target.pathD, target.pointKey);
  if (!resolved) return false;
  const { editable } = resolved;
  const nextType =
    resolved.point.nodeType === 'smooth' || resolved.point.nodeType === 'symmetric'
      ? 'static'
      : 'smooth';
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

  const nextPointIdx = pointIdx + 1 < subPath.points.length ? pointIdx + 1 : (subPath.closed ? 0 : -1);
  if (nextPointIdx === -1) return false;
  const nextPoint = subPath.points[nextPointIdx];
  if (!nextPoint) return false;

  const hasCurve = point.handleOut || nextPoint.handleIn;

  if (hasCurve) {
    // De Casteljau subdivision at t=0.5 for proper on-curve point insertion
    const p0 = point.position;
    const p1 = point.handleOut ?? point.position;
    const p2 = nextPoint.handleIn ?? nextPoint.position;
    const p3 = nextPoint.position;

    // First level interpolation
    const p01 = lerp2d(p0, p1, 0.5);
    const p12 = lerp2d(p1, p2, 0.5);
    const p23 = lerp2d(p2, p3, 0.5);

    // Second level
    const p012 = lerp2d(p01, p12, 0.5);
    const p123 = lerp2d(p12, p23, 0.5);

    // Third level = point on curve
    const p0123 = lerp2d(p012, p123, 0.5);

    // Update existing handles for the two resulting curve segments
    point.handleOut = { x: p01.x, y: p01.y };
    nextPoint.handleIn = { x: p23.x, y: p23.y };

    const inserted: PathPoint = {
      id: `${subPath.id}-pt-${Date.now()}`,
      position: { x: p0123.x, y: p0123.y },
      handleIn: { x: p012.x, y: p012.y },
      handleOut: { x: p123.x, y: p123.y },
      nodeType: 'smooth',
      segment: { type: 'cubic' },
    };

    const insertAt = nextPointIdx <= pointIdx ? subPath.points.length : pointIdx + 1;
    subPath.points.splice(insertAt, 0, inserted);

    patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));

    editorStore.getState().setSelection({
      layerIds: [target.layerId],
      pointIds: [`${subPathIdx}:${insertAt}`],
    });
  } else {
    // Simple midpoint for straight line segments
    const inserted: PathPoint = {
      id: `${subPath.id}-pt-${Date.now()}`,
      position: {
        x: (point.position.x + nextPoint.position.x) / 2,
        y: (point.position.y + nextPoint.position.y) / 2,
      },
      handleIn: null,
      handleOut: null,
      nodeType: 'static',
      segment: { type: 'line' },
    };

    const insertAt = nextPointIdx <= pointIdx ? subPath.points.length : pointIdx + 1;
    subPath.points.splice(insertAt, 0, inserted);
    patchPath(target.iconId, target.stateId, target.layerId, serializePath(editable));

    editorStore.getState().setSelection({
      layerIds: [target.layerId],
      pointIds: [`${subPathIdx}:${insertAt}`],
    });
  }

  return true;
}

function lerp2d(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Split a path segment at the nearest point to a given position.
 * Supports both line segments and cubic bezier curves.
 * Returns true if a point was inserted, false otherwise.
 */
export function splitSegmentAtPoint(
  layerId: string,
  svgPosition: { x: number; y: number },
  tolerance: number,
): boolean {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const variantId = state.currentVariantId;
  const stateId = state.currentStateId;
  if (!iconId || !variantId || !stateId) return false;

  const pathD =
    state.project?.icons[iconId]?.variants[variantId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return false;

  const editable = parseSvgPath(pathD);
  let bestHit: {
    subPathIdx: number;
    pointIdx: number;
    t: number;
    distSq: number;
  } | null = null;

  for (let spIdx = 0; spIdx < editable.subPaths.length; spIdx++) {
    const subPath = editable.subPaths[spIdx];
    const segmentCount = subPath.closed ? subPath.points.length : subPath.points.length - 1;

    for (let pIdx = 0; pIdx < segmentCount; pIdx++) {
      const from = subPath.points[pIdx];
      const to = subPath.points[(pIdx + 1) % subPath.points.length];

      const hasCurve = from.handleOut || to.handleIn;
      let result: { t: number; distSq: number };

      if (hasCurve) {
        result = nearestOnCubic(
          from.position,
          from.handleOut ?? from.position,
          to.handleIn ?? to.position,
          to.position,
          svgPosition,
        );
      } else {
        result = nearestOnLine(from.position, to.position, svgPosition);
      }

      if (!bestHit || result.distSq < bestHit.distSq) {
        bestHit = { subPathIdx: spIdx, pointIdx: pIdx, t: result.t, distSq: result.distSq };
      }
    }
  }

  if (!bestHit || bestHit.distSq > tolerance * tolerance) return false;

  const subPath = editable.subPaths[bestHit.subPathIdx];
  const from = subPath.points[bestHit.pointIdx];
  const toIdx = (bestHit.pointIdx + 1) % subPath.points.length;
  const to = subPath.points[toIdx];
  const t = bestHit.t;

  const hasCurve = from.handleOut || to.handleIn;

  if (hasCurve) {
    const p0 = from.position;
    const p1 = from.handleOut ?? from.position;
    const p2 = to.handleIn ?? to.position;
    const p3 = to.position;

    const p01 = lerp2d(p0, p1, t);
    const p12 = lerp2d(p1, p2, t);
    const p23 = lerp2d(p2, p3, t);
    const p012 = lerp2d(p01, p12, t);
    const p123 = lerp2d(p12, p23, t);
    const p0123 = lerp2d(p012, p123, t);

    from.handleOut = { x: p01.x, y: p01.y };
    to.handleIn = { x: p23.x, y: p23.y };

    const inserted: PathPoint = {
      id: `${subPath.id}-pt-${Date.now()}`,
      position: { x: p0123.x, y: p0123.y },
      handleIn: { x: p012.x, y: p012.y },
      handleOut: { x: p123.x, y: p123.y },
      nodeType: 'smooth',
      segment: { type: 'cubic' },
    };

    const insertAt = toIdx <= bestHit.pointIdx ? subPath.points.length : bestHit.pointIdx + 1;
    subPath.points.splice(insertAt, 0, inserted);

    patchPath(iconId, stateId, layerId, serializePath(editable));
    state.setSelection({
      layerIds: [layerId],
      pointIds: [`${bestHit.subPathIdx}:${insertAt}`],
    });
  } else {
    const pos = lerp2d(from.position, to.position, t);
    const inserted: PathPoint = {
      id: `${subPath.id}-pt-${Date.now()}`,
      position: pos,
      handleIn: null,
      handleOut: null,
      nodeType: 'static',
      segment: { type: 'line' },
    };

    const insertAt = toIdx <= bestHit.pointIdx ? subPath.points.length : bestHit.pointIdx + 1;
    subPath.points.splice(insertAt, 0, inserted);

    patchPath(iconId, stateId, layerId, serializePath(editable));
    state.setSelection({
      layerIds: [layerId],
      pointIds: [`${bestHit.subPathIdx}:${insertAt}`],
    });
  }

  return true;
}

function nearestOnLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
  p: { x: number; y: number },
): { t: number; distSq: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) {
    return { t: 0, distSq: (p.x - a.x) ** 2 + (p.y - a.y) ** 2 };
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return { t, distSq: (p.x - px) ** 2 + (p.y - py) ** 2 };
}

function nearestOnCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  target: { x: number; y: number },
): { t: number; distSq: number } {
  // Sample the curve at intervals and find the closest point
  const SAMPLES = 32;
  let bestT = 0;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const pt = evalCubic(p0, p1, p2, p3, t);
    const distSq = (target.x - pt.x) ** 2 + (target.y - pt.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }

  // Refine with binary search around the best sample
  let lo = Math.max(0, bestT - 1 / SAMPLES);
  let hi = Math.min(1, bestT + 1 / SAMPLES);
  for (let iter = 0; iter < 16; iter++) {
    const midLo = (2 * lo + hi) / 3;
    const midHi = (lo + 2 * hi) / 3;
    const ptLo = evalCubic(p0, p1, p2, p3, midLo);
    const ptHi = evalCubic(p0, p1, p2, p3, midHi);
    const dLo = (target.x - ptLo.x) ** 2 + (target.y - ptLo.y) ** 2;
    const dHi = (target.x - ptHi.x) ** 2 + (target.y - ptHi.y) ** 2;
    if (dLo < dHi) {
      hi = midHi;
    } else {
      lo = midLo;
    }
  }

  const finalT = (lo + hi) / 2;
  const finalPt = evalCubic(p0, p1, p2, p3, finalT);
  const finalDistSq = (target.x - finalPt.x) ** 2 + (target.y - finalPt.y) ** 2;

  return { t: finalT, distSq: finalDistSq };
}

function evalCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

export function toggleSelectedPathClosed(): boolean {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const variantId = state.currentVariantId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  if (!iconId || !variantId || !stateId || !layerId) return false;

  const pathD =
    state.project?.icons[iconId]?.variants[variantId]?.states[stateId]?.layers[layerId]?.path?.d;
  if (!pathD || !isPathDirectlyEditable(pathD)) return false;

  const editable = parseSvgPath(pathD);
  const subPath = editable.subPaths[0];
  if (!subPath) return false;

  subPath.closed = !subPath.closed;
  patchPath(iconId, stateId, layerId, serializePath(editable));
  return true;
}

export function nudgeSelectedPointByArrow(key: string, shiftKey = false): boolean {
  const target = getMultiSelectionTarget(1);
  if (!target) return false;

  const step = shiftKey ? NUDGE_STEP * 10 : NUDGE_STEP;
  const delta = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
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

/**
 * Nudge the selected layer's transform by arrow key direction.
 * Fallback for non-editable paths where point nudging doesn't work.
 */
export function nudgeSelectedLayerByArrow(key: string, shiftKey = false): boolean {
  const state = editorStore.getState();
  const iconId = state.currentIconId;
  const variantId = state.currentVariantId;
  const stateId = state.currentStateId;
  const layerId = state.selection.layerIds[0];
  if (!iconId || !variantId || !stateId || !layerId) return false;

  const layer =
    state.project?.icons[iconId]?.variants[variantId]?.states[stateId]?.layers[layerId];
  if (!layer?.path?.d) return false;

  const step = shiftKey ? NUDGE_STEP * 10 : NUDGE_STEP;
  const delta = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }[key];
  if (!delta) return false;

  state.patchLayer(iconId, stateId, layerId, {
    transform: {
      ...(layer.transform ?? {}),
      x: (layer.transform?.x ?? 0) + delta.x,
      y: (layer.transform?.y ?? 0) + delta.y,
    },
  });

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

  if (nodeType === 'static') {
    point.handleIn = null;
    point.handleOut = null;
    point.nodeType = 'static';
    point.segment = { type: 'line' };
    return;
  }

  if (nodeType === 'corner') {
    point.nodeType = 'corner';
    point.segment = point.handleIn || point.handleOut ? { type: 'cubic' } : { type: 'line' };
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
    point.segment = { type: 'cubic' };
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
  point.segment = { type: 'cubic' };
}

function deleteSelectionEntries(
  iconId: string,
  stateId: string,
  layerId: string,
  pathD: string,
  selections: Array<{
    rawPointKey: string;
    pointKey: string;
    handleDirection: 'in' | 'out' | null;
  }>,
): boolean {
  const editable = parseSvgPath(pathD);
  const pointDeletes = new Map<number, Set<number>>();
  const handleOnlySelections = new Set<string>();
  let changed = false;

  for (const selection of selections) {
    const resolved = resolvePointInEditable(editable, selection.pointKey);
    if (!resolved) continue;

    if (selection.handleDirection) {
      const handleKey = selection.handleDirection === 'in' ? 'handleIn' : 'handleOut';
      const previousSegmentType = resolved.point.segment?.type ?? null;
      const hadHandle = Boolean(resolved.point[handleKey]);
      resolved.point[handleKey] = null;
      const adjacentPoint = getNeighborPoint(
        resolved.subPath,
        resolved.pointIdx,
        selection.handleDirection === 'in' ? -1 : 1,
      );
      if (adjacentPoint) {
        if (selection.handleDirection === 'in') {
          adjacentPoint.handleOut = null;
        } else {
          adjacentPoint.handleIn = null;
        }
        normalizePointAfterHandleMutation(adjacentPoint);
      }
      normalizePointAfterHandleMutation(resolved.point);
      handleOnlySelections.add(selection.pointKey);
      changed =
        changed ||
        hadHandle ||
        previousSegmentType === 'arc' ||
        previousSegmentType === 'quadratic';
      continue;
    }

    const indices = pointDeletes.get(resolved.subPathIdx) ?? new Set<number>();
    indices.add(resolved.pointIdx);
    pointDeletes.set(resolved.subPathIdx, indices);
  }

  pointDeletes.forEach((pointIndices, subPathIdx) => {
    const subPath = editable.subPaths[subPathIdx];
    if (!subPath) return;
    const sorted = [...pointIndices].sort((a, b) => b - a);
    for (const pointIdx of sorted) {
      if (subPath.points.length <= 1) continue;
      if (pointIdx < 0 || pointIdx >= subPath.points.length) continue;
      subPath.points.splice(pointIdx, 1);
      changed = true;
    }
  });

  if (!changed) return false;

  patchPath(iconId, stateId, layerId, serializePath(editable));
  editorStore.getState().setSelection({
    layerIds: [layerId],
    pointIds: pointDeletes.size > 0 ? [] : [...handleOnlySelections],
  });
  return true;
}

function normalizePointAfterHandleMutation(point: PathPoint): void {
  if (!point.handleIn && !point.handleOut) {
    point.nodeType = 'static';
    point.segment = { type: 'line' };
    return;
  }

  point.nodeType = 'corner';
  if (point.segment?.type === 'arc' || point.segment?.type === 'quadratic') {
    point.segment = { type: 'line' };
    return;
  }
  point.segment = { type: 'cubic' };
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

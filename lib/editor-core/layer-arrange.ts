import { commitHistory, pauseHistory, resumeHistory } from '@/lib/editor-store/history';
import { editorStore } from '@/lib/editor-store/store';
import type { Layer } from '@/lib/schema/types';

type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';
type DistributeMode = 'horizontal' | 'vertical';

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

type LayerBounds = {
  id: string;
  layer: Layer;
  bounds: Bounds;
};

type Point = {
  x: number;
  y: number;
};

const DEFAULT_ARRANGE_SETTINGS = {
  invalidLayerPolicy: 'skip-invalid',
  minDistributionLayerCount: 3,
  epsilon: 1e-6,
} as const;

function computeLayerBounds(layer: Layer): Bounds | null {
  const d = layer.path?.d;
  if (!d) return null;

  return computePathBounds(d, layer.transform);
}

function collectLayerBounds(layerIds: string[], iconId: string, stateId: string): LayerBounds[] {
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const iconState = state.currentVariantId
    ? icon?.variants[state.currentVariantId]?.states[stateId]
    : null;
  if (!iconState) return [];

  const seen = new Set<string>();
  const orderedIds = layerIds.filter((layerId) => {
    if (seen.has(layerId)) return false;
    seen.add(layerId);
    return true;
  });

  return orderedIds
    .map((layerId) => {
      const layer = iconState.layers[layerId];
      if (!layer) return null;

      const bounds = computeLayerBounds(layer);
      if (!bounds) return null;

      return { id: layerId, layer, bounds };
    })
    .filter((entry): entry is LayerBounds => Boolean(entry));
}

function unionBounds(entries: LayerBounds[]): Bounds | null {
  if (entries.length === 0) return null;

  let left = entries[0].bounds.left;
  let right = entries[0].bounds.right;
  let top = entries[0].bounds.top;
  let bottom = entries[0].bounds.bottom;

  for (let i = 1; i < entries.length; i++) {
    const bounds = entries[i].bounds;
    left = Math.min(left, bounds.left);
    right = Math.max(right, bounds.right);
    top = Math.min(top, bounds.top);
    bottom = Math.max(bottom, bounds.bottom);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function patchLayerPosition(
  iconId: string,
  stateId: string,
  layer: Layer,
  deltaX: number,
  deltaY: number,
): boolean {
  if (
    Math.abs(deltaX) <= DEFAULT_ARRANGE_SETTINGS.epsilon &&
    Math.abs(deltaY) <= DEFAULT_ARRANGE_SETTINGS.epsilon
  ) {
    return false;
  }

  const state = editorStore.getState();
  state.patchLayer(iconId, stateId, layer.id, {
    transform: {
      ...(layer.transform ?? {}),
      x: (layer.transform?.x ?? 0) + deltaX,
      y: (layer.transform?.y ?? 0) + deltaY,
    },
  });
  return true;
}

function runHistoryTransaction(label: string, mutator: () => boolean) {
  pauseHistory();

  let changed = false;
  try {
    changed = mutator();
  } finally {
    resumeHistory();
    if (changed) {
      commitHistory(label);
    }
  }
}

export function alignLayers(
  mode: AlignMode,
  layerIds: string[],
  iconId: string,
  stateId: string,
): void {
  if (!iconId || !stateId) return;

  const entries = collectLayerBounds(layerIds, iconId, stateId);
  const reference = unionBounds(entries);
  if (!reference) return;

  runHistoryTransaction(`align-${mode}`, () => {
    let changed = false;

    for (const entry of entries) {
      let deltaX = 0;
      let deltaY = 0;

      switch (mode) {
        case 'left':
          deltaX = reference.left - entry.bounds.left;
          break;
        case 'center-h':
          deltaX = reference.centerX - entry.bounds.centerX;
          break;
        case 'right':
          deltaX = reference.right - entry.bounds.right;
          break;
        case 'top':
          deltaY = reference.top - entry.bounds.top;
          break;
        case 'center-v':
          deltaY = reference.centerY - entry.bounds.centerY;
          break;
        case 'bottom':
          deltaY = reference.bottom - entry.bounds.bottom;
          break;
      }

      changed = patchLayerPosition(iconId, stateId, entry.layer, deltaX, deltaY) || changed;
    }

    return changed;
  });
}

export function distributeLayers(
  mode: DistributeMode,
  layerIds: string[],
  iconId: string,
  stateId: string,
): void {
  if (!iconId || !stateId) return;

  const entries = collectLayerBounds(layerIds, iconId, stateId);
  if (entries.length < DEFAULT_ARRANGE_SETTINGS.minDistributionLayerCount) return;

  const axis = mode === 'horizontal' ? 'x' : 'y';
  const sorted = [...entries].sort((a, b) => {
    const delta =
      axis === 'x' ? a.bounds.left - b.bounds.left : a.bounds.top - b.bounds.top;

    if (Math.abs(delta) > DEFAULT_ARRANGE_SETTINGS.epsilon) return delta;
    return layerIds.indexOf(a.id) - layerIds.indexOf(b.id);
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (axis === 'x') {
    const totalWidth = sorted.reduce((sum, entry) => sum + entry.bounds.width, 0);
    const gap = (last.bounds.right - first.bounds.left - totalWidth) / (sorted.length - 1);
    let cursor = first.bounds.right + gap;

    runHistoryTransaction(`distribute-${mode}`, () => {
      let changed = false;

      for (let i = 1; i < sorted.length - 1; i++) {
        const entry = sorted[i];
        changed =
          patchLayerPosition(iconId, stateId, entry.layer, cursor - entry.bounds.left, 0) || changed;
        cursor += entry.bounds.width + gap;
      }

      return changed;
    });
    return;
  }

  const totalHeight = sorted.reduce((sum, entry) => sum + entry.bounds.height, 0);
  const gap = (last.bounds.bottom - first.bounds.top - totalHeight) / (sorted.length - 1);
  let cursor = first.bounds.bottom + gap;

  runHistoryTransaction(`distribute-${mode}`, () => {
    let changed = false;

    for (let i = 1; i < sorted.length - 1; i++) {
      const entry = sorted[i];
      changed =
        patchLayerPosition(iconId, stateId, entry.layer, 0, cursor - entry.bounds.top) || changed;
      cursor += entry.bounds.height + gap;
    }

    return changed;
  });
}

function computePathBounds(d: string, transform?: Layer['transform']): Bounds | null {
  const tokens = tokenizePath(d);
  if (tokens.length === 0) return null;

  let index = 0;
  let command = '';
  let current: Point | null = null;
  let subpathStart: Point | null = null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const includePoint = (point: Point) => {
    const next = transformPoint(point, transform);
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return;
    minX = Math.min(minX, next.x);
    minY = Math.min(minY, next.y);
    maxX = Math.max(maxX, next.x);
    maxY = Math.max(maxY, next.y);
  };

  const includeLine = (a: Point, b: Point) => {
    includePoint(a);
    includePoint(b);
  };

  const includeQuadratic = (p0: Point, p1: Point, p2: Point) => {
    const a = transformPoint(p0, transform);
    const b = transformPoint(p1, transform);
    const c = transformPoint(p2, transform);
    const samples = [a, c];

    const tx = quadraticExtremum(a.x, b.x, c.x);
    if (tx !== null) samples.push(evaluateQuadratic(a, b, c, tx));

    const ty = quadraticExtremum(a.y, b.y, c.y);
    if (ty !== null) samples.push(evaluateQuadratic(a, b, c, ty));

    for (const point of samples) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  };

  const includeCubic = (p0: Point, p1: Point, p2: Point, p3: Point) => {
    const a = transformPoint(p0, transform);
    const b = transformPoint(p1, transform);
    const c = transformPoint(p2, transform);
    const dPoint = transformPoint(p3, transform);
    const samples = [a, dPoint];

    for (const t of cubicExtrema(a.x, b.x, c.x, dPoint.x)) {
      samples.push(evaluateCubic(a, b, c, dPoint, t));
    }
    for (const t of cubicExtrema(a.y, b.y, c.y, dPoint.y)) {
      samples.push(evaluateCubic(a, b, c, dPoint, t));
    }

    for (const point of samples) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (isCommandToken(token)) {
      command = token;
      index += 1;
    } else if (!command) {
      return null;
    }

    switch (command) {
      case 'M':
      case 'm': {
        const first = readPoint(tokens, index, command === 'm', current);
        if (!first) return null;
        current = first.point;
        subpathStart = first.point;
        includePoint(first.point);
        index = first.nextIndex;

        while (canReadPoint(tokens, index)) {
          const next = readPoint(tokens, index, command === 'm', current);
          if (!next || !current) return null;
          includeLine(current, next.point);
          current = next.point;
          index = next.nextIndex;
        }
        break;
      }

      case 'L':
      case 'l': {
        if (!current || !canReadPoint(tokens, index)) return null;
        while (canReadPoint(tokens, index)) {
          const next = readPoint(tokens, index, command === 'l', current);
          if (!next || !current) return null;
          includeLine(current, next.point);
          current = next.point;
          index = next.nextIndex;
        }
        break;
      }

      case 'H':
      case 'h': {
        if (!current || !canReadNumbers(tokens, index, 1)) return null;
        while (canReadNumbers(tokens, index, 1)) {
          const x = readNumber(tokens, index);
          if (x === null || !current) return null;
          const nextPoint: Point = { x: command === 'h' ? current.x + x : x, y: current.y };
          includeLine(current, nextPoint);
          current = nextPoint;
          index += 1;
        }
        break;
      }

      case 'V':
      case 'v': {
        if (!current || !canReadNumbers(tokens, index, 1)) return null;
        while (canReadNumbers(tokens, index, 1)) {
          const y = readNumber(tokens, index);
          if (y === null || !current) return null;
          const nextPoint: Point = { x: current.x, y: command === 'v' ? current.y + y : y };
          includeLine(current, nextPoint);
          current = nextPoint;
          index += 1;
        }
        break;
      }

      case 'Q':
      case 'q': {
        if (!current || !canReadNumbers(tokens, index, 4)) return null;
        while (canReadNumbers(tokens, index, 4)) {
          const curve = readQuadratic(tokens, index, command === 'q', current);
          if (!curve || !current) return null;
          includeQuadratic(current, curve.control, curve.point);
          current = curve.point;
          index = curve.nextIndex;
        }
        break;
      }

      case 'C':
      case 'c': {
        if (!current || !canReadNumbers(tokens, index, 6)) return null;
        while (canReadNumbers(tokens, index, 6)) {
          const curve = readCubic(tokens, index, command === 'c', current);
          if (!curve || !current) return null;
          includeCubic(current, curve.control1, curve.control2, curve.point);
          current = curve.point;
          index = curve.nextIndex;
        }
        break;
      }

      case 'Z':
      case 'z': {
        if (current && subpathStart) {
          includeLine(current, subpathStart);
          current = subpathStart;
        }
        break;
      }

      default:
        return null;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function tokenizePath(d: string): string[] {
  return Array.from(d.matchAll(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g), (match) => match[0]);
}

function isCommandToken(token: string | undefined): token is string {
  return Boolean(token && /^[a-zA-Z]$/.test(token));
}

function canReadNumbers(tokens: string[], index: number, count: number): boolean {
  if (index + count > tokens.length) return false;
  for (let i = 0; i < count; i++) {
    if (readNumber(tokens, index + i) === null) return false;
  }
  return true;
}

function canReadPoint(tokens: string[], index: number): boolean {
  return canReadNumbers(tokens, index, 2);
}

function readNumber(tokens: string[], index: number): number | null {
  const token = tokens[index];
  if (token === undefined || isCommandToken(token)) return null;
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}

function readPoint(
  tokens: string[],
  index: number,
  relative: boolean,
  current: Point | null,
): { point: Point; nextIndex: number } | null {
  const x = readNumber(tokens, index);
  const y = readNumber(tokens, index + 1);
  if (x === null || y === null) return null;
  return {
    point: {
      x: relative ? (current?.x ?? 0) + x : x,
      y: relative ? (current?.y ?? 0) + y : y,
    },
    nextIndex: index + 2,
  };
}

function readQuadratic(
  tokens: string[],
  index: number,
  relative: boolean,
  current: Point,
): { control: Point; point: Point; nextIndex: number } | null {
  const control = readPoint(tokens, index, relative, current);
  if (!control) return null;
  const point = readPoint(tokens, index + 2, relative, current);
  if (!point) return null;
  return { control: control.point, point: point.point, nextIndex: index + 4 };
}

function readCubic(
  tokens: string[],
  index: number,
  relative: boolean,
  current: Point,
): { control1: Point; control2: Point; point: Point; nextIndex: number } | null {
  const control1 = readPoint(tokens, index, relative, current);
  if (!control1) return null;
  const control2 = readPoint(tokens, index + 2, relative, current);
  if (!control2) return null;
  const point = readPoint(tokens, index + 4, relative, current);
  if (!point) return null;
  return {
    control1: control1.point,
    control2: control2.point,
    point: point.point,
    nextIndex: index + 6,
  };
}

function transformPoint(point: Point, transform?: Layer['transform']): Point {
  let x = point.x + (transform?.x ?? 0);
  let y = point.y + (transform?.y ?? 0);

  if (transform?.rotate) {
    const radians = (transform.rotate * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const nextX = x * cos - y * sin;
    const nextY = x * sin + y * cos;
    x = nextX;
    y = nextY;
  }

  x *= transform?.scaleX ?? 1;
  y *= transform?.scaleY ?? 1;

  return { x, y };
}

function quadraticExtremum(p0: number, p1: number, p2: number): number | null {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) <= DEFAULT_ARRANGE_SETTINGS.epsilon) return null;
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? t : null;
}

function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;

  if (Math.abs(a) <= DEFAULT_ARRANGE_SETTINGS.epsilon) {
    if (Math.abs(b) <= DEFAULT_ARRANGE_SETTINGS.epsilon) return [];
    const t = -c / b;
    return t > 0 && t < 1 ? [t] : [];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -DEFAULT_ARRANGE_SETTINGS.epsilon) return [];
  if (Math.abs(discriminant) <= DEFAULT_ARRANGE_SETTINGS.epsilon) {
    const t = -b / (2 * a);
    return t > 0 && t < 1 ? [t] : [];
  }

  const root = Math.sqrt(Math.max(discriminant, 0));
  const values = [(-b + root) / (2 * a), (-b - root) / (2 * a)];
  return values.filter((t, index) => t > 0 && t < 1 && values.indexOf(t) === index);
}

function evaluateQuadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function evaluateCubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

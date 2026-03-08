import { commitHistory, pauseHistory, resumeHistory } from '@/lib/editor-store/history';
import { editorStore } from '@/lib/editor-store/store';
import type { Layer } from '@/lib/schema/types';

declare const require: undefined | ((id: string) => PaperModule);

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

const DEFAULT_ARRANGE_SETTINGS = {
  invalidLayerPolicy: 'skip-invalid',
  minDistributionLayerCount: 3,
  epsilon: 1e-6,
} as const;

type PaperModule = {
  PaperScope: new () => {
    setup: (size: { width: number; height: number }) => void;
    Size: new (width: number, height: number) => unknown;
    CompoundPath: new (pathData: string) => any;
    Point: new (x: number, y: number) => unknown;
  };
};

declare global {
  interface Window {
    paper?: PaperModule;
  }
}

let paperScope: any | null = null;

function loadPaperModule(): PaperModule | null {
  if (typeof window !== 'undefined') {
    if (window.paper) {
      return window.paper;
    }
  }

  try {
    if (typeof require === 'function') {
      const moduleId = ['paper', 'dist', 'paper-core'].join('/');
      return require(moduleId);
    }
  } catch {
    return null;
  }

  return null;
}

function getPaperScope(): any | null {
  if (paperScope) return paperScope;

  const paperModule = loadPaperModule();
  if (!paperModule) return null;

  paperScope = new paperModule.PaperScope();
  paperScope.setup(new paperScope.Size(1, 1));
  return paperScope;
}

function toBounds(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  center: { x: number; y: number };
}): Bounds | null {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (values.some((value) => !Number.isFinite(value))) return null;

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    centerX: rect.center.x,
    centerY: rect.center.y,
  };
}

function computeLayerBounds(layer: Layer): Bounds | null {
  const d = layer.path?.d;
  if (!d) return null;

  const scope = getPaperScope();
  if (!scope) return null;

  try {
    const item = new scope.CompoundPath(d);
    item.fillColor = null;
    item.strokeColor = null;

    const t = layer.transform;
    if (t) {
      if (t.x !== undefined || t.y !== undefined) {
        item.translate(new scope.Point(t.x ?? 0, t.y ?? 0));
      }
      if (t.rotate !== undefined) {
        item.rotate(t.rotate, new scope.Point(0, 0));
      }
      if (t.scaleX !== undefined || t.scaleY !== undefined) {
        item.scale(t.scaleX ?? 1, t.scaleY ?? 1, new scope.Point(0, 0));
      }
    }

    const bounds = toBounds(item.strokeBounds.clone());
    item.remove();
    return bounds;
  } catch {
    return null;
  }
}

function collectLayerBounds(layerIds: string[], iconId: string, stateId: string): LayerBounds[] {
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const iconState = icon?.states[stateId];
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

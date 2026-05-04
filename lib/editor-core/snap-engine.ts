import { editorStore, type EditorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentGuideMaster,
  selectCurrentType,
  selectCurrentVariant,
} from '@/lib/editor-store/selectors';
import { parseSvgPath } from './parse';
import type { GuideItem, Layer } from '@/lib/schema/types';

export type SnapTarget = {
  x?: number;
  y?: number;
  type: 'grid' | 'guide' | 'edge' | 'center' | 'spacing' | 'anchor';
  sourceLayerId?: string;
};

export type SnapResult = {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  guides: SnapTarget[];
};

export type ComputeSnapOptions = {
  sourceLayerId?: string;
  sourceGuideIndex?: number;
  tolerancePx?: number;
  gridStep?: number;
  zoom?: number;
  viewBox?: [number, number, number, number];
};

type LayerBounds = { minX: number; maxX: number; minY: number; maxY: number };

type BoundsCacheEntry = {
  signature: string;
  bounds: LayerBounds | null;
};

const DEFAULT_GRID_STEP = 0.5;
const DEFAULT_TOLERANCE_PX = 3;

export class SnapEngine {
  private boundsCache = new Map<string, BoundsCacheEntry>();
  private unsubscribe: (() => void) | null = null;
  private stateFingerprint = '';

  constructor(private readonly store: Pick<typeof editorStore, 'getState' | 'subscribe'>) {
    this.unsubscribe = this.store.subscribe(() => {
      const nextFingerprint = this.getStateFingerprint();
      if (nextFingerprint !== this.stateFingerprint) {
        this.stateFingerprint = nextFingerprint;
        this.invalidate();
      }
    });
    this.stateFingerprint = this.getStateFingerprint();
  }

  computeSnap(point: { x: number; y: number }, options: ComputeSnapOptions = {}): SnapResult {
    const state = this.store.getState() as EditorStore;
    if (!state.snapEnabled) {
      return {
        x: point.x,
        y: point.y,
        snappedX: false,
        snappedY: false,
        guides: [],
      };
    }

    const variant = selectCurrentVariant(state);
    const icon = selectCurrentIcon(state);
    const guideMaster = selectCurrentGuideMaster(state);
    const currentState = selectCurrentType(state);

    const viewBox = options.viewBox ?? variant?.viewBox;
    const zoom = Math.max(options.zoom ?? state.viewport.zoom ?? 1, 0.0001);
    const toleranceSvg = (options.tolerancePx ?? DEFAULT_TOLERANCE_PX) / zoom;
    const gridStep = options.gridStep ?? DEFAULT_GRID_STEP;

    const candidates: SnapTarget[] = [];

    this.collectGridTargets(point, gridStep, candidates);

    if (viewBox) {
      this.collectViewBoxCenterTargets(viewBox, candidates);
    }

    // Guides contribute snap targets only when they are visible. Toggling the
    // toolbar guide-visibility off therefore disables guide snapping too —
    // pixel/grid/edge snapping remain gated only by `snapEnabled`.
    if (state.guidesVisible) {
      if (guideMaster?.items?.length) {
        this.collectGuideTargets(
          guideMaster.items,
          candidates,
          state.editScope.kind === 'guideMaster' ? options.sourceGuideIndex : undefined,
        );
      }

      if (icon?.customGuides?.length) {
        this.collectGuideTargets(icon.customGuides, candidates);
      }

      // While editing an icon, the master's editable `layers` (full-fat
      // shapes authored on canvas via Guide editing mode) also contribute
      // edge/anchor snap targets — they render as part of the guide
      // overlay at this point. In guide scope, those same layers are
      // already `currentState.layers`, so we skip to avoid duplicate
      // collection.
      if (
        state.editScope.kind === 'icon' &&
        guideMaster?.layers &&
        Object.keys(guideMaster.layers).length > 0
      ) {
        this.collectLayerTargets(guideMaster.layers, options.sourceLayerId, candidates);
      }
    }

    if (currentState?.layers) {
      this.collectLayerTargets(currentState.layers, options.sourceLayerId, candidates);
    }

    const xMatch = findNearestTarget(point.x, 'x', candidates, toleranceSvg);
    const yMatch = findNearestTarget(point.y, 'y', candidates, toleranceSvg);

    const guides: SnapTarget[] = [];
    if (xMatch) guides.push(xMatch.target);
    if (yMatch) {
      const alreadyIncluded = guides.some((guide) => areTargetsEquivalent(guide, yMatch.target));
      if (!alreadyIncluded) guides.push(yMatch.target);
    }

    return {
      x: xMatch?.value ?? point.x,
      y: yMatch?.value ?? point.y,
      snappedX: Boolean(xMatch),
      snappedY: Boolean(yMatch),
      guides,
    };
  }

  invalidate() {
    this.boundsCache.clear();
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private collectGridTargets(point: { x: number; y: number }, step: number, out: SnapTarget[]) {
    if (!(step > 0)) return;

    out.push({ x: snapToStep(point.x, step), type: 'grid' });
    out.push({ y: snapToStep(point.y, step), type: 'grid' });
  }

  private collectViewBoxCenterTargets(viewBox: [number, number, number, number], out: SnapTarget[]) {
    const [vx, vy, vw, vh] = viewBox;
    out.push({ x: vx + vw / 2, type: 'center' });
    out.push({ y: vy + vh / 2, type: 'center' });
  }

  private collectGuideTargets(
    items: GuideItem[],
    out: SnapTarget[],
    sourceGuideIndex?: number,
  ) {
    for (const [index, item] of items.entries()) {
      if (index === sourceGuideIndex) continue;

      if (item.kind === 'hline') {
        out.push({ y: item.y, type: 'guide' });
      } else if (item.kind === 'vline') {
        out.push({ x: item.x, type: 'guide' });
      } else if (item.kind === 'line') {
        out.push({ x: item.x1, type: 'guide' });
        out.push({ x: item.x2, type: 'guide' });
        out.push({ x: (item.x1 + item.x2) / 2, type: 'guide' });
        out.push({ y: item.y1, type: 'guide' });
        out.push({ y: item.y2, type: 'guide' });
        out.push({ y: (item.y1 + item.y2) / 2, type: 'guide' });
      } else if (item.kind === 'rect') {
        out.push({ x: item.x, type: 'guide' });
        out.push({ x: item.x + item.width, type: 'guide' });
        out.push({ x: item.x + item.width / 2, type: 'guide' });
        out.push({ y: item.y, type: 'guide' });
        out.push({ y: item.y + item.height, type: 'guide' });
        out.push({ y: item.y + item.height / 2, type: 'guide' });
      } else if (item.kind === 'ellipse') {
        out.push({ x: item.cx - item.rx, type: 'guide' });
        out.push({ x: item.cx, type: 'guide' });
        out.push({ x: item.cx + item.rx, type: 'guide' });
        out.push({ y: item.cy - item.ry, type: 'guide' });
        out.push({ y: item.cy, type: 'guide' });
        out.push({ y: item.cy + item.ry, type: 'guide' });
      }
    }
  }

  private collectLayerTargets(
    layers: Record<string, Layer>,
    sourceLayerId: string | undefined,
    out: SnapTarget[],
  ) {
    for (const [layerId, layer] of Object.entries(layers)) {
      if (layerId === sourceLayerId || layer.visible === false || !layer.path?.d) continue;

      const bounds = this.getLayerBounds(layer);
      if (!bounds) continue;

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      out.push({ x: bounds.minX, type: 'edge', sourceLayerId: layerId });
      out.push({ x: bounds.maxX, type: 'edge', sourceLayerId: layerId });
      out.push({ y: bounds.minY, type: 'edge', sourceLayerId: layerId });
      out.push({ y: bounds.maxY, type: 'edge', sourceLayerId: layerId });
      out.push({ x: centerX, type: 'center', sourceLayerId: layerId });
      out.push({ y: centerY, type: 'center', sourceLayerId: layerId });

      const anchors = this.getLayerAnchors(layer);
      for (const anchor of anchors) {
        out.push({ x: anchor.x, type: 'anchor', sourceLayerId: layerId });
        out.push({ y: anchor.y, type: 'anchor', sourceLayerId: layerId });
      }
    }
  }

  private getLayerBounds(layer: Layer): LayerBounds | null {
    if (!layer.path?.d) return null;

    const signature = `${layer.path.d}|${layer.transform?.x ?? ''}|${layer.transform?.y ?? ''}|${
      layer.transform?.rotate ?? ''
    }|${layer.transform?.scaleX ?? ''}|${layer.transform?.scaleY ?? ''}`;

    const cached = this.boundsCache.get(layer.id);
    if (cached && cached.signature === signature) {
      return cached.bounds;
    }

    const bounds = computeLayerBounds(layer);
    this.boundsCache.set(layer.id, { signature, bounds });
    return bounds;
  }

  private getStateFingerprint(): string {
    const s = this.store.getState() as EditorStore;
    const iconId = s.currentIconId ?? '';
    const variantId = s.currentVariantId ?? '';
    const stateId = s.currentTypeId ?? '';
    const projectMarker = s.project ? Object.keys(s.project.icons).length : 0;
    const current = selectCurrentType(s);
    const layerCount = current ? Object.keys(current.layers).length : 0;
    return `${iconId}|${variantId}|${stateId}|${projectMarker}|${layerCount}`;
  }

  private getLayerAnchors(layer: Layer): Array<{ x: number; y: number }> {
    if (!layer.path?.d) return [];

    const editablePath = parseSvgPath(layer.path.d);
    const anchors: Array<{ x: number; y: number }> = [];
    for (const subPath of editablePath.subPaths) {
      for (const point of subPath.points) {
        anchors.push(applyTransform(point.position, layer.transform));
      }
    }
    return anchors;
  }
}

const defaultSnapEngine = new SnapEngine(editorStore);

export function computeSnap(
  point: { x: number; y: number },
  options: ComputeSnapOptions = {},
): SnapResult {
  return defaultSnapEngine.computeSnap(point, options);
}

function findNearestTarget(
  value: number,
  axis: 'x' | 'y',
  candidates: SnapTarget[],
  tolerance: number,
): { target: SnapTarget; value: number; distance: number } | null {
  let best: { target: SnapTarget; value: number; distance: number } | null = null;

  for (const candidate of candidates) {
    const candidateValue = axis === 'x' ? candidate.x : candidate.y;
    if (candidateValue === undefined) continue;

    const distance = Math.abs(candidateValue - value);
    if (distance > tolerance) continue;

    if (!best) {
      best = { target: candidate, value: candidateValue, distance };
      continue;
    }

    const candidatePriority = getSnapPriority(candidate.type);
    const bestPriority = getSnapPriority(best.target.type);
    if (candidatePriority < bestPriority) {
      best = { target: candidate, value: candidateValue, distance };
      continue;
    }
    if (candidatePriority > bestPriority) {
      continue;
    }

    if (distance < best.distance) {
      best = { target: candidate, value: candidateValue, distance };
      continue;
    }

    if (distance === best.distance && candidateValue < best.value) {
      best = { target: candidate, value: candidateValue, distance };
    }
  }

  return best;
}

function getSnapPriority(type: SnapTarget['type']): number {
  switch (type) {
    case 'guide':
      return 1;
    case 'anchor':
      return 2;
    case 'edge':
      return 3;
    case 'center':
      return 4;
    case 'grid':
      return 5;
    case 'spacing':
      return 6;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

function areTargetsEquivalent(a: SnapTarget, b: SnapTarget): boolean {
  return (
    a.type === b.type &&
    a.x === b.x &&
    a.y === b.y &&
    a.sourceLayerId === b.sourceLayerId
  );
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function computeLayerBounds(layer: Layer): LayerBounds | null {
  if (!layer.path?.d) return null;

  const editablePath = parseSvgPath(layer.path.d);
  const points: Array<{ x: number; y: number }> = [];

  for (const subPath of editablePath.subPaths) {
    for (const point of subPath.points) {
      points.push(point.position);
      if (point.handleIn) points.push(point.handleIn);
      if (point.handleOut) points.push(point.handleOut);
    }
  }

  if (points.length === 0) return null;

  const transformed = points.map((pt) => applyTransform(pt, layer.transform));

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const pt of transformed) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;

  return { minX, maxX, minY, maxY };
}

function applyTransform(
  point: { x: number; y: number },
  transform: Layer['transform'],
): { x: number; y: number } {
  if (!transform) return point;

  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const rotate = transform.rotate ?? 0;
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;

  const sx = point.x * scaleX;
  const sy = point.y * scaleY;

  const theta = (rotate * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  return {
    x: sx * cos - sy * sin + tx,
    y: sx * sin + sy * cos + ty,
  };
}

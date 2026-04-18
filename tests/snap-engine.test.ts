import { describe, expect, test } from 'bun:test';
import type { EditorStore } from '../lib/editor-store/store';
import type { Project } from '../lib/schema/types';
import { SnapEngine, computeSnap } from '../lib/editor-core/snap-engine';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

type StoreLike = {
  getState: () => EditorStore;
  subscribe: (listener: () => void) => () => boolean;
};

function createProjectFixture(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Snap Fixture',
      createdAt: '2026-03-07T00:00:00Z',
      updatedAt: '2026-03-07T00:00:00Z',
    },
    guideMasters: {
      'primary-guides': {
        id: 'primary-guides',
        name: '24px Primary Guides',
        targetSize: 24,
        viewBox: [0, 0, 24, 24],
        items: [
          { kind: 'vline', x: 6 },
          { kind: 'hline', y: 18 },
          { kind: 'rect', x: 4, y: 4, width: 8, height: 8 },
        ],
      },
    },
    icons: {
      snap: {
        id: 'snap',
        name: 'Snap',
        variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          layers: {},
          defaultType: 'default',
          types: {
            default: {
              id: 'default',
              layers: {
                moving: {
                  id: 'moving',
                  visible: true,
                  path: { d: 'M1 1 L2 2' },
                  style: {},
                },
                anchor: {
                  id: 'anchor',
                  visible: true,
                  path: { d: 'M8 10 L12 14' },
                  style: {},
                },
              },
            },
          },
        },
      },
        transitions: {},
      },
    },
  };
}

function createMockStore(state: EditorStore): StoreLike & { emit: () => void } {
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: () => {
      listeners.forEach((listener) => listener());
    },
  };
}

describe('snap engine', () => {
  test('computeSnap snaps to grid by default', () => {
    editorStore.setState({ snapEnabled: true, activeSnapGuides: [], project: null, currentIconId: null, currentVariantId: null, currentTypeId: null });
    const result = computeSnap(
      { x: 3.24, y: 6.76 },
      {
        zoom: 1,
        tolerancePx: 3,
        viewBox: [0, 0, 24, 24],
      },
    );

    expect(result.x).toBe(3);
    expect(result.y).toBe(7);
    expect(result.snappedX).toBeTrue();
    expect(result.snappedY).toBeTrue();
    expect(result.guides.some((guide) => guide.type === 'grid')).toBeTrue();
  });

  test('collects viewBox center, guide items, and other-layer bounds as candidates', () => {
    const project = createProjectFixture();
    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    const centerSnap = engine.computeSnap(
      { x: 11.6, y: 11.7 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(centerSnap.x).toBe(12);
    expect(centerSnap.y).toBe(12);

    const guideSnap = engine.computeSnap(
      { x: 5.95, y: 17.9 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(guideSnap.x).toBe(6);
    expect(guideSnap.y).toBe(18);
    expect(guideSnap.guides.some((guide) => guide.type === 'guide')).toBeTrue();

    const layerBoundsSnap = engine.computeSnap(
      { x: 7.92, y: 9.95 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(layerBoundsSnap.x).toBe(8);
    expect(layerBoundsSnap.y).toBe(10);
    expect(
      layerBoundsSnap.guides.some(
        (guide) =>
          (guide.type === 'edge' || guide.type === 'anchor') &&
          guide.sourceLayerId === 'anchor',
      ),
    ).toBeTrue();

    engine.destroy();
  });

  test('uses screen-space tolerance and cache invalidation on layer changes', () => {
    const project = createProjectFixture();
    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      viewport: { zoom: 1, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    // At zoom=1, 3px tolerance => 3 SVG units: x=15 is too far from anchor edge x=12.
    const loose = engine.computeSnap(
      { x: 15.1, y: 15 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(loose.snappedX).toBeFalse();

    // At zoom=4, same 3px tolerance => 0.75 SVG units: this point is near edge x=12.
    state.viewport.zoom = 4;
    const tight = engine.computeSnap(
      { x: 12.7, y: 13.8 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(tight.x).toBe(12);
    expect(tight.snappedX).toBeTrue();

    // Mutate layer geometry and emit store update to trigger cache invalidation.
    state.project!.icons.snap.variants.v24.types!.default.layers.anchor.path!.d = 'M16 16 L20 20';
    store.emit();

    const afterChange = engine.computeSnap(
      { x: 16.2, y: 16.1 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );
    expect(afterChange.x).toBe(16);
    expect(afterChange.y).toBe(16);
    expect(afterChange.guides.some((guide) => guide.sourceLayerId === 'anchor')).toBeTrue();

    engine.destroy();
  });

  test('can be constructed with sample project store shape', () => {
    const loaded = structuredClone(SAMPLE_PROJECT);
    editorStore.getState().loadProject(loaded);
    editorStore.getState().setCurrentIcon('icon-home');
    editorStore.getState().setCurrentVariant('v24');
    editorStore.getState().setCurrentType('default');
    editorStore.setState({ snapEnabled: true, activeSnapGuides: [] });

    const result = computeSnap({ x: 12.1, y: 12.1 }, { zoom: 4, tolerancePx: 3 });
    expect(result.snappedX).toBeTrue();
    expect(result.snappedY).toBeTrue();
  });

  test('returns raw pointer coordinates when snapping is disabled', () => {
    const project = createProjectFixture();
    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: false,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    const result = engine.computeSnap({ x: 11.6, y: 17.9 }, { sourceLayerId: 'moving' });
    expect(result.x).toBe(11.6);
    expect(result.y).toBe(17.9);
    expect(result.snappedX).toBeFalse();
    expect(result.snappedY).toBeFalse();
    expect(result.guides).toEqual([]);

    engine.destroy();
  });

  test('prefers the nearest candidate on each axis over a farther grid snap', () => {
    const project = createProjectFixture();
    project.icons.snap.variants.v24.guideMasterId = 'primary-guides';

    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    const result = engine.computeSnap(
      { x: 5.92, y: 17.9 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 4 },
    );

    expect(result.x).toBe(6);
    expect(result.y).toBe(18);
    expect(result.guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'guide', x: 6 }),
        expect.objectContaining({ type: 'guide', y: 18 }),
      ]),
    );

    engine.destroy();
  });

  test('uses deterministic target priority when multiple snap candidates overlap', () => {
    const project = createProjectFixture();
    project.icons.snap.variants.v24.guideMasterId = 'primary-guides';

    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    // x=6 and y=18 are shared by guide + grid candidates.
    const result = engine.computeSnap(
      { x: 6.02, y: 17.98 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 2 },
    );

    expect(result.x).toBe(6);
    expect(result.y).toBe(18);
    expect(result.guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'guide', x: 6 }),
        expect.objectContaining({ type: 'guide', y: 18 }),
      ]),
    );

    engine.destroy();
  });

  test('guidesVisible=false drops guide targets while grid snap still fires', () => {
    const project = createProjectFixture();
    project.icons.snap.variants.v24.guideMasterId = 'primary-guides';

    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      guidesVisible: false,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    // Point is near the vline at x=6 — guide should no longer attract it.
    const result = engine.computeSnap(
      { x: 6.05, y: 17.9 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0.5 },
    );

    expect(result.guides.some((guide) => guide.type === 'guide')).toBeFalse();
    // Grid/edge/anchor snap is still live; just not the guide master.
    expect(result.snappedX || result.snappedY).toBeTrue();

    engine.destroy();
  });

  test('guidesVisible=true regression: guide target still contributes', () => {
    const project = createProjectFixture();
    project.icons.snap.variants.v24.guideMasterId = 'primary-guides';

    const state = {
      ...editorStore.getState(),
      project,
      currentIconId: 'snap',
      currentVariantId: 'v24',
      currentTypeId: 'default',
      snapEnabled: true,
      guidesVisible: true,
      viewport: { zoom: 4, panX: 0, panY: 0 },
    } as EditorStore;

    const store = createMockStore(state);
    const engine = new SnapEngine(store);

    const result = engine.computeSnap(
      { x: 5.95, y: 17.9 },
      { sourceLayerId: 'moving', tolerancePx: 3, gridStep: 0 },
    );

    expect(result.x).toBe(6);
    expect(result.y).toBe(18);
    expect(result.guides.some((guide) => guide.type === 'guide')).toBeTrue();

    engine.destroy();
  });
});

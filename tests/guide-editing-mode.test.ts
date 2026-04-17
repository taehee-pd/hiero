import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { PathEditor, buildShapePathFromDrag, primitiveToGuideItem } from '../lib/editor-core';
import { buildPrimitivePath } from '../lib/editor-core/path-shapes';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import type { PrimitiveShape } from '../lib/schema/types';

const originalWindow = (globalThis as { window?: unknown }).window;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

beforeAll(() => {
  (globalThis as { window: unknown }).window = {
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
});

afterEach(() => {
  clearHistory();
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
});

afterAll(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = originalWindow;
  }
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

function seedMaster() {
  const state = editorStore.getState();
  state.addGuideMaster({
    id: 'test-master',
    name: 'Test master',
    targetSize: 24,
    viewBox: [0, 0, 24, 24],
    items: [],
  });
  // Bind the master to the current variant. `patchVariant` doesn't accept
  // `guideMasterId`, so reach through the project state directly — this is
  // the same pattern migration code uses.
  editorStore.setState((s) => {
    if (!s.project) return s;
    const icon = s.project.icons['icon-home'];
    if (!icon) return s;
    const variant = icon.variants.v24;
    if (!variant) return s;
    return {
      project: {
        ...s.project,
        icons: {
          ...s.project.icons,
          'icon-home': {
            ...icon,
            variants: {
              ...icon.variants,
              v24: { ...variant, guideMasterId: 'test-master' },
            },
          },
        },
      },
    };
  });
  clearHistory();
  return 'test-master';
}

function createMockSvg(): SVGSVGElement {
  return {
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 240, height: 240 } as DOMRect;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    setPointerCapture() {},
  } as unknown as SVGSVGElement;
}

function pointerEvent(init: {
  clientX: number;
  clientY: number;
  pointerId?: number;
  shiftKey?: boolean;
  altKey?: boolean;
}) {
  return {
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId ?? 1,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    target: {
      getAttribute() {
        return null;
      },
      setPointerCapture() {},
    },
  } as unknown as PointerEvent;
}

describe('guide editing mode — store lifecycle', () => {
  test('enter/exit toggles the mode and clears selection on enter', () => {
    bootstrap();
    const masterId = seedMaster();

    editorStore.getState().setSelection({ layerIds: ['roof'], pointIds: [] });
    editorStore.getState().enterGuideEditingMode(masterId);
    const after = editorStore.getState();
    expect(after.guideEditingMode).toEqual({ active: true, masterId });
    expect(after.selection).toEqual({ layerIds: [], pointIds: [] });

    editorStore.getState().exitGuideEditingMode();
    expect(editorStore.getState().guideEditingMode).toEqual({
      active: false,
      masterId: null,
    });
  });

  test('enter is a no-op when the target master does not exist', () => {
    bootstrap();
    editorStore.getState().enterGuideEditingMode('does-not-exist');
    expect(editorStore.getState().guideEditingMode).toEqual({
      active: false,
      masterId: null,
    });
  });

  test('switching variant exits guide editing mode', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    // SAMPLE_PROJECT has multiple variants for icon-home; pick any other one.
    const icon = editorStore.getState().project!.icons['icon-home'];
    const otherVariantId = Object.keys(icon.variants).find((id) => id !== 'v24');
    if (!otherVariantId) return; // SAMPLE_PROJECT shape changed; skip.
    editorStore.getState().setCurrentVariant(otherVariantId);
    expect(editorStore.getState().guideEditingMode.active).toBeFalse();
  });

  test('deleting the bound master exits guide editing mode', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    editorStore.getState().removeGuideMaster(masterId);
    expect(editorStore.getState().guideEditingMode).toEqual({
      active: false,
      masterId: null,
    });
  });
});

describe('guide editing mode — canvas drag branches to GuideItem', () => {
  test('drag creates a GuideItem on pointerup, no Layer added', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('rectangle');
    state.enterGuideEditingMode(masterId);

    const layerCountBefore = Object.keys(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers,
    ).length;

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 30 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 100 }));
    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 100 }));

    const master = editorStore.getState().project!.guideMasters![masterId];
    expect(master.items.length).toBe(1);
    expect(master.items[0]!.kind).toBe('rect');

    const layerCountAfter = Object.keys(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers,
    ).length;
    expect(layerCountAfter).toBe(layerCountBefore);

    editor.destroy();
  });

  test('Escape cancel during drag commits nothing', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('rectangle');
    state.enterGuideEditingMode(masterId);

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 30 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 100 }));
    (editor as any).onKeyDown({ key: 'Escape' } as KeyboardEvent);

    const master = editorStore.getState().project!.guideMasters![masterId];
    expect(master.items).toHaveLength(0);

    editor.destroy();
  });

  test('Escape with no drag in progress exits guide editing mode', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const editor = new PathEditor(createMockSvg());
    (editor as any).onKeyDown({ key: 'Escape' } as KeyboardEvent);

    expect(editorStore.getState().guideEditingMode.active).toBeFalse();
    editor.destroy();
  });

  test('polygon sub-tool in guide mode does not commit a GuideItem', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('polygon');
    state.enterGuideEditingMode(masterId);

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 30 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 100 }));
    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 100 }));

    const master = editorStore.getState().project!.guideMasters![masterId];
    expect(master.items).toHaveLength(0);

    editor.destroy();
  });
});

describe('primitive shape metadata + invariant', () => {
  test('shape-tool creation stamps a matching primitive on the new layer', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('polygon');
    state.setShapePolygonSides(6);

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));
    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));

    const layerId = editorStore.getState().selection.layerIds[0]!;
    const layer =
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default
        .layers[layerId];
    expect(layer).toBeDefined();
    expect(layer!.primitive?.kind).toBe('polygon');
    if (layer!.primitive?.kind === 'polygon') {
      expect(layer!.primitive.sides).toBe(6);
    }

    editor.destroy();
  });

  test('setLayerPrimitive regenerates path.d via the shared buildPrimitivePath helper', () => {
    bootstrap();
    const state = editorStore.getState();
    const seeded: PrimitiveShape = {
      kind: 'polygon',
      cx: 12,
      cy: 12,
      r: 6,
      sides: 5,
    };
    state.patchLayer('icon-home', 'roof', {
      path: { d: buildPrimitivePath(seeded) },
      primitive: seeded,
    });

    state.setLayerPrimitive('icon-home', 'roof', { ...seeded, sides: 8 });

    const layer =
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers
        .roof;
    expect(layer.primitive?.kind).toBe('polygon');
    if (layer.primitive?.kind === 'polygon') {
      expect(layer.primitive.sides).toBe(8);
    }
    expect(layer.path!.d).toBe(buildPrimitivePath({ ...seeded, sides: 8 }));
  });

  test('patchLayer clears primitive + stamps formerPrimitiveKind when path is mutated', () => {
    bootstrap();
    const state = editorStore.getState();
    const seeded: PrimitiveShape = {
      kind: 'star',
      cx: 12,
      cy: 12,
      outerR: 6,
      innerR: 3,
      points: 5,
    };
    state.patchLayer('icon-home', 'roof', {
      path: { d: buildPrimitivePath(seeded) },
      primitive: seeded,
    });
    // A mutation to path.d without supplying a primitive clears the metadata.
    state.patchLayer('icon-home', 'roof', {
      path: { d: 'M0 0 L10 10' },
    });

    const layer =
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers
        .roof;
    expect(layer.primitive).toBeUndefined();
    expect(layer.formerPrimitiveKind).toBe('star');
  });

  test('setLayerPrimitive clears the formerPrimitiveKind breadcrumb', () => {
    bootstrap();
    const state = editorStore.getState();
    const seeded: PrimitiveShape = {
      kind: 'polygon',
      cx: 12,
      cy: 12,
      r: 6,
      sides: 5,
    };
    state.patchLayer('icon-home', 'roof', {
      path: { d: buildPrimitivePath(seeded) },
      primitive: seeded,
    });
    // Mutate path → primitive cleared, breadcrumb stamped
    state.patchLayer('icon-home', 'roof', { path: { d: 'M0 0 L10 10' } });
    expect(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers
        .roof.formerPrimitiveKind,
    ).toBe('polygon');
    // Re-parameterising clears the breadcrumb
    state.setLayerPrimitive('icon-home', 'roof', { ...seeded, sides: 7 });
    expect(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers
        .roof.formerPrimitiveKind,
    ).toBeUndefined();
  });
});

describe('primitiveToGuideItem helper', () => {
  test('maps rectangle/ellipse primitives to matching GuideItems', () => {
    const rect = buildShapePathFromDrag({
      shapeType: 'rectangle',
      start: { x: 0, y: 0 },
      current: { x: 10, y: 10 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(rect.primitive)).toEqual({
      kind: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    const ellipse = buildShapePathFromDrag({
      shapeType: 'ellipse',
      start: { x: 0, y: 0 },
      current: { x: 10, y: 10 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(ellipse.primitive)).toEqual({
      kind: 'ellipse',
      cx: 5,
      cy: 5,
      rx: 5,
      ry: 5,
    });
  });

  test('maps axis-aligned line primitives to hline / vline', () => {
    const horizontal = buildShapePathFromDrag({
      shapeType: 'line',
      start: { x: 0, y: 5 },
      current: { x: 10, y: 5 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(horizontal.primitive)).toEqual({ kind: 'hline', y: 5 });

    const vertical = buildShapePathFromDrag({
      shapeType: 'line',
      start: { x: 7, y: 0 },
      current: { x: 7, y: 10 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(vertical.primitive)).toEqual({ kind: 'vline', x: 7 });
  });

  test('polygon/star primitives have no GuideItem equivalent', () => {
    const polygon = buildShapePathFromDrag({
      shapeType: 'polygon',
      start: { x: 0, y: 0 },
      current: { x: 10, y: 10 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(polygon.primitive)).toBeNull();

    const star = buildShapePathFromDrag({
      shapeType: 'star',
      start: { x: 0, y: 0 },
      current: { x: 10, y: 10 },
      shiftKey: false,
      altKey: false,
      polygonSides: 5,
      starPoints: 5,
    });
    expect(primitiveToGuideItem(star.primitive)).toBeNull();
  });
});

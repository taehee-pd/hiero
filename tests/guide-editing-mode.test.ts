import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { PathEditor } from '../lib/editor-core';
import { buildPrimitivePath } from '../lib/editor-core/path-shapes';
import { clearHistory, undo } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import {
  selectCurrentType,
  selectCurrentVariant,
  selectCurrentIcon,
} from '../lib/editor-store/selectors';
import type { PrimitiveShape } from '../lib/schema/types';

const windowRef = ((globalThis as { window?: Record<string, unknown> }).window ??= {});
const originalWindowAddEventListener = windowRef.addEventListener;
const originalWindowRemoveEventListener = windowRef.removeEventListener;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

beforeAll(() => {
  windowRef.addEventListener = () => {};
  windowRef.removeEventListener = () => {};
  windowRef.setTimeout = globalThis.setTimeout as unknown as Record<string, unknown>[string];
  windowRef.clearTimeout = globalThis.clearTimeout as unknown as Record<string, unknown>[string];
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
});

afterEach(() => {
  clearHistory();
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
});

afterAll(() => {
  windowRef.addEventListener = originalWindowAddEventListener;
  windowRef.removeEventListener = originalWindowRemoveEventListener;
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

/**
 * Seed a master with a couple of parametric items so we can assert the
 * items → layers migration fires on first enter.
 */
function seedMaster() {
  const state = editorStore.getState();
  state.addGuideMaster({
    id: 'test-master',
    name: 'Test master',
    targetSize: 24,
    viewBox: [0, 0, 24, 24],
    items: [
      { kind: 'rect', x: 4, y: 4, width: 8, height: 6 },
      { kind: 'ellipse', cx: 12, cy: 12, rx: 4, ry: 3 },
      { kind: 'hline', y: 8 },
      {
        kind: 'drawPoint',
        layerId: 'some-layer',
        t: 0.5,
      },
    ],
    layers: {},
  });
  // Bind the master to the current variant via direct project surgery
  // (patchVariant doesn't accept guideMasterId).
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

describe('editScope lifecycle', () => {
  test('enter flips editScope to guideMaster + clears selection', () => {
    bootstrap();
    const masterId = seedMaster();

    editorStore.getState().setSelection({ layerIds: ['roof'], pointIds: [] });
    editorStore.getState().enterGuideEditingMode(masterId);

    const after = editorStore.getState();
    expect(after.editScope).toEqual({ kind: 'guideMaster', masterId });
    expect(after.selection).toEqual({ layerIds: [], pointIds: [] });
  });

  test('exit returns the scope to icon + keeps icon pointers intact', () => {
    bootstrap();
    const masterId = seedMaster();
    const before = editorStore.getState();
    const { currentIconId, currentVariantId, currentTypeId } = before;

    editorStore.getState().enterGuideEditingMode(masterId);
    editorStore.getState().exitGuideEditingMode();

    const after = editorStore.getState();
    expect(after.editScope).toEqual({ kind: 'icon' });
    expect(after.currentIconId).toBe(currentIconId);
    expect(after.currentVariantId).toBe(currentVariantId);
    expect(after.currentTypeId).toBe(currentTypeId);
  });

  test('enter is a no-op when the target master does not exist', () => {
    bootstrap();
    editorStore.getState().enterGuideEditingMode('does-not-exist');
    expect(editorStore.getState().editScope).toEqual({ kind: 'icon' });
  });

  test('switching variant auto-exits guide editing mode', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const icon = editorStore.getState().project!.icons['icon-home'];
    const otherVariantId = Object.keys(icon.variants).find((id) => id !== 'v24');
    if (!otherVariantId) return; // sample project changed; skip

    editorStore.getState().setCurrentVariant(otherVariantId);
    expect(editorStore.getState().editScope).toEqual({ kind: 'icon' });
  });

  test('deleting the bound master auto-exits guide editing mode', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    editorStore.getState().removeGuideMaster(masterId);
    expect(editorStore.getState().editScope).toEqual({ kind: 'icon' });
  });
});

describe('items → layers migration on enter', () => {
  test('migrates rect/ellipse/hline/vline into layers; keeps drawPoint in items', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const master = editorStore.getState().project!.guideMasters![masterId];
    // 3 geometric items → 3 layers; drawPoint stays in items.
    expect(Object.keys(master.layers ?? {})).toHaveLength(3);
    expect(master.items).toHaveLength(1);
    expect(master.items[0]!.kind).toBe('drawPoint');

    // The migrated rect/ellipse layers should carry matching primitive
    // metadata so the Inspector's Sides/Points surface generalises.
    const layers = Object.values(master.layers ?? {});
    const rectLayer = layers.find((l) => l.primitive?.kind === 'rectangle');
    const ellipseLayer = layers.find((l) => l.primitive?.kind === 'ellipse');
    expect(rectLayer).toBeDefined();
    expect(ellipseLayer).toBeDefined();
  });

  test('migration is idempotent — a second enter is a no-op', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    const firstPass = editorStore.getState().project!.guideMasters![masterId];

    editorStore.getState().exitGuideEditingMode();
    editorStore.getState().enterGuideEditingMode(masterId);
    const secondPass = editorStore.getState().project!.guideMasters![masterId];

    expect(Object.keys(secondPass.layers ?? {}).length).toBe(
      Object.keys(firstPass.layers ?? {}).length,
    );
    expect(secondPass.items.length).toBe(firstPass.items.length);
  });
});

describe('selectors redirect to master layers in guide scope', () => {
  test('selectCurrentIcon returns null', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    expect(selectCurrentIcon(editorStore.getState())).toBeNull();
  });

  test('selectCurrentVariant synthesises a Variant from the master', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const variant = selectCurrentVariant(editorStore.getState());
    expect(variant).not.toBeNull();
    expect(variant!.size).toBe(24);
    expect(variant!.id).toBe(`guide-master:${masterId}`);
    // Layers reflect the migrated set.
    expect(Object.keys(variant!.layers).length).toBeGreaterThan(0);
  });

  test('selectCurrentType returns the master snapshot', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const snap = selectCurrentType(editorStore.getState());
    expect(snap).not.toBeNull();
    expect(Object.keys(snap!.layers).length).toBeGreaterThan(0);
  });
});

describe('shape-tool creation routes writes by scope', () => {
  test('new shapes land on master.layers in guide scope (not on any icon)', () => {
    bootstrap();
    const masterId = seedMaster();
    const iconLayersBefore = Object.keys(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers,
    ).length;

    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('polygon');
    state.enterGuideEditingMode(masterId);

    const beforeMasterCount = Object.keys(
      editorStore.getState().project!.guideMasters![masterId]!.layers ?? {},
    ).length;

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));
    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));

    const master = editorStore.getState().project!.guideMasters![masterId]!;
    expect(Object.keys(master.layers ?? {}).length).toBe(beforeMasterCount + 1);

    // Icon's variant layers are untouched — the drawn shape went to the
    // master, not the icon.
    const iconLayersAfter = Object.keys(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers,
    ).length;
    expect(iconLayersAfter).toBe(iconLayersBefore);

    editor.destroy();
  });

  test('polygon + star are available in guide mode (same toolbar)', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.enterGuideEditingMode(masterId);

    for (const kind of ['polygon', 'star'] as const) {
      state.setShapeSubTool(kind);
      const editor = new PathEditor(createMockSvg());
      const before = Object.keys(
        editorStore.getState().project!.guideMasters![masterId]!.layers ?? {},
      ).length;
      (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
      (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));
      (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));
      const after = Object.keys(
        editorStore.getState().project!.guideMasters![masterId]!.layers ?? {},
      ).length;
      expect(after).toBe(before + 1);
      editor.destroy();
    }
  });
});

describe('layer-writers respect editScope', () => {
  test('patchLayer writes to master.layers in guide scope', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const master = editorStore.getState().project!.guideMasters![masterId]!;
    const someLayerId = Object.keys(master.layers ?? {})[0]!;
    editorStore.getState().patchLayer('icon-home', someLayerId, { visible: false });

    const updated = editorStore.getState().project!.guideMasters![masterId]!
      .layers![someLayerId];
    expect(updated!.visible).toBe(false);

    // The icon's variant is not mutated.
    const iconLayer = Object.values(
      editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers,
    )[0];
    if (iconLayer) {
      expect(iconLayer.visible).not.toBe(false);
    }
  });

  test('setLayerPrimitive regenerates a master layer via the shared helper', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const master = editorStore.getState().project!.guideMasters![masterId]!;
    // Pick the migrated rectangle layer.
    const rectLayerId = Object.keys(master.layers ?? {}).find(
      (id) => master.layers![id]!.primitive?.kind === 'rectangle',
    )!;
    expect(rectLayerId).toBeDefined();

    const nextPrimitive: PrimitiveShape = {
      kind: 'polygon',
      cx: 12,
      cy: 12,
      r: 5,
      sides: 7,
    };
    editorStore.getState().setLayerPrimitive('icon-home', rectLayerId, nextPrimitive);

    const updated = editorStore.getState().project!.guideMasters![masterId]!
      .layers![rectLayerId];
    expect(updated!.primitive?.kind).toBe('polygon');
    expect(updated!.path!.d).toBe(buildPrimitivePath(nextPrimitive));
  });

  test('removeSelectedLayers deletes from master.layers in guide scope', () => {
    bootstrap();
    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);

    const layersBefore =
      editorStore.getState().project!.guideMasters![masterId]!.layers ?? {};
    const [firstId] = Object.keys(layersBefore);
    if (!firstId) return;

    editorStore.getState().setSelection({ layerIds: [firstId], pointIds: [] });
    editorStore.getState().removeSelectedLayers();

    const layersAfter =
      editorStore.getState().project!.guideMasters![masterId]!.layers ?? {};
    expect(layersAfter[firstId]).toBeUndefined();
  });
});

describe('icon-dependent actions no-op in guide scope', () => {
  test('upsertSymbolComponent no-ops when editing a master', () => {
    bootstrap();
    const masterId = seedMaster();
    const iconBefore = editorStore.getState().project!.icons['icon-home'];
    const componentsBefore = iconBefore.components;

    editorStore.getState().enterGuideEditingMode(masterId);
    editorStore
      .getState()
      .upsertSymbolComponent('icon-home', { kind: 'badge', layerIds: ['roof'] });

    const iconAfter = editorStore.getState().project!.icons['icon-home'];
    expect(iconAfter.components).toEqual(componentsBefore);
  });
});

describe('adversarial: history, clipboard, race, synthetic ids', () => {
  function makeSecondMaster() {
    editorStore.getState().addGuideMaster({
      id: 'test-master-b',
      name: 'Test master B',
      targetSize: 24,
      viewBox: [0, 0, 24, 24],
      items: [{ kind: 'rect', x: 2, y: 2, width: 10, height: 10 }],
      layers: {},
    });
    return 'test-master-b';
  }

  test('undo of a guide-scope edit keeps us in the same master', () => {
    bootstrap();
    const masterA = seedMaster();

    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('rectangle');

    // Enter A. At this moment editScope flips to guideMaster(A) — and a
    // snapshot is pushed with editScope=icon (the state BEFORE the enter).
    state.enterGuideEditingMode(masterA);
    const masterALayersBeforeDraw = Object.keys(
      editorStore.getState().project!.guideMasters![masterA]!.layers ?? {},
    ).length;

    // Draw one shape on A. A snapshot is pushed capturing editScope=A
    // (the state before the mutation).
    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));
    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));
    editor.destroy();

    // If the user is still in scope A (they haven't exited), undoing the
    // draw should keep them in scope A. The popped snapshot's editScope
    // was A, so restoration yields A.
    undo();

    const afterUndo = editorStore.getState();
    expect(afterUndo.editScope).toEqual({ kind: 'guideMaster', masterId: masterA });
    const masterAAfter = Object.keys(
      afterUndo.project!.guideMasters![masterA]!.layers ?? {},
    ).length;
    expect(masterAAfter).toBe(masterALayersBeforeDraw);
  });


  test('deleting the active master during a drag does not resurrect it', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('rectangle');
    state.enterGuideEditingMode(masterId);

    const editor = new PathEditor(createMockSvg());
    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));

    // Master is deleted mid-drag. Pointerup must not write back anything.
    editorStore.getState().removeGuideMaster(masterId);

    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));
    const master = editorStore.getState().project!.guideMasters?.[masterId];
    expect(master).toBeUndefined();
    expect(editorStore.getState().editScope).toEqual({ kind: 'icon' });
    editor.destroy();
  });

  test('paste strips icon-only metadata when landing on a guide master', () => {
    bootstrap();
    // Load a clipboard payload that carries icon-only fields to exercise
    // the strip behaviour.
    editorStore.setState({
      layerClipboard: [
        {
          id: 'payload',
          role: 'primary',
          groupId: 'group-1',
          drawOrder: 2,
          importMeta: { sourceTag: 'path' },
          visible: true,
          path: { d: 'M0 0 L10 10' },
          style: {},
        },
      ],
    });

    const masterId = seedMaster();
    editorStore.getState().enterGuideEditingMode(masterId);
    editorStore.getState().pasteLayers();

    const master = editorStore.getState().project!.guideMasters![masterId]!;
    const pasted = Object.values(master.layers ?? {}).find((l) => l.id.startsWith('payload'));
    expect(pasted).toBeDefined();
    expect(pasted!.role).toBeUndefined();
    expect(pasted!.groupId).toBeUndefined();
    expect(pasted!.drawOrder).toBeUndefined();
    expect(pasted!.importMeta).toBeUndefined();
    expect(pasted!.path!.d).toBe('M0 0 L10 10');
  });

  test('icon-only actions no-op in guide scope', () => {
    bootstrap();
    const masterId = seedMaster();
    const snapshotBefore = structuredClone(editorStore.getState().project);

    editorStore.getState().enterGuideEditingMode(masterId);

    // addVariant / removeVariant / patchVariant / applyDerivedVariant all
    // must no-op. The icon dictionary should remain referentially equal
    // relative to what we saved before the enter (modulo the migration
    // which only touched guideMasters, not icons).
    editorStore
      .getState()
      .addVariant('icon-home', { size: 72, name: 'No-op variant' });
    editorStore.getState().removeVariant('icon-home', 'v24');
    editorStore.getState().patchVariant('icon-home', 'v24', { size: 999 });

    const after = editorStore.getState().project;
    expect(after!.icons).toEqual(snapshotBefore!.icons);
  });

  test('synthetic variant ids are master-scoped and stable across reads', () => {
    bootstrap();
    const masterA = seedMaster();
    const masterB = makeSecondMaster();

    editorStore.getState().enterGuideEditingMode(masterA);
    const aFirst = selectCurrentVariant(editorStore.getState());
    const aSecond = selectCurrentVariant(editorStore.getState());
    expect(aFirst).toBe(aSecond); // WeakMap cache — identity-stable.
    expect(aFirst!.id).toBe(`guide-master:${masterA}`);

    editorStore.getState().exitGuideEditingMode();
    editorStore.getState().enterGuideEditingMode(masterB);
    const b = selectCurrentVariant(editorStore.getState());
    expect(b!.id).toBe(`guide-master:${masterB}`);
    // A and B use different synthetic ids — no collision.
    expect(b!.id).not.toBe(aFirst!.id);
  });
});

describe('canvas toolbar remains identical in guide scope', () => {
  test('every SHAPE_SUB_TOOLS entry is still authorable on the master', () => {
    bootstrap();
    const masterId = seedMaster();
    const state = editorStore.getState();
    state.setTool('shape');
    state.enterGuideEditingMode(masterId);

    const kinds: Array<'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line'> = [
      'rectangle',
      'ellipse',
      'polygon',
      'star',
      'line',
    ];
    for (const kind of kinds) {
      state.setShapeSubTool(kind);
      const editor = new PathEditor(createMockSvg());
      const before = Object.keys(
        editorStore.getState().project!.guideMasters![masterId]!.layers ?? {},
      ).length;
      (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
      (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 80 }));
      (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 80 }));
      const after = Object.keys(
        editorStore.getState().project!.guideMasters![masterId]!.layers ?? {},
      ).length;
      expect(after).toBe(before + 1);
      editor.destroy();
    }
  });
});

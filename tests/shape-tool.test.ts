import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { createEllipsePath, createPolygonPath, createRectPath, PathEditor } from '../lib/editor-core';
import { clearHistory, canUndo, redo, undo } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

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
  // Replace the complex Lucide path with a simple 3-point polyline for point-editing tests
  state.patchLayer('icon-home', 'roof', {
    path: { d: 'M9.5 7 L14.5 12 L9.5 17' },
  });
  clearHistory();
}

function createMockSvg(): SVGSVGElement {
  return {
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: 240,
        height: 240,
      } as DOMRect;
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

function getCurrentLayer(layerId: string) {
  return editorStore.getState().project!.icons['icon-home'].variants.v24.types!.default.layers[layerId];
}

function pointerEvent(init: {
  clientX: number;
  clientY: number;
  pointerId?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  layerId?: string | null;
  pointKey?: string | null;
  controlDirection?: 'in' | 'out' | null;
}) {
  const attrs = new Map<string, string>();
  if (init.layerId) attrs.set('data-layer-id', init.layerId);
  if (init.pointKey) attrs.set('data-point-key', init.pointKey);
  if (init.controlDirection) attrs.set('data-control-direction', init.controlDirection);

  return {
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId ?? 1,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    target: {
      getAttribute(name: string) {
        return attrs.get(name) ?? null;
      },
      setPointerCapture() {},
    },
  } as unknown as PointerEvent;
}

describe('shape tool drag interactions', () => {
  test('creates, previews, and commits a rectangle layer with one undo snapshot', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('rectangle');

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 30 }));
    const layerId = editorStore.getState().selection.layerIds[0];
    expect(layerId).toBe('shape-1');
    expect(canUndo()).toBeFalse();

    (editor as any).onPointerMove(pointerEvent({ clientX: 80, clientY: 100 }));
    const previewPath = getCurrentLayer(layerId).path!.d;
    expect(previewPath).toBe(createRectPath(2, 3, 6, 7));

    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 100 }));
    expect(canUndo()).toBeTrue();

    undo();
    const afterUndo = getCurrentLayer(layerId);
    expect(afterUndo).toBeUndefined();

    redo();
    const afterRedo = getCurrentLayer(layerId).path!.d;
    expect(afterRedo).toBe(createRectPath(2, 3, 6, 7));

    editor.destroy();
  });

  test('uses shift and alt to draw a centered constrained ellipse', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('ellipse');

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(pointerEvent({ clientX: 120, clientY: 120 }));
    const layerId = editorStore.getState().selection.layerIds[0];

    (editor as any).onPointerMove(
      pointerEvent({ clientX: 180, clientY: 140, shiftKey: true, altKey: true }),
    );
    (editor as any).onPointerUp(
      pointerEvent({ clientX: 180, clientY: 140, shiftKey: true, altKey: true }),
    );

    const path = getCurrentLayer(layerId).path!.d;
    expect(path).toBe(createEllipsePath(12, 12, 6, 6));

    editor.destroy();
  });

  test('uses polygon side count from store settings', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('polygon');
    state.setShapePolygonSides(6);

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }));
    const layerId = editorStore.getState().selection.layerIds[0];

    (editor as any).onPointerUp(pointerEvent({ clientX: 140, clientY: 100 }));

    const path = getCurrentLayer(layerId).path!.d;
    expect(path).toBe(createPolygonPath(8, 6, 4, 6));
    expect(editorStore.getState().shapePolygonSides).toBe(6);

    editor.destroy();
  });

  test('escape cancels the temporary shape layer and restores the previous selection', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('star');
    state.setSelection({ layerIds: ['roof'], pointIds: [] });

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(pointerEvent({ clientX: 40, clientY: 40 }));
    expect(editorStore.getState().selection.layerIds[0]).toBe('shape-1');

    (editor as any).onPointerMove(pointerEvent({ clientX: 120, clientY: 120 }));
    (editor as any).onKeyDown({ key: 'Escape' } as KeyboardEvent);

    expect(getCurrentLayer('shape-1')).toBeUndefined();
    expect(editorStore.getState().selection.layerIds).toEqual(['roof']);
    expect(canUndo()).toBeFalse();

    editor.destroy();
  });
});

describe('direct-select marquee interactions', () => {
  test('selects a nearby point when clicking within the expanded hit radius', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('direct-select');
    state.setSelection({ layerIds: ['roof'], pointIds: [] });

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(
      pointerEvent({ clientX: 112, clientY: 70, layerId: 'roof' }),
    );
    (editor as any).onPointerUp(
      pointerEvent({ clientX: 112, clientY: 70, layerId: 'roof' }),
    );

    expect(editorStore.getState().selection.layerIds).toEqual(['roof']);
    expect(editorStore.getState().selection.pointIds).toEqual(['0:0']);

    editor.destroy();
  });

  test('marquee drag replaces the current point selection with touched points', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('direct-select');
    state.setSelection({ layerIds: ['roof'], pointIds: ['0:2'] });

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(
      pointerEvent({ clientX: 80, clientY: 55, layerId: 'roof' }),
    );
    (editor as any).onPointerMove(
      pointerEvent({ clientX: 155, clientY: 135, layerId: 'roof' }),
    );

    expect(editorStore.getState().pointMarquee).toEqual({
      minX: 8,
      minY: 5.5,
      maxX: 15.5,
      maxY: 13.5,
    });
    expect(editorStore.getState().selection.pointIds).toEqual(['0:0', '0:1']);

    (editor as any).onPointerUp(
      pointerEvent({ clientX: 155, clientY: 135, layerId: 'roof' }),
    );

    expect(editorStore.getState().pointMarquee).toBeNull();
    expect(editorStore.getState().selection.pointIds).toEqual(['0:0', '0:1']);

    editor.destroy();
  });

  test('shift marquee toggles touched points against the starting selection', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('direct-select');
    state.setSelection({ layerIds: ['roof'], pointIds: ['0:0', '0:2'] });

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(
      pointerEvent({ clientX: 80, clientY: 105, layerId: 'roof', shiftKey: true }),
    );
    (editor as any).onPointerMove(
      pointerEvent({ clientX: 155, clientY: 185, layerId: 'roof', shiftKey: true }),
    );
    (editor as any).onPointerUp(
      pointerEvent({ clientX: 155, clientY: 185, layerId: 'roof', shiftKey: true }),
    );

    expect(editorStore.getState().selection.layerIds).toEqual(['roof']);
    expect(editorStore.getState().selection.pointIds).toEqual(['0:0', '0:1']);

    editor.destroy();
  });
});

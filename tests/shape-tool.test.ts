import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { createEllipsePath, createPolygonPath, createRectPath, PathEditor } from '../lib/editor-core';
import { clearHistory, canUndo, redo, undo } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

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
    const previewPath =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers[layerId].path!.d;
    expect(previewPath).toBe(createRectPath(2, 3, 6, 7));

    (editor as any).onPointerUp(pointerEvent({ clientX: 80, clientY: 100 }));
    expect(canUndo()).toBeTrue();

    undo();
    const afterUndo =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers[layerId];
    expect(afterUndo).toBeUndefined();

    redo();
    const afterRedo =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers[layerId].path!.d;
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

    const path =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers[layerId].path!.d;
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

    const path =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers[layerId].path!.d;
    expect(path).toBe(createPolygonPath(8, 6, 4, 6));
    expect(editorStore.getState().shapePolygonSides).toBe(6);

    editor.destroy();
  });

  test('escape cancels the temporary shape layer and restores the previous selection', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('shape');
    state.setShapeSubTool('star');
    state.setSelection({ layerIds: ['chevron'], pointIds: [] });

    const editor = new PathEditor(createMockSvg());

    (editor as any).onPointerDown(pointerEvent({ clientX: 40, clientY: 40 }));
    expect(editorStore.getState().selection.layerIds[0]).toBe('shape-1');

    (editor as any).onPointerMove(pointerEvent({ clientX: 120, clientY: 120 }));
    (editor as any).onKeyDown({ key: 'Escape' } as KeyboardEvent);

    expect(
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['shape-1'],
    ).toBeUndefined();
    expect(editorStore.getState().selection.layerIds).toEqual(['chevron']);
    expect(canUndo()).toBeFalse();

    editor.destroy();
  });
});

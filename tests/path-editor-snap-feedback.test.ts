import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { PathEditor } from '../lib/editor-core/path-editor';
import type { Project } from '../lib/schema/types';

type FakeSvgElement = {
  addEventListener: () => void;
  removeEventListener: () => void;
  getBoundingClientRect: () => DOMRect;
  querySelector: () => { setAttribute: (name: string, value: string) => void } | null;
  querySelectorAll: () => Array<{ setAttribute: (name: string, value: string) => void }>;
};

function createProjectFixture(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Path Editor Snap Feedback',
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-03-08T00:00:00Z',
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
                path: { d: 'M8.3 10.7 L12.3 14.7' },
                style: {},
              },
            },
            defaultState: 'default',
            states: {
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
                    path: { d: 'M8.3 10.7 L12.3 14.7' },
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

function createSvgStub(): FakeSvgElement {
  const pathEl = {
    setAttribute: (_name: string, _value: string) => {},
  };

  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
        width: 24,
        height: 24,
      }) as DOMRect,
    querySelector: () => pathEl,
    querySelectorAll: () => [],
  };
}

beforeAll(() => {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  (globalThis as any).cancelAnimationFrame = () => {};
});

beforeEach(() => {
  editorStore.getState().loadProject(createProjectFixture());
  editorStore.getState().setCurrentIcon('snap');
  editorStore.getState().setCurrentVariant('v24');
  editorStore.getState().setCurrentState('default');
  editorStore.getState().setActiveSnapGuides([]);
});

describe('path editor snap feedback', () => {
  test('publishes and clears active snap guides during point drag', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    (editor as any).startPointDrag('moving', '0:0', 1, 1);
    (editor as any).dragPoint({ clientX: 8.28, clientY: 10.72 });

    expect(
      editorStore.getState().activeSnapGuides.some((guide) => guide.sourceLayerId === 'anchor'),
    ).toBeTrue();

    (editor as any).onPointerUp({ clientX: 8.28, clientY: 10.72 });

    expect(editorStore.getState().activeSnapGuides).toEqual([]);
    editor.destroy();
  });

  test('publishes and clears active snap guides during pen placement', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    const placement = (editor as any).beginPenPlacement('moving', 8.28, 10.72, 7);
    expect(placement).not.toBeNull();
    expect(
      editorStore.getState().activeSnapGuides.some((guide) => guide.sourceLayerId === 'anchor'),
    ).toBeTrue();

    (editor as any).onPointerUp({ clientX: 8.28, clientY: 10.72, pointerId: 7 });

    expect(editorStore.getState().activeSnapGuides).toEqual([]);
    editor.destroy();
  });

  test('stores mirrored pending handles for a dragged pen endpoint', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    const placement = (editor as any).beginPenPlacement('moving', 8, 8, 7);
    expect(placement).not.toBeNull();

    (editor as any).updatePenCurvePreview({ clientX: 10, clientY: 8 });
    (editor as any).onPointerUp({ clientX: 10, clientY: 8, pointerId: 7 });

    expect(editorStore.getState().pendingPenHandle).toMatchObject({
      layerId: 'moving',
      pointKey: '0:2',
      anchor: { x: 8, y: 8 },
      handleIn: { x: 6, y: 8 },
      handleOut: { x: 10, y: 8 },
    });
    editor.destroy();
  });

  test('materializes the pending outgoing handle into the next pen segment', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    (editor as any).beginPenPlacement('moving', 8, 8, 7);
    (editor as any).updatePenCurvePreview({ clientX: 10, clientY: 8 });
    (editor as any).onPointerUp({ clientX: 10, clientY: 8, pointerId: 7 });

    (editor as any).beginPenPlacement('moving', 12, 8, 8);

    const d =
      editorStore.getState().project!.icons.snap.variants.v24.states!.default.layers.moving.path!.d;
    const path = editorStore.getState().pendingPenHandle;

    expect(d).toBe('M1 1 L2 2 C10 8 6 8 8 8 C10 8 12 8 12 8');
    expect(path).toBeNull();
    editor.destroy();
  });

  test('publishes snap guides while dragging bezier handles and snaps handle endpoint', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    (editor as any).startControlDrag('moving', '0:0', 'out', 1, 1);
    (editor as any).dragControl({ clientX: 8.28, clientY: 10.72, shiftKey: false, altKey: false });

    expect(
      editorStore.getState().activeSnapGuides.some((guide) => guide.sourceLayerId === 'anchor'),
    ).toBeTrue();

    (editor as any).commitControlDrag({ clientX: 8.28, clientY: 10.72, shiftKey: false, altKey: false });

    const d =
      editorStore.getState().project!.icons.snap.variants.v24.states!.default.layers.moving.path!.d;
    expect(d).toContain('C8.3 10.7');
    editor.destroy();
  });
});

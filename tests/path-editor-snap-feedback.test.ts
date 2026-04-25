import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
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
  (globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  (globalThis as any).cancelAnimationFrame = () => {};
});

afterAll(() => {
  windowRef.addEventListener = originalWindowAddEventListener;
  windowRef.removeEventListener = originalWindowRemoveEventListener;
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

beforeEach(() => {
  editorStore.getState().loadProject(createProjectFixture());
  editorStore.getState().setCurrentIcon('snap');
  editorStore.getState().setCurrentVariant('v24');
  editorStore.getState().setCurrentType('default');
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

  test('click-only pen placement (below drag threshold) leaves a corner point with no handles', () => {
    // Regression for "bezier points always curved" bug: previously, any
    // sub-pixel mouse jitter between pointerdown and pointerup triggered
    // curve-handle creation. Now we enforce a 4px screen-space threshold
    // matching Figma/Illustrator/Inkscape behavior.
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    (editor as any).beginPenPlacement('moving', 8, 8, 7);
    // A 2px drag is well below the 4px threshold — must be ignored.
    (editor as any).updatePenCurvePreview({ clientX: 10, clientY: 8 });
    (editor as any).onPointerUp({ clientX: 10, clientY: 8, pointerId: 7 });

    // No pending pen handle should be published for a click-only commit.
    expect(editorStore.getState().pendingPenHandle).toBeNull();

    // The path must still be a pure line segment ending at (8,8).
    const d =
      editorStore.getState().project!.icons.snap.variants.v24.types!.default.layers.moving.path!.d;
    expect(d).toBe('M1 1 L2 2 L8 8');
    editor.destroy();
  });

  test('stores mirrored pending handles for a pen endpoint dragged past the threshold', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    const placement = (editor as any).beginPenPlacement('moving', 8, 8, 7);
    expect(placement).not.toBeNull();

    // 8px drag — clearly above the 4px threshold. Preview handles are
    // mirrored around the anchor (8,8): handleIn at (0,8), handleOut at (16,8).
    (editor as any).updatePenCurvePreview({ clientX: 16, clientY: 8 });
    (editor as any).onPointerUp({ clientX: 16, clientY: 8, pointerId: 7 });

    expect(editorStore.getState().pendingPenHandle).toMatchObject({
      layerId: 'moving',
      pointKey: '0:2',
      anchor: { x: 8, y: 8 },
      handleIn: { x: 0, y: 8 },
      handleOut: { x: 16, y: 8 },
    });
    editor.destroy();
  });

  test('materializes the pending outgoing handle into the next pen segment', () => {
    const editor = new PathEditor(createSvgStub() as unknown as SVGSVGElement);

    (editor as any).beginPenPlacement('moving', 8, 8, 7);
    // Above-threshold drag so the handles persist past commit.
    (editor as any).updatePenCurvePreview({ clientX: 16, clientY: 8 });
    (editor as any).onPointerUp({ clientX: 16, clientY: 8, pointerId: 7 });

    // Second pen click at (12, 8) — no drag this time, click-only add.
    (editor as any).beginPenPlacement('moving', 12, 8, 8);
    (editor as any).onPointerUp({ clientX: 12, clientY: 8, pointerId: 8 });

    const d =
      editorStore.getState().project!.icons.snap.variants.v24.types!.default.layers.moving.path!.d;
    const pending = editorStore.getState().pendingPenHandle;

    // Previous bug: `prev.handleOut = preview.handleOut` overwrote point 1's
    // (at 2,2) outgoing handle with the CURRENT point's forward drag direction,
    // producing a segment whose first control was past the new anchor. With
    // the fix:
    //   - segment 1→2 (line→cubic because pt2.handleIn is set): cp1 = prev.position (2,2),
    //     cp2 = pt2.handleIn (0,8), end (8,8)
    //   - segment 2→3 (cubic because prev.handleOut is set from materialized pending):
    //     cp1 = prev.handleOut (16,8), cp2 = pt3.position (12,8), end (12,8)
    expect(d).toBe('M1 1 L2 2 C2 2 0 8 8 8 C16 8 12 8 12 8');
    // After the second click-only commit, pending should be cleared.
    expect(pending).toBeNull();
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
      editorStore.getState().project!.icons.snap.variants.v24.types!.default.layers.moving.path!.d;
    expect(d).toContain('C8.3 10.7');
    editor.destroy();
  });
});

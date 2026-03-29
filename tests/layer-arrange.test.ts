import { describe, expect, test } from 'bun:test';
import { alignLayers, distributeLayers } from '../lib/editor-core/layer-arrange';
import { clearHistory, canRedo, canUndo, redo, undo } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import type { Project } from '../lib/schema/types';

const ARRANGE_PROJECT: Project = {
  version: '1.0',
  meta: {
    name: 'Arrange Test',
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
  },
  icons: {
    arrange: {
      id: 'arrange',
      name: 'Arrange',
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          layers: {
            a: {
              id: 'a',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 0, y: 0 },
            },
            b: {
              id: 'b',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 20, y: 10 },
            },
            c: {
              id: 'c',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 50, y: 20 },
            },
            invalid: {
              id: 'invalid',
              path: { d: 'M not-a-valid-path' },
              style: {},
              transform: { x: 999, y: 999 },
            },
          },
        },
      },
    },
  },
};

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(ARRANGE_PROJECT));
  clearHistory();
  return { iconId: 'arrange', stateId: 'default' };
}

function layerTransform(layerId: string) {
  return (
    editorStore.getState().project!.icons.arrange.variants.v24.layers[layerId]
      .transform ?? {}
  );
}

describe('layer arrange commands', () => {
  test('aligns layers against the combined selection bounds and skips invalid layers', () => {
    const { iconId, stateId } = bootstrap();

    alignLayers('left', ['a', 'invalid', 'b', 'c'], iconId, stateId);

    expect(layerTransform('a').x).toBe(0);
    expect(layerTransform('b').x).toBe(0);
    expect(layerTransform('c').x).toBe(0);
    expect(layerTransform('invalid').x).toBe(999);
  });

  test('distributes layers evenly between the outermost items with one undo snapshot', () => {
    const { iconId, stateId } = bootstrap();

    distributeLayers('horizontal', ['a', 'b', 'c'], iconId, stateId);

    expect(layerTransform('a').x).toBe(0);
    expect(layerTransform('b').x).toBe(25);
    expect(layerTransform('c').x).toBe(50);
    expect(canUndo()).toBeTrue();

    undo();
    expect(layerTransform('a').x).toBe(0);
    expect(layerTransform('b').x).toBe(20);
    expect(layerTransform('c').x).toBe(50);
    expect(canUndo()).toBeFalse();
    expect(canRedo()).toBeTrue();

    redo();
    expect(layerTransform('b').x).toBe(25);
  });
});

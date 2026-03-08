import { describe, expect, test } from 'bun:test';
import { alignLayers, distributeLayers } from '../lib/editor-core/layer-arrange';
import { editorStore } from '../lib/editor-store/store';
import type { Project } from '../lib/schema/types';

const PROJECT: Project = {
  version: '1.0',
  meta: {
    name: 'Align Distribute Math',
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
  },
  icons: {
    align: {
      id: 'align',
      name: 'Align',
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          defaultState: 'default',
          states: {
            default: {
              id: 'default',
              layers: {
                a: {
                  id: 'a',
                  path: { d: 'M0 0 H4 V4 H0 Z' },
                  style: {},
                  transform: { x: 0, y: 0 },
                },
                b: {
                  id: 'b',
                  path: { d: 'M0 0 H8 V2 H0 Z' },
                  style: {},
                  transform: { x: 10, y: 12 },
                },
                c: {
                  id: 'c',
                  path: { d: 'M0 0 H6 V6 H0 Z' },
                  style: {},
                  transform: { x: 30, y: 30 },
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

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(PROJECT));
  return { iconId: 'align', stateId: 'default' as const };
}

function getTransform(layerId: 'a' | 'b' | 'c') {
  return editorStore.getState().project!.icons.align.variants.v24.states.default.layers[layerId]
    .transform!;
}

describe('align and distribute math', () => {
  test('aligns layer centers against the combined selection bounds', () => {
    const { iconId, stateId } = bootstrap();

    alignLayers('center-h', ['a', 'b', 'c'], iconId, stateId);

    expect(getTransform('a').x).toBe(16);
    expect(getTransform('b').x).toBe(14);
    expect(getTransform('c').x).toBe(15);
  });

  test('distributes layers vertically using the outer bounds and intrinsic heights', () => {
    const { iconId, stateId } = bootstrap();

    distributeLayers('vertical', ['a', 'b', 'c'], iconId, stateId);

    expect(getTransform('a').y).toBe(0);
    expect(getTransform('b').y).toBe(16);
    expect(getTransform('c').y).toBe(30);
  });
});

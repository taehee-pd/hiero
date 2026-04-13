import { describe, expect, test, beforeEach } from 'bun:test';

import { editorStore } from '../lib/editor-store/store';
import type { Project } from '../lib/schema/types';

/**
 * PR #128 review P1 regression: `pasteLayers` and `duplicateSelectedLayers`
 * must rewrite ID-based layer references (currently `clipPathLayerId`) so
 * that a cloned mask + masked-layer set stays internally self-contained
 * and no longer points at the original mask.
 */

function buildClipMaskProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Clip mask clone test',
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-13T00:00:00Z',
    },
    icons: {
      icon: {
        id: 'icon',
        name: 'Icon',
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              mask: {
                id: 'mask',
                path: { d: 'M0 0H24V24H0Z' },
                style: {},
                transform: { x: 0, y: 0 },
                isClipMask: true,
              },
              masked: {
                id: 'masked',
                path: { d: 'M4 4H20V20H4Z' },
                style: { fill: { mode: 'fixed', value: '#000' } },
                transform: { x: 0, y: 0 },
                clipPathLayerId: 'mask',
              },
            },
            defaultState: 'default',
            states: {
              default: {
                id: 'default',
                layers: {
                  mask: {
                    id: 'mask',
                    path: { d: 'M0 0H24V24H0Z' },
                    style: {},
                    transform: { x: 0, y: 0 },
                    isClipMask: true,
                  },
                  masked: {
                    id: 'masked',
                    path: { d: 'M4 4H20V20H4Z' },
                    style: { fill: { mode: 'fixed', value: '#000' } },
                    transform: { x: 0, y: 0 },
                    clipPathLayerId: 'mask',
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

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(buildClipMaskProject()));
  state.setCurrentIcon('icon');
  state.setCurrentVariant('v24');
}

function layerById(id: string) {
  const state = editorStore.getState();
  const variant = state.project!.icons.icon.variants.v24;
  return variant.layers[id];
}

describe('duplicateSelectedLayers — P1 clip remap', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('rewrites clipPathLayerId to the cloned mask id', () => {
    const state = editorStore.getState();
    state.setSelection({ layerIds: ['mask', 'masked'], pointIds: [] });
    state.duplicateSelectedLayers();

    const next = editorStore.getState();
    const variant = next.project!.icons.icon.variants.v24;
    const keys = Object.keys(variant.layers);
    expect(keys).toContain('mask');
    expect(keys).toContain('masked');
    expect(keys).toContain('mask-copy');
    expect(keys).toContain('masked-copy');

    const cloneMasked = variant.layers['masked-copy']!;
    expect(cloneMasked.clipPathLayerId).toBe('mask-copy');

    // Sanity: the original reference is untouched.
    expect(variant.layers['masked']!.clipPathLayerId).toBe('mask');
  });

  test('leaves clipPathLayerId alone when only the masked layer is duplicated', () => {
    const state = editorStore.getState();
    state.setSelection({ layerIds: ['masked'], pointIds: [] });
    state.duplicateSelectedLayers();

    const next = editorStore.getState();
    const variant = next.project!.icons.icon.variants.v24;
    // The clone still points at the original mask because the mask itself
    // was NOT duplicated — the idMap only contains `masked` → `masked-copy`.
    expect(variant.layers['masked-copy']!.clipPathLayerId).toBe('mask');
  });
});

describe('pasteLayers — P1 clip remap', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('pasting a copied mask + masked pair rewrites clipPathLayerId', () => {
    const state = editorStore.getState();
    state.setSelection({ layerIds: ['mask', 'masked'], pointIds: [] });
    state.copySelectedLayers();
    state.pasteLayers();

    const next = editorStore.getState();
    const variant = next.project!.icons.icon.variants.v24;
    const cloneMasked = variant.layers['masked-copy']!;
    expect(cloneMasked.clipPathLayerId).toBe('mask-copy');
  });

  test('pasting only the masked layer keeps the original mask reference', () => {
    const state = editorStore.getState();
    state.setSelection({ layerIds: ['masked'], pointIds: [] });
    state.copySelectedLayers();
    state.pasteLayers();

    const next = editorStore.getState();
    const variant = next.project!.icons.icon.variants.v24;
    expect(variant.layers['masked-copy']!.clipPathLayerId).toBe('mask');
  });

  test('pasting twice produces two independent self-contained copies', () => {
    const state = editorStore.getState();
    state.setSelection({ layerIds: ['mask', 'masked'], pointIds: [] });
    state.copySelectedLayers();
    state.pasteLayers();
    state.pasteLayers();

    const next = editorStore.getState();
    const variant = next.project!.icons.icon.variants.v24;
    const firstMaskedCopy = variant.layers['masked-copy'];
    const secondMaskedCopy = variant.layers['masked-copy-2'];
    const firstMaskCopy = variant.layers['mask-copy'];
    const secondMaskCopy = variant.layers['mask-copy-2'];

    expect(firstMaskedCopy).toBeDefined();
    expect(secondMaskedCopy).toBeDefined();
    expect(firstMaskCopy).toBeDefined();
    expect(secondMaskCopy).toBeDefined();

    // Each paste gets its own self-contained mask reference — neither copy
    // references the original `mask`, and they do not cross-link.
    expect(firstMaskedCopy!.clipPathLayerId).toBe('mask-copy');
    expect(secondMaskedCopy!.clipPathLayerId).toBe('mask-copy-2');
  });
});

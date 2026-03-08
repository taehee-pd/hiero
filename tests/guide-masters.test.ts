import { describe, expect, test } from 'bun:test';
import { getDefaultGuideMaster } from '../lib/editor-core/guide-presets';
import { editorStore } from '../lib/editor-store/store';
import { selectCurrentGuideMaster } from '../lib/editor-store/selectors';

describe('guide masters', () => {
  test('scales preset geometry for arbitrary sizes', () => {
    const master = getDefaultGuideMaster(20);

    expect(master).toMatchObject({
      id: 'preset-20',
      targetSize: 20,
      viewBox: [0, 0, 20, 20],
    });
    expect(master.items).toEqual(
      expect.arrayContaining([
        { kind: 'hline', y: 10 },
        { kind: 'vline', x: 10 },
        { kind: 'rect', x: 0.833, y: 0.833, width: 18.333, height: 18.333 },
      ]),
    );
  });

  test('selectCurrentGuideMaster falls back by variant size when no id is set', () => {
    editorStore.getState().loadProject({
      version: '1.0',
      meta: {
        name: 'Guide Resolution',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
      },
      guideMasters: {
        small: {
          id: 'small',
          name: '16px Standard',
          targetSize: 16,
          viewBox: [0, 0, 16, 16],
          items: [{ kind: 'hline', y: 8 }],
        },
        large: {
          id: 'large',
          name: '32px Standard',
          targetSize: 32,
          viewBox: [0, 0, 32, 32],
          items: [{ kind: 'vline', x: 16 }],
        },
      },
      icons: {
        icon: {
          id: 'icon',
          name: 'Icon',
          variants: {
            v16: {
              id: 'v16',
              size: 16,
              viewBox: [0, 0, 16, 16],
              defaultState: 'default',
              states: { default: { id: 'default', layers: {} } },
            },
            v32: {
              id: 'v32',
              size: 32,
              viewBox: [0, 0, 32, 32],
              defaultState: 'default',
              states: { default: { id: 'default', layers: {} } },
            },
          },
          transitions: {},
        },
      },
    } as never);

    editorStore.getState().setCurrentVariant('v32');
    expect(selectCurrentGuideMaster(editorStore.getState())).toEqual(
      expect.objectContaining({ id: 'large', targetSize: 32 }),
    );
  });

  test('migrates legacy guide sets into per-size guide masters and resolves them', () => {
    editorStore.getState().loadProject({
      version: '1.0',
      meta: {
        name: 'Legacy Guides',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
      },
      icons: {
        legacy: {
          id: 'legacy',
          name: 'Legacy',
          variants: {
            v24: {
              id: 'v24',
              size: 24,
              viewBox: [0, 0, 24, 24],
              defaultState: 'default',
              guideSetId: 'standard',
            },
            v32: {
              id: 'v32',
              size: 32,
              viewBox: [0, 0, 32, 32],
              defaultState: 'default',
              guideSetId: 'standard',
            },
          },
          guides: {
            standard: {
              id: 'standard',
              items: [{ kind: 'hline', y: 12 }],
            },
          },
          states: {
            default: {
              id: 'default',
              layers: {},
            },
          },
          transitions: {},
        },
      },
    } as never);

    editorStore.getState().setCurrentVariant('v32');

    expect(editorStore.getState().project!.guideMasters).toEqual(
      expect.objectContaining({
        'standard-24': expect.objectContaining({ targetSize: 24 }),
        'standard-32': expect.objectContaining({ targetSize: 32 }),
      }),
    );
    expect(editorStore.getState().project!.icons.legacy.variants.v32.guideMasterId).toBe(
      'standard-32',
    );
    expect(selectCurrentGuideMaster(editorStore.getState())).toEqual(
      expect.objectContaining({ id: 'standard-32', targetSize: 32 }),
    );
  });
});

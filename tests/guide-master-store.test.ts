import { describe, expect, test } from 'bun:test';
import { getDefaultGuideMaster } from '../lib/editor-core/guide-presets';
import { editorStore } from '../lib/editor-store/store';

describe('guide master store actions', () => {
  test('can add, update, and remove guide masters', () => {
    const state = editorStore.getState();
    state.newProject();

    const master = {
      ...getDefaultGuideMaster(20),
      id: 'custom-20',
      name: '20px Custom',
    };

    state.addGuideMaster(master);
    expect(editorStore.getState().project?.guideMasters?.['custom-20']).toMatchObject({
      id: 'custom-20',
      name: '20px Custom',
      targetSize: 20,
    });

    state.updateGuideMaster('custom-20', { name: '20px Refined' });
    expect(editorStore.getState().project?.guideMasters?.['custom-20']?.name).toBe('20px Refined');

    state.removeGuideMaster('custom-20');
    expect(editorStore.getState().project?.guideMasters?.['custom-20']).toBeUndefined();
  });

  test('can add, update, and remove guide items', () => {
    const state = editorStore.getState();
    state.newProject();

    state.addGuideItem('preset-24', { kind: 'hline', y: 10 });
    expect(editorStore.getState().project?.guideMasters?.['preset-24']?.items.at(-1)).toEqual({
      kind: 'hline',
      y: 10,
    });

    const insertedIndex =
      (editorStore.getState().project?.guideMasters?.['preset-24']?.items.length ?? 1) - 1;
    state.updateGuideItem('preset-24', insertedIndex, { kind: 'vline', x: 9 });
    expect(editorStore.getState().project?.guideMasters?.['preset-24']?.items[insertedIndex]).toEqual({
      kind: 'vline',
      x: 9,
    });

    state.removeGuideItem('preset-24', insertedIndex);
    expect(editorStore.getState().project?.guideMasters?.['preset-24']?.items.some((item) => item.kind === 'vline' && item.x === 9)).toBeFalse();
  });

  test('can toggle guide visibility and style', () => {
    const state = editorStore.getState();
    state.newProject();

    expect(editorStore.getState().guidesVisible).toBeTrue();
    expect(editorStore.getState().guideStyle).toBe('subtle');

    state.toggleGuidesVisible();
    expect(editorStore.getState().guidesVisible).toBeFalse();

    state.setGuideStyle('strong');
    expect(editorStore.getState().guideStyle).toBe('strong');
  });

  test('can add, update, select, and remove icon custom guides', () => {
    const state = editorStore.getState();
    state.loadProject({
      version: '1.0',
      meta: {
        name: 'Icon Guides',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
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
              defaultType: 'default',
            },
          },
          types: {
            default: {
              id: 'default',
              layers: {},
            },
          },
          transitions: {},
        },
      },
    } as never);

    state.addIconGuide('icon', { kind: 'hline', y: 12 });
    expect(editorStore.getState().project?.icons.icon.customGuides).toEqual([{ kind: 'hline', y: 12 }]);
    expect(editorStore.getState().selectedIconGuideIndex).toBe(0);

    state.updateIconGuide('icon', 0, { kind: 'vline', x: 8 });
    expect(editorStore.getState().project?.icons.icon.customGuides).toEqual([{ kind: 'vline', x: 8 }]);

    state.setSelectedIconGuideIndex(0);
    expect(editorStore.getState().selectedIconGuideIndex).toBe(0);

    state.removeIconGuide('icon', 0);
    expect(editorStore.getState().project?.icons.icon.customGuides).toBeUndefined();
    expect(editorStore.getState().selectedIconGuideIndex).toBeNull();
  });
});

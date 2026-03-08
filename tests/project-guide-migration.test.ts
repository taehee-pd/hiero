import { describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';

describe('project guide migration', () => {
  test('loadProject hoists legacy icon guides into project guide masters by size', () => {
    const legacyProject = {
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
    };

    editorStore.getState().loadProject(legacyProject as never);
    const project = editorStore.getState().project!;

    expect(project.guideMasters).toBeDefined();
    expect(project.guideMasters!['standard-24']).toMatchObject({
      id: 'standard-24',
      targetSize: 24,
      viewBox: [0, 0, 24, 24],
      items: [{ kind: 'hline', y: 12 }],
    });
    expect(project.guideMasters!['standard-32']).toMatchObject({
      id: 'standard-32',
      targetSize: 32,
      viewBox: [0, 0, 32, 32],
      items: [{ kind: 'hline', y: 12 }],
    });
    expect('guides' in project.icons.legacy).toBeFalse();
    expect('guideSetId' in project.icons.legacy.variants.v24).toBeFalse();
  });

  test('loadProject creates an empty fallback guide master for unreferenced legacy guides', () => {
    const legacyProject = {
      version: '1.0',
      meta: {
        name: 'Legacy Fallback',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
      },
      icons: {
        orphaned: {
          id: 'orphaned',
          name: 'Orphaned',
          variants: {
            v24: {
              id: 'v24',
              size: 24,
              viewBox: [0, 0, 24, 24],
              defaultState: 'default',
            },
          },
          guides: {
            fallback: {
              id: 'fallback',
              items: [{ kind: 'vline', x: 8 }],
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
    };

    editorStore.getState().loadProject(legacyProject as never);
    const fallbackGuide = editorStore.getState().project!.guideMasters!.fallback;

    expect(fallbackGuide).toMatchObject({
      id: 'fallback',
      targetSize: 24,
      viewBox: [0, 0, 24, 24],
      items: [],
    });
  });
});

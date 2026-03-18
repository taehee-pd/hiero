import { describe, expect, test } from 'bun:test';

import type { IconSet, Workspace } from '../lib/schema/types';
import {
  createWorkspaceFromProject,
  getActiveIconSet,
  getFirstIconSetId,
  replaceWorkspaceIconSet,
} from '../lib/schema/workspace';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeIconSet = (name: string): IconSet => ({
  version: '1.0',
  meta: { name, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  icons: {},
});

const makeWorkspace = (iconSets: Record<string, IconSet>, activeId?: string): Workspace => ({
  version: '2.0',
  meta: { name: 'Test Workspace', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  iconSets,
  activeIconSetId: activeId,
});

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workspace persistence round-trip', () => {
  test('basic round-trip preserves all icon sets and metadata', () => {
    const setA = makeIconSet('Filled');
    const setB = makeIconSet('Outlined');

    const workspace = makeWorkspace({ filled: setA, outlined: setB }, 'filled');
    const restored = roundTrip(workspace);

    expect(restored.version).toBe('2.0');
    expect(restored.meta.name).toBe('Test Workspace');
    expect(restored.meta.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(restored.meta.updatedAt).toBe('2026-01-01T00:00:00Z');
    expect(Object.keys(restored.iconSets)).toHaveLength(2);
    expect(restored.iconSets['filled']?.meta.name).toBe('Filled');
    expect(restored.iconSets['outlined']?.meta.name).toBe('Outlined');
    expect(restored.activeIconSetId).toBe('filled');
  });

  test('guideMasters survive round-trip', () => {
    const iconSet: IconSet = {
      ...makeIconSet('WithGuides'),
      guideMasters: {
        'gm-1': {
          id: 'gm-1',
          name: 'Grid 24',
          targetSize: 24,
          viewBox: [0, 0, 24, 24],
          items: [
            { kind: 'hline', y: 12 },
            { kind: 'vline', x: 12 },
          ],
        },
      },
    };

    const workspace = makeWorkspace({ main: iconSet });
    const restored = roundTrip(workspace);

    const restoredSet = restored.iconSets['main']!;
    expect(restoredSet.guideMasters).toBeDefined();
    expect(restoredSet.guideMasters!['gm-1']!.name).toBe('Grid 24');
    expect(restoredSet.guideMasters!['gm-1']!.items).toHaveLength(2);
    expect(restoredSet.guideMasters!['gm-1']!.targetSize).toBe(24);
    expect(restoredSet.guideMasters!['gm-1']!.viewBox).toEqual([0, 0, 24, 24]);
  });

  test('legacy Project auto-wraps via createWorkspaceFromProject', () => {
    const project = makeIconSet('Legacy Icons');
    const workspace = createWorkspaceFromProject(project, 'legacy-set');

    expect(workspace.version).toBe('2.0');
    expect(workspace.meta.name).toBe('Legacy Icons');
    expect(workspace.activeIconSetId).toBe('legacy-set');
    expect(Object.keys(workspace.iconSets)).toHaveLength(1);
    expect(workspace.iconSets['legacy-set']).toBe(project);

    // Verify getActiveIconSet resolves the wrapped project
    const active = getActiveIconSet(workspace);
    expect(active).toBe(project);
  });

  test('activeIconSetId persists through round-trip', () => {
    const workspace = makeWorkspace(
      { alpha: makeIconSet('Alpha'), beta: makeIconSet('Beta') },
      'beta',
    );

    const restored = roundTrip(workspace);

    expect(restored.activeIconSetId).toBe('beta');
    expect(getFirstIconSetId(restored)).toBe('beta');

    const active = getActiveIconSet(restored);
    expect(active?.meta.name).toBe('Beta');
  });

  test('replaceWorkspaceIconSet is immutable', () => {
    const original = makeWorkspace(
      { main: makeIconSet('Original') },
      'main',
    );

    const updated = makeIconSet('Updated');
    const result = replaceWorkspaceIconSet(original, 'main', updated);

    // Result should be a new workspace
    expect(result).not.toBe(original);
    expect(result).not.toBeNull();

    // Original workspace is unchanged
    expect(original.iconSets['main']!.meta.name).toBe('Original');

    // New workspace has the updated icon set
    expect(result!.iconSets['main']!.meta.name).toBe('Updated');

    // Other workspace properties are preserved
    expect(result!.version).toBe('2.0');
    expect(result!.meta.name).toBe('Test Workspace');
    expect(result!.activeIconSetId).toBe('main');
  });
});

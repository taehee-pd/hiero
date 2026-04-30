/**
 * Workspace-level diff for the Version History compare view.
 *
 * Pinned behaviors:
 *   - identical workspaces → isIdentical=true, all lists empty
 *   - new icon in `after` → added
 *   - icon present in `before` only → removed
 *   - icon contents differ (any field) → modified
 *   - cross-set icon ids don't collide (set-namespacing in flatten)
 *   - lists are sorted alphabetically for deterministic UI rendering
 */

import { describe, it, expect } from 'bun:test';
import { diffWorkspaces } from '@/lib/sync-ui/version-compare';
import type { Workspace } from '@/lib/schema/types';

function makeWorkspace(
  iconSets: Record<string, Record<string, { id: string; name: string }>>,
): Workspace {
  return {
    version: '2.0',
    meta: {
      name: 'test',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    iconSets: Object.fromEntries(
      Object.entries(iconSets).map(([setId, icons]) => [
        setId,
        {
          version: '1.0',
          meta: {
            name: setId,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          icons: Object.fromEntries(
            Object.entries(icons).map(([iconId, icon]) => [iconId, icon]),
          ),
        } as Workspace['iconSets'][string],
      ]),
    ),
  };
}

describe('diffWorkspaces', () => {
  it('identical workspaces produce isIdentical=true', () => {
    const ws = makeWorkspace({ default: { 'icon-a': { id: 'icon-a', name: 'A' } } });
    const diff = diffWorkspaces(ws, ws);
    expect(diff.isIdentical).toBe(true);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it('detects added icons', () => {
    const before = makeWorkspace({ default: { 'icon-a': { id: 'icon-a', name: 'A' } } });
    const after = makeWorkspace({
      default: {
        'icon-a': { id: 'icon-a', name: 'A' },
        'icon-b': { id: 'icon-b', name: 'B' },
      },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.added).toEqual(['default/icon-b']);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
    expect(diff.isIdentical).toBe(false);
  });

  it('detects removed icons', () => {
    const before = makeWorkspace({
      default: {
        'icon-a': { id: 'icon-a', name: 'A' },
        'icon-b': { id: 'icon-b', name: 'B' },
      },
    });
    const after = makeWorkspace({ default: { 'icon-a': { id: 'icon-a', name: 'A' } } });
    const diff = diffWorkspaces(before, after);
    expect(diff.removed).toEqual(['default/icon-b']);
    expect(diff.added).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it('detects modified icons by content equality', () => {
    const before = makeWorkspace({
      default: { 'icon-a': { id: 'icon-a', name: 'A' } },
    });
    const after = makeWorkspace({
      default: { 'icon-a': { id: 'icon-a', name: 'A renamed' } },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.modified).toEqual(['default/icon-a']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('namespaces by setId so same icon id across sets does not collide', () => {
    // 'icon-a' exists in both 'set1' and 'set2'. Removing it from set1
    // should report a removal scoped to that set; the entry in set2 is
    // unaffected. Per the type, output keys are `${setId}/${iconId}`
    // so the consumer can tell the two apart.
    const before = makeWorkspace({
      set1: { 'icon-a': { id: 'icon-a', name: 'A1' } },
      set2: { 'icon-a': { id: 'icon-a', name: 'A2' } },
    });
    const after = makeWorkspace({
      set2: { 'icon-a': { id: 'icon-a', name: 'A2' } },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.removed).toEqual(['set1/icon-a']);
    expect(diff.added).toEqual([]);
    // set2/icon-a still exists in `after`, so it is not in any list.
    expect(diff.modified).toEqual([]);
  });

  it('reports per-set keys when the same icon id moves between sets', () => {
    // Removing from set1 and adding identical content to set2 must
    // produce two distinct entries — not collapse into "no change".
    const before = makeWorkspace({
      set1: { 'icon-a': { id: 'icon-a', name: 'A' } },
    });
    const after = makeWorkspace({
      set2: { 'icon-a': { id: 'icon-a', name: 'A' } },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.removed).toEqual(['set1/icon-a']);
    expect(diff.added).toEqual(['set2/icon-a']);
  });

  it('sorts each list alphabetically', () => {
    const before = makeWorkspace({ default: {} });
    const after = makeWorkspace({
      default: {
        'icon-c': { id: 'icon-c', name: 'C' },
        'icon-a': { id: 'icon-a', name: 'A' },
        'icon-b': { id: 'icon-b', name: 'B' },
      },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.added).toEqual([
      'default/icon-a',
      'default/icon-b',
      'default/icon-c',
    ]);
  });

  it('totalAfter reflects the after workspace icon count', () => {
    const before = makeWorkspace({});
    const after = makeWorkspace({
      default: {
        'icon-a': { id: 'icon-a', name: 'A' },
        'icon-b': { id: 'icon-b', name: 'B' },
      },
    });
    const diff = diffWorkspaces(before, after);
    expect(diff.totalAfter).toBe(2);
  });
});

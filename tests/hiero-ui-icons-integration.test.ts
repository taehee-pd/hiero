import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { editorStore } from '../lib/editor-store/store';
import {
  HIERO_UI_ICONS_SOURCE_FILENAME,
  isViewingHieroUiIconSet,
  loadHieroUiIconSet,
  openHieroUiIconSetInEditor,
  serializeHieroUiIconSet,
} from '../lib/integrations/hiero-ui-icons-source';
import { setCurrentProjectPath } from '../lib/platform/bridge';

// editorStore is a process-global; mutations leak across test files in
// the same bun invocation. Capture the initial state and restore it
// after each test so no other test sees a partial workspace from this
// file's "no workspace loaded" branch.
const STORE_INITIAL_STATE = editorStore.getState();

beforeEach(() => {
  editorStore.setState(STORE_INITIAL_STATE);
  setCurrentProjectPath(undefined);
});

afterEach(() => {
  editorStore.setState(STORE_INITIAL_STATE);
  setCurrentProjectPath(undefined);
});

// These run regardless of build channel because the test environment
// always exercises the code paths the helper exposes; the build-time
// gating is what keeps the helper out of the *public bundle*, not what
// makes it functionally different. Bundle isolation is verified
// separately in scripts/check-public-bundle.ts (commit 3).

describe('loadHieroUiIconSet', () => {
  test('returns a valid Project with at least one icon', () => {
    const project = loadHieroUiIconSet();
    expect(project.icons).toBeDefined();
    expect(Object.keys(project.icons).length).toBeGreaterThan(0);
  });

  test('returns a deep copy each call (mutating one does not affect the next)', () => {
    const a = loadHieroUiIconSet();
    const b = loadHieroUiIconSet();
    expect(a).not.toBe(b);
    // Mutate `a` and confirm `b` is unaffected.
    delete (a.icons as Record<string, unknown>)['plus'];
    const c = loadHieroUiIconSet();
    expect(Object.keys(c.icons)).toContain('plus');
  });
});

describe('openHieroUiIconSetInEditor', () => {
  test('loads the icon set into the editor and marks the source path', () => {
    setCurrentProjectPath(undefined);
    openHieroUiIconSetInEditor();

    const workspace = editorStore.getState().workspace;
    expect(workspace).toBeTruthy();
    if (!workspace) return;
    const setId = workspace.activeIconSetId;
    expect(setId).toBeTruthy();
    if (!setId) return;
    expect(Object.keys(workspace.iconSets[setId]?.icons ?? {}).length).toBeGreaterThan(0);

    expect(isViewingHieroUiIconSet()).toBe(true);
  });
});

describe('serializeHieroUiIconSet', () => {
  test('returns Project shape, not Workspace shape', () => {
    openHieroUiIconSetInEditor();
    const result = serializeHieroUiIconSet();
    expect(result).toBeTruthy();
    if (!result) return;

    const parsed = JSON.parse(result.data) as Record<string, unknown>;
    // Project shape: top-level `icons`, no `iconSets` or `activeIconSetId`.
    expect(parsed.icons).toBeDefined();
    expect(parsed.iconSets).toBeUndefined();
    expect(parsed.activeIconSetId).toBeUndefined();
  });

  test('returns null when no workspace is loaded', () => {
    // Reset to a blank workspace by loading an empty workspace.
    editorStore.setState({ workspace: null, project: null, activeIconSetId: null });
    const result = serializeHieroUiIconSet();
    expect(result).toBeNull();
  });

  test('stamps meta.updatedAt with an ISO timestamp', () => {
    openHieroUiIconSetInEditor();
    const result = serializeHieroUiIconSet();
    if (!result) throw new Error('expected payload');

    const parsed = JSON.parse(result.data) as { meta?: { updatedAt?: string } };
    expect(parsed.meta?.updatedAt).toBeDefined();
    // ISO 8601 with milliseconds — what Date.toISOString() produces.
    expect(parsed.meta?.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(result.updatedAt).toBe(parsed.meta?.updatedAt ?? '');
  });
});

describe('HIERO_UI_ICONS_SOURCE_FILENAME', () => {
  test('matches the on-disk filename so Save downloads default to it', () => {
    expect(HIERO_UI_ICONS_SOURCE_FILENAME).toBe('icons.json');
  });
});

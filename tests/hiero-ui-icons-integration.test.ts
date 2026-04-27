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
  test('returns Project shape (not Workspace) when the canonical set is open', () => {
    openHieroUiIconSetInEditor();
    const result = serializeHieroUiIconSet();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = JSON.parse(result.data) as Record<string, unknown>;
    // Project shape: top-level `icons`, no `iconSets` or `activeIconSetId`.
    expect(parsed.icons).toBeDefined();
    expect(parsed.iconSets).toBeUndefined();
    expect(parsed.activeIconSetId).toBeUndefined();
  });

  test('refuses with no-workspace when no workspace is loaded', () => {
    editorStore.setState({ workspace: null, project: null, activeIconSetId: null });
    const result = serializeHieroUiIconSet();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-workspace');
    }
  });

  test('refuses with not-canonical-source when a different project is open', () => {
    // Load the canonical set, then mark a different on-disk path so the
    // currentProjectPath check fails. This simulates a maintainer who
    // opened some random JSON via "Open Project" then clicked
    // "Save Hiero UI Icon Set" — without the guard, that would silently
    // overwrite icons.json with whatever was loaded.
    openHieroUiIconSetInEditor();
    setCurrentProjectPath('something-else.hiero.json');
    const result = serializeHieroUiIconSet();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-canonical-source');
    }
  });

  test('preserves meta.updatedAt verbatim on a no-op save (byte stability)', () => {
    openHieroUiIconSetInEditor();
    // The editor isn't dirty after a fresh load — `markSaved` was called
    // by loadProject's resetHistory branch. Save now should produce the
    // ORIGINAL timestamp from the bundled icons.json, not "now".
    const before = serializeHieroUiIconSet();
    if (!before.ok) throw new Error('expected ok before');
    const original = before.updatedAt;

    // Force-clear isDirty in case loadProject didn't auto-mark clean.
    editorStore.setState({ isDirty: false });

    const result = serializeHieroUiIconSet();
    if (!result.ok) throw new Error('expected ok');

    const parsed = JSON.parse(result.data) as { meta?: { updatedAt?: string } };
    expect(parsed.meta?.updatedAt).toBe(original);
    expect(result.updatedAt).toBe(original);
  });

  test('stamps a fresh ISO timestamp when the editor is dirty', () => {
    openHieroUiIconSetInEditor();
    editorStore.setState({ isDirty: true });

    const result = serializeHieroUiIconSet();
    if (!result.ok) throw new Error('expected ok');

    const parsed = JSON.parse(result.data) as { meta?: { updatedAt?: string } };
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

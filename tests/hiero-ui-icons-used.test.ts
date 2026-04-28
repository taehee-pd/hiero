import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { editorStore } from '../lib/editor-store/store';
import {
  HIERO_UI_ICONS_SOURCE_FILENAME,
  HIERO_UI_ICONS_USED_VIEW_PATH,
  isViewingHieroUiIconSet,
  isViewingUsedHieroUiIcons,
  loadHieroUiIconSet,
  loadUsedHieroUiIconSet,
  openUsedHieroUiIconsInEditor,
  serializeHieroUiIconSet,
  serializeMergedHieroUiIconSet,
} from '../lib/integrations/hiero-ui-icons-source';
import { setCurrentProjectPath } from '../lib/platform/bridge';
import { USED_ICON_NAMES } from '../lib/integrations/used-icons.generated';

// Same store-restoration discipline as hiero-ui-icons-integration.test.ts:
// editorStore is a process-global; mutations leak across tests within the
// same bun invocation.
const STORE_INITIAL_STATE = editorStore.getState();

beforeEach(() => {
  editorStore.setState(STORE_INITIAL_STATE);
  setCurrentProjectPath(undefined);
});

afterEach(() => {
  editorStore.setState(STORE_INITIAL_STATE);
  setCurrentProjectPath(undefined);
});

describe('USED_ICON_NAMES', () => {
  test('is non-empty (the inventory script must have populated it)', () => {
    expect(USED_ICON_NAMES.length).toBeGreaterThan(0);
  });

  test('every name resolves in the canonical icons.json', () => {
    const canonical = loadHieroUiIconSet();
    const missing = USED_ICON_NAMES.filter((n) => !canonical.icons[n]);
    expect(missing).toEqual([]);
  });

  test('is sorted to keep the generated file diff-stable', () => {
    const sorted = [...USED_ICON_NAMES].sort();
    expect(USED_ICON_NAMES).toEqual(sorted);
  });
});

describe('loadUsedHieroUiIconSet', () => {
  test('returns a Project containing exactly the used icons', () => {
    const { project, missing } = loadUsedHieroUiIconSet();
    expect(missing).toEqual([]);
    expect(Object.keys(project.icons).sort()).toEqual([...USED_ICON_NAMES].sort());
  });

  test('strictly subsets the canonical set (used <= canonical)', () => {
    const canonical = loadHieroUiIconSet();
    const { project } = loadUsedHieroUiIconSet();
    expect(Object.keys(project.icons).length).toBeLessThanOrEqual(
      Object.keys(canonical.icons).length,
    );
    for (const id of Object.keys(project.icons)) {
      // Same icon object content as canonical (same id, same variants).
      expect(project.icons[id]?.id).toBe(canonical.icons[id]?.id);
    }
  });

  test('uses a distinct project meta.name so the editor breadcrumb makes the filtered view obvious', () => {
    const canonical = loadHieroUiIconSet();
    const { project } = loadUsedHieroUiIconSet();
    expect(project.meta.name).not.toBe(canonical.meta.name);
    expect(project.meta.name).toContain('used');
  });
});

describe('openUsedHieroUiIconsInEditor', () => {
  test('marks the editor with the used-view sentinel, not the canonical filename', () => {
    openUsedHieroUiIconsInEditor();
    expect(isViewingUsedHieroUiIcons()).toBe(true);
    // Critically: the canonical-source guard must read false, otherwise
    // a stray "Save Hiero UI Icon Set" click would write the filtered
    // subset back to icons.json and silently delete every unused icon.
    expect(isViewingHieroUiIconSet()).toBe(false);
  });

  test('loads only the used icons into the active workspace', () => {
    openUsedHieroUiIconsInEditor();
    const workspace = editorStore.getState().workspace;
    expect(workspace).toBeTruthy();
    if (!workspace) return;
    const setId = workspace.activeIconSetId;
    if (!setId) throw new Error('expected an active icon set');
    const icons = workspace.iconSets[setId]?.icons ?? {};
    expect(Object.keys(icons).sort()).toEqual([...USED_ICON_NAMES].sort());
  });
});

describe('serializeHieroUiIconSet refuses the used view', () => {
  test('returns not-canonical-source when the editor is showing the filtered subset', () => {
    openUsedHieroUiIconsInEditor();
    const result = serializeHieroUiIconSet();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-canonical-source');
    }
  });
});

describe('serializeMergedHieroUiIconSet', () => {
  test('refuses with no-workspace when nothing is loaded', () => {
    editorStore.setState({ workspace: null, project: null, activeIconSetId: null });
    setCurrentProjectPath(HIERO_UI_ICONS_USED_VIEW_PATH);
    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no-workspace');
    }
  });

  test('refuses with not-used-view when the canonical (full) set is open', () => {
    // Load the full canonical set via the existing flow (sets currentProjectPath
    // to icons.json). Saving via the merge path should refuse — merging the
    // full set onto itself would be a no-op but the wrong save action.
    editorStore.setState(STORE_INITIAL_STATE);
    const canonical = loadHieroUiIconSet();
    editorStore.getState().loadProject(canonical);
    setCurrentProjectPath(HIERO_UI_ICONS_SOURCE_FILENAME);
    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-used-view');
    }
  });

  test('round-trips: open used view → save merged → result has every canonical icon', () => {
    openUsedHieroUiIconsInEditor();
    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.data) as { icons: Record<string, unknown> };
    const canonical = loadHieroUiIconSet();
    expect(Object.keys(parsed.icons).sort()).toEqual(
      Object.keys(canonical.icons).sort(),
    );
  });

  test('preserves canonical-but-unused icons verbatim across an edit-and-merge cycle', () => {
    const canonical = loadHieroUiIconSet();
    const unusedNames = Object.keys(canonical.icons).filter(
      (id) => !USED_ICON_NAMES.includes(id),
    );
    // The canonical set ships strictly more icons than the app uses;
    // otherwise the whole "merge" semantic is moot and the test below
    // wouldn't be testing anything.
    expect(unusedNames.length).toBeGreaterThan(0);

    openUsedHieroUiIconsInEditor();
    // Mutate the *first used* icon so the merge is non-trivial. The
    // editorStore re-derives `workspace.iconSets[activeIconSetId]` from
    // `project` on every setState (see lib/editor-store/store.ts ~L561),
    // so the mutation has to go through `project`, not directly via
    // `workspace`.
    const firstUsed = USED_ICON_NAMES[0];
    if (!firstUsed) throw new Error('expected at least one used icon');
    const state = editorStore.getState();
    const project = state.project;
    if (!project) throw new Error('expected project to be loaded');
    const icon = project.icons[firstUsed];
    if (!icon) throw new Error(`expected used icon ${firstUsed} in project`);
    const mutated = { ...icon, name: `${icon.name}-edited` };
    editorStore.setState({
      project: {
        ...project,
        icons: { ...project.icons, [firstUsed]: mutated },
      },
      isDirty: true,
    });

    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.data) as {
      icons: Record<string, { name: string }>;
    };

    // Edited used icon survives.
    expect(parsed.icons[firstUsed]?.name).toBe(`${icon.name}-edited`);

    // Every previously-unused canonical icon is byte-identical to the
    // bundled source — the whole point of the merge.
    for (const unused of unusedNames) {
      expect(parsed.icons[unused] as unknown).toEqual(
        canonical.icons[unused] as unknown,
      );
    }
  });

  test('preserves meta.updatedAt verbatim on a no-op merge (byte stability)', () => {
    openUsedHieroUiIconsInEditor();
    const canonical = loadHieroUiIconSet();
    editorStore.setState({ isDirty: false });
    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedAt).toBe(canonical.meta.updatedAt);
  });

  test('stamps a fresh ISO timestamp when the editor is dirty', () => {
    openUsedHieroUiIconsInEditor();
    editorStore.setState({ isDirty: true });
    const result = serializeMergedHieroUiIconSet();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

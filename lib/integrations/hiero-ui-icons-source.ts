/**
 * Hiero UI icon set integration — INTERNAL BUILD ONLY.
 *
 * This module is the dogfooding entry point: it lets a maintainer open
 * `packages/hiero-ui-icons/source/icons.json` in the editor, edit, and
 * save back as the same Project shape the file expects.
 *
 * It is imported via `await import(...)` from the toolbar action
 * handlers, which themselves only render when `IS_INTERNAL_BUILD` is
 * true. The combination keeps the helper module — and the bundled
 * icons.json data — out of the public artifact entirely.
 *
 * Do NOT statically import this module from anywhere that ships in the
 * public bundle. The bundle-isolation CI check (commit 3) fails if a
 * fingerprint of icons.json content appears in a public build's chunks.
 *
 * The companion safety property is in tests/hiero-ui-icons-roundtrip.test.ts:
 * loading icons.json through the editor and saving back must be byte-stable
 * for `pnpm icons:verify` to pass on every CI run.
 */

// 'use client' because this module is dynamic-imported from client
// components (Toolbar, Navbar) and calls editorStore + setCurrentProjectPath,
// which are client-only. If a future Server Component needs to consume
// loadHieroUiIconSet() for SSR (e.g., an internal-only marketing landing),
// extract loadHieroUiIconSet into a server-safe sibling module — the rest
// (openHieroUiIconSetInEditor, serializeHieroUiIconSet, isViewingHieroUiIconSet)
// stays here.
'use client';

import iconsJsonRaw from '@hiero/ui-icons/source/icons.json';

import type { Project } from '@/lib/schema/types';
import { isProject } from '@/lib/schema/guards';
import { editorStore } from '@/lib/editor-store/store';
import {
  getCurrentProjectPath,
  setCurrentProjectPath,
} from '@/lib/platform/bridge';

/** The on-disk filename of the canonical icon source. */
export const HIERO_UI_ICONS_SOURCE_FILENAME = 'icons.json';

/**
 * Return the canonical Hiero UI icon set as a Project, validated.
 *
 * Throws if the bundled icons.json doesn't pass the runtime guard —
 * which would mean the build inlined a malformed source file and the
 * editor would have failed in worse ways downstream. Better to fail
 * loud at the entry point.
 */
export function loadHieroUiIconSet(): Project {
  // Defensive copy. The toolbar passes this into editorStore.loadProject,
  // which mutates the workspace tree; sharing a reference with the
  // build-time-frozen JSON would surface as confusing read-only errors
  // deep inside store internals.
  const candidate = structuredClone(iconsJsonRaw) as unknown;
  if (!isProject(candidate)) {
    throw new Error(
      'packages/hiero-ui-icons/source/icons.json failed isProject(); the bundled source file is malformed.',
    );
  }
  return candidate;
}

/**
 * Open the canonical icon set in the editor and mark its origin so the
 * Save action knows to default the filename to `icons.json` and to
 * serialize as Project (not Workspace) — the shape icons.json expects.
 */
export function openHieroUiIconSetInEditor(): void {
  const project = loadHieroUiIconSet();
  editorStore.getState().loadProject(project);
  setCurrentProjectPath(HIERO_UI_ICONS_SOURCE_FILENAME);
}

export type SerializeHieroUiIconSetResult =
  | { ok: true; data: string; updatedAt: string }
  | { ok: false; reason: 'no-workspace' | 'not-canonical-source' };

/**
 * Serialize the active icon set out of the editor as a Project — the
 * shape `packages/hiero-ui-icons/source/icons.json` expects. The
 * default Save flow emits a Workspace; saving Workspace JSON to
 * icons.json would silently corrupt the file and break
 * `pnpm icons:verify` on every CI run thereafter.
 *
 * Two guards:
 *
 *   1. **Canonical-source-only.** Refuses to serialize unless the user
 *      opened the canonical icon set first via
 *      `openHieroUiIconSetInEditor()`. Without this guard, a maintainer
 *      could load any random project and click "Save Hiero UI Icon Set"
 *      to overwrite icons.json with unrelated data — silently corrupting
 *      the source file. The guard delegates to `isViewingHieroUiIconSet()`,
 *      which reads the platform-bridge's currentProjectPath marker set by
 *      the open flow.
 *
 *   2. **Byte-stable on no-op saves.** `meta.updatedAt` only gets a fresh
 *      timestamp when the editor reports `isDirty === true`. Loading
 *      icons.json and immediately saving without edits returns the
 *      original timestamp, so the file is byte-identical and
 *      `pnpm icons:verify` stays green. Without this, every save —
 *      including accidental clicks — would dirty the file.
 */
export function serializeHieroUiIconSet(): SerializeHieroUiIconSetResult {
  const state = editorStore.getState();
  const { workspace } = state;
  if (!workspace) return { ok: false, reason: 'no-workspace' };
  const setId = workspace.activeIconSetId;
  if (!setId) return { ok: false, reason: 'no-workspace' };
  const iconSet = workspace.iconSets[setId];
  if (!iconSet) return { ok: false, reason: 'no-workspace' };

  if (!isViewingHieroUiIconSet()) {
    return { ok: false, reason: 'not-canonical-source' };
  }

  // Only stamp a fresh updatedAt when the editor has actual changes.
  // No-op saves (open icons.json → click Save without editing) keep the
  // original timestamp so the file stays byte-identical to disk.
  const updatedAt = state.isDirty
    ? new Date().toISOString()
    : iconSet.meta.updatedAt;

  const project: Project = {
    ...iconSet,
    meta: { ...iconSet.meta, updatedAt },
  };
  return {
    ok: true,
    data: JSON.stringify(project, null, 2),
    updatedAt,
  };
}

/**
 * True when the editor is currently viewing the canonical Hiero UI
 * icon set (loaded via `openHieroUiIconSetInEditor`). Used by the
 * toolbar to decide whether to show "Save Hiero UI Icon Set" alongside
 * the generic Save action.
 */
export function isViewingHieroUiIconSet(): boolean {
  return getCurrentProjectPath() === HIERO_UI_ICONS_SOURCE_FILENAME;
}

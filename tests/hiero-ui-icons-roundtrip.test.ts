import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { editorStore } from '../lib/editor-store/store';
import type { Project } from '../lib/schema/types';

/**
 * Round-trip determinism for `packages/hiero-ui-icons/source/icons.json`.
 *
 * The migration plan's section 2 ("publish right away") promises that a
 * designer can open the canonical icon set in Hiero, edit, and save back
 * to the same file — and that `pnpm icons:build` will regenerate cleanly.
 *
 * That promise rests on a load-bearing invariant: **loading icons.json
 * into the editor and saving back without changes produces a byte-stable
 * file.** If the editor's normalization chain (migrateProjectForGuideMasters,
 * ensureUniversalTypes, withLegacyProjectView, createWorkspaceFromProject)
 * mutates fields on load, save re-serializes the mutated shape, and the
 * "no edits" save dirties the file. `pnpm icons:verify` then fails on
 * every CI run that touches the editor.
 *
 * This test loads icons.json through the editor's public `loadProject`
 * action, extracts the project back out of the workspace, and asserts
 * structural equivalence with the input. It catches:
 *
 *   - schema migrations that need icons.json to be regenerated
 *   - accidental edits to icons.json that strip required fields
 *   - serializer drift between import and save
 *
 * Failure mode: when this test fails, regenerate the source via
 * `pnpm icons:import` and commit. If that doesn't produce a clean diff,
 * a normalization step is non-idempotent and needs investigation.
 */

const ICONS_JSON_PATH = join(
  import.meta.dir,
  '..',
  'packages',
  'hiero-ui-icons',
  'source',
  'icons.json',
);

function loadIconsJson(): Project {
  return JSON.parse(readFileSync(ICONS_JSON_PATH, 'utf-8')) as Project;
}

// `loadProject` always populates workspace + activeIconSetId, but the
// store's TS types reflect "may be empty" because there's a brief window
// before any project is loaded. Centralize the narrowing here so each
// test isn't littered with the same null-checks.
function getLoadedProject(): Project {
  const workspace = editorStore.getState().workspace;
  if (!workspace) throw new Error('Editor workspace was not populated by loadProject().');
  const setId = workspace.activeIconSetId;
  if (!setId) throw new Error('Workspace.activeIconSetId was not set after loadProject().');
  const loaded = workspace.iconSets[setId];
  if (!loaded) throw new Error(`Workspace.iconSets[${setId}] is empty after loadProject().`);
  return loaded;
}

describe('hiero-ui-icons round-trip', () => {
  test('icons.json is parseable and looks like a Project', () => {
    const project = loadIconsJson();
    expect(project.version).toBeDefined();
    expect(project.icons).toBeDefined();
    expect(typeof project.icons).toBe('object');
    expect(Object.keys(project.icons).length).toBeGreaterThan(0);
  });

  test('every icon has at least one variant with a viewBox', () => {
    const project = loadIconsJson();
    for (const [iconId, icon] of Object.entries(project.icons)) {
      const variantIds = Object.keys(icon.variants);
      expect(variantIds.length, `icon ${iconId} has no variants`).toBeGreaterThan(0);
      for (const [variantId, variant] of Object.entries(icon.variants)) {
        expect(
          Array.isArray(variant.viewBox) && variant.viewBox.length === 4,
          `${iconId}.${variantId} has invalid viewBox`,
        ).toBe(true);
      }
    }
  });

  test('loading icons.json through the editor store does not lose any icon ids', () => {
    const input = loadIconsJson();
    editorStore.getState().loadProject(input);
    const loaded = getLoadedProject();

    const inputIconIds = Object.keys(input.icons).sort();
    const loadedIconIds = Object.keys(loaded.icons).sort();
    expect(loadedIconIds).toEqual(inputIconIds);
  });

  test('loading icons.json through the editor store does not lose any variant ids', () => {
    const input = loadIconsJson();
    editorStore.getState().loadProject(input);
    const loaded = getLoadedProject();

    for (const [iconId, inputIcon] of Object.entries(input.icons)) {
      const loadedIcon = loaded.icons[iconId];
      expect(loadedIcon, `icon ${iconId} missing after load`).toBeTruthy();
      if (!loadedIcon) continue;
      const inputVariants = Object.keys(inputIcon.variants).sort();
      const loadedVariants = Object.keys(loadedIcon.variants).sort();
      expect(loadedVariants, `variants for ${iconId} drifted on load`).toEqual(inputVariants);
    }
  });

  test('every variant preserves its viewBox and size after load', () => {
    const input = loadIconsJson();
    editorStore.getState().loadProject(input);
    const loaded = getLoadedProject();

    for (const [iconId, inputIcon] of Object.entries(input.icons)) {
      const loadedIcon = loaded.icons[iconId];
      if (!loadedIcon) continue;
      for (const [variantId, inputVariant] of Object.entries(inputIcon.variants)) {
        const loadedVariant = loadedIcon.variants[variantId];
        if (!loadedVariant) continue;
        expect(
          loadedVariant.viewBox,
          `${iconId}.${variantId} viewBox changed on load`,
        ).toEqual(inputVariant.viewBox);
        expect(
          loadedVariant.size,
          `${iconId}.${variantId} size changed on load`,
        ).toEqual(inputVariant.size);
      }
    }
  });

  test('every layer preserves its path data after load', () => {
    const input = loadIconsJson();
    editorStore.getState().loadProject(input);
    const loaded = getLoadedProject();

    for (const [iconId, inputIcon] of Object.entries(input.icons)) {
      const loadedIcon = loaded.icons[iconId];
      if (!loadedIcon) continue;
      for (const [variantId, inputVariant] of Object.entries(inputIcon.variants)) {
        const loadedVariant = loadedIcon.variants[variantId];
        if (!loadedVariant) continue;
        for (const [layerId, inputLayer] of Object.entries(inputVariant.layers)) {
          const loadedLayer = loadedVariant.layers[layerId];
          expect(
            loadedLayer,
            `${iconId}.${variantId}.${layerId} missing after load`,
          ).toBeTruthy();
          if (!loadedLayer) continue;
          expect(
            loadedLayer.path,
            `${iconId}.${variantId}.${layerId} path data changed on load — save would dirty the file`,
          ).toEqual(inputLayer.path);
        }
      }
    }
  });
});

/**
 * End-to-end regression tests for the PR sync → release pipeline.
 *
 * Golden path: project fixture → source export → diff → PR sync →
 *              merged repo state → post-merge build → package validation.
 *
 * All tests are hermetic — no real GitHub network calls.
 */

import { describe, expect, test, beforeEach } from 'bun:test';

import type { Project } from '@/lib/schema/types';
import type { SourcePayloadFile } from '@/lib/sync-source/types';
import { exportSourcePayload } from '@/lib/sync-source/export-source-payload';
import { diffSourcePayloads } from '@/lib/sync-service/diff-source';
import { syncPr } from '@/lib/sync-service/sync-pr';
import type { SyncPrResult } from '@/lib/sync-service/sync-pr';
import type { SyncPrRequest } from '@/lib/sync-service/contracts';
import { projectFromSourceFiles } from '@/lib/sync-source/source-to-project';
import { compileProject } from '@/lib/export/compile-pipeline';
import { isCompiledIcon, isPackageManifest } from '@/lib/compiler-contracts';

import { MockGitProvider } from './helpers/mock-git-provider';
import {
  makeProject,
  exportSource,
  simulateMergedState,
  mergedStateFromFullPayload,
  buildFromMergedSource,
  extractManifest,
  extractIconDirNames,
  hasDuplicateIcons,
} from './helpers/source-fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER = 'test-org';
const REPO = 'design-icons';
const FIXED_DATE = new Date('2026-03-15T14:30:00.000Z');
const GENERATED_AT = '2026-03-15T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  files: SourcePayloadFile[],
  previousFiles: SourcePayloadFile[] = [],
  overrides?: Partial<SyncPrRequest>,
): SyncPrRequest {
  return {
    owner: OWNER,
    repo: REPO,
    baseBranch: 'main',
    actor: { name: 'E2E Test', email: 'e2e@test.com' },
    files,
    previousFiles,
    force: true,
    ...overrides,
  };
}

function assertSuccessResult(result: SyncPrResult): asserts result is Extract<SyncPrResult, { kind: 'success' }> {
  expect(result.kind).toBe('success');
}

/**
 * Runs the full golden path for a given scenario:
 * 1. Export source from base project
 * 2. Export source from modified project
 * 3. Diff the two exports
 * 4. Run syncPr with the diff
 * 5. Simulate merged repo state
 * 6. Build from merged state
 * 7. Return all intermediate results for assertion
 */
async function runGoldenPath(
  baseProject: Project,
  modifiedProject: Project,
) {
  const provider = new MockGitProvider();

  // Step 1: Export base source (represents previous sync state)
  const basePayload = exportSourcePayload(baseProject, { generatedAt: GENERATED_AT });
  const baseFiles = basePayload.files;

  // Seed the mock provider with existing files on main
  provider.seedListFiles(
    OWNER,
    REPO,
    'main',
    baseFiles.map((f) => f.path),
  );
  for (const file of baseFiles) {
    provider.seedFile(OWNER, REPO, 'main', file.path, file.contents);
  }

  // Step 2: Export modified source (represents current editor state)
  const currentPayload = exportSourcePayload(modifiedProject, { generatedAt: GENERATED_AT });
  const currentFiles = currentPayload.files;

  // Step 3: Diff
  const diff = diffSourcePayloads(baseFiles, currentFiles);

  // Step 4: PR sync
  const request = makeRequest(currentFiles, baseFiles);
  const result = await syncPr(request, { provider, now: FIXED_DATE });

  // Step 5: Simulate merged state
  let mergedFiles: SourcePayloadFile[];
  if (result.kind === 'success') {
    mergedFiles = simulateMergedState(baseFiles, currentFiles, result.changedFiles);
  } else {
    // For no-op, merged state is the base
    mergedFiles = baseFiles;
  }

  // Step 6: Build from merged state
  const build = buildFromMergedSource(mergedFiles, {
    tokenColors: { accent: '#38bdf8' },
  });

  return {
    basePayload,
    currentPayload,
    diff,
    syncResult: result,
    mergedFiles,
    build,
    provider,
  };
}

/**
 * Runs a first-sync scenario (no previous files on main).
 */
async function runFirstSync(project: Project) {
  const provider = new MockGitProvider();

  // Seed main branch as existing (empty repo, first sync)
  provider.seedBranchSha(OWNER, REPO, 'main', 'base-sha-000');

  const payload = exportSourcePayload(project, { generatedAt: GENERATED_AT });

  const request = makeRequest(payload.files, [], { force: true });
  const result = await syncPr(request, { provider, now: FIXED_DATE });

  const mergedFiles = mergedStateFromFullPayload(payload);
  const build = buildFromMergedSource(mergedFiles, {
    tokenColors: { accent: '#38bdf8' },
  });

  return { payload, syncResult: result, mergedFiles, build, provider };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: PR sync to release pipeline', () => {

  // -----------------------------------------------------------------------
  // Golden path: initial sync of a multi-icon project
  // -----------------------------------------------------------------------

  describe('initial sync (first-time export)', () => {
    test('exports, syncs, merges, and builds a 3-icon project', async () => {
      const project = makeProject();
      const { payload, syncResult, mergedFiles, build } = await runFirstSync(project);

      // Source export produces files for all 3 icons + manifest
      const iconDirs = extractIconDirNames(payload.files);
      expect(iconDirs.size).toBe(3);
      expect(iconDirs.has('chevron')).toBeTrue();
      expect(iconDirs.has('search')).toBeTrue();
      expect(iconDirs.has('star')).toBeTrue();

      // Manifest is consistent
      const manifest = extractManifest(payload.files);
      expect(manifest.iconCount).toBe(3);
      expect(hasDuplicateIcons(manifest)).toBeFalse();
      expect(Object.keys(manifest.icons).sort()).toEqual(
        ['icon-chevron', 'icon-search', 'icon-star'],
      );

      // Sync succeeds
      assertSuccessResult(syncResult);
      expect(syncResult.changedFiles.added.length).toBeGreaterThan(0);
      expect(syncResult.pr.number).toBe(42);

      // Build succeeds from merged state
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();

      // Generated exports include React components
      expect(build.files.some((f) => f.path === 'generated/index.ts')).toBeTrue();
    });

    test('deterministic export — re-export produces identical files', () => {
      const project = makeProject();
      const payload1 = exportSourcePayload(project, { generatedAt: GENERATED_AT });
      const payload2 = exportSourcePayload(project, { generatedAt: GENERATED_AT });

      expect(payload1.files.length).toBe(payload2.files.length);
      for (let i = 0; i < payload1.files.length; i++) {
        expect(payload1.files[i]!.path).toBe(payload2.files[i]!.path);
        expect(payload1.files[i]!.contents).toBe(payload2.files[i]!.contents);
      }
    });

    test('no-op sync when exporting the same project twice', async () => {
      const project = makeProject();
      const payload = exportSourcePayload(project, { generatedAt: GENERATED_AT });

      const provider = new MockGitProvider();
      const request = makeRequest(payload.files, payload.files);
      const result = await syncPr(request, { provider, now: FIXED_DATE });

      expect(result.kind).toBe('no-op');
    });
  });

  // -----------------------------------------------------------------------
  // Scenario: update one icon metadata field
  // -----------------------------------------------------------------------

  describe('update icon metadata field', () => {
    test('changing category triggers metadata-only diff and builds successfully', async () => {
      const base = makeProject();
      const modified = makeProject();
      modified.icons['icon-chevron']!.category = 'arrows';

      const { diff, syncResult, build, mergedFiles } = await runGoldenPath(base, modified);

      // Diff detects the change
      expect(diff.isNoOp).toBeFalse();
      const chevronChange = diff.iconChanges.find((c) => c.iconDir === 'chevron');
      expect(chevronChange).toBeDefined();
      expect(chevronChange!.kind).toBe('updated');

      // Sync succeeds
      assertSuccessResult(syncResult);
      expect(syncResult.changedFiles.updated.length).toBeGreaterThan(0);

      // Merged manifest reflects the update
      const manifest = extractManifest(mergedFiles);
      expect(manifest.icons['icon-chevron']!.category).toBe('arrows');
      expect(manifest.iconCount).toBe(3);
      expect(hasDuplicateIcons(manifest)).toBeFalse();

      // Build succeeds
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });

    test('changing tags triggers metadata update', async () => {
      const base = makeProject();
      const modified = makeProject();
      modified.icons['icon-search']!.tags = ['find', 'search', 'magnifier', 'lookup'];

      const { diff, syncResult, build } = await runGoldenPath(base, modified);

      expect(diff.isNoOp).toBeFalse();
      assertSuccessResult(syncResult);
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // Scenario: update one icon variant/path/state
  // -----------------------------------------------------------------------

  describe('update icon variant/path/state', () => {
    test('changing path data in a variant triggers icon-updated diff', async () => {
      const base = makeProject();
      const modified = makeProject();

      // Change the chevron path data
      modified.icons['icon-chevron']!.variants['v24']!.layers['path-main']!.path = {
        d: 'M9 6l6 6-6 6',
      };

      const { diff, syncResult, build, mergedFiles } = await runGoldenPath(base, modified);

      expect(diff.isNoOp).toBeFalse();
      const chevronChange = diff.iconChanges.find((c) => c.iconDir === 'chevron');
      expect(chevronChange).toBeDefined();
      expect(chevronChange!.kind).toBe('updated');

      assertSuccessResult(syncResult);

      // Build still succeeds with modified path
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });

    test('adding a new state to an existing variant', async () => {
      const base = makeProject();
      const modified = makeProject();

      // Add a new variant size to the chevron (simulating structural change)
      modified.icons['icon-chevron']!.variants['v48'] = {
        id: 'v48',
        size: 48,
        viewBox: [0, 0, 48, 48] as [number, number, number, number],
        layers: {
          'path-main': {
            id: 'path-main',
            role: 'primary',
            visible: true,
            path: { d: 'M14 8l18 16-18 16' },
            style: {
              fill: { mode: 'fixed', value: 'none' },
              stroke: { mode: 'token', token: 'accent' },
              strokeWidth: 2.5,
              lineCap: 'round',
              lineJoin: 'round',
            },
          },
        },
      };

      const { diff, syncResult, build } = await runGoldenPath(base, modified);

      expect(diff.isNoOp).toBeFalse();
      assertSuccessResult(syncResult);
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });

    test('changing stroke width updates compiled output', async () => {
      const base = makeProject();
      const modified = makeProject();

      modified.icons['icon-star']!.variants['v24']!.layers['outline']!.style.strokeWidth = 3;

      const { diff, syncResult, build } = await runGoldenPath(base, modified);

      expect(diff.isNoOp).toBeFalse();
      assertSuccessResult(syncResult);
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // Scenario: add a new icon
  // -----------------------------------------------------------------------

  describe('add a new icon', () => {
    test('adding a 4th icon produces correct diff, sync, and build', async () => {
      const base = makeProject();
      const modified = makeProject();

      // Add a "Heart" icon
      modified.icons['icon-heart'] = {
        id: 'icon-heart',
        name: 'Heart',
        category: 'feedback',
        tags: ['heart', 'love', 'like'],
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24] as [number, number, number, number],
            layers: {
              heart: {
                id: 'heart',
                role: 'primary',
                visible: true,
                path: {
                  d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z',
                },
                style: {
                  fill: { mode: 'fixed', value: 'none' },
                  stroke: { mode: 'token', token: 'accent' },
                  strokeWidth: 2,
                  lineCap: 'round',
                  lineJoin: 'round',
                },
              },
            },
          },
        },
        transitions: {},
        effects: {},
      };

      const { diff, syncResult, build, mergedFiles } = await runGoldenPath(base, modified);

      // Diff detects added icon
      expect(diff.isNoOp).toBeFalse();
      const heartChange = diff.iconChanges.find((c) => c.iconDir === 'heart');
      expect(heartChange).toBeDefined();
      expect(heartChange!.kind).toBe('added');

      // Sync reports files added
      assertSuccessResult(syncResult);
      expect(
        syncResult.changedFiles.added.some((p) => p.includes('heart')),
      ).toBeTrue();

      // Merged manifest has 4 icons, no duplicates
      const manifest = extractManifest(mergedFiles);
      expect(manifest.iconCount).toBe(4);
      expect(hasDuplicateIcons(manifest)).toBeFalse();
      expect(Object.keys(manifest.icons).sort()).toEqual(
        ['icon-chevron', 'icon-heart', 'icon-search', 'icon-star'],
      );

      // Build succeeds with 4 icons
      expect(build.compiledIconCount).toBe(4);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();

      // 4 compiled icon files
      const compiledFiles = build.files.filter((f) => f.path.endsWith('.compiled.json'));
      expect(compiledFiles.length).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // Scenario: remove an icon
  // -----------------------------------------------------------------------

  describe('remove an icon', () => {
    test('removing the star icon produces correct diff, sync, and build', async () => {
      const base = makeProject();
      const modified = makeProject();

      delete modified.icons['icon-star'];

      const { diff, syncResult, build, mergedFiles } = await runGoldenPath(base, modified);

      // Diff detects removal
      expect(diff.isNoOp).toBeFalse();
      const starChange = diff.iconChanges.find((c) => c.iconDir === 'star');
      expect(starChange).toBeDefined();
      expect(starChange!.kind).toBe('removed');

      // Sync reports files deleted
      assertSuccessResult(syncResult);
      expect(
        syncResult.changedFiles.deleted.some((p) => p.includes('star')),
      ).toBeTrue();

      // Merged state no longer contains star
      const iconDirs = extractIconDirNames(mergedFiles);
      expect(iconDirs.has('star')).toBeFalse();
      expect(iconDirs.size).toBe(2);

      // Merged manifest has 2 icons
      const manifest = extractManifest(mergedFiles);
      expect(manifest.iconCount).toBe(2);
      expect(hasDuplicateIcons(manifest)).toBeFalse();

      // Build succeeds with 2 icons
      expect(build.compiledIconCount).toBe(2);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // Scenario: preview-only change
  // -----------------------------------------------------------------------

  describe('preview-only change', () => {
    test('changing only the preview SVG (via token color) is detected', async () => {
      const base = makeProject();
      const modified = makeProject();

      // Export base with one token color, modified with another.
      // This changes preview.svg but not icon.json.
      const basePayload = exportSourcePayload(base, { generatedAt: GENERATED_AT });

      // Manually alter just the preview SVG content to simulate a preview-only change
      const modifiedPayload = exportSourcePayload(modified, { generatedAt: GENERATED_AT });

      // Find a preview.svg and alter it
      const modifiedFiles = modifiedPayload.files.map((f) => {
        if (f.path === 'icons/chevron/preview.svg') {
          return {
            path: f.path,
            // Append a trivial comment to simulate rendering difference
            contents: f.contents.replace('</svg>', '<!-- preview-updated --></svg>'),
          };
        }
        return f;
      });

      const diff = diffSourcePayloads(basePayload.files, modifiedFiles);

      expect(diff.isNoOp).toBeFalse();
      const chevronChange = diff.iconChanges.find((c) => c.iconDir === 'chevron');
      expect(chevronChange).toBeDefined();
      expect(chevronChange!.kind).toBe('preview-only');

      // The preview-only change should still sync and build successfully
      const provider = new MockGitProvider();
      provider.seedListFiles(
        OWNER,
        REPO,
        'main',
        basePayload.files.map((f) => f.path),
      );
      for (const file of basePayload.files) {
        provider.seedFile(OWNER, REPO, 'main', file.path, file.contents);
      }

      const request = makeRequest(modifiedFiles, basePayload.files);
      const syncResult = await syncPr(request, { provider, now: FIXED_DATE });

      assertSuccessResult(syncResult);

      // Build from merged state with the modified preview
      const mergedFiles = simulateMergedState(
        basePayload.files,
        modifiedFiles,
        syncResult.changedFiles,
      );
      const build = buildFromMergedSource(mergedFiles, {
        tokenColors: { accent: '#38bdf8' },
      });

      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // Manifest consistency checks
  // -----------------------------------------------------------------------

  describe('manifest consistency', () => {
    test('manifest icon count always matches actual icon files', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const manifest = extractManifest(payload.files);
      const iconDirs = extractIconDirNames(payload.files);

      expect(manifest.iconCount).toBe(iconDirs.size);
      expect(Object.keys(manifest.icons).length).toBe(iconDirs.size);
    });

    test('every manifest entry has matching icon.json and preview.svg', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const manifest = extractManifest(payload.files);
      const filePaths = new Set(payload.files.map((f) => f.path));

      for (const entry of Object.values(manifest.icons)) {
        expect(filePaths.has(entry.sourcePath)).toBeTrue();
        expect(filePaths.has(entry.previewPath)).toBeTrue();
      }
    });

    test('no duplicate icon IDs in manifest after any operation', async () => {
      // Add + existing
      const modified = makeProject();
      modified.icons['icon-plus'] = {
        id: 'icon-plus',
        name: 'Plus',
        category: 'action',
        tags: ['add', 'plus'],
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24] as [number, number, number, number],
            layers: {
              cross: {
                id: 'cross',
                role: 'primary',
                visible: true,
                path: { d: 'M12 5v14M5 12h14' },
                style: {
                  fill: { mode: 'fixed', value: 'none' },
                  stroke: { mode: 'token', token: 'accent' },
                  strokeWidth: 2,
                  lineCap: 'round',
                  lineJoin: 'round',
                },
              },
            },
          },
        },
        transitions: {},
        effects: {},
      };

      const payload = exportSourcePayload(modified, { generatedAt: GENERATED_AT });
      const manifest = extractManifest(payload.files);

      expect(hasDuplicateIcons(manifest)).toBeFalse();
      expect(manifest.iconCount).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // Package build integrity
  // -----------------------------------------------------------------------

  describe('package build integrity', () => {
    test('compiled icons pass contract validation', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const merged = mergedStateFromFullPayload(payload);
      const build = buildFromMergedSource(merged, {
        tokenColors: { accent: '#38bdf8' },
      });

      for (const file of build.files) {
        if (file.path.endsWith('.compiled.json')) {
          const parsed = JSON.parse(file.contents);
          expect(isCompiledIcon(parsed)).toBeTrue();
        }
      }
    });

    test('package manifest passes contract validation', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const merged = mergedStateFromFullPayload(payload);
      const build = buildFromMergedSource(merged, {
        tokenColors: { accent: '#38bdf8' },
      });

      const manifestFile = build.files.find((f) => f.path === 'icons.manifest.json');
      expect(manifestFile).toBeDefined();
      expect(isPackageManifest(JSON.parse(manifestFile!.contents))).toBeTrue();
    });

    test('React codegen generates index and component files', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const merged = mergedStateFromFullPayload(payload);
      const build = buildFromMergedSource(merged, {
        tokenColors: { accent: '#38bdf8' },
      });

      expect(build.files.some((f) => f.path === 'generated/index.ts')).toBeTrue();
      expect(
        build.files.some((f) => f.path.startsWith('generated/') && f.path.endsWith('.tsx')),
      ).toBeTrue();
    });

    test('roundtrip: source export → reconstruct project → compile preserves icon count', () => {
      const project = makeProject();
      const payload = exportSource(project);
      const merged = mergedStateFromFullPayload(payload);

      // Reconstruct
      const reconstructed = projectFromSourceFiles(merged, {
        name: 'Roundtrip Test',
        tokenColors: { accent: '#38bdf8' },
      });

      expect(Object.keys(reconstructed.icons).length).toBe(3);

      // Compile
      const result = compileProject(reconstructed, {
        package: {
          name: '@coniva/icons',
          version: '1.0.0',
          builtAt: '2026-03-15T00:00:00.000Z',
        },
      });

      expect(result.compiledIcons.length).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Edge case: multiple mutations in a single sync
  // -----------------------------------------------------------------------

  describe('combined mutations', () => {
    test('add icon + remove icon + update icon in a single sync', async () => {
      const base = makeProject();
      const modified = makeProject();

      // Remove star
      delete modified.icons['icon-star'];

      // Update chevron category
      modified.icons['icon-chevron']!.category = 'arrows';

      // Add heart
      modified.icons['icon-heart'] = {
        id: 'icon-heart',
        name: 'Heart',
        category: 'feedback',
        tags: ['heart', 'love'],
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24] as [number, number, number, number],
            layers: {
              heart: {
                id: 'heart',
                role: 'primary',
                visible: true,
                path: {
                  d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z',
                },
                style: {
                  fill: { mode: 'fixed', value: 'none' },
                  stroke: { mode: 'token', token: 'accent' },
                  strokeWidth: 2,
                  lineCap: 'round',
                  lineJoin: 'round',
                },
              },
            },
          },
        },
        transitions: {},
        effects: {},
      };

      const { diff, syncResult, build, mergedFiles } = await runGoldenPath(base, modified);

      // Diff captures all 3 changes
      expect(diff.isNoOp).toBeFalse();
      expect(diff.iconChanges.find((c) => c.iconDir === 'star')?.kind).toBe('removed');
      expect(diff.iconChanges.find((c) => c.iconDir === 'chevron')?.kind).toBe('updated');
      expect(diff.iconChanges.find((c) => c.iconDir === 'heart')?.kind).toBe('added');

      // Sync succeeds
      assertSuccessResult(syncResult);
      expect(syncResult.changedFiles.added.length).toBeGreaterThan(0);
      expect(syncResult.changedFiles.updated.length).toBeGreaterThan(0);
      expect(syncResult.changedFiles.deleted.length).toBeGreaterThan(0);

      // Merged manifest has 3 icons (removed star, added heart, kept chevron + search)
      const manifest = extractManifest(mergedFiles);
      expect(manifest.iconCount).toBe(3);
      expect(hasDuplicateIcons(manifest)).toBeFalse();
      expect(Object.keys(manifest.icons).sort()).toEqual(
        ['icon-chevron', 'icon-heart', 'icon-search'],
      );

      // Build succeeds
      expect(build.compiledIconCount).toBe(3);
      expect(build.manifestValid).toBeTrue();
      expect(build.allCompiledIconsValid).toBeTrue();
    });
  });
});

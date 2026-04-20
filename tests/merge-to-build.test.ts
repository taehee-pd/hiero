/**
 * Regression tests: source export → merged repo → package build.
 *
 * Proves the full roundtrip works:
 *   Project → exportSourcePayload → projectFromSourceFiles → compileProject → valid package
 *
 * Also verifies no schema/version mismatch is introduced when source files
 * are used as the canonical input for the compile pipeline.
 */

import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import type { Project, Icon } from '../lib/schema/types';
import {
  isCompiledIcon,
  isPackageManifest,
  type CompiledIcon,
  type PackageManifest,
} from '../lib/compiler-contracts';
import { compileProject } from '../lib/export/compile-pipeline';
import { exportSourcePayload } from '../lib/sync-source/export-source-payload';
import {
  iconFromSource,
  projectFromSourceFiles,
  projectFromSourceDir,
} from '../lib/sync-source/source-to-project';
import { exportIconSource } from '../lib/sync-source/export-icon-source';
import { isProject } from '../lib/schema/guards';
import e2eFixture from './fixtures/e2e/compiler-project.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(): Project {
  return structuredClone(e2eFixture) as unknown as Project;
}

const COMPILE_OPTIONS = {
  package: {
    name: '@hiero/icons',
    version: '1.0.0',
    builtAt: '2026-03-17T00:00:00.000Z',
  },
};

// ---------------------------------------------------------------------------
// iconFromSource roundtrip
// ---------------------------------------------------------------------------

describe('iconFromSource roundtrip', () => {
  test('reconstructs a valid Icon from IconSourceFile', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    const restored = iconFromSource(source);

    expect(restored.id).toBe(icon.id);
    expect(restored.name).toBe(icon.name);
    expect(restored.category).toBe(icon.category);
    expect(restored.tags).toEqual(icon.tags?.sort());
    expect(Object.keys(restored.variants)).toEqual(Object.keys(icon.variants).sort());
  });

  test('preserves variant structure through roundtrip', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    const restored = iconFromSource(source);

    for (const variantId of Object.keys(icon.variants)) {
      const original = icon.variants[variantId]!;
      const roundtripped = restored.variants[variantId]!;

      expect(roundtripped.size).toBe(original.size);
      expect(roundtripped.viewBox).toEqual(original.viewBox);
      expect(Object.keys(roundtripped.layers).sort()).toEqual(
        Object.keys(original.layers).sort(),
      );
    }
  });

  test('preserves layer path data through roundtrip', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    const restored = iconFromSource(source);

    const originalLayer = icon.variants['v24']!.layers['chev']!;
    const restoredLayer = restored.variants['v24']!.layers['chev']!;

    expect(restoredLayer.path?.d).toBe(originalLayer.path?.d);
    expect(restoredLayer.style).toEqual(originalLayer.style);
    expect(restoredLayer.role).toBe(originalLayer.role);
  });

  test('strips editor-only metadata during roundtrip', () => {
    const project = makeProject();
    const icon = structuredClone(project.icons['icon-chev']!) as Icon;
    // Add editor-only metadata
    const firstVariant = Object.values(icon.variants)[0]!;
    const firstLayer = Object.values(firstVariant.layers)[0]!;
    firstLayer.importMeta = { sourceTag: 'path', sourceNodeId: 'n1' };
    firstLayer.isClipMask = false;
    firstLayer.groupId = 'group-1';
    (firstVariant as any).guideMasterId = 'guide-1';
    icon.customGuides = [{ kind: 'hline', y: 12 }];
    icon.components = { badge: { kind: 'badge', layerIds: ['chev'] } };

    const source = exportIconSource(icon);
    const restored = iconFromSource(source);

    const restoredLayer = Object.values(
      Object.values(restored.variants)[0]!.layers,
    )[0]!;

    expect(restoredLayer.importMeta).toBeUndefined();
    expect(restoredLayer.isClipMask).toBeUndefined();
    expect(restoredLayer.groupId).toBeUndefined();
    expect(restored.customGuides).toBeUndefined();
    expect(restored.components).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// projectFromSourceFiles roundtrip
// ---------------------------------------------------------------------------

describe('projectFromSourceFiles roundtrip', () => {
  test('reconstructs a valid Project from exported source payload', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });

    const restored = projectFromSourceFiles(payload.files, {
      name: 'Test Icons',
      tokenColors: project.tokenSet?.colors,
    });

    expect(isProject(restored)).toBeTrue();
    expect(Object.keys(restored.icons).length).toBe(Object.keys(project.icons).length);
  });

  test('restored project compiles successfully', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });

    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
    });

    const result = compileProject(restored, COMPILE_OPTIONS);

    expect(result.compiledIcons.length).toBeGreaterThan(0);
    expect(result.files.some((f) => f.path === 'icons.manifest.json')).toBeTrue();

    for (const compiled of result.compiledIcons) {
      expect(isCompiledIcon(compiled)).toBeTrue();
    }
  });

  test('throws on missing manifest.json', () => {
    expect(() =>
      projectFromSourceFiles([
        { path: 'icons/test/icon.json', contents: '{}' },
      ]),
    ).toThrow('Missing manifest.json');
  });

  test('uses manifest.generatedAt for project timestamp', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const restored = projectFromSourceFiles(payload.files);

    expect(restored.meta.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Full pipeline roundtrip: project → source → project → compile
// ---------------------------------------------------------------------------

describe('full pipeline roundtrip', () => {
  test('source export → compile produces identical compiled icons', () => {
    const project = makeProject();

    // Direct compile
    const directResult = compileProject(project, COMPILE_OPTIONS);

    // Roundtrip: export → reconstruct → compile
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });
    const roundtripResult = compileProject(restored, COMPILE_OPTIONS);

    // Same number of compiled icons
    expect(roundtripResult.compiledIcons.length).toBe(directResult.compiledIcons.length);

    // Same icon IDs
    const directIds = directResult.compiledIcons.map((c) => c.id).sort();
    const roundtripIds = roundtripResult.compiledIcons.map((c) => c.id).sort();
    expect(roundtripIds).toEqual(directIds);

    // Same content hashes (proves byte-identical compiled output)
    for (const directIcon of directResult.compiledIcons) {
      const roundtripIcon = roundtripResult.compiledIcons.find(
        (c) => c.id === directIcon.id,
      )!;
      expect(roundtripIcon.meta.contentHash).toBe(directIcon.meta.contentHash);
    }
  });

  test('manifest has correct icon count after roundtrip compile', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });
    const result = compileProject(restored, COMPILE_OPTIONS);

    const manifestFile = result.files.find((f) => f.path === 'icons.manifest.json')!;
    const manifest = JSON.parse(manifestFile.contents) as PackageManifest;

    expect(isPackageManifest(manifest)).toBeTrue();
    expect(manifest.package.iconCount).toBe(Object.keys(project.icons).length);
    expect(Object.keys(manifest.icons).length).toBe(Object.keys(project.icons).length);
  });

  test('React codegen works through roundtrip', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });

    const result = compileProject(restored, {
      ...COMPILE_OPTIONS,
      generateReact: true,
    });

    expect(result.files.some((f) => f.path === 'generated/index.ts')).toBeTrue();
    expect(
      result.files.some((f) => f.path === 'package.exports.generated.json'),
    ).toBeTrue();
  });

  test('change detection works across roundtripped builds', () => {
    const project = makeProject();

    // Build v1 via roundtrip
    const payload1 = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored1 = projectFromSourceFiles(payload1.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });
    const result1 = compileProject(restored1, {
      package: { name: '@hiero/icons', version: '1.0.0', builtAt: '2026-03-17T00:00:00.000Z' },
    });
    const previousCompiled = Object.fromEntries(
      result1.compiledIcons.map((c) => [c.id, c]),
    );

    // Mutate and build v2
    const project2 = makeProject();
    project2.icons['icon-chev']!.name = 'Chevron Updated';
    const payload2 = exportSourcePayload(project2, {
      generatedAt: '2026-03-17T01:00:00.000Z',
    });
    const restored2 = projectFromSourceFiles(payload2.files, {
      name: '@hiero/icons',
      tokenColors: project2.tokenSet?.colors,
      updatedAt: '2026-03-17T01:00:00.000Z',
    });
    const result2 = compileProject(restored2, {
      package: { name: '@hiero/icons', version: '1.1.0', builtAt: '2026-03-17T01:00:00.000Z' },
      previousCompiledIcons: previousCompiled,
    });

    const changeFile = result2.files.find((f) => f.path.startsWith('changes/'));
    expect(changeFile).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Schema/version compatibility
// ---------------------------------------------------------------------------

describe('schema and version compatibility', () => {
  test('source schema version is preserved through roundtrip', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });

    // Read manifest from payload
    const manifestFile = payload.files.find((f) => f.path === 'manifest.json')!;
    const manifest = JSON.parse(manifestFile.contents);

    // Read an icon source file
    const iconFile = payload.files.find((f) => f.path.endsWith('/icon.json'))!;
    const iconSource = JSON.parse(iconFile.contents);

    // Verify schema versions are set
    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(iconSource.schemaVersion).toBe('1.0.0');
  });

  test('compiled output uses correct schema URIs after roundtrip', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });
    const result = compileProject(restored, COMPILE_OPTIONS);

    for (const compiled of result.compiledIcons) {
      expect(compiled.$schema).toBe('https://hiero.dev/schemas/compiled-icon/1.0.0');
    }

    const manifestFile = result.files.find((f) => f.path === 'icons.manifest.json')!;
    const manifest = JSON.parse(manifestFile.contents) as PackageManifest;
    expect(manifest.$schema).toBe('https://hiero.dev/schemas/manifest/1.0.0');
  });

  test('project version is preserved', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files);

    expect(restored.version).toBe('1.0');
  });

  test('token colors are correctly passed to compilation', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      tokenColors: { accent: '#ff0000' },
    });

    expect(restored.tokenSet?.colors?.accent).toBe('#ff0000');

    // Compile and verify token-resolved fills
    const result = compileProject(restored, COMPILE_OPTIONS);
    const compiled = result.compiledIcons[0]!;
    const firstVariantCompiled = Object.values(compiled.variants)[0]!;
    const strokeColor = firstVariantCompiled.layers.layers[0]?.style.stroke;
    expect(strokeColor).toBe('#ff0000');
  });
});

// ---------------------------------------------------------------------------
// projectFromSourceDir (filesystem)
// ---------------------------------------------------------------------------

describe('projectFromSourceDir', () => {
  test('reads source files from disk and produces a valid project', async () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });

    // Write payload to a temp directory
    const tempDir = await mkdtemp(path.join(tmpdir(), 'merge-to-build-'));
    try {
      for (const file of payload.files) {
        const filePath = path.join(tempDir, file.path);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, file.contents, 'utf8');
      }

      const restored = await projectFromSourceDir(tempDir, {
        name: 'Disk Test',
        tokenColors: project.tokenSet?.colors,
      });

      expect(isProject(restored)).toBeTrue();
      expect(Object.keys(restored.icons).length).toBe(Object.keys(project.icons).length);
      expect(restored.meta.name).toBe('Disk Test');

      // Verify it compiles
      const result = compileProject(restored, COMPILE_OPTIONS);
      expect(result.compiledIcons.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles empty icons directory', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'merge-to-build-empty-'));
    try {
      const manifest = {
        schemaVersion: '1.0.0',
        generatedAt: '2026-03-17T00:00:00.000Z',
        iconCount: 0,
        icons: {},
      };
      await writeFile(
        path.join(tempDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8',
      );

      const restored = await projectFromSourceDir(tempDir);

      expect(isProject(restored)).toBeTrue();
      expect(Object.keys(restored.icons).length).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-icon roundtrip
// ---------------------------------------------------------------------------

describe('multi-icon roundtrip', () => {
  test('handles project with multiple icons', () => {
    const project = makeProject();
    // Add a second icon
    project.icons['icon-star'] = {
      id: 'icon-star',
      name: 'Star',
      category: 'ratings',
      tags: ['star', 'favorite'],
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24] as [number, number, number, number],
          layers: {
            star: {
              id: 'star',
              role: 'primary' as const,
              path: { d: 'M12 2l3 7h7l-6 4 3 7-7-4-7 4 3-7-6-4h7z' },
              style: {
                fill: { mode: 'token' as const, token: 'accent' },
              },
            },
          },
        },
      },
    };

    const payload = exportSourcePayload(project, {
      generatedAt: '2026-03-17T00:00:00.000Z',
    });
    const restored = projectFromSourceFiles(payload.files, {
      name: '@hiero/icons',
      tokenColors: project.tokenSet?.colors,
      updatedAt: project.meta.updatedAt,
    });

    expect(Object.keys(restored.icons).length).toBe(2);
    expect(restored.icons['icon-chev']).toBeDefined();
    expect(restored.icons['icon-star']).toBeDefined();

    const result = compileProject(restored, COMPILE_OPTIONS);
    expect(result.compiledIcons.length).toBe(2);

    const manifestFile = result.files.find((f) => f.path === 'icons.manifest.json')!;
    const manifest = JSON.parse(manifestFile.contents) as PackageManifest;
    expect(manifest.package.iconCount).toBe(2);
  });
});

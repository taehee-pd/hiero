import { mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { buildIconsPackage, validateBuiltIconsPackage } from '../lib/export/icons-package';

const FIXTURE_PROJECT = path.join(process.cwd(), 'tests/fixtures/e2e/compiler-project.json');

async function createTempOutDir(): Promise<{ root: string; outDir: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'icons-package-test-'));
  return { root, outDir: path.join(root, 'dist/icons-package') };
}

describe('icons production package pipeline', () => {
  test('builds publishable package output shape', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      const result = await buildIconsPackage({
        projectPath: FIXTURE_PROJECT,
        outDir,
        packageName: '@contour/icons',
        packageVersion: '1.2.3',
        builtAt: '2026-03-10T00:00:00.000Z',
        fixtureProjectPathForValidation: FIXTURE_PROJECT,
      });

      expect(result.iconCount).toBeGreaterThan(0);

      const packageJson = JSON.parse(await readFile(path.join(outDir, 'package.json'), 'utf8')) as {
        exports: Record<string, string>;
      };
      const manifest = JSON.parse(await readFile(path.join(outDir, 'icons.manifest.json'), 'utf8')) as {
        icons: Record<string, { componentName: string; supportedSizes: number[] }>;
      };

      expect(packageJson.exports['.']).toBe('./generated/index.ts');
      expect(packageJson.exports['./collections']).toBe('./generated/collections/index.ts');

      const firstIcon = Object.values(manifest.icons)[0]!;
      expect(packageJson.exports[`./icons/${firstIcon.componentName}`]).toBeDefined();
      expect(packageJson.exports[`./sizes/${firstIcon.supportedSizes[0]}/${firstIcon.componentName}`]).toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('validates built package integrity from fixture project', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      await buildIconsPackage({
        projectPath: FIXTURE_PROJECT,
        outDir,
        packageName: '@contour/icons',
        packageVersion: '2.0.0',
      });

      await expect(
        validateBuiltIconsPackage(outDir, {
          packageName: '@contour/icons',
          packageVersion: '2.0.0',
        }),
      ).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails validation when required export target file is missing', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      await buildIconsPackage({
        projectPath: FIXTURE_PROJECT,
        outDir,
        packageName: '@contour/icons',
        packageVersion: '3.0.0',
      });

      const exportsMap = JSON.parse(
        await readFile(path.join(outDir, 'package.exports.generated.json'), 'utf8'),
      ) as Record<string, string>;
      const firstExportPath = Object.values(exportsMap)[0]!;
      await unlink(path.join(outDir, firstExportPath.replace(/^\.\//, '')));

      await expect(validateBuiltIconsPackage(outDir)).rejects.toThrow('export target');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails build when package version input is invalid', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      await expect(
        buildIconsPackage({
          projectPath: FIXTURE_PROJECT,
          outDir,
          packageName: '@contour/icons',
          packageVersion: 'not-semver',
        }),
      ).rejects.toThrow('Invalid package version');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails validation when manifest iconCount is inconsistent', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      await buildIconsPackage({
        projectPath: FIXTURE_PROJECT,
        outDir,
        packageName: '@contour/icons',
        packageVersion: '4.0.0',
      });

      const manifestPath = path.join(outDir, 'icons.manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        package: { iconCount: number };
      };
      manifest.package.iconCount = manifest.package.iconCount + 1;
      await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(validateBuiltIconsPackage(outDir)).rejects.toThrow('iconCount');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails validation when collection references unknown icon', async () => {
    const { root, outDir } = await createTempOutDir();

    try {
      await buildIconsPackage({
        projectPath: FIXTURE_PROJECT,
        outDir,
        packageName: '@contour/icons',
        packageVersion: '5.0.0',
      });

      const manifestPath = path.join(outDir, 'icons.manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        collections: Record<string, { name: string; iconIds: string[] }>;
      };
      manifest.collections = {
        invalid: { name: 'Invalid', iconIds: ['missing-icon'] },
      };
      await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(validateBuiltIconsPackage(outDir)).rejects.toThrow('references unknown icon');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

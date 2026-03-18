import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  isCompiledIcon,
  isIconChangeRecord,
  isPackageManifest,
} from '../lib/compiler-contracts';
import type { IconSet as Project } from '../lib/schema/types';
import { compileProject, runCompileCommand } from '../lib/export/compile-pipeline';
import e2eProjectFixture from './fixtures/e2e/compiler-project.json';

function makeProject(): Project {
  return structuredClone(e2eProjectFixture) as unknown as Project;
}

describe('compile pipeline end-to-end', () => {
  test('builds compiled icons + manifest + optional codegen artifacts', () => {
    const project = makeProject();
    const result = compileProject(project, {
      package: {
        name: '@icophone/icons',
        version: '2.0.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
      generateReact: true,
    });

    expect(result.files.some((file) => file.path === 'icons/icon-chev.compiled.json')).toBeTrue();
    expect(result.files.some((file) => file.path === 'icons.manifest.json')).toBeTrue();
    expect(result.files.some((file) => file.path === 'generated/index.ts')).toBeTrue();

    const compiledRaw = result.files.find((file) => file.path === 'icons/icon-chev.compiled.json')!;
    const manifestRaw = result.files.find((file) => file.path === 'icons.manifest.json')!;

    expect(isCompiledIcon(JSON.parse(compiledRaw.contents))).toBeTrue();
    expect(isPackageManifest(JSON.parse(manifestRaw.contents))).toBeTrue();
  });

  test('emits change records when previous compiled build is available', () => {
    const previousProject = makeProject();
    const previous = compileProject(previousProject, {
      package: {
        name: '@icophone/icons',
        version: '1.0.0',
        builtAt: '2026-03-09T00:00:00.000Z',
      },
    });
    const previousCompiled = Object.fromEntries(
      previous.compiledIcons.map((icon) => [icon.id, icon]),
    );

    const nextProject = makeProject();
    nextProject.icons['icon-chev']!.name = 'Chevron Updated';

    const result = compileProject(nextProject, {
      package: {
        name: '@icophone/icons',
        version: '1.1.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
      previousCompiledIcons: previousCompiled,
    });

    const changeFile = result.files.find((file) => file.path === 'changes/icon-chev.change.json');
    expect(changeFile).toBeDefined();
    expect(isIconChangeRecord(JSON.parse(changeFile!.contents))).toBeTrue();
  });

  test('runCompileCommand writes output files to disk', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'icophone-compile-'));
    const outDir = path.join(tempRoot, 'out');

    try {
      const projectPath = path.join(process.cwd(), 'tests/fixtures/e2e/compiler-project.json');
      await runCompileCommand({
        projectPath,
        outDir,
        packageName: '@icophone/icons',
        packageVersion: '2.0.0',
        builtAt: '2026-03-10T00:00:00.000Z',
        generateReact: true,
      });

      const manifestRaw = await readFile(path.join(outDir, 'icons.manifest.json'), 'utf8');
      const compiledRaw = await readFile(path.join(outDir, 'icons/icon-chev.compiled.json'), 'utf8');
      expect(isPackageManifest(JSON.parse(manifestRaw))).toBeTrue();
      expect(isCompiledIcon(JSON.parse(compiledRaw))).toBeTrue();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test('fails fast for invalid project input', () => {
    expect(() =>
      compileProject({} as unknown as Project, {
        package: {
          name: '@icophone/icons',
          version: '1.0.0',
          builtAt: '2026-03-10T00:00:00.000Z',
        },
      }),
    ).toThrow('Invalid project input for compile pipeline.');
  });
});

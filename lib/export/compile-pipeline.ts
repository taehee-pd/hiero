import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CompiledIcon, IconChangeRecord } from '@/lib/compiler-contracts';
import { isCompiledIcon, isIconChangeRecord } from '@/lib/compiler-contracts';
import type { Project } from '@/lib/schema/types';
import { isProject, isWorkspace } from '@/lib/schema/guards';
import { getActiveIconSet } from '@/lib/schema/workspace';
import { diffCompiledIcons } from './diff-compiled-icons';
import { exportCompiledIconFile } from './export-compiled-icon';
import {
  generatePackageManifestFile,
  validatePackageManifestOrThrow,
} from './export-package-manifest';
import { generateReactIconComponents } from './export-react-components';

export type CompilePipelineOptions = {
  package: {
    name: string;
    version: string;
    builtAt: string;
    gitSha?: string;
    gitBranch?: string;
  };
  previousCompiledIcons?: Record<string, CompiledIcon>;
  generateReact?: boolean;
};

export type CompilePipelineResult = {
  files: Array<{ path: string; contents: string }>;
  compiledIcons: CompiledIcon[];
  manifestPath: 'icons.manifest.json';
};

export function compileProject(
  project: Project,
  options: CompilePipelineOptions,
): CompilePipelineResult {
  if (!isProject(project)) {
    throw new Error('Invalid project input for compile pipeline.');
  }

  const compiledOutputs = Object.keys(project.icons)
    .sort((a, b) => a.localeCompare(b))
    .map((iconId) => {
      const output = exportCompiledIconFile(project, iconId);
      if (!isCompiledIcon(output.compiled)) {
        throw new Error(`Invalid compiled output for icon "${iconId}".`);
      }

      return {
        path: `icons/${output.path}`,
        contents: output.contents,
        compiled: output.compiled,
      };
    });

  const manifestFile = generatePackageManifestFile(
    compiledOutputs.map((entry) => ({ path: entry.path, compiled: entry.compiled })),
    {
      package: options.package,
    },
  );
  validatePackageManifestOrThrow(manifestFile.manifest);

  const files: CompilePipelineResult['files'] = compiledOutputs.map((entry) => ({
    path: entry.path,
    contents: entry.contents,
  }));
  files.push({ path: manifestFile.path, contents: manifestFile.contents });

  if (options.previousCompiledIcons) {
    const changeFiles = compiledOutputs
      .map((entry) => {
        const previous = options.previousCompiledIcons?.[entry.compiled.id];
        if (!previous) return null;

        const record = diffCompiledIcons(previous, entry.compiled, {
          publishedAt: options.package.builtAt,
        });

        if (!isIconChangeRecord(record)) {
          throw new Error(`Invalid change record for icon "${entry.compiled.id}".`);
        }

        return {
          path: `changes/${entry.compiled.id}.change.json`,
          contents: serializeCanonicalJson(record),
        };
      })
      .filter(Boolean) as Array<{ path: string; contents: string }>;

    files.push(...changeFiles);
  }

  if (options.generateReact) {
    const react = generateReactIconComponents(
      compiledOutputs.map((entry) => entry.compiled),
      manifestFile.manifest,
    );
    files.push(...react.files);
    files.push({
      path: 'package.exports.generated.json',
      contents: serializeCanonicalJson(react.exports),
    });
  }

  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    compiledIcons: compiledOutputs.map((entry) => entry.compiled),
    manifestPath: 'icons.manifest.json',
  };
}

export async function runCompileCommand(params: {
  projectPath: string;
  outDir: string;
  previousOutDir?: string;
  packageName: string;
  packageVersion: string;
  builtAt?: string;
  generateReact?: boolean;
}): Promise<CompilePipelineResult> {
  const rawProject = await readFile(params.projectPath, 'utf8');
  const parsedProject = JSON.parse(rawProject) as unknown;
  const project = isWorkspace(parsedProject)
    ? getActiveIconSet(parsedProject, parsedProject.activeIconSetId)
    : isProject(parsedProject)
      ? parsedProject
      : null;
  if (!project) {
    throw new Error(`Project file is invalid: ${params.projectPath}`);
  }

  const previousCompiledIcons = params.previousOutDir
    ? await loadCompiledIconsFromDir(params.previousOutDir)
    : undefined;

  const builtAt = params.builtAt ?? new Date().toISOString();
  const result = compileProject(project, {
    package: {
      name: params.packageName,
      version: params.packageVersion,
      builtAt,
    },
    previousCompiledIcons,
    generateReact: params.generateReact,
  });

  for (const file of result.files) {
    const targetPath = path.join(params.outDir, file.path);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.contents, 'utf8');
  }

  return result;
}

async function loadCompiledIconsFromDir(dir: string): Promise<Record<string, CompiledIcon>> {
  const iconsDir = path.join(dir, 'icons');
  try {
    const stats = await stat(iconsDir);
    if (!stats.isDirectory()) return {};
  } catch {
    return {};
  }

  const files = await readdir(iconsDir);
  const compiledFiles = files.filter((file) => file.endsWith('.compiled.json'));

  const compiledIcons = await Promise.all(
    compiledFiles.map(async (fileName) => {
      const raw = await readFile(path.join(iconsDir, fileName), 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isCompiledIcon(parsed)) {
        throw new Error(`Invalid compiled icon in previous build: ${fileName}`);
      }
      return parsed;
    }),
  );

  return Object.fromEntries(compiledIcons.map((icon) => [icon.id, icon]));
}

function serializeCanonicalJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)] as const),
    );
  }

  return value;
}

/**
 * `hiero build` — deterministic snapshot build (Lane 2).
 *
 * Reads canonical source from sourceDir, compiles all icons, and writes the
 * output to all configured local-directory releaseTargets.
 *
 * This is the CI-safe build command: same input → same output, always.
 *
 * Options:
 *   --config <path>   Path to hiero.config.ts
 *   --out <path>      Output directory override (bypasses releaseTargets)
 *
 * For git-pr and npm-registry targets, this command prints instructions.
 * Those workflows remain in the Lane 2 sync-service (hiero sync-pr / hiero publish).
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '@/lib/install-config';
import { projectFromSourceDir } from '@/lib/sync-source';
import { compileProject } from '@/lib/export/compile-pipeline';
import type { LocalDirectoryReleaseTarget } from '@/lib/install-config/types';

export async function runBuild(
  cwd: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  const configPath =
    typeof flags['config'] === 'string'
      ? path.resolve(cwd, flags['config'])
      : path.join(cwd, 'hiero.config.ts');

  const outOverride =
    typeof flags['out'] === 'string' ? flags['out'] : undefined;

  // Config
  if (!existsSync(configPath)) {
    console.error(`[hiero] Config not found: ${path.relative(cwd, configPath)}`);
    process.exit(1);
  }

  let config: import('@/lib/install-config/types').HieroConfig;
  try {
    const rawModule = (await import(configPath)) as { default?: unknown };
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[hiero] Config invalid:\n${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(
      `[hiero] Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const releaseTargets = config.releaseTargets ?? [];

  if (releaseTargets.length === 0 && !outOverride) {
    console.error(
      `[hiero] No releaseTargets configured and --out not provided.\n` +
        `         Add a local-directory target to hiero.config.ts or pass --out <dir>.`,
    );
    process.exit(1);
  }

  // Source
  const sourceDir = path.resolve(cwd, config.sourceDir);
  if (!existsSync(sourceDir)) {
    console.error(`[hiero] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`hiero init\` to create it`);
    process.exit(1);
  }

  console.log(`[hiero] Loading source from ${config.sourceDir}...`);

  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(
      `[hiero] Source read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const iconCount = Object.keys(project.icons).length;
  if (iconCount === 0) {
    console.warn(`[hiero] Warning: no icons found in ${config.sourceDir}. Build will produce an empty output.`);
  }

  console.log(`[hiero] Compiling ${iconCount} icon(s)...`);

  const builtAt = new Date().toISOString();
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: 'hiero-build',
        version: '0.0.0',
        builtAt,
      },
    });
  } catch (err) {
    console.error(
      `[hiero] Compile failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  // Determine output directories
  const localDirTargets: LocalDirectoryReleaseTarget[] = outOverride
    ? [{ kind: 'local-directory', outputMode: 'snapshot', outputDir: outOverride }]
    : (releaseTargets.filter(
        (t) => t.kind === 'local-directory',
      ) as LocalDirectoryReleaseTarget[]);

  // Write outputs
  for (const target of localDirTargets) {
    const outDir = path.resolve(cwd, target.outputDir);
    console.log(`[hiero] Writing to ${target.outputDir}...`);

    for (const file of compiled.files) {
      const targetPath = path.join(outDir, file.path);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.contents, 'utf8');
    }

    console.log(`         ${compiled.files.length} file(s) written`);
  }

  // Inform about other target kinds (handled by separate subcommands)
  for (const target of releaseTargets) {
    if (target.kind === 'git-pr') {
      console.log(
        `\n[hiero] git-pr target: ${target.owner}/${target.repo}\n` +
          `         To open a pull request, use the Create PR action in the Hiero editor.`,
      );
    }
    if (target.kind === 'npm-registry') {
      console.log(
        `\n[hiero] npm-registry target: ${target.packageName}\n` +
          `         To publish to npm, use the Release action in the Hiero editor.`,
      );
    }
  }

  const elapsedMs = Date.now() - new Date(builtAt).getTime();
  console.log(`\n[hiero] Build complete — ${iconCount} icon(s) in ${elapsedMs}ms`);
}

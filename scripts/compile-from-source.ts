#!/usr/bin/env bun

/**
 * Post-merge compile script: reads merged source export files from a repo
 * directory and runs the full compile/package pipeline.
 *
 * Usage:
 *   bun scripts/compile-from-source.ts \
 *     --source <icons-source-dir> \
 *     --out <out-dir> \
 *     --package-name <name> \
 *     --package-version <version> \
 *     [--previous-out <dir>] \
 *     [--built-at <iso>] \
 *     [--token-colors <tokens.json>] \
 *     [--generate-react]
 *
 * This is the primary CI entry point after a PR merge. It replaces the need
 * to maintain a project.json file in the repo — source export files (icon.json
 * + manifest.json) are the canonical source.
 */

import { readFile } from 'node:fs/promises';
import { projectFromSourceDir } from '../lib/sync-source/source-to-project';
import { runCompileCommand } from '../lib/export/compile-pipeline';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const sourceDir = getArg('--source');
  const outDir = getArg('--out');
  const packageName = getArg('--package-name');
  const packageVersion = getArg('--package-version');
  const previousOutDir = getArg('--previous-out');
  const builtAt = getArg('--built-at');
  const tokenColorsPath = getArg('--token-colors');
  const generateReact = process.argv.includes('--generate-react');

  if (!sourceDir || !outDir || !packageName || !packageVersion) {
    throw new Error(
      'Usage: bun scripts/compile-from-source.ts --source <icons-dir> --out <out-dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--token-colors <tokens.json>] [--generate-react]',
    );
  }

  // Load optional token colors
  let tokenColors: Record<string, string> | undefined;
  if (tokenColorsPath) {
    const raw = await readFile(tokenColorsPath, 'utf8');
    tokenColors = JSON.parse(raw) as Record<string, string>;
  }

  // Step 1: Reconstruct project from source export files
  const project = await projectFromSourceDir(sourceDir, {
    name: packageName,
    tokenColors,
  });

  process.stdout.write(`Loaded ${Object.keys(project.icons).length} icons from source export\n`);

  // Step 2: Write a temp project file and run through existing compile pipeline
  // We use the in-memory compileProject path via runCompileCommand's internal flow
  const { compileProject } = await import('../lib/export/compile-pipeline');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const result = compileProject(project, {
    package: {
      name: packageName,
      version: packageVersion,
      builtAt: builtAt ?? new Date().toISOString(),
    },
    generateReact,
  });

  // Write output files
  for (const file of result.files) {
    const targetPath = path.join(outDir, file.path);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.contents, 'utf8');
  }

  process.stdout.write(`Compiled ${result.compiledIcons.length} icons to ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

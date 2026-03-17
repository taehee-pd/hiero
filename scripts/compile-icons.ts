#!/usr/bin/env bun

/**
 * Compile icons from a project/workspace JSON file.
 *
 * NOTE: This script is for LOCAL DEVELOPMENT and TEST FIXTURES only.
 * Post-merge CI builds MUST use `compile-from-source.ts` instead,
 * which reads from the canonical source export files (icons/ + manifest.json).
 *
 * See lib/sync-source/source-of-truth.ts for the full decision rationale.
 */

import { runCompileCommand } from '../lib/export/compile-pipeline';
import { warnIfSourceExportExists } from '../lib/sync-source/source-of-truth';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const projectPath = getArg('--project');
  const outDir = getArg('--out');
  const packageName = getArg('--package-name');
  const packageVersion = getArg('--package-version');
  const previousOutDir = getArg('--previous-out');
  const builtAt = getArg('--built-at');
  const generateReact = process.argv.includes('--generate-react');

  if (!projectPath || !outDir || !packageName || !packageVersion) {
    throw new Error(
      'Usage: bun scripts/compile-icons.ts --project <project.json> --out <out-dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--generate-react]',
    );
  }

  // Guard: warn if canonical source export files also exist alongside this project
  const warning = await warnIfSourceExportExists(projectPath);
  if (warning) {
    process.stderr.write(`\n${warning}\n\n`);
  }

  const result = await runCompileCommand({
    projectPath,
    outDir,
    previousOutDir,
    packageName,
    packageVersion,
    builtAt,
    generateReact,
  });

  process.stdout.write(`Compiled ${result.compiledIcons.length} icons to ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

#!/usr/bin/env bun

import { validateBuiltIconsPackage } from '../lib/export/icons-package';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const outDir = getArg('--out') ?? 'dist/icons-package';
  const packageName = getArg('--package-name');
  const packageVersion = getArg('--package-version');

  await validateBuiltIconsPackage(outDir, {
    packageName,
    packageVersion,
  });

  process.stdout.write(`Icon package validation passed for ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

#!/usr/bin/env bun

import path from 'node:path';

import { buildIconsPackage } from '../lib/export/icons-package';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const projectPath = getArg('--project') ?? 'tests/fixtures/e2e/compiler-project.json';
  const outDir = getArg('--out') ?? 'dist/icons-package';
  const packageName = getArg('--package-name') ?? '@cuneiform/icons';
  const packageVersion = getArg('--package-version') ?? process.env.ICONS_PACKAGE_VERSION;
  const builtAt = getArg('--built-at');

  if (!packageVersion) {
    throw new Error(
      'Missing package version. Provide --package-version <semver> or set ICONS_PACKAGE_VERSION.',
    );
  }

  const result = await buildIconsPackage({
    projectPath,
    outDir,
    packageName,
    packageVersion,
    builtAt,
    fixtureProjectPathForValidation: path.join(process.cwd(), 'tests/fixtures/e2e/compiler-project.json'),
  });

  process.stdout.write(
    `Built icon package (${result.iconCount} icons) at ${result.outDir}\npackage.json: ${result.packageJsonPath}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

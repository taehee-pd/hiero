#!/usr/bin/env bun

import { spawn } from 'node:child_process';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed (${command} ${args.join(' ')}), exit code ${code}`));
      }
    });
  });
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const version = getArg('--package-version') ?? process.env.ICONS_PACKAGE_VERSION;
  const packageName = getArg('--package-name') ?? '@contour/icons';

  if (!version) {
    throw new Error('Missing package version. Provide --package-version <semver> or set ICONS_PACKAGE_VERSION.');
  }

  await run('bun', ['scripts/build-icons-package.ts', '--package-version', version, '--package-name', packageName]);
  await run('bun', ['scripts/validate-icons-package.ts', '--package-version', version, '--package-name', packageName]);
  await run('npm', ['pack', '--dry-run', './dist/icons-package']);

  process.stdout.write('Dry-run release completed successfully.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

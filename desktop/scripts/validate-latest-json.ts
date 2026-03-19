import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desktopRoot } from './build-utils';
import { validateLatestReleaseManifest } from './latest-release-manifest';

const latestJsonPath = readArgValue('--file') ?? Bun.argv[2] ?? join(desktopRoot, 'artifacts', 'latest.json');
const manifest = JSON.parse(readFileSync(latestJsonPath, 'utf8')) as unknown;

validateLatestReleaseManifest(manifest);

console.log(`Validated latest release manifest: ${latestJsonPath}`);

function readArgValue(flag: string) {
  const exactArg = Bun.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (exactArg) {
    return exactArg.slice(flag.length + 1).trim() || undefined;
  }

  const index = Bun.argv.findIndex((arg) => arg === flag);
  if (index === -1) return undefined;
  const nextValue = Bun.argv[index + 1];
  return nextValue?.trim() || undefined;
}

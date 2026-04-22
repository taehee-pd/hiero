#!/usr/bin/env bun

/**
 * Compile the hiero-ui-icons set and generate the package registry.
 *
 * Reads `packages/hiero-ui-icons/source/icons.json` and generates a
 * self-contained, tree-shakable React library under
 * `packages/hiero-ui-icons/generated/` via the existing
 * `generateIconLibrary` codegen. Each icon ships as its own module
 * embedding its schema and rendering via `<HieroIcon>`.
 *
 * Also writes `packages/hiero-ui-icons/src/registry.generated.ts`:
 * a typed `IconName` union + name → component map consumed by
 * `<Icon name="...">`.
 *
 * Deterministic: running twice yields byte-identical output. A
 * test in `tests/hiero-ui-icons.test.ts` asserts this.
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

import { generateIconLibrary } from '../lib/export/export-react/generate-library';
import type { IconSet } from '../lib/schema/types';

const ROOT = path.resolve(import.meta.dir, '..');
const PKG = path.join(ROOT, 'packages/hiero-ui-icons');
const SRC_PATH = path.join(PKG, 'source/icons.json');
const OUT_DIR = path.join(PKG, 'generated');
const REGISTRY_PATH = path.join(PKG, 'src/registry.generated.ts');

type ManifestEntry = {
  name: string;
  mirrorInRTL?: boolean;
};
type Manifest = { icons: ManifestEntry[] };

function kebabToPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function writeRegistry(iconSet: IconSet, manifest: Manifest): string {
  const entries = Object.keys(iconSet.icons).sort();
  const mirrorSet = new Set(
    manifest.icons.filter((e) => e.mirrorInRTL).map((e) => e.name),
  );

  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * GENERATED FILE — do not edit.');
  lines.push(' * Regenerate with `pnpm icons:build`.');
  lines.push(' */');
  lines.push('');
  for (const name of entries) {
    const comp = kebabToPascal(iconSet.icons[name]!.name || name);
    lines.push(`import { ${comp} } from '../generated/src/${comp}';`);
  }
  lines.push('');
  lines.push(
    `export const iconNames = ${JSON.stringify(entries, null, 2)} as const;`,
  );
  lines.push('');
  lines.push('export type IconName = (typeof iconNames)[number];');
  lines.push('');
  lines.push('export const iconRegistry = {');
  for (const name of entries) {
    const comp = kebabToPascal(iconSet.icons[name]!.name || name);
    lines.push(`  ${JSON.stringify(name)}: ${comp},`);
  }
  lines.push('} as const;');
  lines.push('');
  lines.push(
    `export const rtlMirrorIcons = new Set<IconName>(${JSON.stringify(
      [...mirrorSet].sort(),
    )});`,
  );
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const raw = await readFile(SRC_PATH, 'utf8');
  const iconSet = JSON.parse(raw) as IconSet;

  const manifestRaw = await readFile(
    path.join(PKG, 'source/manifest.json'),
    'utf8',
  );
  const manifest = JSON.parse(manifestRaw) as Manifest;

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const files = generateIconLibrary(iconSet, {
    outputDir: 'src',
    packageName: '@hiero/ui-icons',
  });

  for (const [relativePath, contents] of Object.entries(files).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    const targetPath = path.join(OUT_DIR, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, contents, 'utf8');
  }

  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await writeFile(REGISTRY_PATH, writeRegistry(iconSet, manifest), 'utf8');

  process.stdout.write(
    `Built ${Object.keys(iconSet.icons).length} icons → ${path.relative(ROOT, OUT_DIR)}\n`,
  );
  process.stdout.write(
    `Wrote registry → ${path.relative(ROOT, REGISTRY_PATH)}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

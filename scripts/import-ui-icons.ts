#!/usr/bin/env bun

/**
 * Bulk-import Lucide icons into the `hiero-ui-icons` IconSet.
 *
 * Reads `packages/hiero-ui-icons/source/manifest.json`, resolves each
 * entry through the existing Lucide adapter infrastructure, runs the
 * result through `importSvg()`, and writes a canonical `IconSet` to
 * `packages/hiero-ui-icons/source/icons.json`.
 *
 * Additive merge: icons already present in `icons.json` are preserved
 * unless `--overwrite` is passed. The existing `meta.externalImport`
 * trace distinguishes imported vs hand-edited icons.
 *
 * Runs in Node. Registers `happy-dom` globally so `importSvg()`'s
 * `DOMParser` dependency resolves server-side.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import type { Icon, IconSet, Variant, Layer } from '../lib/schema/types';

// happy-dom must be installed before any module that touches `DOMParser`.
if (typeof globalThis.DOMParser === 'undefined') {
  GlobalRegistrator.register();
}

// Dynamic requires so the DOM shim registration above runs first.
const requireFn = require;
const { loadLucideIcon, lucideNodesToSvg, getLucideVersion } =
  requireFn('../lib/import/adapters/lucide-source') as typeof import('../lib/import/adapters/lucide-source');
const { importSvg } =
  requireFn('../lib/import/import-svg') as typeof import('../lib/import/import-svg');
const { normalizeVariant } =
  requireFn('../lib/schema/types') as typeof import('../lib/schema/types');

type ManifestEntry = {
  name: string;
  mirrorInRTL?: boolean;
  filled?: boolean;
};

type Manifest = {
  sizes: number[];
  types: string[];
  icons: ManifestEntry[];
};

const ROOT = path.resolve(import.meta.dir, '..');
const PACKAGE_DIR = path.join(ROOT, 'packages/hiero-ui-icons');
const MANIFEST_PATH = path.join(PACKAGE_DIR, 'source/manifest.json');
const ICONS_PATH = path.join(PACKAGE_DIR, 'source/icons.json');

const ARG_OVERWRITE = process.argv.includes('--overwrite');

const ICON_SET_META = {
  name: 'hiero-ui-icons',
  version: '1.0' as const,
};

function kebabToCamel(kebab: string): string {
  return kebab.replace(/-(.)/g, (_m, c) => c.toUpperCase());
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function buildVariant(
  variantId: string,
  size: number,
  layers: Record<string, Layer>,
  viewBox: [number, number, number, number],
  entry: ManifestEntry,
): Variant {
  const styledLayers: Record<string, Layer> = {};
  for (const [layerId, layer] of Object.entries(layers)) {
    styledLayers[layerId] = {
      ...layer,
      style: {
        ...layer.style,
        stroke: entry.filled ? undefined : { mode: 'currentColor' },
        fill: entry.filled ? { mode: 'currentColor' } : undefined,
      },
    };
  }

  return normalizeVariant({
    id: variantId,
    name: `${size}`,
    size,
    viewBox,
    layers: styledLayers,
    defaultType: 'default',
  });
}

function buildIcon(
  entry: ManifestEntry,
  lucideSvg: string,
  sizes: number[],
  lucideVersion: string,
): Icon {
  const imported = importSvg(lucideSvg);
  const variants: Record<string, Variant> = {};

  for (const size of sizes) {
    const variantId = `v-${size}`;
    variants[variantId] = buildVariant(
      variantId,
      size,
      imported.layers,
      imported.viewBox,
      entry,
    );
  }

  return {
    id: entry.name,
    name: kebabToCamel(entry.name),
    tags: entry.mirrorInRTL ? ['rtl-mirror'] : undefined,
    variants,
    meta: {
      externalImport: {
        adapterId: 'lucide',
        sourceLibrary: 'lucide',
        sourceVersion: lucideVersion,
        sourceIconId: entry.name,
        sourceLicense: 'ISC',
        importedAt: new Date().toISOString(),
      },
    },
  };
}

async function loadExistingIconSet(): Promise<IconSet | null> {
  try {
    const raw = await readFile(ICONS_PATH, 'utf8');
    return JSON.parse(raw) as IconSet;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw) as Manifest;

  const existing = await loadExistingIconSet();
  const lucideVersion = getLucideVersion();
  const now = new Date().toISOString();

  const iconSet: IconSet = existing ?? {
    version: ICON_SET_META.version,
    meta: {
      name: ICON_SET_META.name,
      createdAt: now,
      updatedAt: now,
    },
    icons: {},
    types: Object.fromEntries(
      manifest.types.map((id) => [id, { id, name: id }]),
    ),
  };

  let added = 0;
  let skipped = 0;
  let replaced = 0;

  for (const entry of manifest.icons) {
    if (!ARG_OVERWRITE && iconSet.icons[entry.name]) {
      skipped += 1;
      continue;
    }

    const lucide = loadLucideIcon(entry.name);
    if (!lucide) {
      process.stderr.write(`SKIP: lucide icon not found: ${entry.name}\n`);
      continue;
    }

    const svg = lucideNodesToSvg(lucide.nodes);
    const icon = buildIcon(entry, svg, manifest.sizes, lucideVersion);

    if (iconSet.icons[entry.name]) {
      replaced += 1;
    } else {
      added += 1;
    }
    iconSet.icons[entry.name] = icon;
  }

  if (added > 0 || replaced > 0) {
    iconSet.meta.updatedAt = now;
  }

  await mkdir(path.dirname(ICONS_PATH), { recursive: true });
  await writeFile(ICONS_PATH, stableStringify(iconSet), 'utf8');

  process.stdout.write(
    `Imported: ${added} added, ${replaced} replaced, ${skipped} skipped. Total: ${Object.keys(iconSet.icons).length} icons.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});

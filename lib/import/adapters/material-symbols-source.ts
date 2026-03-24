/**
 * Material Symbols build-time manifest and runtime icon loading.
 *
 * Source: @material-symbols/svg-400 (Google's official npm package).
 * Variants: outlined, rounded, sharp.
 * Ships individual SVG files — no React components or node trees.
 *
 * @module
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaterialSymbolsVariant = 'outlined' | 'rounded' | 'sharp';

export type MaterialSymbolsManifestEntry = {
  name: string;
};

export type MaterialSymbolsIconData = {
  name: string;
  variant: MaterialSymbolsVariant;
  svgContent: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _MATERIAL_VARIANTS: MaterialSymbolsVariant[] = ['outlined', 'rounded', 'sharp'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cachedVersion: string | undefined;

export function getMaterialSymbolsVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = require.resolve('@material-symbols/svg-400/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version ?? 'unknown';
    return cachedVersion!;
  } catch {
    return 'unknown';
  }
}

let cachedManifest: MaterialSymbolsManifestEntry[] | undefined;

export function getMaterialSymbolsManifest(): MaterialSymbolsManifestEntry[] {
  if (cachedManifest) return cachedManifest;

  const dir = resolveMaterialDir('outlined');
  if (!dir) {
    cachedManifest = [];
    return cachedManifest;
  }

  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.svg') && !f.includes('-fill'),
  );
  cachedManifest = files.map((f) => ({
    name: f.replace(/\.svg$/, ''),
  }));

  return cachedManifest;
}

export function loadMaterialSymbol(
  iconName: string,
  variant: MaterialSymbolsVariant = 'outlined',
): MaterialSymbolsIconData | null {
  const dir = resolveMaterialDir(variant);
  if (!dir) return null;

  const filePath = join(dir, `${iconName}.svg`);
  if (!existsSync(filePath)) return null;

  let svgContent = readFileSync(filePath, 'utf8');

  // Normalize: Material Symbols SVGs use viewBox "0 -960 960 960" and
  // width/height of 48. Normalize to standard 24x24 for Coniva.
  svgContent = svgContent
    .replace(/width="\d+"/, 'width="24"')
    .replace(/height="\d+"/, 'height="24"');

  return { name: iconName, variant, svgContent };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function resolveMaterialDir(variant: string): string | null {
  try {
    const pkgPath = require.resolve('@material-symbols/svg-400/package.json');
    const dir = join(pkgPath, '..', variant);
    return existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

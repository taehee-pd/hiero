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

  svgContent = normalizeMaterialSymbolSvg(svgContent);

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

function normalizeMaterialSymbolSvg(svgContent: string): string {
  const rootMatch = svgContent.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!rootMatch) return svgContent;

  const rootAttributes = rootMatch[1] ?? '';
  const innerContent = (rootMatch[2] ?? '').trim();
  const xmlns = extractSvgRootAttribute(rootAttributes, 'xmlns') ?? 'http://www.w3.org/2000/svg';

  // Material Symbols are authored in a 960x960 coordinate system with
  // viewBox "0 -960 960 960". Wrap source paths in a transform so they map
  // to a canonical 24x24 coordinate space while preserving path geometry.
  const normalizedInner = `<g transform="translate(0 24) scale(0.025)">${innerContent}</g>`;

  return `<svg xmlns="${xmlns}" width="24" height="24" viewBox="0 0 24 24">${normalizedInner}</svg>`;
}

function extractSvgRootAttribute(rootAttributes: string, attributeName: string): string | null {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*"([^"]*)"`, 'i');
  const match = rootAttributes.match(pattern);
  return match?.[1] ?? null;
}

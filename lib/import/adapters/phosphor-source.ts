/**
 * Phosphor Icons build-time manifest and runtime icon loading.
 *
 * Source: @phosphor-icons/core — ships raw SVG files in assets/{weight}/.
 * 6 weights: thin, light, regular, bold, fill, duotone.
 *
 * Weight mapping to Contour:
 * - thin → ultralight
 * - light → light
 * - regular → regular
 * - bold → bold
 * - fill → skip (rendering style, not weight)
 * - duotone → skip (multi-layer style)
 *
 * @module
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhosphorWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

export type PhosphorManifestEntry = {
  name: string;
};

export type PhosphorIconData = {
  name: string;
  weight: PhosphorWeight;
  svgContent: string;
};

// ---------------------------------------------------------------------------
// Weight mapping
// ---------------------------------------------------------------------------

/**
 * Phosphor weight → Contour weight name mapping.
 * Only weights that map to Contour's weight system are included.
 * fill and duotone are rendering styles, not weights.
 */
export const PHOSPHOR_WEIGHT_MAP: Record<string, string> = {
  thin: 'ultralight',
  light: 'light',
  regular: 'regular',
  bold: 'bold',
};

export const PHOSPHOR_WEIGHTS: PhosphorWeight[] = [
  'thin', 'light', 'regular', 'bold', 'fill', 'duotone',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cachedVersion: string | undefined;

export function getPhosphorVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = require.resolve('@phosphor-icons/core/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version ?? 'unknown';
    return cachedVersion!;
  } catch {
    return 'unknown';
  }
}

let cachedManifest: PhosphorManifestEntry[] | undefined;

export function getPhosphorManifest(): PhosphorManifestEntry[] {
  if (cachedManifest) return cachedManifest;

  const dir = resolvePhosphorDir('regular');
  if (!dir) {
    cachedManifest = [];
    return cachedManifest;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
  cachedManifest = files.map((f) => ({
    name: f.replace(/\.svg$/, ''),
  }));

  return cachedManifest;
}

export function loadPhosphorIcon(
  iconName: string,
  weight: PhosphorWeight = 'regular',
): PhosphorIconData | null {
  const dir = resolvePhosphorDir(weight);
  if (!dir) return null;

  // Phosphor uses suffixed filenames: e.g. "acorn-thin.svg" in the thin/ dir
  // The regular weight has no suffix: "acorn.svg"
  const suffix = weight === 'regular' ? '' : `-${weight}`;
  const filePath = join(dir, `${iconName}${suffix}.svg`);
  if (!existsSync(filePath)) return null;

  const svgContent = readFileSync(filePath, 'utf8');
  return { name: iconName, weight, svgContent };
}

/**
 * Load weight control point paths for an icon.
 * Returns { ultralight, light, regular, bold } d-strings,
 * or null for weights where the icon doesn't exist.
 */
export function loadPhosphorWeightPaths(
  iconName: string,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  for (const [phosphorWeight, contourWeight] of Object.entries(PHOSPHOR_WEIGHT_MAP)) {
    const data = loadPhosphorIcon(iconName, phosphorWeight as PhosphorWeight);
    if (data) {
      const d = extractFirstPathD(data.svgContent);
      result[contourWeight] = d;
    } else {
      result[contourWeight] = null;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function resolvePhosphorDir(weight: string): string | null {
  try {
    const pkgPath = require.resolve('@phosphor-icons/core/package.json');
    const dir = join(pkgPath, '..', 'assets', weight);
    return existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

function extractFirstPathD(svg: string): string | null {
  const match = svg.match(/<path[^>]+d="([^"]+)"/);
  return match?.[1] ?? null;
}

/**
 * Heroicons build-time manifest and runtime icon loading.
 *
 * Heroicons ships as React component .js files via @heroicons/react.
 * We extract SVG by reading the React.createElement calls and
 * reconstructing the SVG string. This avoids needing a browser or
 * React runtime for extraction.
 *
 * @module
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeroiconsManifestEntry = {
  name: string;
  variant: 'outline' | 'solid';
};

export type HeroiconsIconData = {
  name: string;
  variant: 'outline' | 'solid';
  svgContent: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEROICONS_VARIANTS = ['outline', 'solid'] as const;
const HEROICONS_SIZE = 24;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cachedVersion: string | undefined;

export function getHeroiconsVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = require.resolve('@heroicons/react/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version ?? 'unknown';
    return cachedVersion!;
  } catch {
    return 'unknown';
  }
}

let cachedManifest: HeroiconsManifestEntry[] | undefined;

export function getHeroiconsManifest(): HeroiconsManifestEntry[] {
  if (cachedManifest) return cachedManifest;

  const entries: HeroiconsManifestEntry[] = [];

  for (const variant of HEROICONS_VARIANTS) {
    const dir = resolveHeroiconsDir(variant);
    if (!dir) continue;
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.js') && !f.endsWith('.d.ts'),
    );
    for (const file of files) {
      const name = file
        .replace(/Icon\.js$/, '')
        .replace(/\.js$/, '');
      entries.push({ name: toKebab(name), variant });
    }
  }

  // Deduplicate by name (prefer outline over solid for manifest listing)
  const seen = new Set<string>();
  cachedManifest = entries.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });

  return cachedManifest;
}

export function loadHeroicon(
  iconName: string,
  variant: 'outline' | 'solid' = 'outline',
): HeroiconsIconData | null {
  const dir = resolveHeroiconsDir(variant);
  if (!dir) return null;

  // Convert kebab-case to PascalCase + "Icon" suffix
  const pascalName = toPascal(iconName) + 'Icon';
  const filePath = join(dir, `${pascalName}.js`);

  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const svgContent = extractSvgFromReactComponent(source, variant);
  if (!svgContent) return null;

  return { name: iconName, variant, svgContent };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function resolveHeroiconsDir(variant: string): string | null {
  try {
    const pkgPath = require.resolve('@heroicons/react/package.json');
    return join(pkgPath, '..', '24', variant);
  } catch {
    return null;
  }
}

/**
 * Extract SVG from a Heroicons React component .js file.
 * The file looks like:
 * ```
 * React.createElement("svg", { xmlns: ..., fill: "none", viewBox: "0 0 24 24", ... },
 *   React.createElement("path", { d: "...", ... }),
 * )
 * ```
 */
function extractSvgFromReactComponent(
  source: string,
  variant: 'outline' | 'solid',
): string | null {
  // Extract all path d attributes
  const pathMatches = [...source.matchAll(/d:\s*"([^"]+)"/g)];
  if (pathMatches.length === 0) return null;

  const fillAttr = variant === 'outline' ? 'none' : 'currentColor';
  const strokeAttr = variant === 'outline' ? 'currentColor' : 'none';

  const paths = pathMatches
    .map((m) => {
      if (variant === 'outline') {
        return `<path d="${m[1]}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
      }
      return `<path d="${m[1]}" fill="currentColor"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HEROICONS_SIZE} ${HEROICONS_SIZE}" fill="${fillAttr}" stroke="${strokeAttr}">${paths}</svg>`;
}

function toKebab(pascalCase: string): string {
  return pascalCase
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toPascal(kebabCase: string): string {
  return kebabCase
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

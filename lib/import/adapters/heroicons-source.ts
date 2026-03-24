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
  const pathElements = extractPathElements(source, variant);
  if (pathElements.length === 0) return null;

  const fillAttr = variant === 'outline' ? 'none' : 'currentColor';
  const strokeAttr = variant === 'outline' ? 'currentColor' : 'none';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HEROICONS_SIZE} ${HEROICONS_SIZE}" fill="${fillAttr}" stroke="${strokeAttr}">${pathElements.join('')}</svg>`;
}

function extractPathElements(source: string, variant: 'outline' | 'solid'): string[] {
  const pathCallMatches = [...source.matchAll(/createElement\("path",\s*\{([^}]*)\}/g)];

  return pathCallMatches
    .map((match) => {
      const props = parseReactPropsObject(match[1] ?? '');
      const d = props.get('d');
      if (!d) return null;

      // Preserve source path semantics (fill-rule, stroke-linecap, etc.).
      // Only add canonical defaults when absent.
      if (variant === 'outline') {
        if (!props.has('fill')) props.set('fill', 'none');
        if (!props.has('stroke')) props.set('stroke', 'currentColor');
        if (!props.has('strokeWidth') && !props.has('stroke-width')) {
          props.set('stroke-width', '1.5');
        }
      } else if (!props.has('fill')) {
        props.set('fill', 'currentColor');
      }

      const attributes = serializeSvgAttributes(props);
      return `<path ${attributes}/>`;
    })
    .filter((value): value is string => Boolean(value));
}

function parseReactPropsObject(objectLiteral: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const match of objectLiteral.matchAll(/([A-Za-z_$][\w$]*):\s*"([^"]*)"/g)) {
    const key = match[1];
    const value = match[2];
    if (!key || value === undefined) continue;
    props.set(key, value);
  }
  return props;
}

function serializeSvgAttributes(props: Map<string, string>): string {
  const attributePairs = [...props.entries()].map(([key, value]) => [
    toSvgAttributeName(key),
    value,
  ]);

  return attributePairs
    .map(([key, value]) => `${key}="${escapeSvgAttribute(value)}"`)
    .join(' ');
}

function toSvgAttributeName(key: string): string {
  if (key === 'className') return 'class';
  if (key.includes('-')) return key;
  return key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

function escapeSvgAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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

/**
 * Lucide Source Resolver
 *
 * Reads Lucide icon data from the installed `lucide-react` package and
 * reconstructs SVG markup. This abstraction keeps all Lucide-specific
 * filesystem and data-format knowledge isolated from the adapter.
 *
 * Lucide icons store their geometry as an `__iconNode` array:
 *   [["tagName", { d: "...", key: "..." }], ...]
 *
 * Each element uses the standard Lucide defaults:
 *   - viewBox="0 0 24 24"
 *   - fill="none"
 *   - stroke="currentColor"
 *   - stroke-width="2"
 *   - stroke-linecap="round"
 *   - stroke-linejoin="round"
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LucideIconNode = [string, Record<string, string>];

export type LucideIconData = {
  name: string;
  nodes: LucideIconNode[];
};

export type LucideIconManifestEntry = {
  /** Kebab-case icon name (e.g. "arrow-right"). */
  name: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LUCIDE_VIEWBOX = '0 0 24 24';
const LUCIDE_SVG_ATTRS = [
  'xmlns="http://www.w3.org/2000/svg"',
  'width="24"',
  'height="24"',
  `viewBox="${LUCIDE_VIEWBOX}"`,
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="2"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
].join(' ');

// ---------------------------------------------------------------------------
// Package path resolution
// ---------------------------------------------------------------------------

function resolveIconsDir(): string {
  // The icons live in lucide-react/dist/esm/icons/
  try {
    const pkgPath = require.resolve('lucide-react/package.json');
    return join(pkgPath, '..', 'dist', 'esm', 'icons');
  } catch {
    throw new Error(
      'Lucide source resolver: could not find lucide-react package. ' +
      'Ensure it is installed: pnpm add lucide-react',
    );
  }
}

let cachedVersion: string | undefined;

export function getLucideVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = require.resolve('lucide-react/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version ?? 'unknown';
    return cachedVersion!;
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Icon manifest (lazy-loaded list of all available icons)
// ---------------------------------------------------------------------------

let cachedManifest: LucideIconManifestEntry[] | undefined;

export function getLucideManifest(): LucideIconManifestEntry[] {
  if (cachedManifest) return cachedManifest;

  const dir = resolveIconsDir();
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.js') && !f.endsWith('.js.map'),
  );

  cachedManifest = files.map((f) => ({
    name: f.replace(/\.js$/, ''),
  }));

  return cachedManifest;
}

// ---------------------------------------------------------------------------
// Icon data extraction
// ---------------------------------------------------------------------------

/**
 * Read the raw ESM source for an icon and extract its `__iconNode` array.
 */
export function loadLucideIcon(iconName: string): LucideIconData | null {
  const dir = resolveIconsDir();
  return loadIconFromDir(dir, iconName, new Set());
}

function loadIconFromDir(
  dir: string,
  iconName: string,
  visited: Set<string>,
): LucideIconData | null {
  if (visited.has(iconName)) return null; // circular re-export guard
  visited.add(iconName);

  const filePath = join(dir, `${iconName}.js`);

  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  // Try to extract __iconNode directly
  const nodes = parseIconNodes(source);
  if (nodes) return { name: iconName, nodes };

  // Handle re-exports: `export { default } from './house.js';`
  const reExport = source.match(/from\s+['"]\.\/([\w-]+)\.js['"]/);
  if (reExport?.[1]) {
    return loadIconFromDir(dir, reExport[1], visited);
  }

  return null;
}

/**
 * Parse the `__iconNode` array from an ESM icon module source.
 * Uses a targeted regex + JSON.parse approach — no eval.
 */
function parseIconNodes(source: string): LucideIconNode[] | null {
  // Match: const __iconNode = [ ... ];
  const match = source.match(/const __iconNode\s*=\s*(\[[\s\S]*?\]);/);
  if (!match?.[1]) return null;

  try {
    // The array uses JS object syntax { d: "...", key: "..." }
    // We need to convert it to valid JSON:
    //   - Quote property names
    //   - This is safe because Lucide values are always simple strings
    let jsonLike = match[1];

    // Replace unquoted property names: `{ d: "..." }` → `{ "d": "..." }`
    jsonLike = jsonLike.replace(
      /(\{)\s*([a-zA-Z_]\w*)\s*:/g,
      '$1 "$2":',
    );
    // Handle subsequent properties: `, key: "..."` → `, "key": "..."`
    jsonLike = jsonLike.replace(
      /,\s*([a-zA-Z_]\w*)\s*:/g,
      ', "$1":',
    );

    return JSON.parse(jsonLike) as LucideIconNode[];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SVG reconstruction
// ---------------------------------------------------------------------------

/**
 * Reconstruct a complete SVG string from Lucide icon node data.
 *
 * Uses the standard Lucide SVG attributes (fill=none, stroke=currentColor,
 * stroke-width=2, stroke-linecap=round, stroke-linejoin=round).
 */
export function lucideNodesToSvg(nodes: LucideIconNode[]): string {
  const inner = nodes
    .map(([tag, attrs]) => {
      const attrPairs = Object.entries(attrs)
        .filter(([key]) => key !== 'key') // Remove React-specific key
        .map(([key, value]) => `${key}="${escapeAttrValue(value)}"`)
        .join(' ');
      return `<${tag} ${attrPairs}/>`;
    })
    .join('');

  return `<svg ${LUCIDE_SVG_ATTRS}>${inner}</svg>`;
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

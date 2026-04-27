#!/usr/bin/env bun
/**
 * Page Registry Coverage Check.
 *
 * Walks every `app/**\/page.tsx` (Next.js App Router page files) and verifies:
 *
 *   1. The file calls `definePage(`. Pages that don't enrol bypass the
 *      registry and could silently render whatever shell they want.
 *   2. The route key passed to `definePage()` is declared in PAGE_REGISTRY.
 *      A page calling `definePage({ route: '/new-route' })` without adding
 *      `/new-route` to the registry must fail before merge.
 *   3. Every route in PAGE_REGISTRY has a backing `page.tsx`. Stale registry
 *      entries are misleading documentation.
 *
 * Mirrors `scripts/check-ds-exports.ts` in style and message format. Wired
 * into `pnpm test` (see package.json `test` script).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import {
  PAGE_REGISTRY,
  REGISTERED_ROUTES,
  type RoutePath,
} from '../lib/routes/page-registry';

const ROOT = resolve(import.meta.dir, '..');
const APP_DIR = resolve(ROOT, 'app');

// ---------------------------------------------------------------------------
// 1. Walk app/**/page.tsx, skipping the Next.js conventions whose names
//    don't (or shouldn't) become routes:
//
//      _x         private folder              app/_storybook/
//      (x)        route group                 app/(marketing)/
//      (.)x       intercepting route          app/(.)photo/
//      (..)x      intercepting route          app/(..)photo/
//      (...)x     intercepting route          app/(...)photo/
//      @x         parallel route slot         app/@modal/
//      .x         hidden                      app/.cache/
//
//   The previous version only matched (...) when both ( and ) were the
//   first/last char of the segment, which let intercepting routes through
//   and produced misleading "add '/(.)foo' to the registry" advice.
// ---------------------------------------------------------------------------

const SKIP_DIR_RE = /^(_|\.|@|\(\.{1,3}\).*|\(.*\))/;

function walk(dir: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_RE.test(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, hits);
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      hits.push(full);
    }
  }
  return hits;
}

function fileToRoute(absPath: string): string {
  const rel = relative(APP_DIR, absPath).split(sep).slice(0, -1).join('/');
  return rel === '' ? '/' : `/${rel}`;
}

const pageFiles = existsSync(APP_DIR) ? walk(APP_DIR) : [];

// Fail loudly if the walker finds zero pages. Without this guard, a
// future "src/app" migration or a typo in APP_DIR would print
// "All pages enrolled" against an empty set and exit 0 — silently
// removing the gate this script exists to provide.
if (pageFiles.length === 0) {
  console.error(
    `❌ scripts/check-page-registry.ts found 0 page files under ${APP_DIR}.`,
  );
  console.error(
    `   This script's whole job is checking that every Next.js page enrols`,
  );
  console.error(
    `   in PAGE_REGISTRY. Zero pages probably means the app/ tree moved.`,
  );
  console.error(`   Update APP_DIR in this script to match the new location.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Verify each page file
// ---------------------------------------------------------------------------

const errors: string[] = [];
const seenRoutes = new Set<string>();

for (const pageFile of pageFiles) {
  const relPath = relative(ROOT, pageFile);
  const route = fileToRoute(pageFile);
  seenRoutes.add(route);

  const source = readFileSync(pageFile, 'utf-8');

  // Check 1: page calls definePage(
  if (!/\bdefinePage\s*\(/.test(source)) {
    errors.push(
      [
        `${relPath} does not call definePage().`,
        `  Add at the top of the file:`,
        `    import { definePage } from '@/lib/routes/define-page';`,
        `  And replace the default export with:`,
        `    export default function Page() {`,
        `      return definePage({ route: '${route}' });`,
        `    }`,
        `  See lib/routes/page-registry.ts for the registry; add '${route}'`,
        `  there too if it isn't already listed.`,
      ].join('\n'),
    );
    continue;
  }

  // Check 2: route the page passed to definePage exists in the registry.
  // We grep for route literals in the file rather than parsing JSX — the
  // existing scripts/check-ds-exports.ts uses the same regex-only pattern.
  if (!REGISTERED_ROUTES.includes(route as RoutePath)) {
    errors.push(
      [
        `${relPath} renders route '${route}' but PAGE_REGISTRY has no entry.`,
        `  Add to lib/routes/page-registry.ts:`,
        ``,
        `    export type RoutePath =`,
        `      | '${route}'   // ← add this`,
        `      | ...;`,
        ``,
        `    export const PAGE_REGISTRY = {`,
        `      '${route}': { kind: 'shell', shell: 'StudioLayout' },  // ← or 'redirect' / 'standalone'`,
        `      ...`,
        `    } as const satisfies Record<RoutePath, PageDefinition>;`,
      ].join('\n'),
    );
    continue;
  }

  // Check 3: the route literal the page passed to definePage matches its
  // file path. This catches copy-paste mistakes like editing /foo/page.tsx
  // and forgetting to update its definePage({ route: '/bar' }) argument.
  const routeLiteralRe = /definePage\s*\(\s*\{\s*route:\s*['"]([^'"]+)['"]/;
  const m = source.match(routeLiteralRe);
  if (m && m[1] !== route) {
    errors.push(
      [
        `${relPath} declared route '${m[1]}' in definePage() but its file path resolves to '${route}'.`,
        `  Change the literal to match the file path:`,
        `    definePage({ route: '${route}', ... })`,
      ].join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Verify every registered route has a backing page file
// ---------------------------------------------------------------------------

for (const registered of REGISTERED_ROUTES) {
  if (!seenRoutes.has(registered)) {
    errors.push(
      [
        `PAGE_REGISTRY declares '${registered}' but no app/**/page.tsx renders it.`,
        `  Either remove the entry from lib/routes/page-registry.ts, or add the file:`,
        `    app${registered === '/' ? '' : registered}/page.tsx`,
      ].join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------

console.log(`Page registry coverage: ${pageFiles.length} page file(s) checked`);
for (const pageFile of pageFiles) {
  console.log(`  ✓ ${relative(ROOT, pageFile)} → ${fileToRoute(pageFile)}`);
}

if (errors.length > 0) {
  console.error('');
  console.error(`❌ ${errors.length} issue(s):`);
  for (const err of errors) {
    console.error('');
    console.error(`  • ${err}`);
  }
  console.error('');
  console.error(
    `Why this matters: see lib/routes/page-registry.ts header comment.`,
  );
  process.exit(1);
} else {
  console.log('');
  console.log(`✅ All pages enrolled in PAGE_REGISTRY (${PAGE_REGISTRY['/']!.kind === 'shell' ? PAGE_REGISTRY['/'].shell : 'no root shell'} at /).`);
}

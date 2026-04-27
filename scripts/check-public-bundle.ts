#!/usr/bin/env bun
/**
 * Public-build bundle isolation check.
 *
 * Run after `NEXT_PUBLIC_BUILD_CHANNEL=public bun run build`. Asserts that
 * the resulting `.next/` artifact contains no fingerprints of internal-
 * only data — specifically, the canonical `@hiero/ui-icons` source set
 * loaded by `lib/integrations/hiero-ui-icons-source.ts`.
 *
 * The toolbar gates that helper behind a `process.env.NEXT_PUBLIC_BUILD_CHANNEL
 * !== 'internal'` literal so Webpack constant-folds the gate and dead-
 * code-eliminates the dynamic import in public builds. This script is the
 * empirical check that the folding actually worked — without it, a
 * future refactor (changing the gate from a literal to an imported
 * constant, say) silently re-introduces the leak.
 *
 * Usage:
 *   NEXT_PUBLIC_BUILD_CHANNEL=public bun run build
 *   bun scripts/check-public-bundle.ts
 *
 * Exit codes:
 *   0 — public bundle clean.
 *   1 — fingerprint found in user-facing static chunks (hard fail).
 *   2 — fingerprint found in server chunks only (warn — server bundles
 *       aren't shipped to client browsers, but a misconfigured deploy
 *       could expose them).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const NEXT_DIR = resolve(ROOT, '.next');
const OUT_DIR = resolve(ROOT, 'out');

// `.next/` is the always-present build output. `out/` only exists when
// NEXT_OUTPUT_MODE=export was set; in that case the user-facing artifact
// is `out/` and `.next/` only holds intermediate state. Scan both so the
// check works for either output mode without the caller having to know
// which one ran.
if (!existsSync(NEXT_DIR) && !existsSync(OUT_DIR)) {
  console.error(
    `❌ Neither ${NEXT_DIR} nor ${OUT_DIR} exists. Run \`NEXT_PUBLIC_BUILD_CHANNEL=public bun run build\` first.`,
  );
  process.exit(1);
}

// Fingerprints unique to icons.json's envelope. The path-d strings in
// individual icons also appear in `packages/hiero-ui-icons/generated/src/*.tsx`
// (which legitimately ships in public builds because that's the icon
// component output), so they're NOT reliable fingerprints — they trigger
// false positives on every build. The icon-set-level meta name only
// appears in icons.json itself.
const FINGERPRINTS = [
  // The set-level meta name from icons.json#meta.name. Not a package
  // name, not a chunk ID, not a string anywhere else in the codebase.
  '"name":"hiero-ui-icons"',
  '"name": "hiero-ui-icons"',
  // The integration helper's distinctive error message — only appears in
  // lib/integrations/hiero-ui-icons-source.ts. If the helper module is
  // bundled into a public chunk, this string comes with it.
  'failed isProject(); the bundled source file is malformed',
];

// Files that mention paths but don't actually leak data — these are
// deployment manifests Webpack/Next.js writes for tracing, not artifacts
// shipped to clients.
const PATH_MANIFEST_RE = /\.nft\.json$/;
// Sourcemaps live alongside server chunks but aren't shipped publicly.
// We warn rather than fail when they match.
const SOURCEMAP_RE = /\.map$/;

type Match = {
  file: string;
  fingerprint: string;
  isStatic: boolean;
  isSourcemap: boolean;
};

function walk(dir: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, hits);
    } else {
      hits.push(full);
    }
  }
  return hits;
}

const STATIC_DIR = resolve(NEXT_DIR, 'static');
const SERVER_DIR = resolve(NEXT_DIR, 'server');

// User-facing files: .next/static/* (default mode) AND out/* (export mode).
// In export mode `out/` IS the deployed artifact; missing it would leave
// the largest leak surface unchecked.
const staticFiles = [
  ...(existsSync(STATIC_DIR) ? walk(STATIC_DIR) : []),
  ...(existsSync(OUT_DIR) ? walk(OUT_DIR) : []),
];
const serverFiles = existsSync(SERVER_DIR) ? walk(SERVER_DIR) : [];

const matches: Match[] = [];

function scan(file: string, isStatic: boolean): void {
  if (PATH_MANIFEST_RE.test(file)) return; // path traces, not data leaks
  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    return; // binary or unreadable — skip
  }
  for (const fp of FINGERPRINTS) {
    if (content.includes(fp)) {
      matches.push({
        file,
        fingerprint: fp,
        isStatic,
        isSourcemap: SOURCEMAP_RE.test(file),
      });
    }
  }
}

for (const file of staticFiles) scan(file, true);
for (const file of serverFiles) scan(file, false);

const userFacingLeaks = matches.filter((m) => m.isStatic && !m.isSourcemap);
const serverChunkLeaks = matches.filter((m) => !m.isStatic && !m.isSourcemap);
const sourcemapMatches = matches.filter((m) => m.isSourcemap);

const summarise = (label: string, list: Match[]) => {
  if (list.length === 0) return;
  console.error(`\n  ${label}:`);
  for (const m of list) {
    const rel = m.file.startsWith(ROOT) ? m.file.slice(ROOT.length + 1) : m.file;
    console.error(`    • ${rel}`);
    console.error(`      fingerprint: ${m.fingerprint}`);
  }
};

console.log(
  `Public-bundle check: ${staticFiles.length} static + ${serverFiles.length} server file(s) scanned`,
);

if (userFacingLeaks.length > 0) {
  console.error(
    `\n❌ Public bundle leaks internal data into user-facing chunks (.next/static/).`,
  );
  summarise('User-facing leaks', userFacingLeaks);
  console.error(
    '\nRoot cause is almost always the gating in components/editor/Toolbar.tsx',
  );
  console.error(
    'or components/studio/Navbar.tsx using an imported constant (which the',
  );
  console.error(
    'bundler does NOT fold across module boundaries) instead of the env-var',
  );
  console.error(
    'literal `process.env.NEXT_PUBLIC_BUILD_CHANNEL`. Restore the literal',
  );
  console.error('and re-run.');
  process.exit(1);
}

if (serverChunkLeaks.length > 0) {
  console.error(
    `\n⚠️  Public bundle leaks internal data into server chunks (.next/server/).`,
  );
  console.error(
    `Server chunks aren't shipped to client browsers but a misconfigured`,
  );
  console.error(`deploy could expose them. Investigate:`);
  summarise('Server-only leaks', serverChunkLeaks);
  process.exit(2);
}

if (sourcemapMatches.length > 0) {
  console.log(
    `(sourcemaps contain internal references — not exposed publicly, ignored: ${sourcemapMatches.length})`,
  );
}

console.log('✅ Public bundle is clean — no internal-data fingerprints found.');

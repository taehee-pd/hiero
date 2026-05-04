#!/usr/bin/env bun
/**
 * W4-9 build guard — verify debug-only diagnostics never reach the
 * production bundle.
 *
 * Production = `NEXT_PUBLIC_HIERO_DEBUG !== '1'`. The
 * `TransitionDebugPill` component (and any future debug surface)
 * gates on the env-var literal so Webpack's constant-folding strips
 * the body in production. This script greps the built `.next/`
 * output for debug-only string fingerprints; CI fails if any
 * appear in user-facing chunks.
 *
 * Sister to `scripts/check-public-bundle.ts` which guards the
 * internal-build channel. Same pattern.
 *
 * Usage:
 *   bun run build                                      # build first
 *   bun scripts/check-debug-not-in-prod.ts             # then check
 *
 * Skipped if `.next/` doesn't exist (a fresh checkout's `pnpm test`
 * runs before any build); in that case the script logs and exits
 * with a non-error code so it never blocks local development.
 *
 * Mirrors the style of `scripts/check-page-registry.ts`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const NEXT_DIR = resolve(ROOT, '.next');

/**
 * Strings the debug pill renders verbatim. If ANY of these reach
 * the production bundle, the guard has been bypassed and the lint
 * fails. Add new fingerprints when adding new debug surfaces.
 *
 * W4 audit §10: extended to cover every static literal in the pill
 * body (taxonomy, distortion, ceiling labels). Dynamic content
 * from `signalToDebugString` evades the grep but the pill's
 * surrounding labels would be a tell-tale leak.
 */
const DEBUG_FINGERPRINTS = [
  'transition-debug-pill', // data-testid on the pill body
  'Engine chose: ',
  'Transition resolver debug info', // aria-label
  'taxonomy: ',
  'distortion: ',
  'ceiling: ',
];

type Hit = { file: string; fingerprint: string };

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === 'cache') continue; // `.next/cache` is not shipped
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (
      entry.endsWith('.js') ||
      entry.endsWith('.mjs') ||
      entry.endsWith('.html')
    ) {
      out.push(full);
    }
  }
}

function main(): void {
  if (!existsSync(NEXT_DIR)) {
    console.log(
      '.next/ not found — skip. Run `pnpm build` first to exercise the guard.',
    );
    process.exit(0);
  }

  // The check applies only when NEXT_PUBLIC_HIERO_DEBUG was unset
  // (or set to anything other than '1') at build time. If a
  // contributor explicitly built with debug=1, the guard is
  // bypassed deliberately.
  const buildDebug = process.env.NEXT_PUBLIC_HIERO_DEBUG === '1';
  if (buildDebug) {
    console.log(
      'NEXT_PUBLIC_HIERO_DEBUG=1 was set at build — debug surface is expected in the bundle. Skipping.',
    );
    process.exit(0);
  }

  const files: string[] = [];
  walk(NEXT_DIR, files);

  const hits: Hit[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const fingerprint of DEBUG_FINGERPRINTS) {
      if (source.includes(fingerprint)) {
        hits.push({ file: relative(ROOT, file), fingerprint });
      }
    }
  }

  if (hits.length === 0) {
    console.log(
      `OK — scanned ${files.length} build outputs, no debug fingerprints in production bundle.`,
    );
    process.exit(0);
  }

  console.error(
    `FAIL — found ${hits.length} debug-fingerprint leak(s) in production bundle:\n`,
  );
  for (const hit of hits) {
    console.error(`  ${hit.file}  →  ${JSON.stringify(hit.fingerprint)}`);
  }
  console.error(
    '\nFix: ensure debug components gate on `process.env.NEXT_PUBLIC_HIERO_DEBUG === \'1\'` and that the gate is the FIRST statement in the component body so Webpack can fold it. See components/editor/TransitionDebugPill.tsx for the pattern.',
  );
  process.exit(1);
}

main();

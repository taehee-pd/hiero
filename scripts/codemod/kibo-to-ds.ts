#!/usr/bin/env bun
/**
 * Codemod: rewrite @/components/kibo-ui/<prim> imports.
 *
 * - @/components/kibo-ui/color-picker → @/components/ds/color-picker
 * - @/components/kibo-ui/<anything else> → @/components/ui/<anything else>
 *
 * Idempotent: re-running after completion is a no-op. The kibo-ui folder
 * and the 10 pass-through files this codemod targets were deleted in
 * Phase 2 Commit A, so this script exists purely as the reproducible
 * record of the rewrite (see plan §6 Phase 2 Commit A and Appendix).
 *
 * Usage:
 *   bun scripts/codemod/kibo-to-ds.ts            # report + rewrite
 *   bun scripts/codemod/kibo-to-ds.ts --check    # report only
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
// Scan every source tree that could plausibly import from @/components/kibo-ui.
// Phase 2 Commit A verified none of these directories had a residual import
// after the original narrower scan. Widened to prevent future drift:
// documented by codex adversarial review (finding #5).
const TARGETS = [
  'components',
  'app',
  'lib',
  'tests',
  'scripts',
  'packages',
  'desktop',
  'figma-plugin',
];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const CHECK = process.argv.includes('--check');

const KIBO = '@/components/kibo-ui/';
const UI = '@/components/ui/';
const DS = '@/components/ds/';

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(full);
    } else if (EXT.has(full.slice(full.lastIndexOf('.')))) {
      yield full;
    }
  }
}

function rewrite(source: string): { next: string; changed: boolean } {
  let next = source;
  let changed = false;
  const re = new RegExp(
    String.raw`(["'\`])@/components/kibo-ui/([a-z0-9-]+(?:/[a-z0-9-]+)*)\1`,
    'g',
  );
  next = next.replace(re, (_full, quote: string, rest: string) => {
    changed = true;
    const target = rest.startsWith('color-picker') ? DS : UI;
    return `${quote}${target}${rest}${quote}`;
  });
  return { next, changed };
}

let touched = 0;
const roots = TARGETS.map((t) => join(ROOT, t));
for (const root of roots) {
  try {
    statSync(root);
  } catch {
    continue;
  }
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes(KIBO)) continue;
    const { next, changed } = rewrite(src);
    if (!changed) continue;
    touched += 1;
    const rel = relative(ROOT, file);
    if (CHECK) {
      console.log(`[check] would rewrite ${rel}`);
    } else {
      writeFileSync(file, next);
      console.log(`[write] ${rel}`);
    }
  }
}

console.log(`\n${CHECK ? 'Would rewrite' : 'Rewrote'} ${touched} file(s).`);
if (CHECK && touched > 0) process.exit(1);

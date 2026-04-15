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
 * Security posture (codex adversarial Phase 4 review, finding #7):
 *   - Uses lstatSync to avoid following symlinks that could point
 *     outside the repo. Symlinked directories are skipped entirely.
 *   - Every write path is validated against the resolved project
 *     root before writing. A rewrite that would land outside the
 *     repo throws instead of silently escaping the sandbox.
 *   - Scans .mdx files too (previous version missed MDX imports).
 *   - Regex allows mixed-case path segments defensively even though
 *     the repo convention is lowercase.
 *
 * Usage:
 *   bun scripts/codemod/kibo-to-ds.ts            # report + rewrite
 *   bun scripts/codemod/kibo-to-ds.ts --check    # report only
 */

import { readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
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
// .mdx added after codex review — MDX imports were invisible to the
// previous scope and would silently skip a rewrite.
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mdx']);

const CHECK = process.argv.includes('--check');

const KIBO = '@/components/kibo-ui/';
const UI = '@/components/ui/';
const DS = '@/components/ds/';

// The codemod's own source contains the KIBO string (as a constant
// AND in docstring examples) — skip it to avoid self-rewriting.
const SELF = resolve(import.meta.dir, 'kibo-to-ds.ts');

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      // lstat does NOT follow symlinks — a symlink-to-directory inside
      // the scanned root would otherwise let an attacker steer the
      // rewrite into files outside the project.
      st = lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(full);
    } else if (st.isFile()) {
      const dotIdx = full.lastIndexOf('.');
      if (dotIdx === -1) continue;
      if (EXT.has(full.slice(dotIdx))) yield full;
    }
  }
}

function rewrite(source: string): { next: string; changed: boolean } {
  let next = source;
  let changed = false;
  // Mixed-case tolerated for defensiveness; repo convention is lowercase
  // but a future file with `@/components/kibo-ui/ColorPicker` would
  // silently pass the lowercase-only regex.
  const re = new RegExp(
    String.raw`(["'\`])@/components/kibo-ui/([a-zA-Z0-9-]+(?:/[a-zA-Z0-9-]+)*)\1`,
    'g',
  );
  next = next.replace(re, (_full, quote: string, rest: string) => {
    changed = true;
    // color-picker was moved to components/ds in Phase 2; all other
    // passthroughs went to components/ui.
    const target = rest.toLowerCase().startsWith('color-picker') ? DS : UI;
    return `${quote}${target}${rest}${quote}`;
  });
  return { next, changed };
}

function assertInsideRoot(path: string): void {
  // Resolve the absolute path and check it lives under ROOT. If not,
  // something walked through a symlink or the ROOT check is wrong —
  // either way, refuse to write.
  const absolute = resolve(path);
  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) {
    throw new Error(
      `Refusing to rewrite file outside project root: ${absolute} (root: ${ROOT})`,
    );
  }
}

let touched = 0;
const roots = TARGETS.map((t) => join(ROOT, t));
for (const root of roots) {
  try {
    lstatSync(root);
  } catch {
    continue;
  }
  for (const file of walk(root)) {
    if (resolve(file) === SELF) continue;
    const src = readFileSync(file, 'utf8');
    if (!src.includes(KIBO)) continue;
    const { next, changed } = rewrite(src);
    if (!changed) continue;
    touched += 1;
    const rel = relative(ROOT, file);
    if (CHECK) {
      console.log(`[check] would rewrite ${rel}`);
    } else {
      assertInsideRoot(file);
      writeFileSync(file, next);
      console.log(`[write] ${rel}`);
    }
  }
}

console.log(`\n${CHECK ? 'Would rewrite' : 'Rewrote'} ${touched} file(s).`);
if (CHECK && touched > 0) process.exit(1);

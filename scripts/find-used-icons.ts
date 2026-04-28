#!/usr/bin/env bun
/**
 * Used-icon inventory.
 *
 * Walks app/ and components/ for `<UiIcon name="..."` and
 * `<HieroIcon name="..."` references, deduplicates the names, and emits
 * `lib/integrations/used-icons.generated.ts`. The generated file is
 * consumed by:
 *
 *   1. lib/integrations/hiero-ui-icons-source.ts — the editor's
 *      `openUsedHieroUiIconsInEditor()` action filters icons.json down
 *      to USED_ICON_NAMES so a maintainer can edit only the icons that
 *      actually appear in Hiero's own UI.
 *   2. scripts/check-used-icons.ts — the CI gate that fails if any
 *      used name is missing from packages/hiero-ui-icons/source/icons.json.
 *
 * This is the automation behind "Phase A — Baseline + freeze" in
 * docs_canonical/hiero-ui-icons/MIGRATION_PUBLISH_PLAN.md: the inventory
 * is regenerated rather than maintained by hand.
 *
 * Regenerate with `pnpm icons:find-used` (also runs as part of
 * `pnpm icons:check-used` in CI).
 *
 * The grep pattern is intentionally narrow: the JSX form
 * `<Component name="literal"`. Dynamic name expressions
 * (`name={iconKey}`) are skipped — the inventory only catches
 * statically resolvable references, and this is by design. A dynamic
 * usage cannot be inventoried at build time without a full type
 * solver, and we'd rather under-report (and rely on visual QA) than
 * silently include false positives.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCAN_DIRS = ['app', 'components'].map((d) => resolve(ROOT, d));
const OUTPUT_PATH = resolve(
  ROOT,
  'lib/integrations/used-icons.generated.ts',
);
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Files whose icon usage doesn't ship to end users. Excluding them
// keeps the inventory honest:
//
//   - `.stories.tsx` / `.stories.ts` reference icons purely for
//     Storybook demos (e.g. an alignment-toolbar story flexes
//     `align-left` / `bold` / `italic` even when those icons aren't
//     wired into any production surface). Counting them inflates the
//     editable subset and makes `pnpm icons:check-used` block changes
//     based on demo content.
//   - `.test.tsx` / `.test.ts` similarly reference icons for fixture
//     setup; they're not user-facing surfaces.
//   - Co-located docs (`.mdx` for token pages) aren't .ts/.tsx so the
//     extension filter already drops them, but listing the suffix here
//     keeps the policy obvious.
const EXCLUDE_SUFFIXES = [
  '.stories.tsx',
  '.stories.ts',
  '.test.tsx',
  '.test.ts',
];

// Match any JSX element whose tag name ends in `Icon` (covers UiIcon,
// HieroIcon, and future co-named components) with a literal `name` prop.
// Examples that match:
//   <UiIcon name="plus" ... />
//   <HieroIcon name='chevron-down' />
// Examples that do NOT match (intentional):
//   <UiIcon name={iconKey} />
//   <Icon name="plus" /> — too generic; would catch shadcn primitives
const ICON_USAGE_RE =
  /<([A-Z][A-Za-z0-9]*Icon)\s+[^>]*\bname\s*=\s*["']([a-z0-9-]+)["']/g;

function isExcludedFile(name: string): boolean {
  for (const suffix of EXCLUDE_SUFFIXES) {
    if (name.endsWith(suffix)) return true;
  }
  return false;
}

function walk(dir: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, hits);
    } else if (!isExcludedFile(entry)) {
      const dot = entry.lastIndexOf('.');
      if (dot >= 0 && SCAN_EXTENSIONS.has(entry.slice(dot))) {
        hits.push(full);
      }
    }
  }
  return hits;
}

type Finding = { name: string; sources: Set<string> };

function collectUsedIcons(): Map<string, Finding> {
  const findings = new Map<string, Finding>();
  for (const dir of SCAN_DIRS) {
    let files: string[];
    try {
      files = walk(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const rel = relative(ROOT, file);
      ICON_USAGE_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ICON_USAGE_RE.exec(source)) !== null) {
        const name = m[2];
        if (!name) continue;
        let entry = findings.get(name);
        if (!entry) {
          entry = { name, sources: new Set() };
          findings.set(name, entry);
        }
        entry.sources.add(rel);
      }
    }
  }
  return findings;
}

function emit(findings: Map<string, Finding>): string {
  const sortedNames = [...findings.keys()].sort();
  const header = `/**
 * GENERATED FILE — do not edit.
 * Regenerate with \`pnpm icons:find-used\`.
 *
 * Source of truth: scripts/find-used-icons.ts. Inventory of every
 * statically-resolvable \`<*Icon name="..."\` reference under app/ and
 * components/. Consumed by:
 *
 *   - lib/integrations/hiero-ui-icons-source.ts
 *     (\`openUsedHieroUiIconsInEditor\` filters icons.json to this set)
 *   - scripts/check-used-icons.ts
 *     (CI gate: every name here must exist in icons.json)
 */

`;
  const arrayLiteral = sortedNames
    .map((n) => `  ${JSON.stringify(n)},`)
    .join('\n');
  return `${header}export const USED_ICON_NAMES: readonly string[] = Object.freeze([
${arrayLiteral}
]);

/** Count exposed for diagnostics (drift checks, README pins, etc.). */
export const USED_ICON_COUNT = ${sortedNames.length};
`;
}

function main(): void {
  const findings = collectUsedIcons();
  const out = emit(findings);
  writeFileSync(OUTPUT_PATH, out, 'utf-8');
  console.log(
    `find-used-icons: wrote ${findings.size} icon name(s) → ${relative(ROOT, OUTPUT_PATH)}`,
  );
}

main();

#!/usr/bin/env bun
/**
 * Used-icon coverage gate.
 *
 * Enforces the invariant from
 * docs_canonical/hiero-ui-icons/MIGRATION_PUBLISH_PLAN.md Phase B:
 *
 *   Every icon referenced by Hiero's own UI must exist in
 *   packages/hiero-ui-icons/source/icons.json.
 *
 * Without this gate, a developer could rename an icon in the canonical
 * source (or add a new `<UiIcon name="brand-new" />` to a component)
 * and the dogfood loop would silently 404 the missing glyph.
 *
 * The gate is self-refreshing: it regenerates the inventory by running
 * the find-used-icons script first, so a stale generated file can't
 * mask a real failure. CI wires this in via `pnpm icons:check-used`.
 */

import { spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

// IIFE rather than top-level await because the project tsconfig targets
// ES6/module=esnext-but-not-nodenext for Next.js compatibility, and TypeScript
// rejects top-level await under that combination. Bun runs both fine; the
// IIFE just keeps `npx tsc --noEmit` (which CI runs as the type-check gate)
// from failing here.
async function main(): Promise<void> {
  // 1. Refresh the inventory. Spawning rather than importing keeps the
  //    side-effect of write-on-import out of the gate's import graph.
  const refresh = spawnSync(
    'bun',
    ['run', resolve(ROOT, 'scripts/find-used-icons.ts')],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (refresh.status !== 0) {
    console.error('check-used-icons: failed to regenerate inventory');
    process.exit(refresh.status ?? 1);
  }

  // 2. Load both sets. Dynamic imports because the generated module was
  //    just (re)written and we want the freshest copy.
  const usedMod = (await import(
    resolve(ROOT, 'lib/integrations/used-icons.generated.ts')
  )) as { USED_ICON_NAMES: readonly string[] };

  const iconsJson = (await import(
    resolve(ROOT, 'packages/hiero-ui-icons/source/icons.json'),
    { with: { type: 'json' } }
  )) as { default: { icons: Record<string, unknown> } };

  const used = new Set(usedMod.USED_ICON_NAMES);
  const canonical = new Set(Object.keys(iconsJson.default.icons));

  // 3. Diff + report. We only fail on the "used but missing" direction —
  //    icons that exist in icons.json but aren't referenced are fine
  //    (they may be authored ahead of consumption, kept for migration
  //    waves, or used by downstream consumers).
  const missing: string[] = [];
  for (const name of used) {
    if (!canonical.has(name)) missing.push(name);
  }

  const unused: string[] = [];
  for (const name of canonical) {
    if (!used.has(name)) unused.push(name);
  }

  console.log(
    `check-used-icons: ${used.size} used, ${canonical.size} canonical, ${unused.length} unused`,
  );

  if (missing.length > 0) {
    console.error('');
    console.error(
      `❌ ${missing.length} icon(s) used in app but missing from packages/hiero-ui-icons/source/icons.json:`,
    );
    for (const name of missing.sort()) {
      console.error(`  - ${name}`);
    }
    console.error('');
    console.error(
      `Fix options (see docs_canonical/hiero-ui-icons/MIGRATION_PUBLISH_PLAN.md Phase B):`,
    );
    console.error(
      `  1. Add the icon to packages/hiero-ui-icons/source/manifest.json and run \`pnpm icons:import\` then \`pnpm icons:build\`.`,
    );
    console.error(
      `  2. Or remove the offending \`<*Icon name="..."\` reference from app/ or components/.`,
    );
    console.error(
      `  3. Re-run \`pnpm icons:check-used\` to confirm.`,
    );
    console.error('');
    console.error(
      `Inventory was regenerated to ${relative(ROOT, resolve(ROOT, 'lib/integrations/used-icons.generated.ts'))}.`,
    );
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Every used icon resolves in the canonical source.`);
}

void main();

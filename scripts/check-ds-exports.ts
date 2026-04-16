#!/usr/bin/env bun
/**
 * DS Export Coverage Check — Phase 8 CI gate.
 *
 * Ensures every component exported from components/ds/index.ts has:
 *   1. A matching .stories.tsx file in components/ds/
 *   2. A matching .test.tsx file in tests/ds/
 *
 * Run: bun scripts/check-ds-exports.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const DS_DIR = resolve(ROOT, 'components/ds');
const TESTS_DIR = resolve(ROOT, 'tests/ds');
const INDEX_PATH = resolve(DS_DIR, 'index.ts');

// ---------------------------------------------------------------------------
// 1. Parse exports from components/ds/index.ts
// ---------------------------------------------------------------------------

const indexSource = readFileSync(INDEX_PATH, 'utf-8');

// Match lines like: export { Foo } from './bar';  or  export * from './bar';
const exportRe = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]\.\/([\w-]+(?:\/[\w-]+)?)['"]/g;

const exportedModules = new Set<string>();
let match: RegExpExecArray | null;
while ((match = exportRe.exec(indexSource)) !== null) {
  exportedModules.add(match[1]);
}

if (exportedModules.size === 0) {
  console.error('❌ No exports found in components/ds/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Check each exported module for .stories.tsx and .test.tsx
// ---------------------------------------------------------------------------

const errors: string[] = [];

for (const mod of exportedModules) {
  const modBase = mod.includes('/') ? mod.split('/')[0] : mod;

  // Story file: components/ds/<mod>.stories.tsx or components/ds/<mod>/index.stories.tsx
  const storyPaths = [
    resolve(DS_DIR, `${modBase}.stories.tsx`),
    resolve(DS_DIR, modBase, 'index.stories.tsx'),
  ];
  const hasStory = storyPaths.some((p) => existsSync(p));
  if (!hasStory) {
    errors.push(`Missing story: components/ds/${modBase}.stories.tsx`);
  }

  // Test file: tests/ds/<mod>.test.tsx or tests/ds/<mod>.test.ts
  const testPaths = [
    resolve(TESTS_DIR, `${modBase}.test.tsx`),
    resolve(TESTS_DIR, `${modBase}.test.ts`),
  ];
  const hasTest = testPaths.some((p) => existsSync(p));
  if (!hasTest) {
    errors.push(`Missing test: tests/ds/${modBase}.test.tsx`);
  }
}

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------

console.log(`DS export coverage: ${exportedModules.size} module(s) checked`);
for (const mod of exportedModules) {
  console.log(`  ✓ ${mod}`);
}

if (errors.length > 0) {
  console.error('');
  console.error(`❌ ${errors.length} missing file(s):`);
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
} else {
  console.log('');
  console.log('✅ All DS exports have matching stories and tests.');
}

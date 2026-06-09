import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');

/**
 * Defensive unit-level guard for the public/internal build-channel
 * boundary.
 *
 * The whole bundle-isolation argument rests on the gate at each call
 * site being `process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal'`
 * (literal). Webpack constant-folds env-var literals at build time;
 * it does NOT fold across module boundaries, so a refactor that swaps
 * the literal for an imported `IS_INTERNAL_BUILD` constant silently
 * re-bundles the `lib/integrations/hiero-ui-icons-source` module —
 * including the `icons.json` data it imports — into the public chunks.
 *
 * scripts/check-public-bundle.ts catches this empirically, but only in
 * the build matrix job which runs ~5 minutes after push and only after
 * `validate` passes. This test runs in `pnpm test:core` (sub-second)
 * and produces a clear paste-ready diff if a contributor "cleans up"
 * the gate.
 *
 * If you intentionally need to change the gate pattern, update this
 * test in the same commit so future readers can see the new rule and
 * its rationale.
 */

const GATED_INTEGRATION_IMPORT =
  /await\s+import\s*\(\s*['"]@\/lib\/integrations\/hiero-ui-icons-source['"]/;

const ENV_LITERAL_GATE_RE =
  /process\.env\.NEXT_PUBLIC_BUILD_CHANNEL\s*!==\s*['"]internal['"]/;

const ENV_LITERAL_RENDER_GATE_RE =
  /process\.env\.NEXT_PUBLIC_BUILD_CHANNEL\s*===\s*['"]internal['"]/;

const FORBIDDEN_IMPORTED_CONSTANT_GATE_RE =
  /^\s*if\s*\(\s*!\s*IS_INTERNAL_BUILD\s*\)\s*return/m;

const FILES_WITH_THE_GATE = [
  // Navbar is the single chrome carrying the internal-build maintenance
  // actions. (The former editor Toolbar carried a redundant copy of the
  // same gated actions and was removed; Navbar is now the sole gate site.)
  'components/studio/Navbar.tsx',
];

describe('build-channel boundary — gate must be env-var literal', () => {
  for (const rel of FILES_WITH_THE_GATE) {
    describe(rel, () => {
      const src = read(rel);

      test('contains a dynamic import of the internal integration helper', () => {
        // If this fails the test is stale (the helper moved or was renamed)
        // — update the regex above. Without this assertion the rest of the
        // file would be vacuously satisfied.
        expect(src).toMatch(GATED_INTEGRATION_IMPORT);
      });

      test('gates the dynamic-import call site on the env-var LITERAL (early return)', () => {
        // The handler bodies look like:
        //   if (process.env.NEXT_PUBLIC_BUILD_CHANNEL !== 'internal') return;
        //   const mod = await import('@/lib/integrations/hiero-ui-icons-source');
        // The literal is what Webpack constant-folds. The imported
        // IS_INTERNAL_BUILD constant from lib/build-flags.ts does NOT
        // fold across module boundaries — switching to it ships the
        // icons.json data into public chunks.
        expect(src).toMatch(ENV_LITERAL_GATE_RE);
      });

      test('gates the JSX render on the env-var LITERAL (no IS_INTERNAL_BUILD)', () => {
        // The render guards look like:
        //   {process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal' && (
        //     <DropdownMenuItem … />
        //   )}
        // Same reasoning: imported constants don't fold; the literal
        // does. Even though the menu item without an open icon set is
        // a smaller leak than the data, gating both consistently keeps
        // contributors from accidentally choosing the unsafe pattern.
        expect(src).toMatch(ENV_LITERAL_RENDER_GATE_RE);
      });

      test('does NOT gate on `if (!IS_INTERNAL_BUILD) return` (the regression pattern)', () => {
        // This is the exact pattern that previously leaked the icons.json
        // envelope into public chunks. If you have a legitimate reason to
        // use the imported constant elsewhere in the file, that's fine —
        // this only flags the gate-style usage.
        expect(src).not.toMatch(FORBIDDEN_IMPORTED_CONSTANT_GATE_RE);
      });
    });
  }
});

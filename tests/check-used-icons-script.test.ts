import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dir, '..');

// The CI gate is the load-bearing half of "every used icon must exist
// in icons.json" — without these tests the script could silently regress
// to exit-0 on a missing icon and we'd only find out via a 404 in dogfood.

/**
 * Stages a fake repo layout (scripts/ + lib/integrations/ + packages/.../source/
 * + components/) under a temp dir, mirroring the real script's relative
 * paths so it runs without surgery. Returns the temp dir for the caller
 * to write fixture files into and clean up.
 */
function stageFakeRepo(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'check-used-icons-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'lib/integrations'), { recursive: true });
  mkdirSync(join(dir, 'packages/hiero-ui-icons/source'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  copyFileSync(
    resolve(ROOT, 'scripts/find-used-icons.ts'),
    join(dir, 'scripts/find-used-icons.ts'),
  );
  copyFileSync(
    resolve(ROOT, 'scripts/check-used-icons.ts'),
    join(dir, 'scripts/check-used-icons.ts'),
  );
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function runGate(cwd: string) {
  return spawnSync(
    'bun',
    ['run', join(cwd, 'scripts/check-used-icons.ts')],
    { cwd, encoding: 'utf-8' },
  );
}

/**
 * Run find-used-icons.ts in the staged repo and return the resulting
 * inventory file content. Tests use this to write a "committed" inventory
 * that matches what the gate's regeneration step will produce, so the
 * drift check (P1) passes and we can exercise the missing-icon /
 * exclusion behavior we actually want to test.
 */
function regenerateInventory(cwd: string): string {
  const result = spawnSync(
    'bun',
    ['run', join(cwd, 'scripts/find-used-icons.ts')],
    { cwd, encoding: 'utf-8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `find-used-icons failed in stage: ${result.stderr || result.stdout}`,
    );
  }
  return readFileSync(
    join(cwd, 'lib/integrations/used-icons.generated.ts'),
    'utf-8',
  );
}

describe('scripts/check-used-icons.ts', () => {
  test('passes on the real repo state (sanity)', () => {
    const result = spawnSync(
      'bun',
      ['run', resolve(ROOT, 'scripts/check-used-icons.ts')],
      { cwd: ROOT, encoding: 'utf-8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Every used icon resolves');
  });

  test('fails when a used name is missing from icons.json', () => {
    const stage = stageFakeRepo();
    try {
      writeFileSync(
        join(stage.dir, 'packages/hiero-ui-icons/source/icons.json'),
        JSON.stringify({
          version: '1.0',
          meta: { name: 'fake', createdAt: '', updatedAt: '' },
          icons: {
            present: { id: 'present', name: 'present', variants: {} },
          },
          types: {},
        }),
      );
      writeFileSync(
        join(stage.dir, 'components/fake.tsx'),
        '<FakeIcon name="present" />\n<FakeIcon name="not-in-source" />',
      );
      // Pre-warm the committed inventory so the drift check passes and
      // we exercise the missing-icon failure mode, not the stale-file one.
      regenerateInventory(stage.dir);

      const result = runGate(stage.dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('not-in-source');
      expect(result.stderr).toContain('missing from packages/hiero-ui-icons/source/icons.json');
    } finally {
      stage.cleanup();
    }
  });

  // P1 from PR #163 review: the gate must catch the case where
  // regeneration *changes* the committed inventory — otherwise CI passes
  // while the file on disk silently goes stale, and the editor's
  // "Import Used Icons" flow misses newly added references.
  test('fails when the committed inventory is stale relative to current sources', () => {
    const stage = stageFakeRepo();
    try {
      writeFileSync(
        join(stage.dir, 'packages/hiero-ui-icons/source/icons.json'),
        JSON.stringify({
          version: '1.0',
          meta: { name: 'fake', createdAt: '', updatedAt: '' },
          icons: {
            present: { id: 'present', name: 'present', variants: {} },
            'newly-added': { id: 'newly-added', name: 'newlyAdded', variants: {} },
          },
          types: {},
        }),
      );
      // Only references "present" — the inventory regenerated from this
      // would be ["present"]. We commit a stale inventory that's missing
      // "present" entirely (or has extra entries) — either direction is a
      // drift the gate should catch.
      writeFileSync(
        join(stage.dir, 'components/fake.tsx'),
        '<FakeIcon name="present" />',
      );
      writeFileSync(
        join(stage.dir, 'lib/integrations/used-icons.generated.ts'),
        `export const USED_ICON_NAMES: readonly string[] = Object.freeze([
  "stale-leftover",
]);
export const USED_ICON_COUNT = 1;
`,
      );

      const result = runGate(stage.dir);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('is stale');
      expect(result.stderr).toContain('pnpm icons:find-used');

      // After running find-used-icons (which the gate did internally) the
      // file on disk is the FRESH version. Re-running the gate now should
      // pass because the next CI run picks up the freshly-committed file.
      const refreshed = readFileSync(
        join(stage.dir, 'lib/integrations/used-icons.generated.ts'),
        'utf-8',
      );
      expect(refreshed).toContain('"present"');
      expect(refreshed).not.toContain('stale-leftover');
    } finally {
      stage.cleanup();
    }
  });

  // P2 from PR #163 review: stories pull in icons for demo content
  // (alignment toolbars showing align-left/bold/italic, etc.). Without
  // an exclusion the inventory inflates and the editable subset is noisy.
  test('excludes .stories.tsx and .test.tsx from the inventory scan', () => {
    const stage = stageFakeRepo();
    try {
      writeFileSync(
        join(stage.dir, 'packages/hiero-ui-icons/source/icons.json'),
        JSON.stringify({
          version: '1.0',
          meta: { name: 'fake', createdAt: '', updatedAt: '' },
          icons: {
            'production-icon': { id: 'production-icon', name: 'p', variants: {} },
            'story-only-icon': { id: 'story-only-icon', name: 's', variants: {} },
            'test-only-icon': { id: 'test-only-icon', name: 't', variants: {} },
          },
          types: {},
        }),
      );
      writeFileSync(
        join(stage.dir, 'components/Real.tsx'),
        '<UiIcon name="production-icon" />',
      );
      writeFileSync(
        join(stage.dir, 'components/Real.stories.tsx'),
        '<UiIcon name="story-only-icon" />',
      );
      writeFileSync(
        join(stage.dir, 'components/Real.test.tsx'),
        '<UiIcon name="test-only-icon" />',
      );
      // Pre-warm so the drift check passes; the inventory regeneration
      // step inside the gate then sees no diff.
      regenerateInventory(stage.dir);

      const result = runGate(stage.dir);
      expect(result.status).toBe(0);

      const inventory = readFileSync(
        join(stage.dir, 'lib/integrations/used-icons.generated.ts'),
        'utf-8',
      );
      expect(inventory).toContain('"production-icon"');
      expect(inventory).not.toContain('story-only-icon');
      expect(inventory).not.toContain('test-only-icon');
    } finally {
      stage.cleanup();
    }
  });
});


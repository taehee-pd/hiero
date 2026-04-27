import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dir, '..');

// The CI gate is the load-bearing half of "every used icon must exist
// in icons.json" — without these tests the script could silently regress
// to exit-0 on a missing icon and we'd only find out via a 404 in dogfood.

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
    // Stage a fake repo with a component that references an icon name
    // not in icons.json. We copy the real scripts and source files so
    // the script's relative paths still work.
    const stage = mkdtempSync(join(tmpdir(), 'check-used-icons-'));
    try {
      const stageScripts = join(stage, 'scripts');
      const stageLib = join(stage, 'lib/integrations');
      const stagePkg = join(stage, 'packages/hiero-ui-icons/source');
      const stageComp = join(stage, 'components');
      mkdirSync(stageScripts, { recursive: true });
      mkdirSync(stageLib, { recursive: true });
      mkdirSync(stagePkg, { recursive: true });
      mkdirSync(stageComp, { recursive: true });

      copyFileSync(
        resolve(ROOT, 'scripts/find-used-icons.ts'),
        join(stageScripts, 'find-used-icons.ts'),
      );
      copyFileSync(
        resolve(ROOT, 'scripts/check-used-icons.ts'),
        join(stageScripts, 'check-used-icons.ts'),
      );

      // A fake icons.json with exactly one icon.
      writeFileSync(
        join(stagePkg, 'icons.json'),
        JSON.stringify({
          version: '1.0',
          meta: { name: 'fake', createdAt: '', updatedAt: '' },
          icons: {
            present: { id: 'present', name: 'present', variants: {} },
          },
          types: {},
        }),
      );

      // A fake component that references a name NOT in icons.json. The
      // inventory regex matches `<*Icon name="literal"`; using
      // "FakeIcon" keeps it identical in shape to the real `<UiIcon ...`
      // production usage.
      writeFileSync(
        join(stageComp, 'fake.tsx'),
        '<FakeIcon name="present" />\n<FakeIcon name="not-in-source" />',
      );

      const result = spawnSync(
        'bun',
        ['run', join(stageScripts, 'check-used-icons.ts')],
        { cwd: stage, encoding: 'utf-8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('not-in-source');
      expect(result.stderr).toContain('missing from packages/hiero-ui-icons/source/icons.json');
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  });
});

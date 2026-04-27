import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCRIPT = resolve(ROOT, 'scripts/check-page-registry.ts');

function runScript(): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [SCRIPT], { cwd: ROOT, encoding: 'utf-8' });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? -1,
  };
}

describe('scripts/check-page-registry.ts', () => {
  test('exits 0 when all app pages are enrolled in PAGE_REGISTRY', () => {
    const { stdout, stderr, code } = runScript();
    if (code !== 0) {
      throw new Error(
        `Expected exit 0 but got ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      );
    }
    expect(stdout).toContain('All pages enrolled');
  });

  test('reports each discovered page in the output', () => {
    const { stdout } = runScript();
    expect(stdout).toContain('app/page.tsx → /');
    expect(stdout).toContain('app/editor/page.tsx → /editor');
    expect(stdout).toContain('app/editor/[iconId]/page.tsx → /editor/[iconId]');
  });
});

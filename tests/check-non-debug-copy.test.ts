/**
 * W1-U2 acceptance: the banned-vocabulary copy lint script runs,
 * passes on the current tree, and catches a synthetic violation
 * inside an isolated temp directory.
 */
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCRIPT = resolve(ROOT, 'scripts/check-non-debug-copy.ts');

function runScript(targetRoot: string): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [SCRIPT, '--root', targetRoot], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? -1,
  };
}

function buildTempProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'hiero-copy-lint-'));
  for (const [relPath, contents] of Object.entries(files)) {
    const abs = join(root, relPath);
    mkdirSync(resolve(abs, '..'), { recursive: true });
    writeFileSync(abs, contents);
  }
  return root;
}

describe('scripts/check-non-debug-copy.ts', () => {
  test('exits 0 on the current repository (no banned terms in user copy)', () => {
    const { stdout, code } = runScript(ROOT);
    expect(code).toBe(0);
    expect(stdout).toContain('OK');
  });

  test('catches a banned term inside a JSX text literal', () => {
    const project = buildTempProject({
      'components/TransitionPanel.tsx': `export function Pill() {
  return <span>Engine chose: Hungarian over the contour tree</span>;
}\n`,
    });
    try {
      const { stderr, code } = runScript(project);
      expect(code).toBe(1);
      expect(stderr).toContain('Hungarian');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test('catches a banned term inside a string literal', () => {
    const project = buildTempProject({
      'components/Studio.tsx': `const tooltip = "We picked the ARAP wrap for this morph.";\n`,
    });
    try {
      const { stderr, code } = runScript(project);
      expect(code).toBe(1);
      expect(stderr).toContain('ARAP');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test('skips test, story, and debug files', () => {
    const project = buildTempProject({
      'components/Sample.test.tsx': `test('foo', () => { expect("ARAP wrap").toBe("ARAP wrap"); });\n`,
      'components/Sample.stories.tsx': `export const Demo = () => <span>Hungarian</span>;\n`,
      'components/TransitionDebug.tsx': `export const tier = "Hungarian over the contour tree";\n`,
    });
    try {
      const { code } = runScript(project);
      expect(code).toBe(0);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

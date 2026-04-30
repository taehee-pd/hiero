/**
 * Tests for `hiero init` upgrade.
 *
 * Pinned contracts:
 *   - regression: --yes preserves the prior non-interactive behavior
 *     (config + sourceDir + manifest written, no prompts)
 *   - interactive: prompts drive sourceDir + releaseTarget choice
 *   - non-TTY: silently behaves like --yes (no prompts) so CI is clean
 *   - --check: runs health checks without writing files
 *   - .env.local without gitignore entry → fail health check
 *   - generated config never embeds credentials
 */

import { describe, it, expect } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  runHealthChecks,
  runInit,
  type InitIO,
} from '@/packages/hiero-cli/src/commands/init';

async function tempDir(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'hiero-init-test-'));
}

function captureIO(answers: string[] = []): InitIO & { logs: string[] } {
  const logs: string[] = [];
  let i = 0;
  return {
    logs,
    log: (msg) => {
      logs.push(msg);
    },
    prompt: async (_q, def) => answers[i++] ?? def ?? '',
  };
}

describe('runInit (--yes / non-TTY default)', () => {
  it('writes config + source dir + manifest with default contents', async () => {
    const cwd = await tempDir();
    try {
      const io = captureIO();
      await runInit(cwd, { yes: true }, io);

      const config = await readFile(path.join(cwd, 'hiero.config.ts'), 'utf8');
      expect(config).toContain("sourceDir: 'hiero'");
      expect(config).toContain("kind: 'local-directory'");
      expect(config).toContain("outputDir: 'src/icons/generated'");

      const manifest = await readFile(
        path.join(cwd, 'hiero/manifest.json'),
        'utf8',
      );
      const parsed = JSON.parse(manifest);
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.iconCount).toBe(0);
      expect(parsed.icons).toEqual({});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('never embeds credentials in the generated config', async () => {
    const cwd = await tempDir();
    try {
      const io = captureIO();
      // Even if the env has tokens, the config never references them.
      const prevToken = process.env.HIERO_GITHUB_TOKEN;
      process.env.HIERO_GITHUB_TOKEN = 'ghp_secret_test_token';
      try {
        await runInit(cwd, { yes: true }, io);
      } finally {
        if (prevToken === undefined) {
          delete process.env.HIERO_GITHUB_TOKEN;
        } else {
          process.env.HIERO_GITHUB_TOKEN = prevToken;
        }
      }

      const config = await readFile(path.join(cwd, 'hiero.config.ts'), 'utf8');
      expect(config).not.toContain('ghp_secret_test_token');
      expect(config).not.toContain('HIERO_GITHUB_TOKEN');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('does not overwrite existing files on re-run', async () => {
    const cwd = await tempDir();
    try {
      const io1 = captureIO();
      await runInit(cwd, { yes: true }, io1);

      const original = await readFile(
        path.join(cwd, 'hiero.config.ts'),
        'utf8',
      );
      // Tamper with it; second run must leave it alone.
      const tampered = original + '\n// hand-edited\n';
      await writeFile(path.join(cwd, 'hiero.config.ts'), tampered, 'utf8');

      const io2 = captureIO();
      await runInit(cwd, { yes: true }, io2);

      const after = await readFile(path.join(cwd, 'hiero.config.ts'), 'utf8');
      expect(after).toBe(tampered);
      expect(io2.logs.join('\n')).toMatch(/exists\s+hiero\.config\.ts/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('runInit (interactive)', () => {
  it('uses prompted answers for sourceDir and outputDir', async () => {
    const cwd = await tempDir();
    const prevTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      get: () => true,
    });
    try {
      const io = captureIO(['custom-icons', 'local-directory', 'dist/icons']);
      await runInit(cwd, {}, io);

      const config = await readFile(path.join(cwd, 'hiero.config.ts'), 'utf8');
      expect(config).toContain("sourceDir: 'custom-icons'");
      expect(config).toContain("outputDir: 'dist/icons'");
      // The actual source folder uses the prompted name.
      const manifest = await readFile(
        path.join(cwd, 'custom-icons/manifest.json'),
        'utf8',
      );
      expect(JSON.parse(manifest).iconCount).toBe(0);
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        configurable: true,
        get: () => prevTTY,
      });
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('renders git-pr template when user picks git-pr release target', async () => {
    const cwd = await tempDir();
    const prevTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      get: () => true,
    });
    try {
      const io = captureIO(['hiero', 'git-pr']);
      await runInit(cwd, {}, io);
      const config = await readFile(path.join(cwd, 'hiero.config.ts'), 'utf8');
      expect(config).toContain("kind: 'git-pr'");
      expect(config).toContain('YOUR_GITHUB_OWNER');
      // Token still NOT embedded — the comment instructs the user to use
      // .env.local instead.
      expect(config).toContain('Set HIERO_GITHUB_TOKEN in .env.local');
      expect(config).not.toContain('process.env');
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', {
        configurable: true,
        get: () => prevTTY,
      });
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('runInit --check', () => {
  it('reports config missing for an empty cwd', async () => {
    const cwd = await tempDir();
    try {
      const io = captureIO();
      await runInit(cwd, { check: true }, io);
      const out = io.logs.join('\n');
      expect(out).toContain('hiero.config.ts: missing');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('reports config present after init', async () => {
    const cwd = await tempDir();
    try {
      await runInit(cwd, { yes: true }, captureIO());
      const io = captureIO();
      await runInit(cwd, { check: true }, io);
      expect(io.logs.join('\n')).toContain('hiero.config.ts: present');
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('runHealthChecks', () => {
  it('flags .env.local NOT in .gitignore as fail', async () => {
    const cwd = await tempDir();
    try {
      await writeFile(path.join(cwd, '.env.local'), 'NPM_TOKEN=x', 'utf8');
      await writeFile(
        path.join(cwd, '.gitignore'),
        'node_modules\n# .env.local missing\n',
        'utf8',
      );
      const checks = await runHealthChecks(cwd);
      const env = checks.find((c) => c.name === '.env.local');
      expect(env).toBeDefined();
      expect(env!.status).toBe('fail');
      expect(env!.detail).toContain('NOT in .gitignore');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('passes .env.local when listed in .gitignore', async () => {
    const cwd = await tempDir();
    try {
      await writeFile(path.join(cwd, '.env.local'), 'X=1', 'utf8');
      await writeFile(path.join(cwd, '.gitignore'), '.env.local\n', 'utf8');
      const checks = await runHealthChecks(cwd);
      const env = checks.find((c) => c.name === '.env.local');
      expect(env!.status).toBe('ok');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('warns when GitHub token env var is unset', async () => {
    const cwd = await tempDir();
    const prevA = process.env.HIERO_GITHUB_TOKEN;
    const prevB = process.env.GITHUB_TOKEN;
    delete process.env.HIERO_GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      const checks = await runHealthChecks(cwd);
      const gh = checks.find((c) => c.name === 'GitHub token');
      expect(gh!.status).toBe('warn');
    } finally {
      if (prevA !== undefined) process.env.HIERO_GITHUB_TOKEN = prevA;
      if (prevB !== undefined) process.env.GITHUB_TOKEN = prevB;
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

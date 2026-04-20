import { describe, test, expect } from 'bun:test';
import { validateConfig, loadConfig } from '@/lib/install-config';
import type { HieroConfig } from '@/lib/install-config';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_CONFIG: HieroConfig = {
  sourceDir: 'hiero',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.hiero/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
};

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
  test('accepts a valid config', () => {
    const result = validateConfig(VALID_CONFIG);
    expect(result.valid).toBeTrue();
  });

  test('accepts config without releaseTargets', () => {
    const config = { ...VALID_CONFIG, releaseTargets: undefined };
    const result = validateConfig(config);
    expect(result.valid).toBeTrue();
  });

  test('rejects null input', () => {
    const result = validateConfig(null);
    expect(result.valid).toBeFalse();
  });

  test('rejects missing sourceDir', () => {
    const result = validateConfig({ ...VALID_CONFIG, sourceDir: '' });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'sourceDir')).toBeTrue();
    }
  });

  test('rejects absolute sourceDir', () => {
    const result = validateConfig({ ...VALID_CONFIG, sourceDir: '/absolute/path' });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'sourceDir')).toBeTrue();
    }
  });

  test('rejects sourceDir that escapes the repo root', () => {
    const result = validateConfig({ ...VALID_CONFIG, sourceDir: '../outside' });
    expect(result.valid).toBeFalse();
  });

  test('rejects sourceDir that escapes via nested traversal (icons/../../outside)', () => {
    const result = validateConfig({ ...VALID_CONFIG, sourceDir: 'icons/../../outside' });
    expect(result.valid).toBeFalse();
  });

  test('rejects non-array hostTargets', () => {
    const result = validateConfig({ ...VALID_CONFIG, hostTargets: 'bad' });
    expect(result.valid).toBeFalse();
  });

  test('rejects host target with unknown kind', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'unknown', mode: 'live', runtimeMode: 'in-memory' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects host target with wrong mode', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'react-app', mode: 'offline', runtimeMode: 'in-memory' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects cache-dir host target missing cacheDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'react-app', mode: 'live', runtimeMode: 'cache-dir' }],
    });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes('cacheDir'))).toBeTrue();
    }
  });

  test('rejects cache-dir with absolute cacheDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'react-app', mode: 'live', runtimeMode: 'cache-dir', cacheDir: '/tmp/cache' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('accepts in-memory host target without cacheDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'react-app', mode: 'live', runtimeMode: 'in-memory' }],
    });
    expect(result.valid).toBeTrue();
  });

  test('accepts reference-app kind', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      hostTargets: [{ kind: 'reference-app', mode: 'live', runtimeMode: 'in-memory' }],
    });
    expect(result.valid).toBeTrue();
  });

  test('rejects local-directory release target with missing outputDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'local-directory', outputMode: 'snapshot', outputDir: '' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects local-directory release target with absolute outputDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'local-directory', outputMode: 'snapshot', outputDir: '/tmp/out' }],
    });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes('outputDir'))).toBeTrue();
    }
  });

  test('rejects local-directory release target with traversal outputDir', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'local-directory', outputMode: 'snapshot', outputDir: '../outside' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects git-pr release target with missing owner', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'git-pr', outputMode: 'snapshot', owner: '', repo: 'icons', baseBranch: 'main' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects git-pr release target with whitespace-only owner', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'git-pr', outputMode: 'snapshot', owner: '   ', repo: 'icons', baseBranch: 'main' }],
    });
    expect(result.valid).toBeFalse();
  });

  test('rejects git-pr release target with inline token (credential guard applies to all kinds)', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        {
          kind: 'git-pr',
          outputMode: 'snapshot',
          owner: 'acme',
          repo: 'icons',
          baseBranch: 'main',
          token: 'ghp_supersecret',
        },
      ],
    });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes('token'))).toBeTrue();
    }
  });

  test('accepts valid git-pr release target', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        { kind: 'git-pr', outputMode: 'snapshot', owner: 'acme', repo: 'icons', baseBranch: 'main' },
      ],
    });
    expect(result.valid).toBeTrue();
  });

  test('accepts valid git-pr release target with packagePath', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        { kind: 'git-pr', outputMode: 'snapshot', owner: 'acme', repo: 'icons', baseBranch: 'main', packagePath: 'packages/icons' },
      ],
    });
    expect(result.valid).toBeTrue();
  });

  test('rejects git-pr release target with absolute packagePath', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        { kind: 'git-pr', outputMode: 'snapshot', owner: 'acme', repo: 'icons', baseBranch: 'main', packagePath: '/tmp/out' },
      ],
    });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes('packagePath'))).toBeTrue();
    }
  });

  test('rejects git-pr release target with traversal packagePath', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        { kind: 'git-pr', outputMode: 'snapshot', owner: 'acme', repo: 'icons', baseBranch: 'main', packagePath: '../../outside' },
      ],
    });
    expect(result.valid).toBeFalse();
  });

  test('accepts valid npm-registry release target', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        { kind: 'npm-registry', outputMode: 'snapshot', packageName: '@acme/icons' },
      ],
    });
    expect(result.valid).toBeTrue();
  });

  test('rejects npm-registry release target with inline token', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [
        {
          kind: 'npm-registry',
          outputMode: 'snapshot',
          packageName: '@acme/icons',
          token: 'npm_supersecret',
        },
      ],
    });
    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((e) => e.field.includes('token'))).toBeTrue();
    }
  });

  test('rejects npm-registry release target with missing packageName', () => {
    const result = validateConfig({
      ...VALID_CONFIG,
      releaseTargets: [{ kind: 'npm-registry', outputMode: 'snapshot', packageName: '' }],
    });
    expect(result.valid).toBeFalse();
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  test('returns ok config for valid input', () => {
    const result = loadConfig(VALID_CONFIG);
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.config.sourceDir).toBe('hiero');
      expect(result.config.hostTargets).toHaveLength(1);
    }
  });

  test('returns ok config with releaseTargets normalised to empty array when absent', () => {
    const result = loadConfig({ ...VALID_CONFIG, releaseTargets: undefined });
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(Array.isArray(result.config.releaseTargets)).toBeTrue();
    }
  });

  test('strips trailing slash from sourceDir', () => {
    const result = loadConfig({ ...VALID_CONFIG, sourceDir: 'hiero/' });
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.config.sourceDir).toBe('hiero');
    }
  });

  test('strips trailing slash from cacheDir', () => {
    const input = {
      ...VALID_CONFIG,
      hostTargets: [
        { kind: 'react-app' as const, mode: 'live' as const, runtimeMode: 'cache-dir' as const, cacheDir: '.hiero/cache/' },
      ],
    };
    const result = loadConfig(input);
    expect(result.ok).toBeTrue();
    if (result.ok) {
      const target = result.config.hostTargets[0] as { cacheDir?: string };
      expect(target.cacheDir).toBe('.hiero/cache');
    }
  });

  test('returns error for null input', () => {
    const result = loadConfig(null);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error).toContain('missing or undefined');
    }
  });

  test('returns error with field-level messages for invalid config', () => {
    const result = loadConfig({ sourceDir: '', hostTargets: [] });
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error).toContain('sourceDir');
    }
  });

  test('includes configPath in error messages when provided', () => {
    const result = loadConfig(null, 'packages/my-app/hiero.config.ts');
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error).toContain('packages/my-app/hiero.config.ts');
    }
  });
});

import { describe, expect, test } from 'bun:test';

const VERSION_ENV_KEYS = [
  'NEXT_PUBLIC_BUILD_CHANNEL',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_PUBLIC_BUILD_COMMIT',
  'NEXT_PUBLIC_BUILD_TIME',
  'NEXT_PUBLIC_HIERO_UI_ICONS_VERSION',
] as const;

function loadBuildVersion(env: Partial<Record<(typeof VERSION_ENV_KEYS)[number], string | undefined>>): {
  BUILD_VERSION: import('../lib/build-version').BuildVersion;
  formatBuildVersion: typeof import('../lib/build-version').formatBuildVersion;
} {
  const previous = new Map<string, string | undefined>();
  for (const key of VERSION_ENV_KEYS) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key]!;
    }
  }
  delete require.cache[require.resolve('../lib/build-flags')];
  delete require.cache[require.resolve('../lib/build-version')];
  const mod = require('../lib/build-version') as typeof import('../lib/build-version');
  // restore env
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return {
    BUILD_VERSION: mod.BUILD_VERSION,
    formatBuildVersion: mod.formatBuildVersion,
  };
}

describe('BUILD_VERSION', () => {
  test('uses sane fallbacks when every env var is unset', () => {
    const { BUILD_VERSION } = loadBuildVersion({});
    expect(BUILD_VERSION.channel).toBe('public');
    expect(BUILD_VERSION.app).toBe('0.0.0-dev');
    expect(BUILD_VERSION.commit).toBe('dev');
    expect(BUILD_VERSION.builtAt).toBe('1970-01-01T00:00:00.000Z');
    expect(BUILD_VERSION.hieroUiIconsVersion).toBe('0.0.0-dev');
  });

  test('passes env vars through verbatim when set', () => {
    const { BUILD_VERSION } = loadBuildVersion({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_APP_VERSION: '1.2.3',
      NEXT_PUBLIC_BUILD_COMMIT: 'abc1234',
      NEXT_PUBLIC_BUILD_TIME: '2026-04-27T05:00:00.000Z',
      NEXT_PUBLIC_HIERO_UI_ICONS_VERSION: '0.5.1',
    });
    expect(BUILD_VERSION).toEqual({
      channel: 'internal',
      app: '1.2.3',
      commit: 'abc1234',
      builtAt: '2026-04-27T05:00:00.000Z',
      hieroUiIconsVersion: '0.5.1',
    });
  });

  test('formatBuildVersion produces a single-line, all-fields representation', () => {
    const { formatBuildVersion } = loadBuildVersion({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_APP_VERSION: '1.2.3',
      NEXT_PUBLIC_BUILD_COMMIT: 'abc1234',
      NEXT_PUBLIC_BUILD_TIME: '2026-04-27T05:00:00.000Z',
      NEXT_PUBLIC_HIERO_UI_ICONS_VERSION: '0.5.1',
    });
    const formatted = formatBuildVersion();
    expect(formatted).toBe(
      'internal · v1.2.3 · abc1234 · ui-icons 0.5.1 · 2026-04-27T05:00:00.000Z',
    );
    // No newlines — must fit in a single log line / hover tooltip.
    expect(formatted).not.toContain('\n');
  });
});

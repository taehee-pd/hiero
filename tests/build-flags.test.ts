import { describe, expect, test } from 'bun:test';

// build-flags reads process.env at module-eval time, so each test that
// needs a different value has to import a fresh copy. bun: test's
// `mock.module` is the wrong tool here (process.env isn't a module).
// We use require with cache invalidation via a fresh path query.

function loadBuildFlags(channelEnv: string | undefined): {
  BUILD_CHANNEL: string;
  IS_INTERNAL_BUILD: boolean;
  IS_PUBLIC_BUILD: boolean;
} {
  const previous = process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  if (channelEnv === undefined) {
    delete process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  } else {
    process.env.NEXT_PUBLIC_BUILD_CHANNEL = channelEnv;
  }
  // bust module cache so re-evaluation reads the current env
  delete require.cache[require.resolve('../lib/build-flags')];
  const flags = require('../lib/build-flags') as typeof import('../lib/build-flags');
  // restore env so subsequent tests aren't perturbed
  if (previous === undefined) {
    delete process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  } else {
    process.env.NEXT_PUBLIC_BUILD_CHANNEL = previous;
  }
  return {
    BUILD_CHANNEL: flags.BUILD_CHANNEL,
    IS_INTERNAL_BUILD: flags.IS_INTERNAL_BUILD,
    IS_PUBLIC_BUILD: flags.IS_PUBLIC_BUILD,
  };
}

describe('BUILD_CHANNEL', () => {
  test('resolves to "public" when NEXT_PUBLIC_BUILD_CHANNEL is unset', () => {
    const flags = loadBuildFlags(undefined);
    expect(flags.BUILD_CHANNEL).toBe('public');
    expect(flags.IS_INTERNAL_BUILD).toBe(false);
    expect(flags.IS_PUBLIC_BUILD).toBe(true);
  });

  test('resolves to "internal" only when env is exactly "internal"', () => {
    const flags = loadBuildFlags('internal');
    expect(flags.BUILD_CHANNEL).toBe('internal');
    expect(flags.IS_INTERNAL_BUILD).toBe(true);
    expect(flags.IS_PUBLIC_BUILD).toBe(false);
  });

  test('typo-safe: any unrecognized value defaults to "public"', () => {
    // The whole point of the default-to-public posture is that a CI
    // misconfiguration like NEXT_PUBLIC_BUILD_CHANNEL=Internal (case)
    // or =intenral (typo) doesn't accidentally ship internal features.
    for (const garbage of ['Internal', 'INTERNAL', 'intenral', '', 'true']) {
      const flags = loadBuildFlags(garbage);
      expect(
        flags.BUILD_CHANNEL,
        `garbage value '${garbage}' should default to public`,
      ).toBe('public');
      expect(flags.IS_INTERNAL_BUILD).toBe(false);
    }
  });

  test('IS_INTERNAL_BUILD and IS_PUBLIC_BUILD are mutually exclusive', () => {
    const internal = loadBuildFlags('internal');
    expect(internal.IS_INTERNAL_BUILD).not.toBe(internal.IS_PUBLIC_BUILD);

    const pub = loadBuildFlags(undefined);
    expect(pub.IS_INTERNAL_BUILD).not.toBe(pub.IS_PUBLIC_BUILD);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  assertReleaseManifestHasArtifacts,
  assertStableReleasePrereqs,
  getMissingSigningEnv,
  isStableRelease,
  resolveBuildCommand,
} from '../desktop/scripts/release-checks';

describe('desktop release checks', () => {
  test('isStableRelease detects explicit flag', () => {
    expect(isStableRelease(['bun', 'release.ts', '--stable'], { ...process.env })).toBe(true);
    expect(isStableRelease(['bun', 'release.ts'], { ...process.env })).toBe(false);
  });

  test('isStableRelease detects stable env', () => {
    expect(
      isStableRelease(['bun', 'release.ts'], {
        ...process.env,
        ELECTROBUN_BUILD_ENV: 'stable',
      }),
    ).toBe(
      true,
    );
  });

  test('getMissingSigningEnv lists missing stable secrets', () => {
    const missing = getMissingSigningEnv({ ...process.env });
    expect(missing).toContain('APPLE_TEAM_ID');
    expect(missing).toContain('WINDOWS_CERT_SUBJECT');
  });

  test('assertStableReleasePrereqs throws when stable build is missing secrets', () => {
    expect(() =>
      assertStableReleasePrereqs(['bun', 'release.ts', '--stable'], {
        ...process.env,
        APPLE_TEAM_ID: '',
        APPLE_DEVELOPER_IDENTITY: '',
        APPLE_NOTARIZATION_APPLE_ID: '',
        APPLE_NOTARIZATION_PASSWORD: '',
        WINDOWS_CERT_SUBJECT: '',
      }),
    ).toThrow('Stable desktop release requires signing secrets.');
  });

  test('assertStableReleasePrereqs allows stable build when secrets are present', () => {
    expect(() =>
      assertStableReleasePrereqs(['bun', 'release.ts', '--stable'], {
        ...process.env,
        APPLE_TEAM_ID: 'team',
        APPLE_DEVELOPER_IDENTITY: 'identity',
        APPLE_NOTARIZATION_APPLE_ID: 'apple@example.com',
        APPLE_NOTARIZATION_PASSWORD: 'password',
        WINDOWS_CERT_SUBJECT: 'Coniva',
      }),
    ).not.toThrow();
  });

  test('assertReleaseManifestHasArtifacts rejects empty manifests', () => {
    expect(() =>
      assertReleaseManifestHasArtifacts({
        version: '1.0.0',
        releaseDate: '2026-03-28T00:00:00.000Z',
        releaseNotes: 'Release',
        platforms: {},
      }),
    ).toThrow('Release manifest must include at least one platform artifact.');
  });

  test('assertReleaseManifestHasArtifacts rejects manifests without files', () => {
    expect(() =>
      assertReleaseManifestHasArtifacts({
        version: '1.0.0',
        releaseDate: '2026-03-28T00:00:00.000Z',
        releaseNotes: 'Release',
        platforms: {
          'macos-arm64': {
            downloadUrl: null,
            files: [],
          },
        },
      }),
    ).toThrow('Release manifest must include at least one built artifact file.');
  });

  test('resolveBuildCommand switches between build and dist', () => {
    expect(resolveBuildCommand(true, '/repo')).toEqual([
      'corepack',
      'pnpm',
      '--dir',
      '/repo/desktop',
      'dist',
    ]);
    expect(resolveBuildCommand(false, '/repo')).toEqual([
      'corepack',
      'pnpm',
      '--dir',
      '/repo/desktop',
      'build',
    ]);
  });
});

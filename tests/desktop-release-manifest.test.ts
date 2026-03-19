import { describe, expect, test } from 'bun:test';
import type { ReleaseManifest } from '../desktop/scripts/release-types';
import { inferPlatformKey, isInstallerArtifact } from '../desktop/scripts/release-utils';

describe('ReleaseManifest schema', () => {
  function makeValidManifest(overrides?: Partial<ReleaseManifest>): ReleaseManifest {
    return {
      version: '1.0.0',
      releaseDate: new Date().toISOString(),
      releaseNotes: 'Initial release.',
      platforms: {
        'macos-arm64': {
          downloadUrl: 'https://updates.coniva.app/releases/Coniva-1.0.0-macos-arm64.dmg',
          files: ['Coniva-1.0.0-macos-arm64.dmg', 'Coniva-1.0.0-macos-arm64.zip'],
        },
      },
      ...overrides,
    };
  }

  test('valid manifest has required fields', () => {
    const manifest = makeValidManifest();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.releaseDate).toBeTruthy();
    expect(new Date(manifest.releaseDate).getTime()).not.toBeNaN();
    expect(manifest.releaseNotes.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.platforms).length).toBeGreaterThan(0);
  });

  test('platform entry has downloadUrl and files', () => {
    const manifest = makeValidManifest();
    for (const [key, platform] of Object.entries(manifest.platforms)) {
      expect(key).toBeTruthy();
      expect(platform.files).toBeInstanceOf(Array);
      expect(platform.files.length).toBeGreaterThan(0);
      if (platform.downloadUrl !== null) {
        expect(platform.downloadUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  test('semver validation', () => {
    const manifest = makeValidManifest({ version: '2.3.4' });
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('ISO 8601 date parsing', () => {
    const date = '2026-03-19T12:00:00.000Z';
    const manifest = makeValidManifest({ releaseDate: date });
    const parsed = new Date(manifest.releaseDate);
    expect(parsed.getTime()).not.toBeNaN();
    expect(parsed.toISOString()).toBe(date);
  });

  test('multi-platform manifest', () => {
    const manifest = makeValidManifest({
      platforms: {
        'macos-arm64': {
          downloadUrl: 'https://updates.coniva.app/releases/Coniva-1.0.0-macos-arm64.dmg',
          files: ['Coniva-1.0.0-macos-arm64.dmg'],
        },
        'macos-x64': {
          downloadUrl: null,
          files: ['Coniva-1.0.0-macos-x64.zip'],
        },
        'linux-x64': {
          downloadUrl: 'https://updates.coniva.app/releases/Coniva-1.0.0-linux-x64.deb',
          files: ['Coniva-1.0.0-linux-x64.deb', 'Coniva-1.0.0-linux-x64.AppImage'],
        },
      },
    });
    expect(Object.keys(manifest.platforms)).toEqual(['macos-arm64', 'macos-x64', 'linux-x64']);
  });
});

describe('inferPlatformKey', () => {
  // inferPlatformKey splits basename by '-' and joins segments[1]-segments[2].
  // Extension is NOT stripped (basename keeps it). In practice electrobun
  // generates filenames like AppName-os-arch-qualifier.ext where segments[1]
  // and segments[2] give the platform key.
  test('extracts platform from standard filenames', () => {
    // Pattern: Name-os-arch-extra.ext → segments[1]-segments[2] = os-arch
    expect(inferPlatformKey('Coniva-macos-arm64-installer.dmg')).toBe('macos-arm64');
    expect(inferPlatformKey('Coniva-linux-x64-installer.deb')).toBe('linux-x64');
    expect(inferPlatformKey('Coniva-windows-x64-setup.exe')).toBe('windows-x64');
  });

  test('3-segment filenames include extension in key', () => {
    // Name-os-arch.ext → segments = [Name, os, arch.ext]
    expect(inferPlatformKey('Coniva-macos-arm64.dmg')).toBe('macos-arm64.dmg');
  });

  test('returns null for short filenames', () => {
    expect(inferPlatformKey('README.md')).toBeNull();
    expect(inferPlatformKey('latest.json')).toBeNull();
  });
});

describe('isInstallerArtifact', () => {
  test('recognizes installer extensions', () => {
    expect(isInstallerArtifact('app.dmg')).toBe(true);
    expect(isInstallerArtifact('app.zip')).toBe(true);
    expect(isInstallerArtifact('app.deb')).toBe(true);
    expect(isInstallerArtifact('app.AppImage')).toBe(true);
    expect(isInstallerArtifact('app.exe')).toBe(true);
  });

  test('rejects non-installer extensions', () => {
    expect(isInstallerArtifact('latest.json')).toBe(false);
    expect(isInstallerArtifact('notes.txt')).toBe(false);
    expect(isInstallerArtifact('manifest.yaml')).toBe(false);
  });
});

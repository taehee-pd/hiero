import { describe, expect, test } from 'bun:test';
import {
  buildManifest,
  computeStaleFiles,
  parseManifest,
  serializeManifest,
  type ContourManifest,
} from '../lib/export/adapters/manifest-cleanup';

describe('computeStaleFiles', () => {
  test('detects files removed between generations', () => {
    const previous: ContourManifest = {
      version: '1.0',
      generatedAt: '2026-01-01T00:00:00Z',
      platform: 'react',
      files: ['A.tsx', 'B.tsx', 'index.ts'],
    };
    const stale = computeStaleFiles(previous, ['A.tsx', 'C.tsx', 'index.ts']);
    expect(stale).toEqual(['B.tsx']);
  });

  test('returns empty array when previous manifest is null', () => {
    expect(computeStaleFiles(null, ['A.tsx'])).toEqual([]);
  });

  test('returns empty array when all files still present', () => {
    const previous: ContourManifest = {
      version: '1.0',
      generatedAt: '2026-01-01T00:00:00Z',
      platform: 'react',
      files: ['A.tsx', 'B.tsx'],
    };
    expect(computeStaleFiles(previous, ['A.tsx', 'B.tsx', 'C.tsx'])).toEqual([]);
  });
});

describe('buildManifest', () => {
  test('sorts files alphabetically', () => {
    const manifest = buildManifest('react', ['z.ts', 'a.ts', 'm.ts'], '2026-01-01T00:00:00Z');
    expect(manifest.files).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });

  test('sets version, platform and generatedAt', () => {
    const manifest = buildManifest('flutter', ['x.dart'], '2026-03-19T12:00:00Z');
    expect(manifest.version).toBe('1.0');
    expect(manifest.platform).toBe('flutter');
    expect(manifest.generatedAt).toBe('2026-03-19T12:00:00Z');
  });
});

describe('parseManifest', () => {
  test('handles invalid JSON gracefully', () => {
    expect(parseManifest('not json{')).toBeNull();
  });

  test('rejects non-1.0 version', () => {
    const json = JSON.stringify({ version: '2.0', files: [], generatedAt: '', platform: 'react' });
    expect(parseManifest(json)).toBeNull();
  });

  test('rejects object without files array', () => {
    const json = JSON.stringify({ version: '1.0', files: 'not-an-array', generatedAt: '', platform: 'react' });
    expect(parseManifest(json)).toBeNull();
  });

  test('parses valid manifest', () => {
    const manifest: ContourManifest = {
      version: '1.0',
      generatedAt: '2026-01-01T00:00:00Z',
      platform: 'react',
      files: ['A.tsx', 'B.tsx'],
    };
    const parsed = parseManifest(JSON.stringify(manifest));
    expect(parsed).toEqual(manifest);
  });
});

describe('round-trip', () => {
  test('parseManifest(serializeManifest(m)) deep equals m', () => {
    const original: ContourManifest = {
      version: '1.0',
      generatedAt: '2026-03-19T10:30:00Z',
      platform: 'swift',
      files: ['Icon.swift', 'Assets.xcassets', 'Package.swift'],
    };
    const roundTripped = parseManifest(serializeManifest(original));
    expect(roundTripped).not.toBeNull();
    expect(roundTripped!.version).toBe(original.version);
    expect(roundTripped!.generatedAt).toBe(original.generatedAt);
    expect(roundTripped!.platform).toBe(original.platform);
    expect(roundTripped!.files).toEqual(original.files);
  });
});

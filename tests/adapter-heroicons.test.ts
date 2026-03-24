import { describe, expect, test } from 'bun:test';
import { heroiconsAdapter } from '../lib/import/adapters/heroicons-adapter';
import {
  getHeroiconsManifest,
  getHeroiconsVersion,
  loadHeroicon,
} from '../lib/import/adapters/heroicons-source';
import { ExternalIconImportError } from '../lib/import/adapter-sdk';

describe('Heroicons source resolver', () => {
  test('getHeroiconsVersion returns a version string', () => {
    const version = getHeroiconsVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('getHeroiconsManifest returns a non-empty list', () => {
    const manifest = getHeroiconsManifest();
    expect(manifest.length).toBeGreaterThan(100);
    expect(manifest[0]!.name).toBeTruthy();
  });

  test('loadHeroicon returns icon data for known icon', () => {
    const data = loadHeroicon('academic-cap', 'outline');
    expect(data).not.toBeNull();
    expect(data!.name).toBe('academic-cap');
    expect(data!.svgContent).toContain('<svg');
    expect(data!.svgContent).toContain('<path');
  });

  test('loadHeroicon returns null for unknown icon', () => {
    expect(loadHeroicon('nonexistent-icon-xyz')).toBeNull();
  });
});

describe('Heroicons adapter', () => {
  test('descriptor has correct metadata', () => {
    expect(heroiconsAdapter.descriptor.id).toBe('heroicons');
    expect(heroiconsAdapter.descriptor.capabilities.searchable).toBe(true);
    expect(heroiconsAdapter.descriptor.capabilities.license).toBe('MIT');
  });

  test('fetch returns valid SVG for known icon', async () => {
    const result = await heroiconsAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'academic-cap',
    });
    expect(result.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('viewBox');
    expect(result.provenance.adapterId).toBe('heroicons');
    expect(result.provenance.sourceLicense).toBe('MIT');
  });

  test('fetch throws for unknown icon', async () => {
    await expect(
      heroiconsAdapter.fetch({
        mode: 'library-icon-name',
        iconId: 'nonexistent-xyz',
      }),
    ).rejects.toThrow(ExternalIconImportError);
  });

  test('fetch rejects unsupported input mode', async () => {
    await expect(
      heroiconsAdapter.fetch({
        mode: 'raw-svg-string',
        svgContent: '<svg/>',
      }),
    ).rejects.toThrow(ExternalIconImportError);
  });

  test('search returns results for query', async () => {
    const results = await heroiconsAdapter.search!('arrow', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0]!.iconId).toContain('arrow');
  });

  test('search returns results for empty query', async () => {
    const results = await heroiconsAdapter.search!('', { limit: 10 });
    expect(results.length).toBe(10);
  });
});

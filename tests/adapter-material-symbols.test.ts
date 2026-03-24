import { describe, expect, test } from 'bun:test';
import { materialSymbolsAdapter } from '../lib/import/adapters/material-symbols-adapter';
import {
  getMaterialSymbolsManifest,
  getMaterialSymbolsVersion,
  loadMaterialSymbol,
} from '../lib/import/adapters/material-symbols-source';
import { ExternalIconImportError } from '../lib/import/adapter-sdk';

describe('Material Symbols source resolver', () => {
  test('getMaterialSymbolsVersion returns a version string', () => {
    const version = getMaterialSymbolsVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('getMaterialSymbolsManifest returns a non-empty list', () => {
    const manifest = getMaterialSymbolsManifest();
    expect(manifest.length).toBeGreaterThan(1000);
    expect(manifest[0]!.name).toBeTruthy();
  });

  test('loadMaterialSymbol loads outlined variant', () => {
    const data = loadMaterialSymbol('search', 'outlined');
    expect(data).not.toBeNull();
    expect(data!.svgContent).toContain('<svg');
    expect(data!.svgContent).toContain('viewBox');
  });

  test('loadMaterialSymbol normalizes width/height to 24', () => {
    const data = loadMaterialSymbol('search', 'outlined');
    expect(data).not.toBeNull();
    expect(data!.svgContent).toContain('width="24"');
    expect(data!.svgContent).toContain('height="24"');
  });

  test('loadMaterialSymbol normalizes viewBox and scales geometry to 24x24 space', () => {
    const data = loadMaterialSymbol('search', 'outlined');
    expect(data).not.toBeNull();
    expect(data!.svgContent).toContain('viewBox="0 0 24 24"');
    expect(data!.svgContent).toContain('transform="translate(0 24) scale(0.025)"');
  });

  test('loadMaterialSymbol returns null for unknown icon', () => {
    expect(loadMaterialSymbol('nonexistent-xyz')).toBeNull();
  });
});

describe('Material Symbols adapter', () => {
  test('descriptor has correct metadata', () => {
    expect(materialSymbolsAdapter.descriptor.id).toBe('material-symbols');
    expect(materialSymbolsAdapter.descriptor.capabilities.searchable).toBe(true);
    expect(materialSymbolsAdapter.descriptor.capabilities.license).toBe('Apache-2.0');
  });

  test('fetch returns valid SVG for known icon', async () => {
    const result = await materialSymbolsAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'search',
    });
    expect(result.svgContent).toContain('<svg');
    expect(result.provenance.adapterId).toBe('material-symbols');
    expect(result.provenance.sourceLicense).toBe('Apache-2.0');
  });

  test('fetch throws for unknown icon', async () => {
    await expect(
      materialSymbolsAdapter.fetch({
        mode: 'library-icon-name',
        iconId: 'nonexistent-xyz',
      }),
    ).rejects.toThrow(ExternalIconImportError);
  });

  test('fetch rejects unsupported input mode', async () => {
    await expect(
      materialSymbolsAdapter.fetch({
        mode: 'raw-svg-string',
        svgContent: '<svg/>',
      }),
    ).rejects.toThrow(ExternalIconImportError);
  });

  test('search returns results for query', async () => {
    const results = await materialSymbolsAdapter.search!('search', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test('search returns results for empty query', async () => {
    const results = await materialSymbolsAdapter.search!('', { limit: 10 });
    expect(results.length).toBe(10);
  });
});

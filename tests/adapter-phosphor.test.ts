import { describe, expect, test } from 'bun:test';
import { phosphorAdapter } from '../lib/import/adapters/phosphor-adapter';
import {
  getPhosphorManifest,
  getPhosphorVersion,
  loadPhosphorIcon,
  loadPhosphorWeightPaths,
  PHOSPHOR_WEIGHT_MAP,
} from '../lib/import/adapters/phosphor-source';
import { ExternalIconImportError } from '../lib/import/adapter-sdk';

describe('Phosphor source resolver', () => {
  test('getPhosphorVersion returns a version string', () => {
    const version = getPhosphorVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('getPhosphorManifest returns a non-empty list', () => {
    const manifest = getPhosphorManifest();
    expect(manifest.length).toBeGreaterThan(500);
    expect(manifest[0]!.name).toBeTruthy();
  });

  test('loadPhosphorIcon loads regular weight', () => {
    const data = loadPhosphorIcon('acorn', 'regular');
    expect(data).not.toBeNull();
    expect(data!.svgContent).toContain('<svg');
    expect(data!.svgContent).toContain('viewBox');
  });

  test('loadPhosphorIcon loads thin weight', () => {
    const data = loadPhosphorIcon('acorn', 'thin');
    expect(data).not.toBeNull();
    expect(data!.weight).toBe('thin');
  });

  test('loadPhosphorIcon returns null for unknown icon', () => {
    expect(loadPhosphorIcon('nonexistent-xyz')).toBeNull();
  });

  test('PHOSPHOR_WEIGHT_MAP maps correctly', () => {
    expect(PHOSPHOR_WEIGHT_MAP.thin).toBe('ultralight');
    expect(PHOSPHOR_WEIGHT_MAP.light).toBe('light');
    expect(PHOSPHOR_WEIGHT_MAP.regular).toBe('regular');
    expect(PHOSPHOR_WEIGHT_MAP.bold).toBe('bold');
    // fill and duotone should NOT be in the mapping
    expect(PHOSPHOR_WEIGHT_MAP.fill).toBeUndefined();
    expect(PHOSPHOR_WEIGHT_MAP.duotone).toBeUndefined();
  });

  test('loadPhosphorWeightPaths returns paths for known icon', () => {
    const paths = loadPhosphorWeightPaths('acorn');
    expect(paths.ultralight).toBeTruthy();
    expect(paths.regular).toBeTruthy();
    expect(paths.bold).toBeTruthy();
  });
});

describe('Phosphor adapter', () => {
  test('descriptor has correct metadata', () => {
    expect(phosphorAdapter.descriptor.id).toBe('phosphor');
    expect(phosphorAdapter.descriptor.capabilities.searchable).toBe(true);
    expect(phosphorAdapter.descriptor.capabilities.license).toBe('MIT');
  });

  test('fetch returns valid SVG for known icon', async () => {
    const result = await phosphorAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'acorn',
    });
    expect(result.svgContent).toContain('<svg');
    expect(result.provenance.adapterId).toBe('phosphor');
    expect(result.metadata?.hasWeightControlPoints).toBe(true);
  });

  test('fetch throws for unknown icon', async () => {
    await expect(
      phosphorAdapter.fetch({
        mode: 'library-icon-name',
        iconId: 'nonexistent-xyz',
      }),
    ).rejects.toThrow(ExternalIconImportError);
  });

  test('search returns results', async () => {
    const results = await phosphorAdapter.search!('arrow', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
  });
});

import { describe, expect, test } from 'bun:test';

import {
  exportCompiledIcon,
  exportCompiledIconFile,
  serializeCompiledJson,
  validateCompiledIconOrThrow,
} from '../lib/export/export-compiled-icon';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

describe('compiled icon export adapter', () => {
  test('resolves token references to concrete values', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-home']!;
    icon.variants.v24.layers.roof.style.stroke = {
      mode: 'token',
      token: 'accent',
    };

    const compiled = exportCompiledIcon(project, icon.id);
    const layer = compiled.variants.v24.layers.layers.find(
      (item: { id: string }) => item.id === 'roof',
    );

    expect(layer?.style.stroke).toBe('#38bdf8');
  });

  test('exports layers in deterministic draw order', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const variant = project.icons['icon-home']!.variants.v24;
    variant.layers = {
      roof: variant.layers.roof,
      house: variant.layers.house,
    };

    const compiled = exportCompiledIcon(project, 'icon-home');
    const layers = compiled.variants.v24.layers.layers;
    expect(layers.map((layer: { id: string }) => layer.id)).toEqual(['house', 'roof']);
  });

  test('omits identity transform', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    project.icons['icon-home']!.variants.v24.layers.roof.transform = {
      x: 0,
      y: 0,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
    };

    const compiled = exportCompiledIcon(project, 'icon-home');
    const layer = compiled.variants.v24.layers.layers.find(
      (item: { id: string }) => item.id === 'roof',
    );

    expect(layer?.transform).toBeUndefined();
  });

  test('produces stable content hash and deterministic file output', () => {
    const first = exportCompiledIconFile(structuredClone(SAMPLE_PROJECT), 'icon-home');
    const second = exportCompiledIconFile(structuredClone(SAMPLE_PROJECT), 'icon-home');

    expect(first.path).toBe('icon-home.compiled.json');
    expect(first.compiled.meta.contentHash).toBe(second.compiled.meta.contentHash);
    expect(first.contents).toBe(second.contents);
  });

  test('fails validation on malformed compiled payload before write', () => {
    const compiled = exportCompiledIcon(structuredClone(SAMPLE_PROJECT), 'icon-home');
    const malformed = {
      ...compiled,
      $schema: 'https://coniva.dev/schemas/compiled-icon/2.0.0',
    };

    expect(() => validateCompiledIconOrThrow(malformed)).toThrow(
      'Malformed CompiledIcon payload.',
    );
    expect(() => serializeCompiledJson(malformed)).not.toThrow();
  });
});

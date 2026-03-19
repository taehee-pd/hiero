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
    const icon = project.icons['icon-chevron']!;
    icon.variants.v24.states.default.layers.chevron.style.stroke = {
      mode: 'token',
      token: 'accent',
    };

    const compiled = exportCompiledIcon(project, icon.id);
    const layer = compiled.variants.v24.states.default.modes.monochrome.layers.find(
      (item) => item.id === 'chevron',
    );

    expect(layer?.style.stroke).toBe('#38bdf8');
  });

  test('materializes all rendering modes for each state', () => {
    const compiled = exportCompiledIcon(structuredClone(SAMPLE_PROJECT), 'icon-chevron');
    const modes = compiled.variants.v24.states.default.modes;

    expect(Object.keys(modes).sort()).toEqual([
      'hierarchical',
      'monochrome',
      'multicolor',
      'palette',
    ]);
  });

  test('exports layers in deterministic draw order', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const state = project.icons['icon-chevron']!.variants.v24.states.default;
    state.layers = {
      chevron: state.layers.chevron,
      'accent-dot': state.layers['accent-dot'],
      'bg-circle': state.layers['bg-circle'],
    };

    const compiled = exportCompiledIcon(project, 'icon-chevron');
    const layers = compiled.variants.v24.states.default.modes.monochrome.layers;
    expect(layers.map((layer) => layer.id)).toEqual(['accent-dot', 'bg-circle', 'chevron']);
  });

  test('omits identity transform', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    project.icons['icon-chevron']!.variants.v24.states.default.layers.chevron.transform = {
      x: 0,
      y: 0,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
    };

    const compiled = exportCompiledIcon(project, 'icon-chevron');
    const layer = compiled.variants.v24.states.default.modes.monochrome.layers.find(
      (item) => item.id === 'chevron',
    );

    expect(layer?.transform).toBeUndefined();
  });

  test('produces stable content hash and deterministic file output', () => {
    const first = exportCompiledIconFile(structuredClone(SAMPLE_PROJECT), 'icon-chevron');
    const second = exportCompiledIconFile(structuredClone(SAMPLE_PROJECT), 'icon-chevron');

    expect(first.path).toBe('icon-chevron.compiled.json');
    expect(first.compiled.meta.contentHash).toBe(second.compiled.meta.contentHash);
    expect(first.contents).toBe(second.contents);
  });

  test('fails validation on malformed compiled payload before write', () => {
    const compiled = exportCompiledIcon(structuredClone(SAMPLE_PROJECT), 'icon-chevron');
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

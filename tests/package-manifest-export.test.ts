import { describe, expect, test } from 'bun:test';

import { isPackageManifest } from '../lib/compiler-contracts';
import { exportCompiledIconFile } from '../lib/export/export-compiled-icon';
import {
  generatePackageManifest,
  generatePackageManifestFile,
} from '../lib/export/export-package-manifest';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function buildCompiledOutputs() {
  const project = structuredClone(SAMPLE_PROJECT);
  return [
    exportCompiledIconFile(project, 'icon-home'),
    exportCompiledIconFile(project, 'icon-search'),
  ];
}

describe('package manifest generation', () => {
  test('generates a multi-icon manifest keyed by stable icon id', () => {
    const outputs = buildCompiledOutputs();
    const result = generatePackageManifestFile(outputs, {
      package: {
        name: '@coniva/icons',
        version: '1.2.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
    });

    expect(result.path).toBe('icons.manifest.json');
    expect(Object.keys(result.manifest.icons)).toEqual(['icon-home', 'icon-search']);
    expect(result.manifest.icons['icon-home']?.compiledPath).toBe('icon-home.compiled.json');
    expect(isPackageManifest(result.manifest)).toBeTrue();
  });

  test('sorts supportedSizes ascending', () => {
    const [first] = buildCompiledOutputs();
    const compiled = structuredClone(first.compiled);

    compiled.variants.v16 = {
      size: 16,
      viewBox: [0, 0, 16, 16],
      states: structuredClone(compiled.variants.v24.states),
    };

    const manifest = generatePackageManifest(
      [{ path: first.path, compiled }],
      {
        package: {
          name: '@coniva/icons',
          version: '1.2.0',
          builtAt: '2026-03-10T00:00:00.000Z',
        },
      },
    );

    expect(manifest.icons['icon-home']?.supportedSizes).toEqual([16, 24]);
  });

  test('aggregates supportedModes across all states', () => {
    const [first] = buildCompiledOutputs();
    const compiled = structuredClone(first.compiled) as any;
    compiled.variants.v24.states.default.modes = {
      monochrome: compiled.variants.v24.states.default.modes.monochrome,
      multicolor: compiled.variants.v24.states.default.modes.multicolor,
    };

    const manifest = generatePackageManifest(
      [{ path: first.path, compiled }],
      {
        package: {
          name: '@coniva/icons',
          version: '1.2.0',
          builtAt: '2026-03-10T00:00:00.000Z',
        },
      },
    );

    expect(manifest.icons['icon-home']?.supportedModes).toEqual([
      'monochrome',
      'multicolor',
    ]);
  });

  test('sets hasAnimation for animated vs non-animated icons', () => {
    const outputs = buildCompiledOutputs();
    const animatedIcon = structuredClone(outputs[0]!);
    animatedIcon.compiled.transitions = [
      {
        from: 'default',
        to: 'active',
        durationMs: 180,
        easing: 'linear',
        strategy: 'track',
        bindings: [],
      },
    ];
    const staticIcon = structuredClone(outputs[1]!);
    staticIcon.compiled.transitions = [];
    staticIcon.compiled.effects = [];

    const manifest = generatePackageManifest([animatedIcon, staticIcon], {
      package: {
        name: '@coniva/icons',
        version: '1.2.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
    });

    expect(manifest.icons['icon-home']?.hasAnimation).toBeTrue();
    expect(manifest.icons['icon-search']?.hasAnimation).toBeFalse();
  });

  test('sets hasMorphTransition based on strategy or binding morph', () => {
    const [first] = buildCompiledOutputs();
    const strategyMorph = structuredClone(first);
    strategyMorph.compiled.transitions = [
      {
        from: 'default',
        to: 'active',
        durationMs: 200,
        easing: 'linear',
        strategy: 'strictMorph',
        bindings: [],
      },
    ];

    const bindingMorph = structuredClone(first);
    bindingMorph.compiled.transitions = [
      {
        from: 'default',
        to: 'active',
        durationMs: 200,
        easing: 'linear',
        strategy: 'track',
        bindings: [
          {
            fromLayerId: 'a',
            toLayerId: 'b',
            morph: {
              topology: 'bestGuess',
              mixer: 'flubber',
            },
          },
        ],
      },
    ];

    const manifestFromStrategy = generatePackageManifest([strategyMorph], {
      package: {
        name: '@coniva/icons',
        version: '1.2.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
    });
    const manifestFromBinding = generatePackageManifest([bindingMorph], {
      package: {
        name: '@coniva/icons',
        version: '1.2.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
    });

    expect(manifestFromStrategy.icons['icon-home']?.hasMorphTransition).toBeTrue();
    expect(manifestFromBinding.icons['icon-home']?.hasMorphTransition).toBeTrue();
  });

  test('throws when package contains mixed compiled schema versions', () => {
    const outputs = buildCompiledOutputs();
    const mismatch = structuredClone(outputs[1]!);
    mismatch.compiled.$schema = 'https://coniva.dev/schemas/compiled-icon/2.0.0' as any;

    expect(() =>
      generatePackageManifest([outputs[0]!, mismatch], {
        package: {
          name: '@coniva/icons',
          version: '1.2.0',
          builtAt: '2026-03-10T00:00:00.000Z',
        },
      }),
    ).toThrow('Compiled icon schema version mismatch: 1.0.0, 2.0.0');
  });

  test('emits empty collections by default', () => {
    const manifest = generatePackageManifest(buildCompiledOutputs(), {
      package: {
        name: '@coniva/icons',
        version: '1.2.0',
        builtAt: '2026-03-10T00:00:00.000Z',
      },
    });

    expect(manifest.collections).toEqual({});
  });
});

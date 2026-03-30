import { describe, expect, test } from 'bun:test';

import type { CompiledIcon, PackageManifest } from '../lib/compiler-contracts';
import { generateReactIconComponents } from '../lib/export/export-react-components';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';
import manifestFixture from './fixtures/compiler-contracts/package-manifest.json';

function makeCompiledIcon(id: string, componentName: string, size: number): CompiledIcon {
  const icon = structuredClone(compiledIconFixture) as unknown as CompiledIcon;
  icon.id = id;
  icon.componentName = componentName;
  icon.name = componentName;
  icon.variants = {
    [`${size}`]: {
      size,
      viewBox: [0, 0, size, size],
      layers: structuredClone(icon.variants['24'].layers),
    },
  };
  return icon;
}

function makeManifest(): PackageManifest {
  return structuredClone(manifestFixture) as PackageManifest;
}

function getFile(files: Array<{ path: string; contents: string }>, path: string): string {
  const file = files.find((entry) => entry.path === path);
  if (!file) throw new Error(`Missing file ${path}`);
  return file.contents;
}

describe('react code generation', () => {
  test('generates icon-specific prop literal unions', () => {
    const icon = makeCompiledIcon('icon-chevron', 'IcChevronRight', 24);
    icon.variants['16'] = {
      size: 16,
      viewBox: [0, 0, 16, 16],
      layers: structuredClone(icon.variants['24'].layers),
    };
    icon.effects = [
      { kind: 'pulse', durationMs: 240, easing: 'linear' },
      { kind: 'wiggle', durationMs: 320, easing: 'ease-in-out' },
    ];

    const manifest = makeManifest();
    manifest.icons['icon-chevron'] = {
      ...manifest.icons['icon-chevron']!,
      supportedSizes: [16, 24],
      supportedModes: ['monochrome', 'palette'],
      componentName: 'IcChevronRight',
    };

    const result = generateReactIconComponents([icon], manifest);
    const component = getFile(
      result.files,
      'generated/icons/IcChevronRight/IcChevronRight.tsx',
    );

    expect(component).toContain('size?: 16 | 24;');
    expect(component).toContain('state?: "default" | "active";');
    expect(component).toContain('renderingMode?: "monochrome" | "palette";');
    expect(component).toContain('animate?: "pulse" | "wiggle" | null;');
  });

  test('attaches static __iconMeta', () => {
    const icon = makeCompiledIcon('icon-chevron', 'IcChevronRight', 24);
    const manifest = makeManifest();

    const result = generateReactIconComponents([icon], manifest);
    const component = getFile(
      result.files,
      'generated/icons/IcChevronRight/IcChevronRight.tsx',
    );

    expect(component).toContain('__iconMeta');
    expect(component).toContain('= iconMeta;');
  });

  test('generates per-size entries for size-scoped imports', () => {
    const icon = makeCompiledIcon('icon-chevron', 'IcChevronRight', 24);
    icon.variants['48'] = {
      size: 48,
      viewBox: [0, 0, 48, 48],
      layers: structuredClone(icon.variants['24'].layers),
    };

    const manifest = makeManifest();
    manifest.icons['icon-chevron'] = {
      ...manifest.icons['icon-chevron']!,
      supportedSizes: [24, 48],
      componentName: 'IcChevronRight',
    };

    const result = generateReactIconComponents([icon], manifest);
    expect(
      result.files.some((file) => file.path === 'generated/sizes/24/IcChevronRight.ts'),
    ).toBeTrue();
    expect(
      result.files.some((file) => file.path === 'generated/sizes/48/IcChevronRight.ts'),
    ).toBeTrue();
  });

  test('generates collection entries from manifest', () => {
    const iconA = makeCompiledIcon('icon-chevron', 'IcChevronRight', 24);
    const iconB = makeCompiledIcon('icon-play', 'IcPlay', 24);
    const manifest = makeManifest();
    manifest.icons['icon-play'] = {
      ...manifest.icons['icon-chevron']!,
      id: 'icon-play',
      name: 'Play',
      componentName: 'IcPlay',
      compiledPath: 'icon-play.compiled.json',
    };
    manifest.collections = {
      media: {
        name: 'Media',
        iconIds: ['icon-play'],
      },
    };

    const result = generateReactIconComponents([iconA, iconB], manifest);
    const collection = getFile(result.files, 'generated/collections/media.ts');

    expect(collection).toContain('export { default as IcPlay }');
    expect(result.exports['./collections/media']).toBe('./generated/collections/media.ts');
  });

  test('generated component is forwardRef-based and delegates svg props to runtime renderer', () => {
    const icon = makeCompiledIcon('icon-chevron', 'IcChevronRight', 24);
    const manifest = makeManifest();

    const result = generateReactIconComponents([icon], manifest);
    const component = getFile(
      result.files,
      'generated/icons/IcChevronRight/IcChevronRight.tsx',
    );

    expect(component).toContain('forwardRef<SVGSVGElement');
    expect(component).toContain('ref={ref}');
    expect(component).toContain('<RuntimeIconRenderer ref={ref} icon={iconData as any} {...props} />');
  });
});

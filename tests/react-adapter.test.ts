import { describe, expect, test } from 'bun:test';
import type { Icon, IconType } from '../lib/schema/types';
import type {
  RuntimeIconMeta,
  RuntimeVariantPayload,
} from '../lib/export/export-runtime-json';
import {
  generateReactFromRuntime,
  type ReactAdapterInput,
} from '../lib/export/adapters/react-adapter';

// ---------------------------------------------------------------------------
// Test fixtures (matches runtime-react.test.tsx pattern)
// ---------------------------------------------------------------------------

function makeTestIcon(): Icon {
  const defaultType: IconType = {
    id: 'default',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#fff' } },
      },
      arrow: {
        id: 'arrow',
        path: { d: 'M8 5l8 7-8 7' },
        style: { stroke: { mode: 'currentColor' } },
      },
    },
  };

  const activeState: IconType = {
    id: 'active',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#eee' } },
      },
      arrow: {
        id: 'arrow',
        path: { d: 'M16 5l-8 7 8 7' },
        style: { stroke: { mode: 'currentColor' } },
      },
    },
  };

  return {
    id: 'icon-test',
    name: 'Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: defaultType.layers,
        defaultType: 'default',
        types: { default: defaultType, active: activeState },
      },
    },
    transitions: {
      'default-active': {
        id: 'default-active',
        fromIconId: 'icon-test',
        toIconId: 'icon-test',
        fromVariantId: 'v24',
        toVariantId: 'v24',
        from: 'default',
        to: 'active',
        strategy: 'lineAnimation',
        durationMs: 200,
        easing: 'ease-in-out',
        layerBindings: [],
      },
    },
  };
}

function makeMeta(icon: Icon): RuntimeIconMeta {
  return {
    id: icon.id,
    name: icon.name,
    variants: Object.fromEntries(
      Object.entries(icon.variants).map(([k, v]) => [
        k,
        { size: v.size, viewBox: v.viewBox },
      ]),
    ),
  };
}

function makeMockVariant(): RuntimeVariantPayload {
  return {
    variant: {
      id: 'v24',
      size: 24,
      viewBox: [0, 0, 24, 24],
    },
    layers: [
      {
        id: 'l1',
        d: 'M0 0',
        fill: { kind: 'solid', color: '#000' },
        stroke: { kind: 'none' },
      },
    ],
  };
}

function makeInput(icon?: Icon): ReactAdapterInput {
  const ic = icon ?? makeTestIcon();
  return {
    icon: ic,
    meta: makeMeta(ic),
    variants: [makeMockVariant()],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateReactFromRuntime', () => {
  test('generates component file and barrel index', () => {
    const result = generateReactFromRuntime([makeInput()]);

    // Should have at least 2 files: component + barrel index
    expect(result.files.length).toBeGreaterThanOrEqual(2);

    const componentFile = result.files.find((f) =>
      f.path.includes('TestIcon/TestIcon.tsx'),
    );
    expect(componentFile).toBeDefined();

    const indexFile = result.files.find((f) => f.path.endsWith('index.ts'));
    expect(indexFile).toBeDefined();
  });

  test('component contains HieroIcon import from runtime package', () => {
    const result = generateReactFromRuntime([makeInput()]);
    const component = result.files.find((f) =>
      f.path.includes('TestIcon.tsx'),
    )!;
    expect(component.contents).toContain(
      "import { HieroIcon } from '@hiero/runtime-react'",
    );
  });

  test('component contains custom runtime package when specified', () => {
    const result = generateReactFromRuntime([makeInput()], {
      runtimePackage: '@myorg/icons-runtime',
    });
    const component = result.files.find((f) =>
      f.path.includes('TestIcon.tsx'),
    )!;
    expect(component.contents).toContain(
      "import { HieroIcon } from '@myorg/icons-runtime'",
    );
  });

  test('component contains typed props with state union', () => {
    const result = generateReactFromRuntime([makeInput()]);
    const component = result.files.find((f) =>
      f.path.includes('TestIcon.tsx'),
    )!;

    expect(component.contents).toContain('export type TestIconProps');
    // Should contain state options for default and active
    expect(component.contents).toContain('"default"');
    expect(component.contents).toContain('"active"');
  });

  test('barrel index re-exports all components', () => {
    const icon1 = makeTestIcon();
    const icon2: Icon = {
      ...makeTestIcon(),
      id: 'icon-arrow',
      name: 'Arrow Right',
    };

    const result = generateReactFromRuntime([
      makeInput(icon1),
      makeInput(icon2),
    ]);

    const indexFile = result.files.find((f) =>
      f.path.endsWith('index.ts'),
    )!;

    expect(indexFile.contents).toContain("export { TestIcon }");
    expect(indexFile.contents).toContain("export { ArrowRight }");
    expect(indexFile.contents).toContain("export type { TestIconProps }");
    expect(indexFile.contents).toContain("export type { ArrowRightProps }");
  });

  test('respects outputDir option', () => {
    const result = generateReactFromRuntime([makeInput()], {
      outputDir: 'packages/icons',
    });

    for (const file of result.files) {
      expect(file.path.startsWith('packages/icons/')).toBe(true);
    }
  });

  test('generates .jsx extension when typescript is false', () => {
    const result = generateReactFromRuntime([makeInput()], {
      typescript: false,
    });
    const componentFile = result.files.find((f) =>
      f.path.includes('TestIcon'),
    );
    expect(componentFile!.path).toContain('.jsx');
    // Should NOT contain TypeScript type annotations
    expect(componentFile!.contents).not.toContain('export type TestIconProps');
  });

  test('component embeds the icon data as JSON', () => {
    const result = generateReactFromRuntime([makeInput()]);
    const component = result.files.find((f) =>
      f.path.includes('TestIcon.tsx'),
    )!;

    // Should contain the embedded icon data
    expect(component.contents).toContain('const iconData =');
    expect(component.contents).toContain('"icon-test"');
  });

  test('returns no diagnostics for React-compatible payloads', () => {
    const result = generateReactFromRuntime([makeInput()]);
    expect(result.diagnostics).toHaveLength(0);
  });
});

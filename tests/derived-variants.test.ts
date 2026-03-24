import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock Paper.js runtime (same pattern as tests/boolean-ops.test.ts)
// ---------------------------------------------------------------------------

class FakeSize {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
}

class FakeCompoundPath {
  pathData: string;
  bounds = { intersects: () => true };

  constructor(arg: string | { pathData: string; insert?: boolean }) {
    this.pathData = typeof arg === 'string' ? arg : arg.pathData;
  }

  unite(other: FakeCompoundPath) {
    return new FakeCompoundPath(`${this.pathData}+${other.pathData}`);
  }
  subtract(other: FakeCompoundPath) {
    return new FakeCompoundPath(`${this.pathData}-${other.pathData}`);
  }
  intersect(other: FakeCompoundPath) {
    return new FakeCompoundPath(`${this.pathData}&${other.pathData}`);
  }
  exclude(other: FakeCompoundPath) {
    return new FakeCompoundPath(`${this.pathData}^${other.pathData}`);
  }

  getPathData() {
    return this.pathData;
  }
  remove() {}
}

class FakePaperScope {
  Size = FakeSize;
  CompoundPath = FakeCompoundPath;
  project = { clear() {}, remove() {} };
  view = { remove() {} };
  setup() {}
  activate() {}
  remove() {}
}

mock.module('../lib/editor-core/paper-runtime', () => ({
  loadPaperGlobal: async () => ({
    PaperScope: FakePaperScope,
    Size: FakeSize,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mock setup
// ---------------------------------------------------------------------------

// @ts-expect-error -- bun supports top-level await but tsconfig doesn't
const variantDerivation = await import('../lib/schema/variant-derivation');
const { applyDerivedVariant, createDerivedVariantSpec, canDeriveVariant, availableModifiers } =
  variantDerivation;
import type { Icon, Layer, State, Variant } from '../lib/schema/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeLayer(id: string, d: string, opts?: Partial<Layer>): Layer {
  return {
    path: { d, normalized: [] },
    style: {
      fill: { mode: 'currentColor' as const },
      stroke: { mode: 'fixed' as const, value: '#000000' },
      strokeWidth: 2,
    },
    visible: true,
    locked: false,
    ...opts,
  } as Layer;
}

function makeState(layers: Record<string, Layer>): State {
  return { layers } as State;
}

function makeVariant(id: string, states: Record<string, State>): Variant {
  return {
    id,
    name: id,
    size: 24,
    viewBox: [0, 0, 24, 24] as [number, number, number, number],
    states,
  } as Variant;
}

function makeIcon(opts?: {
  components?: Icon['components'];
  layers?: Record<string, Layer>;
}): Icon {
  const layers = opts?.layers ?? {
    'primary-layer': makeLayer('primary-layer', 'M0 0L24 24'),
    'secondary-layer': makeLayer('secondary-layer', 'M0 24L24 0'),
  };
  return {
    id: 'test-icon',
    name: 'Test Icon',
    variants: {
      '24': makeVariant('24', {
        default: makeState(layers),
      }),
    },
    transitions: {},
    components: opts?.components,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('canDeriveVariant', () => {
  test('fill is always available', () => {
    expect(canDeriveVariant(makeIcon(), '24', 'fill')).toBe(true);
  });

  test('slash requires slash component', () => {
    expect(canDeriveVariant(makeIcon(), '24', 'slash')).toBe(false);
    expect(
      canDeriveVariant(
        makeIcon({ components: { slash: { kind: 'slash', layerIds: ['s1'] } } }),
        '24',
        'slash',
      ),
    ).toBe(true);
  });

  test('circle/square require enclosure component', () => {
    expect(canDeriveVariant(makeIcon(), '24', 'circle')).toBe(false);
    expect(
      canDeriveVariant(
        makeIcon({ components: { enc: { kind: 'enclosure', layerIds: ['e1'] } } }),
        '24',
        'circle',
      ),
    ).toBe(true);
  });

  test('badge requires badge component', () => {
    expect(canDeriveVariant(makeIcon(), '24', 'badge')).toBe(false);
    expect(
      canDeriveVariant(
        makeIcon({ components: { badge: { kind: 'badge', layerIds: ['b1'] } } }),
        '24',
        'badge',
      ),
    ).toBe(true);
  });

  test('returns false for non-existent variant', () => {
    expect(canDeriveVariant(makeIcon(), 'nonexistent', 'fill')).toBe(false);
  });
});

describe('availableModifiers', () => {
  test('returns only fill for icon with no components', () => {
    expect(availableModifiers(makeIcon(), '24')).toEqual(['fill']);
  });

  test('returns all modifiers when all components present', () => {
    const icon = makeIcon({
      components: {
        enc: { kind: 'enclosure', layerIds: ['e1'] },
        slash: { kind: 'slash', layerIds: ['s1'] },
        badge: { kind: 'badge', layerIds: ['b1'] },
      },
    });
    expect(availableModifiers(icon, '24')).toEqual([
      'fill',
      'circle',
      'square',
      'slash',
      'badge',
    ]);
  });
});

describe('applyDerivedVariant', () => {
  test('fill derivation flips stroke to fill on stroke-only layers', async () => {
    // Layer with stroke but NO fill — eligible for fill derivation
    const strokeOnlyLayer = makeLayer('stroke-only', 'M0 0L24 24', {
      style: {
        fill: undefined as unknown as Layer['style'] extends undefined ? never : NonNullable<Layer['style']>['fill'],
        stroke: { mode: 'fixed' as const, value: '#FF0000' },
        strokeWidth: 2,
      },
    });
    const icon = makeIcon({
      layers: { 'primary-layer': strokeOnlyLayer },
    });
    const spec = createDerivedVariantSpec('24', 'fill');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.variants['24.fill']).toBeDefined();
    const derivedState = result.variants['24.fill']!.states.default;
    const layer = derivedState.layers['primary-layer'];
    // Fill should now have the stroke's value
    expect(layer.style?.fill).toEqual({ mode: 'fixed', value: '#FF0000' });
    // Stroke should be cleared
    expect(layer.style?.strokeWidth).toBe(0);
  });

  test('fill derivation skips layers that already have fill (including currentColor)', async () => {
    // Default makeIcon layers have both currentColor fill and fixed stroke
    const icon = makeIcon();
    const spec = createDerivedVariantSpec('24', 'fill');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.variants['24.fill']).toBeDefined();
    const derivedState = result.variants['24.fill']!.states.default;
    const layer = derivedState.layers['primary-layer'];
    // Layer already has fill (currentColor) — should NOT be converted
    expect(layer.style?.fill).toEqual({ mode: 'currentColor' });
    // Stroke should remain
    expect(layer.style?.stroke).toEqual({ mode: 'fixed', value: '#000000' });
  });

  test('fill derivation stores spec in meta.derivedSpecs', async () => {
    const icon = makeIcon();
    const spec = createDerivedVariantSpec('24', 'fill');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.meta?.derivedSpecs).toHaveLength(1);
    expect(result.meta!.derivedSpecs![0]).toEqual(spec);
  });

  test('slash derivation calls booleanOp subtract', async () => {
    const icon = makeIcon({
      components: { slash: { kind: 'slash', layerIds: ['slash-layer'] } },
      layers: {
        'primary-layer': makeLayer('primary-layer', 'M0 0L24 24'),
        'slash-layer': makeLayer('slash-layer', 'M0 12L24 12'),
      },
    });
    const spec = createDerivedVariantSpec('24', 'slash');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.variants['24.slash']).toBeDefined();
    const derivedState = result.variants['24.slash']!.states.default;
    // Primary layer should have subtracted path
    expect(derivedState.layers['primary-layer'].path?.d).toContain('-');
    // Slash layer should be hidden
    expect(derivedState.layers['slash-layer'].visible).toBe(false);
  });

  test('circle derivation calls booleanOp unite', async () => {
    const icon = makeIcon({
      components: { enc: { kind: 'enclosure', layerIds: ['enc-layer'] } },
      layers: {
        'primary-layer': makeLayer('primary-layer', 'M0 0L24 24'),
        'enc-layer': makeLayer('enc-layer', 'M2 2A10 10 0 1 0 22 22'),
      },
    });
    const spec = createDerivedVariantSpec('24', 'circle');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.variants['24.circle']).toBeDefined();
    const derivedState = result.variants['24.circle']!.states.default;
    // Primary layer should have united path
    expect(derivedState.layers['primary-layer'].path?.d).toContain('+');
    // Enclosure layer should be hidden
    expect(derivedState.layers['enc-layer'].visible).toBe(false);
  });

  test('badge derivation keeps badge visible', async () => {
    const icon = makeIcon({
      components: { badge: { kind: 'badge', layerIds: ['badge-layer'] } },
      layers: {
        'primary-layer': makeLayer('primary-layer', 'M0 0L24 24'),
        'badge-layer': makeLayer('badge-layer', 'M18 0L24 6'),
      },
    });
    const spec = createDerivedVariantSpec('24', 'badge');
    const result = await applyDerivedVariant(icon, spec);

    expect(result.variants['24.badge']).toBeDefined();
    const derivedState = result.variants['24.badge']!.states.default;
    // Primary layer should have subtracted path
    expect(derivedState.layers['primary-layer'].path?.d).toContain('-');
    // Badge layer should remain visible (not hidden)
    expect(derivedState.layers['badge-layer'].visible).toBe(true);
  });

  test('does not mutate original icon', async () => {
    const icon = makeIcon();
    const originalVariants = Object.keys(icon.variants);
    const spec = createDerivedVariantSpec('24', 'fill');
    const result = await applyDerivedVariant(icon, spec);

    expect(Object.keys(icon.variants)).toEqual(originalVariants);
    expect(Object.keys(result.variants)).toContain('24.fill');
    expect(icon.meta?.derivedSpecs).toBeUndefined();
  });

  test('throws for non-existent base variant', async () => {
    const icon = makeIcon();
    const spec = createDerivedVariantSpec('nonexistent', 'fill');
    await expect(applyDerivedVariant(icon, spec)).rejects.toThrow(
      'Base variant "nonexistent" not found',
    );
  });

  test('re-derive replaces existing derived spec', async () => {
    const icon = makeIcon();
    const spec = createDerivedVariantSpec('24', 'fill');
    const first = await applyDerivedVariant(icon, spec);
    const second = await applyDerivedVariant(first, spec);

    // Should still have exactly 1 spec (replaced, not duplicated)
    expect(second.meta?.derivedSpecs).toHaveLength(1);
  });
});

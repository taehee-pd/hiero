/**
 * W2-2 acceptance: editor store actions for compound layers.
 *
 *   - applyBoolean writes path.d AND compound atomically
 *   - patchLayer's path-invariant clears compound on direct path edits
 *   - flattenCompound drops compound, leaves path intact
 *   - convertToGroup explodes operands into sibling layers
 *
 * Paper.js is browser-only, so we mock `paper-runtime` with the
 * same FakeCompoundPath shape `tests/boolean-ops.test.ts` uses; the
 * editor-store actions then exercise without touching the real
 * runtime.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M5 5 L15 5 L15 15 L5 15 Z';
const SQUARE_C = 'M2 2 L8 2 L8 8 L2 8 Z';
const UNION_AB = 'M0 0 L15 0 L15 15 L0 15 Z';
const UNION_ABC = 'M0 0 L15 0 L15 15 L0 15 Z';
const SUBTRACT_AB = 'M0 0 L5 0 L5 10 L0 10 Z';
/** Sentinel path data that makes the fake paper ops throw (A5 rollback tests). */
const THROWING_PATH = 'THROW';

class FakeCompoundPath {
  pathData: string;
  bounds: { intersects: (other: { pathData: string }) => boolean };
  constructor(input: string | { pathData: string }) {
    this.pathData = typeof input === 'string' ? input : input.pathData;
    this.bounds = {
      intersects: (other) => this.pathData !== '' && other.pathData !== '',
    };
  }
  unite(other: FakeCompoundPath) {
    if (this.pathData === THROWING_PATH || other.pathData === THROWING_PATH) {
      throw new Error('fake paper unite failure');
    }
    return new FakeCompoundPath({ pathData: UNION_AB });
  }
  subtract(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: SUBTRACT_AB });
  }
  intersect(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: SQUARE_A });
  }
  exclude(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: `${SQUARE_A} ${SQUARE_B}` });
  }
  getPathData() {
    return this.pathData;
  }
  remove() {}
}
class FakeSize {
  constructor(_w: number, _h: number) {}
}
class FakePaperScope {
  Size = FakeSize;
  CompoundPath = FakeCompoundPath;
  project = { clear() {}, remove() {} };
  view = { remove() {} };
  setup(_size: unknown) {}
  activate() {}
  remove() {}
}
mock.module('../lib/editor-core/paper-runtime', () => ({
  loadPaperGlobal: async () => ({
    PaperScope: FakePaperScope,
    Size: FakeSize,
  }),
}));

import { editorStore } from '../lib/editor-store/store';
import { hasCompound } from '../lib/schema/compound';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import type { Icon, Layer } from '../lib/schema/types';

function bootstrapWithLayers(layerEntries: Array<[string, Layer]>): {
  iconId: string;
  variantId: string;
} {
  // Load the sample project, then surgically replace the active
  // variant's layers with the test fixture so the path-invariant
  // wiring runs against a known-good shape.
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  const state = editorStore.getState();
  const iconId = state.currentIconId!;
  const variantId = state.currentVariantId!;
  editorStore.setState((s) => {
    if (!s.project) return s;
    const icon = s.project.icons[iconId]!;
    const variant = icon.variants[variantId]!;
    const layers: Record<string, Layer> = {};
    for (const [id, layer] of layerEntries) {
      layers[id] = { ...layer, id };
    }
    const nextIcon: Icon = {
      ...icon,
      variants: {
        ...icon.variants,
        [variantId]: { ...variant, layers, topology: undefined },
      },
    };
    return {
      project: {
        ...s.project,
        icons: { ...s.project.icons, [iconId]: nextIcon },
      },
      selection: { layerIds: layerEntries.map(([id]) => id), pointIds: [] },
    };
  });
  return { iconId, variantId };
}

function activeLayer(layerId: string): Layer | undefined {
  const s = editorStore.getState();
  return s.project?.icons[s.currentIconId!]?.variants[s.currentVariantId!]?.layers[
    layerId
  ];
}

function makeLayer(id: string, d: string): [string, Layer] {
  return [
    id,
    {
      id,
      style: { fill: { mode: 'fixed', value: '#000' } },
      path: { d },
    } as Layer,
  ];
}

describe('applyBoolean (W2-2)', () => {
  beforeEach(() => {
    editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
  });

  test('writes path.d AND compound atomically when uniting two layers', async () => {
    bootstrapWithLayers([makeLayer('A', SQUARE_A), makeLayer('B', SQUARE_B)]);
    await editorStore.getState().applyBoolean('unite');

    const survivor = activeLayer('A');
    expect(survivor).toBeDefined();
    expect(survivor!.path?.d).toBeTruthy();
    expect(hasCompound(survivor!)).toBe(true);
    // Tree records both operands in author-supplied order.
    expect(survivor!.compound!.tree.kind).toBe('op');
    if (survivor!.compound!.tree.kind === 'op') {
      expect(survivor!.compound!.tree.op).toBe('unite');
    }
    // Consumed sibling is gone.
    expect(activeLayer('B')).toBeUndefined();
  });

  test('chained boolean over 3 layers builds a left-leaning tree', async () => {
    bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
      makeLayer('C', SQUARE_C),
    ]);
    await editorStore.getState().applyBoolean('subtract');
    const survivor = activeLayer('A')!;
    const tree = survivor.compound!.tree;
    expect(tree.kind).toBe('op');
    if (tree.kind !== 'op') throw new Error('unreachable');
    // Outer op is the last subtract.
    expect(tree.op).toBe('subtract');
    expect(tree.children.length).toBe(2);
    // Left child should itself be an op (the first subtract).
    expect(tree.children[0]!.kind).toBe('op');
  });

  test('repeated applyBoolean increments cacheVersion', async () => {
    bootstrapWithLayers([makeLayer('A', SQUARE_A), makeLayer('B', SQUARE_B)]);
    await editorStore.getState().applyBoolean('unite');
    const v1 = activeLayer('A')!.compound!.cacheVersion;

    // Add a new sibling and union again.
    editorStore.setState((s) => {
      if (!s.project) return s;
      const variant =
        s.project.icons[s.currentIconId!]!.variants[s.currentVariantId!]!;
      const layers = { ...variant.layers, C: makeLayer('C', SQUARE_C)[1] };
      return {
        project: {
          ...s.project,
          icons: {
            ...s.project.icons,
            [s.currentIconId!]: {
              ...s.project.icons[s.currentIconId!]!,
              variants: { ...variant.layers, [s.currentVariantId!]: { ...variant, layers } },
            },
          },
        },
        selection: { layerIds: ['A', 'C'], pointIds: [] },
      } as unknown as ReturnType<typeof editorStore.getState>;
    });
    await editorStore.getState().applyBoolean('unite');
    const v2 = activeLayer('A')!.compound!.cacheVersion;
    expect(v2).toBeGreaterThan(v1);
  });
});

describe('applyBoolean rollback on failure (A5)', () => {
  beforeEach(() => {
    editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
  });

  test('a throwing boolean op leaves layers, selection, and history untouched', async () => {
    bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', THROWING_PATH),
    ]);
    const before = editorStore.getState();
    const historyBefore = editorStore.temporal.getState().pastStates.length;

    await expect(editorStore.getState().applyBoolean('unite')).rejects.toThrow(
      'fake paper unite failure',
    );

    const after = editorStore.getState();
    // Pre-operation geometry survives verbatim — a failed op is a no-op.
    expect(after.project).toBe(before.project);
    expect(activeLayer('A')!.path?.d).toBe(SQUARE_A);
    expect(activeLayer('B')!.path?.d).toBe(THROWING_PATH);
    expect(after.selection.layerIds.sort()).toEqual(['A', 'B']);
    // No phantom undo entry for the failed operation.
    expect(editorStore.temporal.getState().pastStates.length).toBe(historyBefore);
    expect(after.isDirty).toBe(before.isDirty);
  });
});

describe('patchLayer path-invariant for compound (W2-1)', () => {
  beforeEach(() => {
    editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
  });

  test('direct path.d mutation clears compound and stamps formerCompound', async () => {
    const { iconId } = bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
    ]);
    await editorStore.getState().applyBoolean('unite');
    expect(hasCompound(activeLayer('A')!)).toBe(true);

    // Mutate path.d directly via patchLayer (no `compound` in patch).
    editorStore.getState().patchLayer(iconId, 'A', {
      path: { d: 'M0 0 L1 0 L1 1 L0 1 Z' },
    });

    const after = activeLayer('A')!;
    expect(hasCompound(after)).toBe(false);
    expect(after.formerCompound).toBe(true);
    expect(after.path?.d).toBe('M0 0 L1 0 L1 1 L0 1 Z');
  });

  test('patch carrying both path AND compound preserves the compound', async () => {
    const { iconId } = bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
    ]);
    await editorStore.getState().applyBoolean('unite');
    const before = activeLayer('A')!;
    const beforeCompound = before.compound!;

    editorStore.getState().patchLayer(iconId, 'A', {
      path: { d: 'M9 9 L10 9 L10 10 L9 10 Z' },
      compound: { ...beforeCompound, cacheVersion: beforeCompound.cacheVersion + 1 },
    });

    const after = activeLayer('A')!;
    expect(hasCompound(after)).toBe(true);
    expect(after.compound!.cacheVersion).toBe(beforeCompound.cacheVersion + 1);
  });
});

describe('flattenCompound (W2-2)', () => {
  beforeEach(() => {
    editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
  });

  test('drops compound and stamps formerCompound; preserves path.d', async () => {
    const { iconId } = bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
    ]);
    await editorStore.getState().applyBoolean('unite');
    const beforeD = activeLayer('A')!.path?.d;

    editorStore.getState().flattenCompound(iconId, 'A');
    const after = activeLayer('A')!;
    expect(hasCompound(after)).toBe(false);
    expect(after.formerCompound).toBe(true);
    expect(after.path?.d).toBe(beforeD!);
  });

  test('no-op on a layer that has no compound', () => {
    const { iconId } = bootstrapWithLayers([makeLayer('A', SQUARE_A)]);
    editorStore.getState().flattenCompound(iconId, 'A');
    const after = activeLayer('A')!;
    expect(hasCompound(after)).toBe(false);
    expect(after.formerCompound).toBeUndefined();
  });
});

describe('convertToGroup (W2-2)', () => {
  beforeEach(() => {
    editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
  });

  test('dedupes sibling ids when the canonical slot already exists (W2 audit §1)', async () => {
    // Pre-seed a layer at the canonical sibling-id slot
    // `${layerId}/${operandId}` so convertToGroup must dedupe.
    const { iconId } = bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
    ]);
    await editorStore.getState().applyBoolean('unite');
    const survivor = activeLayer('A')!;
    const operandIds = Object.keys(survivor.compound!.operands);
    const canonicalSiblingId = `A/${operandIds[0]!}`;
    // Inject a pre-existing layer at the canonical slot.
    editorStore.setState((s) => {
      if (!s.project) return s;
      const variant =
        s.project.icons[s.currentIconId!]!.variants[s.currentVariantId!]!;
      const layers = {
        ...variant.layers,
        [canonicalSiblingId]: makeLayer(canonicalSiblingId, 'M0 0 L1 0 L1 1 L0 1 Z')[1],
      };
      return {
        project: {
          ...s.project,
          icons: {
            ...s.project.icons,
            [s.currentIconId!]: {
              ...s.project.icons[s.currentIconId!]!,
              variants: {
                ...s.project.icons[s.currentIconId!]!.variants,
                [s.currentVariantId!]: { ...variant, layers },
              },
            },
          },
        },
      } as unknown as ReturnType<typeof editorStore.getState>;
    });

    editorStore.getState().convertToGroup(iconId, 'A');

    // The pre-existing layer at the canonical slot is preserved
    // unchanged; the convertToGroup output goes to a `~1` suffixed
    // slot.
    expect(activeLayer(canonicalSiblingId)).toBeDefined();
    expect(activeLayer(canonicalSiblingId)!.path?.d).toBe(
      'M0 0 L1 0 L1 1 L0 1 Z',
    );
    // The new sibling id has the dedupe suffix.
    expect(activeLayer(`${canonicalSiblingId}~1`)).toBeDefined();
  });

  test('explodes a 2-operand compound into 2 sibling layers', async () => {
    const { iconId } = bootstrapWithLayers([
      makeLayer('A', SQUARE_A),
      makeLayer('B', SQUARE_B),
    ]);
    await editorStore.getState().applyBoolean('unite');
    expect(hasCompound(activeLayer('A')!)).toBe(true);

    editorStore.getState().convertToGroup(iconId, 'A');

    // Compound layer is gone; two sibling layers remain.
    expect(activeLayer('A')).toBeUndefined();
    const siblings = ['A/A/op0', 'A/A/op1'].map(activeLayer);
    expect(siblings.every(Boolean)).toBe(true);
    // Sibling geometry restored from operand storage.
    expect(siblings[0]!.path?.d).toBe(SQUARE_A);
    expect(siblings[1]!.path?.d).toBe(SQUARE_B);
    // Selection follows the new siblings.
    expect(editorStore.getState().selection.layerIds.sort()).toEqual([
      'A/A/op0',
      'A/A/op1',
    ]);
  });
});

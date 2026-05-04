/**
 * W2-1 acceptance (regression): TopologyContract.layerPairs is keyed
 * off `path.d` and is identical for two layers that evaluate to the
 * same `path.d` regardless of their `compound.tree` shape.
 *
 * Two compound trees can produce the same canonical evaluation:
 *   unite(A, B)       ≡       unite(B, A)
 * because `unite` is commutative. The contract is keyed off the
 * cached `path.d`, not the tree, so this regression test ensures the
 * Inspector's tree-edit / reorder operations never accidentally trip
 * a "topology drift" warning on the variant.
 */
import { describe, expect, test } from 'bun:test';

import { computeTopology } from '../lib/editor-core/topology';
import { buildLeftLeaningCompound } from '../lib/schema/compound';
import type { Layer, LayerSnapshot } from '../lib/schema/types';

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M5 5 L15 5 L15 15 L5 15 Z';

function snapshot(layers: Layer[]): LayerSnapshot {
  const record: Record<string, Layer> = {};
  for (const l of layers) record[l.id] = l;
  return { layers: record } as LayerSnapshot;
}

function layerWith(id: string, d: string, compoundOperandsOrder?: string[]): Layer {
  const base: Layer = {
    id,
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d },
  } as Layer;
  if (compoundOperandsOrder) {
    base.compound = buildLeftLeaningCompound(
      'unite',
      compoundOperandsOrder.map((od) => ({ d: od })),
      id,
    );
  }
  return base;
}

describe('W2-1 regression: topology is keyed off path.d', () => {
  test('two layers with the same path.d but different compound.tree produce identical topology', () => {
    const cachedD = `${SQUARE_A} ${SQUARE_B}`;
    const left = layerWith('L', cachedD, [SQUARE_A, SQUARE_B]);
    const right = layerWith('L', cachedD, [SQUARE_B, SQUARE_A]); // commuted operands
    const tLeft = computeTopology(snapshot([left]));
    const tRight = computeTopology(snapshot([right]));
    expect(tLeft).toEqual(tRight);
  });

  test('flipping a compound to a flat layer (no `compound`) does not change topology if path.d is unchanged', () => {
    const cachedD = `${SQUARE_A} ${SQUARE_B}`;
    const compoundLayer = layerWith('L', cachedD, [SQUARE_A, SQUARE_B]);
    const flatLayer = layerWith('L', cachedD);
    expect(computeTopology(snapshot([compoundLayer]))).toEqual(
      computeTopology(snapshot([flatLayer])),
    );
  });
});

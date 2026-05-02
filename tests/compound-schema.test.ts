/**
 * W2-1 acceptance: Layer.compound schema, helpers, and the
 * path-invariant rule (compound is cleared when path.d is mutated
 * outside the compound flow).
 */
import { describe, expect, test } from 'bun:test';

import {
  buildLeftLeaningCompound,
  compoundOpGlyph,
  forEachOperandId,
  hasCompound,
  operandIdsInTree,
  rootOpGlyph,
} from '../lib/schema/compound';
import type { CompoundNode, Layer, LayerCompound } from '../lib/schema/types';

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M5 5 L15 5 L15 15 L5 15 Z';

function layerWithCompound(compound: LayerCompound | undefined): Layer {
  return {
    id: 'l',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d: SQUARE_A },
    compound,
  } as Layer;
}

describe('compound schema helpers', () => {
  test('buildLeftLeaningCompound produces a stable tree of N operands', () => {
    const c = buildLeftLeaningCompound(
      'unite',
      [{ d: SQUARE_A }, { d: SQUARE_B }, { d: 'M20 20 L25 25' }],
      'layerX',
    );
    expect(c.cacheVersion).toBe(1);
    expect(Object.keys(c.operands)).toEqual([
      'layerX/op0',
      'layerX/op1',
      'layerX/op2',
    ]);
    // Left-leaning shape: unite(unite(a, b), c)
    expect(c.tree.kind).toBe('op');
    if (c.tree.kind !== 'op') throw new Error('unreachable');
    expect(c.tree.op).toBe('unite');
    expect(c.tree.children.length).toBe(2);
    const right = c.tree.children[1]!;
    expect(right.kind).toBe('leaf');
    if (right.kind === 'leaf') expect(right.operandId).toBe('layerX/op2');
  });

  test('buildLeftLeaningCompound rejects fewer than two operands', () => {
    expect(() =>
      buildLeftLeaningCompound('unite', [{ d: SQUARE_A }], 'l'),
    ).toThrow();
  });

  test('operandIdsInTree returns ids in deterministic depth-first order', () => {
    const tree: CompoundNode = {
      kind: 'op',
      op: 'subtract',
      children: [
        {
          kind: 'op',
          op: 'unite',
          children: [
            { kind: 'leaf', operandId: 'a' },
            { kind: 'leaf', operandId: 'b' },
          ],
        },
        { kind: 'leaf', operandId: 'c' },
      ],
    };
    expect(operandIdsInTree(tree)).toEqual(['a', 'b', 'c']);
  });

  test('forEachOperandId visits every leaf', () => {
    const tree: CompoundNode = {
      kind: 'op',
      op: 'unite',
      children: [
        { kind: 'leaf', operandId: 'x' },
        { kind: 'leaf', operandId: 'y' },
      ],
    };
    const seen: string[] = [];
    forEachOperandId(tree, (id) => seen.push(id));
    expect(seen).toEqual(['x', 'y']);
  });

  test('compoundOpGlyph maps every CompoundOp', () => {
    expect(compoundOpGlyph('unite')).toBe('∪');
    expect(compoundOpGlyph('subtract')).toBe('−');
    expect(compoundOpGlyph('intersect')).toBe('∩');
    expect(compoundOpGlyph('exclude')).toBe('⊕');
  });

  test('rootOpGlyph returns the outermost op glyph or null', () => {
    const c = buildLeftLeaningCompound(
      'subtract',
      [{ d: SQUARE_A }, { d: SQUARE_B }],
      'l',
    );
    expect(rootOpGlyph(c)).toBe('−');
    expect(rootOpGlyph(undefined)).toBeNull();
    // Leaf-only tree (defensive — shouldn't happen in practice).
    expect(
      rootOpGlyph({
        tree: { kind: 'leaf', operandId: 'a' },
        operands: { a: { d: SQUARE_A } },
        cacheVersion: 1,
      }),
    ).toBeNull();
  });
});

describe('hasCompound (structural shape check, not just truthiness)', () => {
  test('returns false for layers with no compound field', () => {
    expect(hasCompound(layerWithCompound(undefined))).toBe(false);
  });

  test('returns true for a well-formed compound', () => {
    const c = buildLeftLeaningCompound(
      'unite',
      [{ d: SQUARE_A }, { d: SQUARE_B }],
      'l',
    );
    expect(hasCompound(layerWithCompound(c))).toBe(true);
  });

  test('returns false for a malformed compound (string instead of object)', () => {
    // Defensive against import / hand-edit corruption.
    const layer = {
      ...layerWithCompound(undefined),
      compound: 'yes' as unknown as LayerCompound,
    };
    expect(hasCompound(layer)).toBe(false);
  });

  test('returns false when cacheVersion is missing', () => {
    const layer = layerWithCompound({
      tree: { kind: 'leaf', operandId: 'a' },
      operands: { a: { d: SQUARE_A } },
      cacheVersion: undefined as unknown as number,
    });
    expect(hasCompound(layer)).toBe(false);
  });
});

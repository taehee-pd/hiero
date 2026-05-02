/**
 * Compound path utilities — small, pure helpers shared between the
 * editor store, the Inspector, and the W3+ resolver.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.2,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §4.1 and §4.6.
 *
 * @module
 */
import type {
  CompoundNode,
  CompoundOp,
  CompoundOperand,
  Layer,
  LayerCompound,
} from './types';

const COMPOUND_OP_GLYPH: Record<CompoundOp, string> = {
  unite: '∪',
  subtract: '−',
  intersect: '∩',
  exclude: '⊕',
};

/**
 * Designer-facing glyph for a {@link CompoundOp}. Used by the layer
 * list to surface the outermost op of a compound layer.
 */
export function compoundOpGlyph(op: CompoundOp): string {
  return COMPOUND_OP_GLYPH[op];
}

/**
 * Glyph for the *outermost* operation of a compound tree. Returns
 * `null` for leaf-only trees (a single operand wrapped in a leaf
 * node — shouldn't happen in practice but kept defensive).
 */
export function rootOpGlyph(compound: LayerCompound | undefined): string | null {
  if (!compound) return null;
  if (compound.tree.kind !== 'op') return null;
  return compoundOpGlyph(compound.tree.op);
}

/**
 * Walk a compound tree, calling `visit` on every operand id (leaf).
 */
export function forEachOperandId(
  tree: CompoundNode,
  visit: (operandId: string) => void,
): void {
  if (tree.kind === 'leaf') {
    visit(tree.operandId);
    return;
  }
  for (const child of tree.children) forEachOperandId(child, visit);
}

/**
 * Collect every operand id referenced by the tree. Order is
 * deterministic (depth-first, left-to-right).
 */
export function operandIdsInTree(tree: CompoundNode): string[] {
  const ids: string[] = [];
  forEachOperandId(tree, (id) => ids.push(id));
  return ids;
}

/**
 * Construct a fresh `LayerCompound` for the canonical case of
 * authoring `applyBoolean` over an ordered list of operand path-data
 * strings: `op(operand[0], operand[1], operand[2], ...)`. Operand ids
 * are generated stably from a seed (the survivor layer's id is the
 * usual source of seeding stability).
 *
 * The resulting tree is left-leaning: `op(op(op(a, b), c), d)`. This
 * matches Paper.js's reduce-style boolean chaining and keeps round-
 * trip evaluation deterministic.
 */
export function buildLeftLeaningCompound(
  op: CompoundOp,
  operands: Array<{ d: string; transform?: CompoundOperand['transform'] }>,
  seed: string,
): LayerCompound {
  if (operands.length < 2) {
    throw new Error(
      `buildLeftLeaningCompound requires >= 2 operands (got ${operands.length})`,
    );
  }
  const operandRecord: Record<string, CompoundOperand> = {};
  const ids: string[] = [];
  for (let i = 0; i < operands.length; i++) {
    const id = `${seed}/op${i}`;
    operandRecord[id] = { d: operands[i]!.d };
    if (operands[i]!.transform) operandRecord[id]!.transform = operands[i]!.transform;
    ids.push(id);
  }
  let tree: CompoundNode = { kind: 'leaf', operandId: ids[0]! };
  for (let i = 1; i < ids.length; i++) {
    tree = {
      kind: 'op',
      op,
      children: [tree, { kind: 'leaf', operandId: ids[i]! }],
    };
  }
  return { tree, operands: operandRecord, cacheVersion: 1 };
}

/**
 * Layer.compound is *authoring metadata* over the canonical
 * `path.d`. Renderers / exporters / hit-testers must never read it.
 * This helper is the single source of truth for that classification.
 */
export function hasCompound(layer: Pick<Layer, 'compound'>): boolean {
  const c = layer.compound;
  if (!c) return false;
  // Defensive shape check: tolerate the field being present but
  // mid-write or hand-edited. The classifier and Inspector treat a
  // structurally-invalid compound as "absent" so the runtime never
  // chokes on partial data. We validate the tree's discriminator —
  // a malformed `{ kind: 'foo' }` tree counts as absent and routes
  // morphs through the non-T6 path.
  if (typeof c.cacheVersion !== 'number') return false;
  if (typeof c.operands !== 'object' || c.operands === null) return false;
  if (!c.tree || typeof c.tree !== 'object') return false;
  return isValidCompoundNode(c.tree as CompoundNode);
}

function isValidCompoundNode(node: CompoundNode): boolean {
  if (node.kind === 'leaf') {
    return typeof node.operandId === 'string' && node.operandId.length > 0;
  }
  if (node.kind === 'op') {
    if (
      node.op !== 'unite' &&
      node.op !== 'subtract' &&
      node.op !== 'intersect' &&
      node.op !== 'exclude'
    ) {
      return false;
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
      return false;
    }
    return node.children.every(isValidCompoundNode);
  }
  return false;
}

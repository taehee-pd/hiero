import { describe, expect, test } from 'bun:test';

import {
  buildContourTree,
  pointInRing,
  type ContourTree,
} from '../lib/runtime-core/contour-tree';
import { canonicalizePath } from '../lib/runtime-core/path-normalization';

function tree(d: string): ContourTree {
  return buildContourTree(canonicalizePath(d));
}

describe('contour-tree', () => {
  test('single closed contour produces one root, depth 0', () => {
    const t = tree('M0 0 L10 0 L10 10 L0 10 Z');
    expect(t.rings.length).toBe(1);
    expect(t.nodes.length).toBe(1);
    expect(t.rootIds).toEqual([0]);
    expect(t.nodes[0]!.depth).toBe(0);
    expect(t.nodes[0]!.parent).toBeNull();
    expect(t.openSubpathIndices).toEqual([]);
  });

  test('open subpath does not enter the tree', () => {
    const t = tree('M0 0 L10 10');
    expect(t.rings.length).toBe(0);
    expect(t.nodes.length).toBe(0);
    expect(t.openSubpathIndices.length).toBe(1);
  });

  test('mixed open + closed: only the closed one becomes a ring', () => {
    const t = tree('M0 0 L10 0 L10 10 L0 10 Z M20 20 L30 30');
    expect(t.rings.length).toBe(1);
    expect(t.openSubpathIndices.length).toBe(1);
  });

  test('donut: outer + inner with inner depth 1', () => {
    // outer 0..20, inner 5..15
    const t = tree(
      'M0 0 L20 0 L20 20 L0 20 Z M5 5 L15 5 L15 15 L5 15 Z',
    );
    expect(t.rings.length).toBe(2);
    expect(t.rootIds.length).toBe(1);
    const root = t.nodes[t.rootIds[0]!]!;
    expect(root.depth).toBe(0);
    expect(root.children.length).toBe(1);
    const child = t.nodes[root.children[0]!]!;
    expect(child.depth).toBe(1);
    expect(child.parent).toBe(t.rootIds[0]!);
  });

  test('island-in-hole: alternation depth reaches 2', () => {
    // outer 0..30, hole 5..25, island 10..20
    const t = tree(
      'M0 0 L30 0 L30 30 L0 30 Z ' +
        'M5 5 L25 5 L25 25 L5 25 Z ' +
        'M10 10 L20 10 L20 20 L10 20 Z',
    );
    expect(t.rings.length).toBe(3);
    expect(t.rootIds.length).toBe(1);
    const depths = t.nodes.map((n) => n.depth).sort();
    expect(depths).toEqual([0, 1, 2]);
  });

  test('two disjoint contours both become roots', () => {
    const t = tree(
      'M0 0 L5 0 L5 5 L0 5 Z M10 10 L15 10 L15 15 L10 15 Z',
    );
    expect(t.rings.length).toBe(2);
    expect(t.rootIds.length).toBe(2);
    for (const node of t.nodes) {
      expect(node.depth).toBe(0);
      expect(node.parent).toBeNull();
    }
  });

  test('smallest enclosing wins as parent (not outermost)', () => {
    // Three nested squares. Inner-most must attach to mid, not outer.
    const t = tree(
      'M0 0 L30 0 L30 30 L0 30 Z ' + // outer
        'M5 5 L25 5 L25 25 L5 25 Z ' + // mid
        'M10 10 L20 10 L20 20 L10 20 Z', // inner
    );
    expect(t.rings.length).toBe(3);
    // Find by signedArea magnitude to identify which is which without
    // depending on subpath ordering.
    const idxByArea = [...t.rings.keys()].sort(
      (a, b) => Math.abs(t.rings[b]!.signedArea) - Math.abs(t.rings[a]!.signedArea),
    );
    const outer = idxByArea[0]!;
    const mid = idxByArea[1]!;
    const inner = idxByArea[2]!;
    expect(t.nodes[inner]!.parent).toBe(mid);
    expect(t.nodes[mid]!.parent).toBe(outer);
    expect(t.nodes[outer]!.parent).toBeNull();
  });

  test('representative point lands inside concave (L-shape) ring', () => {
    // L-shape whose centroid sits in the cutout. The builder must
    // still classify it as a single root with no parent.
    const t = tree(
      'M0 0 L20 0 L20 8 L8 8 L8 20 L0 20 Z',
    );
    expect(t.rings.length).toBe(1);
    expect(t.rootIds).toEqual([0]);
    // Sanity-check the in-polygon helper directly: a point in the
    // L's arm is inside, and one in the cutout is not.
    const ring = t.rings[0]!;
    expect(pointInRing({ x: 4, y: 4 }, ring)).toBe(true);
    expect(pointInRing({ x: 14, y: 14 }, ring)).toBe(false);
  });

  test('fillRule defaults to nonzero and is recorded on the tree', () => {
    const t = tree('M0 0 L10 0 L10 10 L0 10 Z');
    expect(t.fillRule).toBe('nonzero');
  });

  test('pointInRing rejects points outside the bbox quickly', () => {
    const t = tree('M0 0 L10 0 L10 10 L0 10 Z');
    const ring = t.rings[0]!;
    expect(pointInRing({ x: -1, y: 5 }, ring)).toBe(false);
    expect(pointInRing({ x: 5, y: -1 }, ring)).toBe(false);
    expect(pointInRing({ x: 100, y: 5 }, ring)).toBe(false);
  });
});

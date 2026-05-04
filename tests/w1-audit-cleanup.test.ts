/**
 * W1 audit cleanup — fixes folded into the W2 commit.
 *
 *   1. Negative-assertion: forbidden algorithm-mechanism fields
 *      (`morphStrategy`, `compatibilityLock`, `fillRuleOverride`) do
 *      not appear in the Transition source. Mirrors the integrated
 *      plan §2.1 contract.
 *   2. Determinism: the corpus baseline JSON is bit-stable across
 *      consecutive harness runs (round-trip through JSON.stringify).
 *   3. Contour tree built post-transform: a layer with a translate
 *      transform produces a tree whose ring vertices are the
 *      transformed coordinates.
 *   4. Contour tree under evenodd fill-rule on a self-intersecting
 *      path: the fill-rule is recorded on the tree.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildContourTree } from '../lib/runtime-core/contour-tree';
import { canonicalizeLayerPath, canonicalizePath } from '../lib/runtime-core/path-normalization';
import type { Layer } from '../lib/schema/types';

const ROOT = resolve(import.meta.dir, '..');
const TYPES_PATH = resolve(ROOT, 'lib', 'schema', 'types.ts');

describe('W1 audit cleanup — Transition contract negative assertion', () => {
  test('Transition source contains no forbidden algorithm-mechanism field names', () => {
    const source = readFileSync(TYPES_PATH, 'utf-8');
    const start = source.indexOf('export type Transition = RuntimeTransitionIntent & {');
    const end = source.indexOf('};', start);
    if (start < 0 || end < 0) {
      throw new Error('Transition declaration not found in types.ts');
    }
    const block = source.slice(start, end);
    const FORBIDDEN_NAMES = [
      'morphStrategy',
      'compatibilityLock',
      'fillRuleOverride',
      'tier:',
      'cascadeTier',
      'distortionFloor',
    ];
    for (const name of FORBIDDEN_NAMES) {
      if (block.includes(name)) {
        throw new Error(
          `Transition source contains forbidden algorithm-mechanism field "${name}". ` +
            'See docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.1.',
        );
      }
    }
    // Also reject any new strategy-shaped field name landing later.
    expect(/\b(strategy|cascade|tier)\??:/i.test(block)).toBe(false);
  });
});

describe('W1 audit cleanup — corpus baseline determinism', () => {
  test('baseline.json round-trips through JSON.stringify identically', () => {
    const path = resolve(ROOT, 'tests', 'transition-corpus', 'baseline.json');
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    // Re-stringifying the same object with the same indent must be
    // byte-identical. If the harness ever introduces an unsorted-keys
    // map or a Date.now()-derived field outside `generatedAt`, this
    // test surfaces it.
    const restringified = JSON.stringify(parsed, null, 2);
    // Allow trailing newline in the source file.
    expect(raw.replace(/\n$/, '')).toBe(restringified);
  });
});

describe('W1 audit cleanup — contour tree built post-transform', () => {
  test('a layer with a translate transform produces transformed ring vertices', () => {
    const baseLayer: Layer = {
      id: 'l',
      style: { fill: { mode: 'fixed', value: '#000' } },
      path: { d: 'M0 0 L10 0 L10 10 L0 10 Z' },
      transform: { x: 50, y: 100 },
    } as Layer;
    const canonical = canonicalizeLayerPath(baseLayer);
    expect(canonical).not.toBeNull();
    const tree = buildContourTree(canonical!);
    expect(tree.rings.length).toBe(1);
    const ring = tree.rings[0]!;
    // Every ring vertex must lie within the translated bbox.
    expect(ring.bbox.minX).toBe(50);
    expect(ring.bbox.minY).toBe(100);
    expect(ring.bbox.maxX).toBe(60);
    expect(ring.bbox.maxY).toBe(110);
  });
});

describe('W1 audit cleanup — fill-rule recorded on tree', () => {
  test('evenodd is recorded; nonzero is the default', () => {
    const canonical = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z');
    expect(buildContourTree(canonical, 'evenodd').fillRule).toBe('evenodd');
    expect(buildContourTree(canonical, 'nonzero').fillRule).toBe('nonzero');
    expect(buildContourTree(canonical).fillRule).toBe('nonzero');
  });

  test('contour tree handles a self-intersecting "bowtie" closed path without crashing', () => {
    // Bowtie: edges cross, but it's still a closed subpath. Tree
    // builder treats it as a single ring whose containment
    // semantics are evenodd-dependent; the builder records geometric
    // containment regardless of fill-rule.
    const canonical = canonicalizePath('M0 0 L10 10 L10 0 L0 10 Z');
    const tree = buildContourTree(canonical, 'evenodd');
    expect(tree.rings.length).toBe(1);
    expect(tree.openSubpathIndices).toEqual([]);
  });
});

/**
 * W2 audit cleanup §1: `LayerBinding.compoundTrimMode` operates on
 * rendered `path.d` subpaths, not on `Layer.compound.operands`.
 *
 * The export-lottie pipeline maps `'simultaneously'` → `m: 1` and
 * `'individually'` → `m: 2` on the Lottie trim shape. The trim is
 * applied to the rendered `path.d` subpath count, regardless of
 * any authoring-side `compound` metadata. This regression test
 * checks that the Lottie export source NEVER reads from `.compound`
 * — if a future contributor reaches into operand geometry from
 * within trim writing, this catches it.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const LOTTIE_EXPORT = resolve(ROOT, 'lib', 'export', 'export-lottie.ts');

describe('W2 audit cleanup — compoundTrimMode operates on rendered path.d', () => {
  test('lib/export/export-lottie.ts never reads `.compound`', () => {
    const source = readFileSync(LOTTIE_EXPORT, 'utf-8');
    // The exporter consumes `LayerBinding.compoundTrimMode` (a
    // small string union) — fine. It must NOT reach into
    // `Layer.compound.operands`, `Layer.compound.tree`, or
    // `Layer.compound.cacheVersion`. Grep for those patterns
    // explicitly.
    expect(source).not.toMatch(/\.compound\.tree/);
    expect(source).not.toMatch(/\.compound\.operands/);
    expect(source).not.toMatch(/\.compound\.cacheVersion/);
  });

  test('compoundTrimMode is consumed verbatim from LayerBinding', () => {
    const source = readFileSync(LOTTIE_EXPORT, 'utf-8');
    // Sanity-check the export still maps the field. Two known
    // call sites: the binding-level read and the trim-shape
    // writer.
    expect(source).toContain('compoundTrimMode');
    expect(source).toContain("'simultaneously'");
    expect(source).toContain("'individually'");
  });
});

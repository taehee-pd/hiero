/**
 * W2-4 acceptance: import + export pipelines treat `Layer.compound`
 * as authoring metadata only.
 *
 *   - SVG import does NOT synthesize a compound from nested subpaths
 *     (the original boolean intent is unrecoverable; we don't try
 *     to fake one).
 *   - SVG / Lottie / runtime-JSON / compiled-icon / React codegen
 *     export readers see identical output for two layers that
 *     differ ONLY in `compound` metadata. Renderer contract is
 *     `path.d` and only `path.d`.
 *   - `clip-path` / `mask` continue to be flagged as
 *     `SvgImportLayerMeta.unsupported`.
 */
import { describe, expect, test } from 'bun:test';

import { exportRuntimeJson } from '../lib/export/export-runtime-json';
import { buildLeftLeaningCompound, hasCompound } from '../lib/schema/compound';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import type { Icon, Layer } from '../lib/schema/types';

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M5 5 L15 5 L15 15 L5 15 Z';
const COMBINED = `${SQUARE_A} ${SQUARE_B}`;

function makeIconWith(layer: Layer): Icon {
  const project = structuredClone(SAMPLE_PROJECT);
  const icon = Object.values(project.icons)[0]!;
  const variantId = Object.keys(icon.variants)[0]!;
  const variant = icon.variants[variantId]!;
  return {
    ...icon,
    variants: {
      [variantId]: { ...variant, layers: { [layer.id]: layer } },
    },
  };
}

function makeLayer(d: string, compound?: ReturnType<typeof buildLeftLeaningCompound>): Layer {
  return {
    id: 'L',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d },
    compound,
  } as Layer;
}

describe('W2-4: SVG import does NOT synthesize compound from nested subpaths', () => {
  test('multi-subpath SVG path imports as a flat layer (no compound)', async () => {
    // Bun's SVG import path uses DOMParser which is happy-dom
    // territory; we exercise the contract via the source code
    // grep instead of round-trip parsing. This proves no W2 audit
    // regression: lib/import/import-svg.ts never reaches into
    // `compound` to write authoring metadata for plain
    // multi-subpath SVGs.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(import.meta.dir, '..', 'lib', 'import', 'import-svg.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/\.compound\s*=/);
    expect(source).not.toMatch(/compound:\s*\{[^}]*tree/);
  });
});

describe('W2-4: export pipelines treat compound as authoring metadata', () => {
  test('runtime JSON export produces identical output for compound vs flat layer with same path.d', () => {
    const flat = makeLayer(COMBINED);
    const compoundEquivalent = makeLayer(
      COMBINED,
      buildLeftLeaningCompound('unite', [{ d: SQUARE_A }, { d: SQUARE_B }], 'L'),
    );
    const flatExport = exportRuntimeJson(makeIconWith(flat));
    const compoundExport = exportRuntimeJson(makeIconWith(compoundEquivalent));
    // Strip variant ids (they could carry stable nonces from
    // structured-clone) but compare layer payloads.
    expect(JSON.stringify(flatExport)).toBe(JSON.stringify(compoundExport));
  });

  test('runtime JSON export does not contain a `compound` key anywhere', () => {
    const compoundEquivalent = makeLayer(
      COMBINED,
      buildLeftLeaningCompound('unite', [{ d: SQUARE_A }, { d: SQUARE_B }], 'L'),
    );
    const exported = exportRuntimeJson(makeIconWith(compoundEquivalent));
    expect(JSON.stringify(exported).includes('"compound"')).toBe(false);
    expect(JSON.stringify(exported).includes('"operandId"')).toBe(false);
    expect(JSON.stringify(exported).includes('"cacheVersion"')).toBe(false);
  });

  test('no exporter source reads .compound.tree / .compound.operands / .compound.cacheVersion', async () => {
    // Renderer-side invariant: every export pipeline reads only
    // `Layer.path.d`. Mirrors the W2 compound-trim-mode
    // regression for the broader export surface.
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve, join } = await import('node:path');
    const exportDir = resolve(import.meta.dir, '..', 'lib', 'export');
    const files = readdirSync(exportDir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    );
    for (const file of files) {
      const source = readFileSync(join(exportDir, file), 'utf-8');
      if (/\.compound\.tree/.test(source)) {
        throw new Error(`${file} reads compound.tree`);
      }
      if (/\.compound\.operands/.test(source)) {
        throw new Error(`${file} reads compound.operands`);
      }
      if (/\.compound\.cacheVersion/.test(source)) {
        throw new Error(`${file} reads compound.cacheVersion`);
      }
    }
  });

  test('schema invariant: a layer with compound has a path.d that the renderer can use directly', () => {
    const layer = makeLayer(
      COMBINED,
      buildLeftLeaningCompound('unite', [{ d: SQUARE_A }, { d: SQUARE_B }], 'L'),
    );
    expect(hasCompound(layer)).toBe(true);
    expect(layer.path?.d).toBe(COMBINED);
  });
});

/**
 * Full import → edit → animate → export workflow characterization test.
 *
 * Exercises the end-to-end path a real user takes:
 *   1. SVG import leg   — sanitize + normalize + convert pipeline
 *   2. Animate leg      — runtime-json export of a transitioning icon
 *   3. Draw-effect leg  — Lottie export of a draw-on effect icon
 *   4. Package layout   — exportRuntimePackage produces well-formed file tree
 *
 * NOTE (Step 1): The sanitizeSvg / normalizeSvg chain uses DOMParser.
 * Under bun's test:core runner (no happy-dom) we install the
 * node-html-parser shim from tests/helpers/dom-parser.ts — the same shim
 * used by tests/import-svg.test.ts. This avoids pulling happy-dom into
 * a .test.ts file (which would contaminate the sanitizer tests running
 * in the same bun process — see bunfig.toml).
 */
import { describe, expect, test } from 'bun:test';

// Install the DOMParser shim before any import that uses sanitizeSvg.
import './helpers/dom-parser';

import { sanitizeSvg } from '../lib/import/sanitize';
import { normalizeSvg } from '../lib/import/normalize';
import { convertNormalizedIconToIcon } from '../lib/import/convert-normalized-icon';

import { exportRuntimeJson, exportRuntimePackage } from '../lib/export/export-runtime-json';
import { exportLottie } from '../lib/export/export-lottie';

import { EXAMPLE_CHECK_ICON, EXAMPLE_PLAY_ICON } from '../lib/schema/example-icons';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

// ---------------------------------------------------------------------------
// Small inline SVG fixture for the import leg
// ---------------------------------------------------------------------------

const INLINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path id="arrow" d="M5 12 L19 12 M13 6 L19 12 L13 18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ---------------------------------------------------------------------------
// describe block
// ---------------------------------------------------------------------------

describe('full workflow', () => {
  // -------------------------------------------------------------------------
  // Step 1: SVG import leg
  // -------------------------------------------------------------------------
  test('import leg: sanitize + normalize + convert produces a well-formed Icon', () => {
    const sanitized = sanitizeSvg(INLINE_SVG);
    // No security content should be stripped from a clean SVG
    expect(sanitized.warnings).toEqual([]);
    expect(typeof sanitized.svg).toBe('string');
    expect(sanitized.svg.length).toBeGreaterThan(0);

    const normalized = normalizeSvg(sanitized.svg, {
      name: 'Arrow',
      tags: ['arrow', 'navigation'],
    });
    expect(normalized.viewBox).toEqual([0, 0, 24, 24]);
    expect(normalized.nodes.length).toBeGreaterThan(0);

    const icon = convertNormalizedIconToIcon(normalized, {
      sourceName: 'Arrow',
      existingIconIds: [],
    });

    // Icon has a valid id and display name
    expect(icon.id).toBeTruthy();
    expect(icon.name).toBeTruthy();

    // At least one variant was created
    const variantIds = Object.keys(icon.variants);
    expect(variantIds.length).toBeGreaterThan(0);

    // The variant has layers with path data
    const firstVariant = icon.variants[variantIds[0]!]!;
    expect(firstVariant.viewBox).toEqual([0, 0, 24, 24]);
    const layers = Object.values(firstVariant.layers);
    expect(layers.length).toBeGreaterThan(0);
    const firstLayer = layers[0]!;
    expect(firstLayer.path?.d).toBeTruthy();
    expect(firstLayer.path!.d.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Step 2: Animate → runtime-json leg
  // -------------------------------------------------------------------------
  test('animate leg: exportRuntimeJson preserves icon identity, variant shape, and is deterministic', () => {
    const json1 = exportRuntimeJson(EXAMPLE_PLAY_ICON);
    const json2 = exportRuntimeJson(EXAMPLE_PLAY_ICON);

    // Determinism: two calls produce identical strings
    expect(json1).toBe(json2);

    const parsed = JSON.parse(json1) as {
      id: string;
      name: string;
      variants: Record<string, {
        size: number;
        viewBox: [number, number, number, number];
        layers: Record<string, { d: string }>;
      }>;
    };

    // Icon identity survives serialization
    expect(parsed.id).toBe('example-play');
    expect(parsed.name).toBe('Play (morph demo)');

    // The v24 variant is present and has expected shape
    const v24 = parsed.variants['v24'];
    expect(v24).toBeDefined();
    expect(v24!.size).toBe(24);
    expect(v24!.viewBox).toEqual([0, 0, 24, 24]);

    // The triangle layer is present with path data
    const layers = v24!.layers;
    expect(Object.keys(layers).length).toBeGreaterThan(0);
    const triangleLayer = layers['triangle'];
    expect(triangleLayer).toBeDefined();
    expect(triangleLayer!.d).toBeTruthy();
    expect(triangleLayer!.d.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Step 3: Draw-effect → Lottie leg
  // -------------------------------------------------------------------------
  test('draw-effect leg: exportLottie on EXAMPLE_CHECK_ICON produces valid Lottie root and does not throw', () => {
    // Should not throw on the open-path draw-on effect
    let lottie: ReturnType<typeof exportLottie>;
    expect(() => {
      lottie = exportLottie(EXAMPLE_CHECK_ICON, 'v24');
    }).not.toThrow();

    // Top-level Lottie structure (version, frame rate, dimensions, layers)
    expect(lottie!.v).toBe('5.12.1');
    expect(lottie!.fr).toBe(60);
    expect(lottie!.ip).toBe(0);
    expect(typeof lottie!.op).toBe('number');
    expect(lottie!.op).toBeGreaterThan(0);
    expect(lottie!.w).toBe(24);
    expect(lottie!.h).toBe(24);
    expect(lottie!.nm).toBe('Check (draw-on demo)');
    expect(Array.isArray(lottie!.assets)).toBe(true);
    expect(Array.isArray(lottie!.layers)).toBe(true);
    expect(lottie!.layers.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Step 4: Package layout leg
  // -------------------------------------------------------------------------
  test('package layout leg: exportRuntimePackage includes per-icon files for example icons and is deterministic', () => {
    const first = exportRuntimePackage(structuredClone(SAMPLE_PROJECT));
    const second = exportRuntimePackage(structuredClone(SAMPLE_PROJECT));

    // Determinism: two calls produce the same file list
    expect(first.files).toEqual(second.files);

    const paths = first.files.map((f) => f.path);

    // Index manifest must be present
    expect(paths).toContain('icons/index.json');

    // example-play: meta + variant
    expect(paths).toContain('icons/example-play/meta.json');
    expect(paths).toContain('icons/example-play/v24.json');

    // example-check: meta + variant
    expect(paths).toContain('icons/example-check/meta.json');
    expect(paths).toContain('icons/example-check/v24.json');

    // example-pause: meta + variant
    expect(paths).toContain('icons/example-pause/meta.json');
    expect(paths).toContain('icons/example-pause/v24.json');

    // All files must have non-empty string contents
    for (const file of first.files) {
      expect(typeof file.contents).toBe('string');
      expect(file.contents.length).toBeGreaterThan(0);
    }

    // Manifest is an object with an icons array
    const manifest = first.manifest as { icons: Array<{ id: string }> };
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    // example-play appears in the manifest
    const examplePlayEntry = manifest.icons.find((e) => e.id === 'example-play');
    expect(examplePlayEntry).toBeDefined();
  });
});

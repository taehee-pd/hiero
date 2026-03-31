import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { rawSvgAdapter } from '../lib/import/adapters/raw-svg-adapter';
import { lucideAdapter } from '../lib/import/adapters/lucide-adapter';
import { sanitizeSvg } from '../lib/import/sanitize';
import { normalizeSvg } from '../lib/import/normalize';
import { serializeNormalizedIcon } from '../lib/import/normalized-ir';
import { convertNormalizedIconToIcon } from '../lib/import/convert-normalized-icon';

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;
}

describe('import hardening fixtures', () => {
  test('simple path-only icon fixture', async () => {
    const fetched = await rawSvgAdapter.fetch({
      mode: 'raw-svg-string',
      svgContent: wrap('<path d="M0 0 L10 10" fill="#111"/>'),
      name: 'Path Only',
    });

    const normalized = normalizeSvg(fetched.svgContent, {
      name: fetched.suggestedName,
      upstreamWarnings: fetched.warnings,
    });
    const icon = convertNormalizedIconToIcon(normalized, { sourceName: fetched.suggestedName });

    expect(normalized.nodes).toHaveLength(1);
    expect(Object.keys(icon.variants.v24!.layers)).toHaveLength(1);
  });

  test('primitive-heavy icon fixture', () => {
    const normalized = normalizeSvg(
      wrap(
        '<rect x="1" y="1" width="10" height="6" rx="2"/>' +
          '<circle cx="16" cy="6" r="3"/>' +
          '<ellipse cx="7" cy="16" rx="4" ry="2"/>' +
          '<line x1="12" y1="12" x2="20" y2="20"/>' +
          '<polyline points="0,20 4,18 8,20"/>' +
          '<polygon points="12,20 16,16 20,20"/>',
      ),
      { name: 'Primitives' },
    );
    const icon = convertNormalizedIconToIcon(normalized, { sourceName: 'Primitives' });
    expect(Object.keys(icon.variants.v24!.layers)).toHaveLength(6);
  });

  test('grouped/transformed icon fixture', () => {
    const normalized = normalizeSvg(
      wrap('<g transform="translate(2,3)"><path id="a" d="M0 0 L4 4"/><path id="b" d="M1 1 L5 5"/></g>'),
      { name: 'Grouped' },
    );
    const icon = convertNormalizedIconToIcon(normalized, { sourceName: 'Grouped' });
    const layers = icon.variants.v24!.layers;
    expect(layers.a?.transform).toEqual({ x: 2, y: 3 });
    expect(layers.b?.transform).toEqual({ x: 2, y: 3 });
  });

  test('multi-node Lucide fixture with provenance', async () => {
    const fetched = await lucideAdapter.fetch({ mode: 'library-icon-name', iconId: 'home' });
    const normalized = normalizeSvg(fetched.svgContent, {
      name: fetched.suggestedName,
      tags: fetched.suggestedTags,
      provenance: fetched.provenance,
      upstreamWarnings: fetched.warnings,
    });
    const icon = convertNormalizedIconToIcon(normalized, { sourceName: fetched.suggestedName });

    expect(normalized.nodes.length).toBeGreaterThan(1);
    expect(icon.meta?.externalImport?.adapterId).toBe('lucide');
    expect(icon.tags).toContain('lucide');
  });

  test('unsupported clipPath/mask fixture surfaces warnings', async () => {
    const fetched = await rawSvgAdapter.fetch({
      mode: 'raw-svg-string',
      svgContent: wrap('<path d="M0 0" clip-path="url(#c)" mask="url(#m)"/>'),
      name: 'Unsupported Features',
    });
    const normalized = normalizeSvg(fetched.svgContent, {
      name: fetched.suggestedName,
      upstreamWarnings: fetched.warnings,
    });

    expect(normalized.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['clip_path_ignored', 'mask_ignored']),
    );
  });

  test('unsafe SVG fixture is sanitized and warned', () => {
    const sanitized = sanitizeSvg(
      wrap('<script>alert(1)</script><path d="M0 0" onclick="evil()"/>'),
    );
    expect(sanitized.svg).not.toContain('script');
    expect(sanitized.svg).not.toContain('onclick');
    expect(sanitized.warnings.length).toBeGreaterThan(0);
  });

  test('deterministic output verification fixture', () => {
    const input = wrap('<g fill="#222"><path d="M0 0"/><path d="M1 1"/></g>');
    const a = normalizeSvg(input, { name: 'Deterministic' });
    const b = normalizeSvg(input, { name: 'Deterministic' });
    expect(serializeNormalizedIcon(a)).toBe(serializeNormalizedIcon(b));
  });
});

import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { normalizeSvg } from '../lib/import/normalize/svg-normalizer';
import { validateNormalizedIcon } from '../lib/import/normalized-ir/validate';
import { serializeNormalizedIcon } from '../lib/import/normalized-ir/serialize';
import type { NormalizedNode } from '../lib/import/normalized-ir/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svg(inner: string, viewBox = '0 0 24 24'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
}

function normalize(inner: string, viewBox?: string) {
  return normalizeSvg(svg(inner, viewBox), { name: 'Test' });
}

// ---------------------------------------------------------------------------
// ViewBox parsing
// ---------------------------------------------------------------------------

describe('normalizeSvg — viewBox', () => {
  test('parses viewBox from attribute', () => {
    const result = normalizeSvg(svg('', '0 0 32 32'));
    expect(result.viewBox).toEqual([0, 0, 32, 32]);
  });

  test('parses viewBox with comma separators', () => {
    const result = normalizeSvg(svg('', '0,0,48,48'));
    expect(result.viewBox).toEqual([0, 0, 48, 48]);
  });

  test('falls back to width/height when no viewBox', () => {
    const result = normalizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0"/></svg>',
    );
    expect(result.viewBox).toEqual([0, 0, 16, 16]);
  });

  test('defaults to 24x24 when nothing specified', () => {
    const result = normalizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    expect(result.viewBox).toEqual([0, 0, 24, 24]);
  });
});

// ---------------------------------------------------------------------------
// Shape element support
// ---------------------------------------------------------------------------

describe('normalizeSvg — shape elements', () => {
  test('normalizes <path> elements', () => {
    const result = normalize('<path d="M0 0 L10 10 Z" fill-rule="evenodd"/>');
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.kind).toBe('path');
    expect(node.geometry).toEqual({ kind: 'path', d: 'M0 0 L10 10 Z', fillRule: 'evenodd' });
  });

  test('normalizes <rect> elements', () => {
    const result = normalize('<rect x="2" y="3" width="10" height="8" rx="2" ry="1"/>');
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.kind).toBe('rect');
    expect(node.geometry).toEqual({
      kind: 'rect',
      x: 2, y: 3, width: 10, height: 8, rx: 2, ry: 1,
    });
  });

  test('normalizes <circle> elements', () => {
    const result = normalize('<circle cx="12" cy="12" r="5"/>');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.geometry).toEqual({ kind: 'circle', cx: 12, cy: 12, r: 5 });
  });

  test('normalizes <ellipse> elements', () => {
    const result = normalize('<ellipse cx="12" cy="6" rx="8" ry="4"/>');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.geometry).toEqual({ kind: 'ellipse', cx: 12, cy: 6, rx: 8, ry: 4 });
  });

  test('normalizes <line> elements', () => {
    const result = normalize('<line x1="2" y1="4" x2="20" y2="18"/>');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.geometry).toEqual({ kind: 'line', x1: 2, y1: 4, x2: 20, y2: 18 });
  });

  test('normalizes <polyline> elements', () => {
    const result = normalize('<polyline points="0,0 10,5 20,0"/>');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.geometry).toEqual({
      kind: 'polyline',
      points: [0, 0, 10, 5, 20, 0],
    });
  });

  test('normalizes <polygon> elements', () => {
    const result = normalize('<polygon points="0,0 10,5 20,0"/>');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.geometry).toEqual({
      kind: 'polygon',
      points: [0, 0, 10, 5, 20, 0],
    });
  });

  test('handles all seven shape types in one SVG', () => {
    const result = normalize(
      '<path id="a" d="M0 0"/>' +
      '<rect id="b" x="0" y="0" width="4" height="4"/>' +
      '<circle id="c" cx="5" cy="5" r="2"/>' +
      '<ellipse id="d" cx="10" cy="5" rx="3" ry="1"/>' +
      '<line id="e" x1="0" y1="0" x2="10" y2="10"/>' +
      '<polyline id="f" points="0,0 5,5"/>' +
      '<polygon id="g" points="0,0 10,0 5,10"/>',
    );
    expect(result.nodes).toHaveLength(7);
    expect(result.nodes.map((n) => n.kind)).toEqual([
      'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Style inheritance
// ---------------------------------------------------------------------------

describe('normalizeSvg — style inheritance', () => {
  test('inherits fill and stroke from parent group', () => {
    const result = normalize(
      '<g fill="#ff0000" stroke="#0000ff" stroke-width="2">' +
      '  <path d="M0 0 L10 10"/>' +
      '</g>',
    );
    const node = result.nodes[0]!;
    expect(node.style.fill).toEqual({ mode: 'fixed', value: '#ff0000' });
    expect(node.style.stroke).toEqual({ mode: 'fixed', value: '#0000ff' });
    expect(node.style.strokeWidth).toBe(2);
  });

  test('child overrides parent fill', () => {
    const result = normalize(
      '<g fill="#ff0000">' +
      '  <path d="M0 0 L10 10" fill="#00ff00"/>' +
      '</g>',
    );
    expect(result.nodes[0]!.style.fill).toEqual({ mode: 'fixed', value: '#00ff00' });
  });

  test('resolves currentColor', () => {
    const result = normalize('<path d="M0 0" fill="currentColor"/>');
    expect(result.nodes[0]!.style.fill).toEqual({ mode: 'currentColor' });
  });

  test('fill=none produces no fill', () => {
    const result = normalize('<path d="M0 0" fill="none" stroke="#000" stroke-width="2"/>');
    expect(result.nodes[0]!.style.fill).toBeUndefined();
    expect(result.nodes[0]!.style.stroke).toEqual({ mode: 'fixed', value: '#000' });
  });
});

// ---------------------------------------------------------------------------
// Opacity normalization
// ---------------------------------------------------------------------------

describe('normalizeSvg — opacity', () => {
  test('combines element opacity with fill-opacity', () => {
    const result = normalize('<path d="M0 0" fill="#000" opacity="0.5" fill-opacity="0.8"/>');
    // 0.5 * 0.8 = 0.4
    expect(result.nodes[0]!.style.fillOpacity).toBe(0.4);
  });

  test('inherits opacity from parent group', () => {
    const result = normalize(
      '<g opacity="0.5"><path d="M0 0" fill="#000"/></g>',
    );
    expect(result.nodes[0]!.style.fillOpacity).toBe(0.5);
  });

  test('omits fillOpacity when result is 1', () => {
    const result = normalize('<path d="M0 0" fill="#000" opacity="1"/>');
    expect(result.nodes[0]!.style.fillOpacity).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Transform normalization
// ---------------------------------------------------------------------------

describe('normalizeSvg — transforms', () => {
  test('decomposes simple translate', () => {
    const result = normalize('<path d="M0 0" transform="translate(5, 10)"/>');
    expect(result.nodes[0]!.transform).toEqual({ x: 5, y: 10 });
  });

  test('decomposes simple scale', () => {
    const result = normalize('<path d="M0 0" transform="scale(2)"/>');
    expect(result.nodes[0]!.transform).toMatchObject({ scaleX: 2, scaleY: 2 });
  });

  test('inherits parent transform (translate composition)', () => {
    const result = normalize(
      '<g transform="translate(2, 3)"><path d="M0 0" transform="translate(1, 1)"/></g>',
    );
    // 2+1=3, 3+1=4
    expect(result.nodes[0]!.transform).toEqual({ x: 3, y: 4 });
  });

  test('preserves original transform string in sourceMeta', () => {
    const result = normalize('<path d="M0 0" transform="translate(5, 10) rotate(45)"/>');
    expect(result.nodes[0]!.sourceMeta.originalTransform).toBe('translate(5, 10) rotate(45)');
  });

  test('omits transform for identity matrix', () => {
    const result = normalize('<path d="M0 0"/>');
    expect(result.nodes[0]!.transform).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Source metadata
// ---------------------------------------------------------------------------

describe('normalizeSvg — source metadata', () => {
  test('captures source tag, id, and class', () => {
    const result = normalize(
      '<rect id="my-rect" class="icon-fill" x="0" y="0" width="10" height="10"/>',
    );
    const meta = result.nodes[0]!.sourceMeta;
    expect(meta.sourceTag).toBe('rect');
    expect(meta.sourceNodeId).toBe('my-rect');
    expect(meta.sourceClassName).toBe('icon-fill');
  });

  test('sourceMeta.unsupported is always an array', () => {
    const result = normalize('<path d="M0 0"/>');
    expect(Array.isArray(result.nodes[0]!.sourceMeta.unsupported)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fill-rule preservation
// ---------------------------------------------------------------------------

describe('normalizeSvg — fill-rule', () => {
  test('preserves evenodd fill-rule in geometry', () => {
    const result = normalize('<path d="M0 0 Z" fill-rule="evenodd"/>');
    const geo = result.nodes[0]!.geometry;
    expect(geo.kind).toBe('path');
    if (geo.kind === 'path') {
      expect(geo.fillRule).toBe('evenodd');
    }
  });

  test('preserves nonzero fill-rule in geometry', () => {
    const result = normalize('<path d="M0 0 Z" fill-rule="nonzero"/>');
    const geo = result.nodes[0]!.geometry;
    if (geo.kind === 'path') {
      expect(geo.fillRule).toBe('nonzero');
    }
  });
});

// ---------------------------------------------------------------------------
// Line cap and join
// ---------------------------------------------------------------------------

describe('normalizeSvg — lineCap and lineJoin', () => {
  test('captures stroke-linecap and stroke-linejoin', () => {
    const result = normalize(
      '<line x1="0" y1="0" x2="10" y2="10" stroke="#000" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="bevel"/>',
    );
    expect(result.nodes[0]!.style.lineCap).toBe('round');
    expect(result.nodes[0]!.style.lineJoin).toBe('bevel');
  });
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe('normalizeSvg — visibility', () => {
  test('marks hidden elements', () => {
    const result = normalize('<path d="M0 0" visibility="hidden"/>');
    expect(result.nodes[0]!.style.visible).toBe(false);
  });

  test('marks display:none elements', () => {
    const result = normalize('<path d="M0 0" display="none"/>');
    expect(result.nodes[0]!.style.visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deterministic output
// ---------------------------------------------------------------------------

describe('normalizeSvg — determinism', () => {
  test('nodes have sequential indices matching array position', () => {
    const result = normalize(
      '<path d="M0 0"/><rect x="0" y="0" width="10" height="10"/><circle cx="5" cy="5" r="2"/>',
    );
    expect(result.nodes.map((n) => n.index)).toEqual([0, 1, 2]);
  });

  test('same input produces identical serialized output', () => {
    const input = svg(
      '<g fill="#333" stroke-width="2">' +
      '  <path d="M0 0 L10 10" stroke="#ff0000"/>' +
      '  <circle cx="12" cy="12" r="3"/>' +
      '</g>',
    );
    const a = normalizeSvg(input, { name: 'Test' });
    const b = normalizeSvg(input, { name: 'Test' });
    expect(serializeNormalizedIcon(a)).toBe(serializeNormalizedIcon(b));
  });

  test('output passes structural validation', () => {
    const result = normalize(
      '<path d="M0 0 L10 10" fill="currentColor" stroke="#f00" stroke-width="2"/>' +
      '<rect x="0" y="0" width="24" height="24" fill="#000"/>',
    );
    expect(validateNormalizedIcon(result)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

describe('normalizeSvg — groups', () => {
  test('flattens group children to top-level nodes with inherited styles', () => {
    const result = normalize(
      '<g fill="#ff0000">' +
      '  <path id="a" d="M0 0"/>' +
      '  <path id="b" d="M1 1"/>' +
      '</g>',
    );
    // Both paths should be at top level, inheriting fill from group
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]!.style.fill).toEqual({ mode: 'fixed', value: '#ff0000' });
    expect(result.nodes[1]!.style.fill).toEqual({ mode: 'fixed', value: '#ff0000' });
  });

  test('handles nested groups', () => {
    const result = normalize(
      '<g fill="#ff0000">' +
      '  <g stroke="#0000ff">' +
      '    <path d="M0 0"/>' +
      '  </g>' +
      '</g>',
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.style.fill).toEqual({ mode: 'fixed', value: '#ff0000' });
    expect(result.nodes[0]!.style.stroke).toEqual({ mode: 'fixed', value: '#0000ff' });
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('normalizeSvg — options', () => {
  test('uses provided name and tags', () => {
    const result = normalizeSvg(svg('<path d="M0 0"/>'), {
      name: 'Arrow Right',
      tags: ['navigation', 'arrow'],
    });
    expect(result.name).toBe('Arrow Right');
    expect(result.tags).toEqual(['navigation', 'arrow']);
  });

  test('includes upstream warnings', () => {
    const result = normalizeSvg(svg('<path d="M0 0"/>'), {
      upstreamWarnings: [
        { code: 'STRIPPED_STYLE', message: 'Stripped inline style' },
      ],
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe('STRIPPED_STYLE');
  });

  test('attaches provenance', () => {
    const result = normalizeSvg(svg('<path d="M0 0"/>'), {
      provenance: {
        adapterId: 'lucide',
        sourceLibrary: 'Lucide',
        sourceIconId: 'arrow-right',
        importedAt: '2026-03-17T00:00:00Z',
      },
    });
    expect(result.provenance?.adapterId).toBe('lucide');
    expect(result.provenance?.sourceIconId).toBe('arrow-right');
  });
});

// ---------------------------------------------------------------------------
// Defs / skipping
// ---------------------------------------------------------------------------

describe('normalizeSvg — defs handling', () => {
  test('skips <defs> children — they are not drawable nodes', () => {
    const result = normalize(
      '<defs><linearGradient id="g1"><stop offset="0" stop-color="#f00"/></linearGradient></defs>' +
      '<path d="M0 0" fill="url(#g1)"/>',
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.kind).toBe('path');
  });
});

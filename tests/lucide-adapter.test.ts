import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { lucideAdapter } from '../lib/import/adapters/lucide-adapter';
import {
  getLucideManifest,
  getLucideVersion,
  loadLucideIcon,
  lucideNodesToSvg,
} from '../lib/import/adapters/lucide-source';
import { ExternalIconImportError } from '../lib/import/adapter-sdk';
import { normalizeSvg } from '../lib/import/normalize/svg-normalizer';
import { validateNormalizedIcon } from '../lib/import/normalized-ir/validate';

// ---------------------------------------------------------------------------
// Source resolver
// ---------------------------------------------------------------------------

describe('Lucide source resolver', () => {
  test('getLucideVersion returns a semver version string', () => {
    const version = getLucideVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('getLucideManifest returns a non-empty icon list', () => {
    const manifest = getLucideManifest();
    expect(manifest.length).toBeGreaterThan(1000);
    expect(manifest[0]!.name).toBeTruthy();
  });

  test('loadLucideIcon returns icon data for known icon', () => {
    const data = loadLucideIcon('arrow-right');
    expect(data).not.toBeNull();
    expect(data!.name).toBe('arrow-right');
    expect(data!.nodes.length).toBeGreaterThanOrEqual(1);
    // Each node is [tagName, attrs]
    expect(data!.nodes[0]![0]).toBe('path');
    expect(data!.nodes[0]![1]).toHaveProperty('d');
  });

  test('loadLucideIcon returns null for unknown icon', () => {
    const data = loadLucideIcon('this-icon-does-not-exist-xyz');
    expect(data).toBeNull();
  });

  test('lucideNodesToSvg produces valid SVG with Lucide defaults', () => {
    const data = loadLucideIcon('arrow-right')!;
    const svg = lucideNodesToSvg(data.nodes);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('</svg>');
    // React key should be stripped
    expect(svg).not.toContain('key=');
  });
});

// ---------------------------------------------------------------------------
// Adapter descriptor
// ---------------------------------------------------------------------------

describe('Lucide adapter — descriptor', () => {
  test('has correct id and capabilities', () => {
    const { descriptor } = lucideAdapter;
    expect(descriptor.id).toBe('lucide');
    expect(descriptor.capabilities.inputModes).toEqual(['library-icon-name']);
    expect(descriptor.capabilities.searchable).toBe(true);
    expect(descriptor.capabilities.displayName).toBe('Lucide Icons');
    expect(descriptor.capabilities.license).toBe('ISC');
    expect(descriptor.capabilities.libraryVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// Adapter fetch
// ---------------------------------------------------------------------------

describe('Lucide adapter — fetch', () => {
  test('fetches arrow-right icon with correct provenance', async () => {
    const result = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'arrow-right',
    });

    expect(result.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('<path');
    expect(result.suggestedName).toBe('Arrow Right');
    expect(result.suggestedTags).toContain('lucide');
    expect(result.provenance.adapterId).toBe('lucide');
    expect(result.provenance.sourceLibrary).toBe('Lucide');
    expect(result.provenance.sourceIconId).toBe('arrow-right');
    expect(result.provenance.sourceLicense).toBe('ISC');
    expect(result.provenance.sourceVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.provenance.importedAt).toBeTruthy();
    expect(result.warnings).toEqual([]);
  });

  test('fetches circle icon with circle element', async () => {
    const result = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'circle',
    });
    expect(result.svgContent).toContain('<circle');
  });

  test('fetches home icon (multi-element)', async () => {
    const result = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'home',
    });
    expect(result.svgContent).toContain('<path');
    expect(result.suggestedName).toBe('Home');
  });

  test('uses name override when provided', async () => {
    const result = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'arrow-right',
      name: 'Forward Arrow',
    });
    expect(result.suggestedName).toBe('Forward Arrow');
  });

  test('throws ICON_NOT_FOUND for unknown icon', async () => {
    try {
      await lucideAdapter.fetch({
        mode: 'library-icon-name',
        iconId: 'nonexistent-icon-xyz',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalIconImportError);
      const e = err as ExternalIconImportError;
      expect(e.code).toBe('ICON_NOT_FOUND');
      expect(e.adapterId).toBe('lucide');
    }
  });

  test('rejects unsupported input modes', async () => {
    try {
      await lucideAdapter.fetch({
        mode: 'raw-svg-string',
        svgContent: '<svg></svg>',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalIconImportError);
      expect((err as ExternalIconImportError).code).toBe('UNSUPPORTED_MODE');
    }
  });
});

// ---------------------------------------------------------------------------
// Adapter search
// ---------------------------------------------------------------------------

describe('Lucide adapter — search', () => {
  test('returns results for "arrow" query', async () => {
    const results = await lucideAdapter.search!('arrow');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.iconId.includes('arrow'))).toBe(true);
    expect(results[0]!.name).toBeTruthy();
    expect(results[0]!.iconId).toBeTruthy();
  });

  test('returns empty array for no matches', async () => {
    const results = await lucideAdapter.search!('zzzznonexistent12345');
    expect(results).toEqual([]);
  });

  test('respects limit option', async () => {
    const results = await lucideAdapter.search!('a', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('returns results for empty query (browse mode)', async () => {
    const results = await lucideAdapter.search!('');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: fetch → normalize → validate
// ---------------------------------------------------------------------------

describe('Lucide adapter — end-to-end normalization', () => {
  const REPRESENTATIVE_ICONS = [
    'arrow-right',   // stroke-only paths
    'circle',        // circle element
    'check',         // single path
    'x',             // two crossing paths
    'home',          // compound icon
    'heart',         // complex curves
    'search',        // circle + line
    'settings',      // complex multi-element
  ];

  for (const iconName of REPRESENTATIVE_ICONS) {
    test(`${iconName}: fetch → normalize produces valid IR`, async () => {
      const result = await lucideAdapter.fetch({
        mode: 'library-icon-name',
        iconId: iconName,
      });

      const normalized = normalizeSvg(result.svgContent, {
        name: result.suggestedName,
        tags: result.suggestedTags,
        provenance: result.provenance,
        upstreamWarnings: result.warnings,
      });

      // Structural validation
      const errors = validateNormalizedIcon(normalized);
      expect(errors).toEqual([]);

      // Must have at least one node
      expect(normalized.nodes.length).toBeGreaterThanOrEqual(1);

      // ViewBox must be 24x24
      expect(normalized.viewBox).toEqual([0, 0, 24, 24]);

      // Provenance must be preserved
      expect(normalized.provenance?.adapterId).toBe('lucide');
      expect(normalized.provenance?.sourceIconId).toBe(iconName);

      // All Lucide icons use currentColor stroke and no fill
      for (const node of normalized.nodes) {
        // Lucide defaults: fill=none (no fill), stroke=currentColor
        expect(node.style.stroke).toEqual({ mode: 'currentColor' });
        // fill should be undefined (fill=none)
        expect(node.style.fill).toBeUndefined();
        // stroke-width should be 2
        expect(node.style.strokeWidth).toBe(2);
        // lineCap and lineJoin should be round
        expect(node.style.lineCap).toBe('round');
        expect(node.style.lineJoin).toBe('round');
      }
    });
  }

  test('deterministic: same icon produces identical normalized output', async () => {
    const result1 = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'arrow-right',
    });
    const result2 = await lucideAdapter.fetch({
      mode: 'library-icon-name',
      iconId: 'arrow-right',
    });

    const norm1 = normalizeSvg(result1.svgContent, { name: 'Arrow Right' });
    const norm2 = normalizeSvg(result2.svgContent, { name: 'Arrow Right' });

    // Compare serialized output (ignoring timestamp in provenance)
    expect(norm1.nodes).toEqual(norm2.nodes);
    expect(norm1.viewBox).toEqual(norm2.viewBox);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  buildPluginImportEntries,
  parseContourPluginPayload,
} from '@/lib/import/coniva-plugin-payload';

const validPayload = JSON.stringify({
  version: '1',
  source: 'contour-figma-plugin',
  exportedAt: '2026-03-28T12:00:00.000Z',
  fileName: 'Icons',
  icons: [
    {
      name: 'Arrow Right',
      nodeId: '1:2',
      svgContent: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
      sourcePage: 'Navigation',
    },
  ],
});

describe('parseContourPluginPayload', () => {
  test('parses a valid plugin payload', () => {
    const payload = parseContourPluginPayload(validPayload);
    expect(payload.fileName).toBe('Icons');
    expect(payload.icons[0]?.name).toBe('Arrow Right');
  });

  test('rejects invalid JSON', () => {
    expect(() => parseContourPluginPayload('{')).toThrow(
      'Plugin payload must be valid JSON.',
    );
  });

  test('rejects payload with missing icons', () => {
    expect(() =>
      parseContourPluginPayload(
        JSON.stringify({
          version: '1',
          source: 'contour-figma-plugin',
          exportedAt: '2026-03-28T12:00:00.000Z',
          fileName: 'Icons',
          icons: [],
        }),
      ),
    ).toThrow();
  });
});

describe('buildPluginImportEntries', () => {
  test('maps payload icons to import entries with provenance', () => {
    const payload = parseContourPluginPayload(validPayload);
    const entries = buildPluginImportEntries(payload);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('Arrow Right');
    expect(entries[0]?.provenance.sourceLibrary).toBe('Figma Plugin');
    expect(entries[0]?.tags).toEqual(['figma', 'plugin']);
  });
});

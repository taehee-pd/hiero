import { describe, expect, test, beforeEach } from 'bun:test';
import {
  createAdapterRegistry,
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconAdapterRegistry,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSearchResult,
} from '../lib/import/adapter-sdk';

// ---------------------------------------------------------------------------
// Test helpers — minimal adapter stubs
// ---------------------------------------------------------------------------

function makeProvenance(adapterId: string) {
  return {
    adapterId,
    sourceLibrary: 'test',
    importedAt: new Date().toISOString(),
  };
}

/** A library adapter with search (like Lucide). */
function createSearchableAdapter(id = 'test-lib'): ExternalIconAdapter {
  return {
    descriptor: {
      id,
      capabilities: {
        inputModes: ['library-icon-name'],
        sourceType: 'library',
        searchable: true,
        displayName: 'Test Library',
        libraryVersion: '1.0.0',
        license: 'MIT',
      },
    },
    async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
      if (request.mode !== 'library-icon-name') {
        throw new ExternalIconImportError({
          code: 'unsupported_source_format',
          message: `Mode "${request.mode}" is not supported`,
          adapterId: id,
          request,
        });
      }
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20Z"/></svg>`;
      return {
        intermediate: { kind: 'svg-source', svgContent },
        svgContent,
        suggestedName: request.name ?? request.iconId,
        suggestedTags: ['test'],
        provenance: makeProvenance(id),
        warnings: [],
      };
    },
    async search(query: string, options?: { limit?: number }): Promise<ExternalIconSearchResult[]> {
      const limit = options?.limit ?? 10;
      if (query === 'arrow') {
        return [
          { iconId: 'arrow-left', name: 'Arrow Left', tags: ['navigation'] },
          { iconId: 'arrow-right', name: 'Arrow Right', tags: ['navigation'] },
        ].slice(0, limit);
      }
      return [];
    },
  };
}

/** A paste adapter that only accepts raw SVG strings. */
function createPasteAdapter(id = 'raw-svg'): ExternalIconAdapter {
  return {
    descriptor: {
      id,
      capabilities: {
        inputModes: ['raw-svg-string'],
        sourceType: 'raw',
        searchable: false,
        displayName: 'Paste SVG',
      },
    },
    async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
      if (request.mode !== 'raw-svg-string') {
        throw new ExternalIconImportError({
          code: 'unsupported_source_format',
          message: `Mode "${request.mode}" is not supported`,
          adapterId: id,
          request,
        });
      }
      return {
        intermediate: { kind: 'svg-source', svgContent: request.svgContent },
        svgContent: request.svgContent,
        suggestedName: request.name ?? 'Pasted SVG',
        provenance: makeProvenance(id),
        warnings: [],
      };
    },
  };
}

/** A file adapter that accepts SVG file uploads. */
function createFileAdapter(id = 'svg-file'): ExternalIconAdapter {
  return {
    descriptor: {
      id,
      capabilities: {
        inputModes: ['svg-file'],
        sourceType: 'file',
        searchable: false,
        displayName: 'Upload SVG File',
      },
    },
    async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
      if (request.mode !== 'svg-file') {
        throw new ExternalIconImportError({
          code: 'unsupported_source_format',
          message: `Mode "${request.mode}" is not supported`,
          adapterId: id,
          request,
        });
      }
      const content = await request.file.text();
      return {
        intermediate: { kind: 'svg-source', svgContent: content },
        svgContent: content,
        suggestedName: request.name ?? request.file.name.replace(/\.svg$/i, ''),
        provenance: makeProvenance(id),
        warnings: [],
      };
    },
  };
}

/** A multi-mode adapter that accepts all three input modes. */
function createMultiModeAdapter(id = 'multi'): ExternalIconAdapter {
  return {
    descriptor: {
      id,
      capabilities: {
        inputModes: ['library-icon-name', 'raw-svg-string', 'svg-file'],
        sourceType: 'library',
        searchable: false,
        displayName: 'Multi-Mode Adapter',
      },
    },
    async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      const svgContent = request.mode === 'raw-svg-string' ? request.svgContent : svg;
      return {
        intermediate: { kind: 'svg-source', svgContent },
        svgContent,
        suggestedName: 'Multi',
        provenance: makeProvenance(id),
        warnings: [],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

describe('ExternalIconAdapterRegistry', () => {
  let registry: ExternalIconAdapterRegistry;

  beforeEach(() => {
    registry = createAdapterRegistry();
  });

  // ---- Registration ----

  test('registers an adapter and retrieves it by id', () => {
    const adapter = createSearchableAdapter();
    registry.register(adapter);
    expect(registry.get('test-lib')).toBe(adapter);
    expect(registry.size).toBe(1);
  });

  test('rejects duplicate adapter ids', () => {
    registry.register(createSearchableAdapter('dup'));
    expect(() => registry.register(createSearchableAdapter('dup'))).toThrow(
      /already registered/,
    );
  });

  test('rejects adapter with empty id', () => {
    const bad = createPasteAdapter('');
    (bad.descriptor as { id: string }).id = '';
    expect(() => registry.register(bad)).toThrow(/non-empty string/);
  });

  test('rejects adapter with missing sourceType', () => {
    const bad = createPasteAdapter('missing-source-type');
    (bad.descriptor.capabilities as { sourceType?: string }).sourceType = '';
    expect(() => registry.register(bad)).toThrow(/sourceType/);
  });

  test('rejects searchable adapter without search() implementation', () => {
    const adapter = createSearchableAdapter('bad-search');
    // Remove search method to simulate a broken adapter
    (adapter as { search?: unknown }).search = undefined;
    expect(() => registry.register(adapter)).toThrow(/does not implement search/);
  });

  // ---- Unregister ----

  test('unregisters an adapter by id', () => {
    registry.register(createPasteAdapter());
    expect(registry.size).toBe(1);
    registry.unregister('raw-svg');
    expect(registry.size).toBe(0);
    expect(registry.get('raw-svg')).toBeUndefined();
  });

  test('unregister is a no-op for unknown ids', () => {
    registry.unregister('nonexistent');
    expect(registry.size).toBe(0);
  });

  // ---- Lookup by input mode ----

  test('getByInputMode returns adapters supporting the requested mode', () => {
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());
    registry.register(createFileAdapter());

    const libraryAdapters = registry.getByInputMode('library-icon-name');
    expect(libraryAdapters).toHaveLength(1);
    expect(libraryAdapters[0]!.descriptor.id).toBe('test-lib');

    const pasteAdapters = registry.getByInputMode('raw-svg-string');
    expect(pasteAdapters).toHaveLength(1);
    expect(pasteAdapters[0]!.descriptor.id).toBe('raw-svg');

    const fileAdapters = registry.getByInputMode('svg-file');
    expect(fileAdapters).toHaveLength(1);
    expect(fileAdapters[0]!.descriptor.id).toBe('svg-file');
  });

  test('getByInputMode returns multiple adapters when modes overlap', () => {
    registry.register(createPasteAdapter());
    registry.register(createMultiModeAdapter());

    const pasteAdapters = registry.getByInputMode('raw-svg-string');
    expect(pasteAdapters).toHaveLength(2);
  });

  test('getByInputMode returns empty array when no adapter supports the mode', () => {
    registry.register(createPasteAdapter());
    expect(registry.getByInputMode('svg-file')).toEqual([]);
  });

  test('getBySourceType resolves adapters by source classification', () => {
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());
    registry.register(createFileAdapter());

    expect(registry.getBySourceType('library').map((a) => a.descriptor.id)).toEqual(['test-lib']);
    expect(registry.getBySourceType('raw').map((a) => a.descriptor.id)).toEqual(['raw-svg']);
    expect(registry.getBySourceType('file').map((a) => a.descriptor.id)).toEqual(['svg-file']);
  });

  // ---- Listing ----

  test('listDescriptors returns descriptors for all registered adapters', () => {
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());

    const descriptors = registry.listDescriptors();
    expect(descriptors).toHaveLength(2);
    expect(descriptors.map((d) => d.id).sort()).toEqual(['raw-svg', 'test-lib']);
  });

  test('listAll returns all adapter instances', () => {
    registry.register(createSearchableAdapter());
    registry.register(createFileAdapter());

    const all = registry.listAll();
    expect(all).toHaveLength(2);
  });

  // ---- Clear ----

  test('clear removes all adapters', () => {
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());
    expect(registry.size).toBe(2);

    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.listAll()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Adapter contract tests — verify adapter behaviour regardless of source
// ---------------------------------------------------------------------------

describe('Adapter contract: fetch()', () => {
  test('library adapter returns valid ExternalIconImportResult', async () => {
    const adapter = createSearchableAdapter();
    const result = await adapter.fetch({
      mode: 'library-icon-name',
      iconId: 'arrow-right',
    });

    expect(result.intermediate.kind).toBe('svg-source');
    expect(result.intermediate.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('</svg>');
    expect(result.suggestedName).toBe('arrow-right');
    expect(result.provenance.adapterId).toBe('test-lib');
    expect(result.provenance.importedAt).toBeTruthy();
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('paste adapter returns the SVG content it was given', async () => {
    const adapter = createPasteAdapter();
    const inputSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>';
    const result = await adapter.fetch({
      mode: 'raw-svg-string',
      svgContent: inputSvg,
      name: 'My Icon',
    });

    expect(result.intermediate.svgContent).toBe(inputSvg);
    expect(result.svgContent).toBe(inputSvg);
    expect(result.suggestedName).toBe('My Icon');
    expect(result.provenance.adapterId).toBe('raw-svg');
  });

  test('file adapter reads the File and returns its content', async () => {
    const adapter = createFileAdapter();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
    const file = new File([svgContent], 'circle-icon.svg', { type: 'image/svg+xml' });

    const result = await adapter.fetch({
      mode: 'svg-file',
      file,
    });

    expect(result.intermediate.svgContent).toBe(svgContent);
    expect(result.svgContent).toBe(svgContent);
    expect(result.suggestedName).toBe('circle-icon');
    expect(result.provenance.adapterId).toBe('svg-file');
  });

  test('adapter rejects unsupported input modes with ExternalIconImportError', async () => {
    const adapter = createSearchableAdapter();
    try {
      await adapter.fetch({
        mode: 'raw-svg-string',
        svgContent: '<svg></svg>',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalIconImportError);
      const importErr = err as ExternalIconImportError;
      expect(importErr.code).toBe('unsupported_source_format');
      expect(importErr.adapterId).toBe('test-lib');
      expect(importErr.request?.mode).toBe('raw-svg-string');
    }
  });

  test('ExternalIconImportError preserves cause chain', () => {
    const cause = new TypeError('network failure');
    const err = new ExternalIconImportError({
      code: 'normalization_failed',
      message: 'Could not fetch icon',
      adapterId: 'test',
      cause,
    });

    expect(err.name).toBe('ExternalIconImportError');
    expect(err.code).toBe('normalization_failed');
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('Could not fetch icon');
  });
});

describe('Adapter contract: search()', () => {
  test('searchable adapter returns results matching query', async () => {
    const adapter = createSearchableAdapter();
    const results = await adapter.search!('arrow');

    expect(results).toHaveLength(2);
    expect(results[0]!.iconId).toBe('arrow-left');
    expect(results[0]!.name).toBe('Arrow Left');
    expect(results[1]!.iconId).toBe('arrow-right');
  });

  test('searchable adapter returns empty array for no matches', async () => {
    const adapter = createSearchableAdapter();
    const results = await adapter.search!('nonexistent');
    expect(results).toEqual([]);
  });

  test('search respects limit option', async () => {
    const adapter = createSearchableAdapter();
    const results = await adapter.search!('arrow', { limit: 1 });
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Integration: registry + adapter contract together
// ---------------------------------------------------------------------------

describe('Registry + adapter integration', () => {
  test('resolve adapter from registry and fetch an icon end-to-end', async () => {
    const registry = createAdapterRegistry();
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());
    registry.register(createFileAdapter());

    // Simulate: user picks "library-icon-name" mode in UI
    const adapters = registry.getByInputMode('library-icon-name');
    expect(adapters).toHaveLength(1);

    const adapter = adapters[0]!;
    expect(adapter.descriptor.capabilities.searchable).toBe(true);

    // Search, pick first result, fetch it
    const searchResults = await adapter.search!('arrow');
    const picked = searchResults[0]!;
    const result = await adapter.fetch({
      mode: 'library-icon-name',
      iconId: picked.iconId,
      name: picked.name,
    });

    expect(result.intermediate.kind).toBe('svg-source');
    expect(result.intermediate.svgContent).toContain('<svg');
    expect(result.svgContent).toContain('<svg');
    expect(result.suggestedName).toBe('Arrow Left');
    expect(result.provenance.adapterId).toBe('test-lib');
    expect(result.provenance.sourceLibrary).toBe('test');
  });

  test('descriptors expose enough metadata for UI rendering', () => {
    const registry = createAdapterRegistry();
    registry.register(createSearchableAdapter());
    registry.register(createPasteAdapter());
    registry.register(createFileAdapter());

    const descriptors = registry.listDescriptors();
    for (const d of descriptors) {
      expect(d.id).toBeTruthy();
      expect(d.capabilities.displayName).toBeTruthy();
      expect(d.capabilities.inputModes.length).toBeGreaterThanOrEqual(1);
      expect(d.capabilities.sourceType).toBeTruthy();
    }
  });
});

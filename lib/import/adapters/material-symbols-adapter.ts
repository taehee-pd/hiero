/**
 * Material Symbols import adapter.
 *
 * Source: @material-symbols/svg-400 (Google's official npm package).
 * Variants: outlined, rounded, sharp.
 * License: Apache-2.0.
 *
 * @module
 */

import {
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSearchResult,
  type ExternalIconSourceDescriptor,
} from '../adapter-sdk';
import {
  getMaterialSymbolsManifest,
  getMaterialSymbolsVersion,
  loadMaterialSymbol,
} from './material-symbols-source';

const ADAPTER_ID = 'material-symbols';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['library-icon-name'],
    sourceType: 'library',
    searchable: true,
    displayName: 'Material Symbols',
    get libraryVersion() {
      return getMaterialSymbolsVersion();
    },
    license: 'Apache-2.0',
  },
};

export const materialSymbolsAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(
    request: ExternalIconImportRequest,
  ): Promise<ExternalIconImportResult> {
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `Material Symbols adapter only supports "library-icon-name" mode, got "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    const iconName = request.iconId;
    const iconData =
      loadMaterialSymbol(iconName, 'outlined') ??
      loadMaterialSymbol(iconName, 'rounded') ??
      loadMaterialSymbol(iconName, 'sharp');

    if (!iconData) {
      throw new ExternalIconImportError({
        code: 'icon_not_found',
        message: `Material Symbol "${iconName}" not found. Check the icon name at fonts.google.com/icons`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    return {
      intermediate: { kind: 'svg-source', svgContent: iconData.svgContent },
      svgContent: iconData.svgContent,
      suggestedName: request.name ?? formatName(iconName),
      suggestedTags: ['material-symbols', iconData.variant],
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: 'Material Symbols',
        sourceVersion: getMaterialSymbolsVersion(),
        sourceIconId: iconName,
        sourceLicense: 'Apache-2.0',
        importedAt: new Date().toISOString(),
      },
      warnings: [],
    };
  },

  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<ExternalIconSearchResult[]> {
    const limit = options?.limit ?? 50;
    const manifest = getMaterialSymbolsManifest();
    const q = query.toLowerCase().trim().replace(/\s+/g, '_');

    if (!q) {
      return manifest.slice(0, limit).map(toSearchResult);
    }

    const results: ExternalIconSearchResult[] = [];
    for (const entry of manifest) {
      if (entry.name.includes(q)) {
        results.push(toSearchResult(entry));
        if (results.length >= limit) break;
      }
    }
    return results;
  },
};

function toSearchResult(entry: { name: string }): ExternalIconSearchResult {
  return {
    iconId: entry.name,
    name: formatName(entry.name),
    tags: ['material-symbols'],
  };
}

function formatName(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

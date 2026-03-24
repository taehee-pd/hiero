/**
 * Phosphor Icons import adapter.
 *
 * Source: @phosphor-icons/core.
 * 6 weights: thin, light, regular, bold, fill, duotone.
 * Weight mapping: thin→ultralight, light→light, regular→regular, bold→bold.
 * fill and duotone are skipped (rendering styles, not weights).
 * License: MIT.
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
  getPhosphorManifest,
  getPhosphorVersion,
  loadPhosphorIcon,
} from './phosphor-source';

const ADAPTER_ID = 'phosphor';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['library-icon-name'],
    sourceType: 'library',
    searchable: true,
    displayName: 'Phosphor Icons',
    get libraryVersion() {
      return getPhosphorVersion();
    },
    license: 'MIT',
  },
};

export const phosphorAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(
    request: ExternalIconImportRequest,
  ): Promise<ExternalIconImportResult> {
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `Phosphor adapter only supports "library-icon-name" mode, got "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    const iconName = request.iconId;
    const iconData = loadPhosphorIcon(iconName, 'regular');

    if (!iconData) {
      throw new ExternalIconImportError({
        code: 'icon_not_found',
        message: `Phosphor icon "${iconName}" not found. Check the icon name at phosphoricons.com`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    return {
      intermediate: { kind: 'svg-source', svgContent: iconData.svgContent },
      svgContent: iconData.svgContent,
      suggestedName: request.name ?? formatName(iconName),
      suggestedTags: ['phosphor'],
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: 'Phosphor',
        sourceVersion: getPhosphorVersion(),
        sourceIconId: iconName,
        sourceLicense: 'MIT',
        importedAt: new Date().toISOString(),
      },
      warnings: [],
      metadata: {
        weightCount: 4,
        hasWeightControlPoints: true,
      },
    };
  },

  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<ExternalIconSearchResult[]> {
    const limit = options?.limit ?? 50;
    const manifest = getPhosphorManifest();
    const q = query.toLowerCase().trim();

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
    tags: ['phosphor'],
  };
}

function formatName(kebab: string): string {
  return kebab
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

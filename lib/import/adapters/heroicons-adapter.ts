/**
 * Heroicons import adapter.
 *
 * Source: @heroicons/react (Tailwind Labs).
 * Variants: outline (24px), solid (24px / 20px).
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
  getHeroiconsManifest,
  getHeroiconsVersion,
  loadHeroicon,
} from './heroicons-source';

const ADAPTER_ID = 'heroicons';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['library-icon-name'],
    sourceType: 'library',
    searchable: true,
    displayName: 'Heroicons',
    get libraryVersion() {
      return getHeroiconsVersion();
    },
    license: 'MIT',
  },
};

export const heroiconsAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(
    request: ExternalIconImportRequest,
  ): Promise<ExternalIconImportResult> {
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `Heroicons adapter only supports "library-icon-name" mode, got "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    const iconName = request.iconId;
    const iconData = loadHeroicon(iconName, 'outline') ?? loadHeroicon(iconName, 'solid');

    if (!iconData) {
      throw new ExternalIconImportError({
        code: 'icon_not_found',
        message: `Heroicons icon "${iconName}" not found. Check the icon name at heroicons.com`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    return {
      intermediate: { kind: 'svg-source', svgContent: iconData.svgContent },
      svgContent: iconData.svgContent,
      suggestedName: request.name ?? formatName(iconName),
      suggestedTags: ['heroicons', iconData.variant],
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: 'Heroicons',
        sourceVersion: getHeroiconsVersion(),
        sourceIconId: iconName,
        sourceLicense: 'MIT',
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
    const manifest = getHeroiconsManifest();
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

function toSearchResult(entry: { name: string; variant: string }): ExternalIconSearchResult {
  return {
    iconId: entry.name,
    name: formatName(entry.name),
    tags: ['heroicons', entry.variant],
  };
}

function formatName(kebab: string): string {
  return kebab
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

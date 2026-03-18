/**
 * Lucide Adapter
 *
 * Imports icons from the Lucide icon library by name.
 * Resolves canonical SVG source from the installed lucide-react package,
 * attaches provenance, and passes through to the sanitization pipeline.
 *
 * Lucide-specific assumptions are contained entirely within this adapter
 * and the lucide-source resolver. The downstream pipeline sees generic SVG.
 */

import {
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSearchResult,
  type ExternalIconSourceDescriptor,
  type ExternalIconWarning,
} from '../adapter-sdk/types';
import {
  getLucideManifest,
  getLucideVersion,
  loadLucideIcon,
  lucideNodesToSvg,
} from './lucide-source';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADAPTER_ID = 'lucide';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['library-icon-name'],
    sourceType: 'library',
    searchable: true,
    displayName: 'Lucide Icons',
    get libraryVersion() {
      return getLucideVersion();
    },
    license: 'ISC',
  },
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const lucideAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `Lucide adapter only supports "library-icon-name" mode, got "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    const iconName = request.iconId;
    const iconData = loadLucideIcon(iconName);

    if (!iconData) {
      throw new ExternalIconImportError({
        code: 'icon_not_found',
        message: `Lucide icon "${iconName}" not found. Check the icon name at lucide.dev/icons`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    const svgContent = lucideNodesToSvg(iconData.nodes);
    const warnings: ExternalIconWarning[] = [];

    return {
      intermediate: { kind: 'svg-source', svgContent },
      svgContent,
      suggestedName: request.name ?? formatLucideName(iconName),
      suggestedTags: ['lucide'],
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: 'Lucide',
        sourceVersion: getLucideVersion(),
        sourceIconId: iconName,
        sourceLicense: 'ISC',
        importedAt: new Date().toISOString(),
      },
      warnings,
    };
  },

  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<ExternalIconSearchResult[]> {
    const limit = options?.limit ?? 50;
    const manifest = getLucideManifest();
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) {
      // Return first N icons when query is empty
      return manifest.slice(0, limit).map(toSearchResult);
    }

    // Simple substring match on icon name
    const results: ExternalIconSearchResult[] = [];
    for (const entry of manifest) {
      if (entry.name.includes(queryLower)) {
        results.push(toSearchResult(entry));
        if (results.length >= limit) break;
      }
    }

    return results;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSearchResult(entry: { name: string }): ExternalIconSearchResult {
  return {
    iconId: entry.name,
    name: formatLucideName(entry.name),
    tags: ['lucide'],
  };
}

/**
 * Convert kebab-case icon name to Title Case display name.
 * e.g. "arrow-right" → "Arrow Right"
 */
function formatLucideName(name: string): string {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

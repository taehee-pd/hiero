/**
 * Figma Adapter
 *
 * Imports icons from Figma files by fetching component nodes as SVG.
 * Uses the Figma REST API via a server-side proxy route.
 *
 * Unlike other adapters (Lucide, Heroicons) that resolve icons from
 * bundled data, Figma requires network requests with per-user auth.
 * The adapter stores a component cache per file to avoid redundant
 * API calls during search.
 */

import {
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSearchResult,
  type ExternalIconSourceDescriptor,
} from '../adapter-sdk/types';

const ADAPTER_ID = 'figma';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['library-icon-name'],
    sourceType: 'figma-file',
    searchable: true,
    displayName: 'Figma',
    license: 'User file',
  },
};

export const figmaAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `Figma adapter only supports "library-icon-name" mode, got "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    // iconId format: "fileKey:nodeId" (set by the proxy route)
    const iconName = request.iconId;

    // The actual Figma API call happens in the proxy route.
    // This adapter's fetch() is only called from the server-side route
    // which has already resolved the SVG content. In the client-side
    // flow, the dialog calls the proxy route directly.
    throw new ExternalIconImportError({
      code: 'icon_not_found',
      message: `Figma icons must be imported via the /api/import/figma proxy. Icon: "${iconName}"`,
      adapterId: ADAPTER_ID,
      request,
    });
  },

  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<ExternalIconSearchResult[]> {
    // Search is handled client-side in ImportIconDialog using the
    // cached component list. This method exists for interface compliance.
    const _limit = options?.limit ?? 50;
    return [];
  },
};

/**
 * Convert kebab-case or slash-separated name to Title Case.
 * e.g. "icons/arrow-right" → "Arrow Right"
 */
export function formatFigmaName(name: string): string {
  // Take the last segment if path-separated
  const segment = name.split('/').pop() ?? name;
  return segment
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();
}

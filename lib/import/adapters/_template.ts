/**
 * Adapter template — copy this file to create a new external icon adapter.
 *
 * Steps:
 *   1. Copy this file and rename it (e.g. `heroicons-adapter.ts`).
 *   2. Replace every `Fill in` marker with your implementation.
 *   3. Register the adapter in `lib/import/adapters/index.ts`.
 *   4. Add tests in `tests/<your-adapter>.test.ts`.
 *
 * Rules:
 *   - Return raw SVG content in `fetch()`. Never produce internal schema types
 *     (Layer, Icon, etc.) — the pipeline handles schema conversion.
 *   - Reject unsupported input modes with `ExternalIconImportError`.
 *   - Surface any fidelity loss as warnings. Never silently drop SVG content.
 *   - Keep `descriptor` static and immutable after construction.
 *   - If `capabilities.searchable` is true, you MUST implement `search()`.
 */

import {
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSourceDescriptor,
} from '../adapter-sdk';

// Fill in: replace with your adapter's unique id and metadata.
const ADAPTER_ID = 'my-library';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    // Fill in: declare which input modes your adapter supports.
    inputModes: ['library-icon-name'],
    sourceType: 'library',
    // Fill in: set to true and implement search() if your source is browsable.
    searchable: false,
    displayName: 'My Icon Library',
    // Fill in: set the library version if applicable.
    libraryVersion: undefined,
    // Fill in: set the SPDX license identifier if applicable.
    license: undefined,
  },
};

export const myLibraryAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
    // Guard: reject unsupported modes early.
    if (request.mode !== 'library-icon-name') {
      throw new ExternalIconImportError({
        code: 'unsupported_source_format',
        message: `"${ADAPTER_ID}" does not support input mode "${request.mode}"`,
        adapterId: ADAPTER_ID,
        request,
      });
    }

    // Fill in: resolve the icon id to raw SVG content.
    // For a library adapter, this typically means looking up icon data from
    // a vendored manifest or fetching from a known source.
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- fill in path data --></svg>`;
    const suggestedName = request.name ?? request.iconId;

    return {
      intermediate: { kind: 'svg-source', svgContent },
      svgContent,
      suggestedName,
      // Fill in: add tags from your library's metadata if available.
      suggestedTags: [],
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: 'My Library',
        sourceVersion: descriptor.capabilities.libraryVersion,
        sourceIconId: request.iconId,
        sourceLicense: descriptor.capabilities.license,
        importedAt: new Date().toISOString(),
      },
      // Fill in: collect any warnings about unsupported features or fidelity loss.
      warnings: [],
    };
  },

  // Fill in: uncomment and implement if capabilities.searchable is true.
  // async search(
  //   query: string,
  //   options?: { limit?: number },
  // ): Promise<ExternalIconSearchResult[]> {
  //   const limit = options?.limit ?? 50;
  //   // Fill in: search your icon manifest and return matching results.
  //   return [];
  // },
};

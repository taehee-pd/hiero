/**
 * Raw SVG Adapter — handles pasted SVG strings and uploaded SVG files.
 *
 * This is the simplest adapter: it passes user-provided SVG content through
 * the sanitizer and returns it as an ExternalIconImportResult. No library
 * lookup, no search — just sanitize, name, and attach provenance.
 */

import {
  ExternalIconImportError,
  type ExternalIconAdapter,
  type ExternalIconImportRequest,
  type ExternalIconImportResult,
  type ExternalIconSourceDescriptor,
} from '../adapter-sdk/types';
import { sanitizeSvg } from '../sanitize/svg-sanitizer';

const ADAPTER_ID = 'raw-svg';

const descriptor: ExternalIconSourceDescriptor = {
  id: ADAPTER_ID,
  capabilities: {
    inputModes: ['raw-svg-string', 'svg-file'],
    sourceType: 'raw',
    searchable: false,
    displayName: 'Raw SVG',
  },
};

export const rawSvgAdapter: ExternalIconAdapter = {
  descriptor,

  async fetch(request: ExternalIconImportRequest): Promise<ExternalIconImportResult> {
    // Resolve raw SVG content from the request
    let rawContent: string;
    let sourceName: string;
    let sourceType: 'svg-paste' | 'svg-file';

    switch (request.mode) {
      case 'raw-svg-string':
        rawContent = request.svgContent;
        sourceName = request.name ?? 'Pasted SVG';
        sourceType = 'svg-paste';
        break;
      case 'svg-file':
        rawContent = await request.file.text();
        sourceName = request.name ?? stripSvgExtension(request.file.name);
        sourceType = 'svg-file';
        break;
      default:
        throw new ExternalIconImportError({
          code: 'unsupported_source_format',
          message: `Raw SVG adapter does not support input mode "${(request as { mode: string }).mode}"`,
          adapterId: ADAPTER_ID,
          request,
        });
    }

    // Validate non-empty
    if (!rawContent.trim()) {
      throw new ExternalIconImportError({
        code: 'invalid_source_input',
        message: 'SVG content is empty',
        adapterId: ADAPTER_ID,
        request,
      });
    }

    // Sanitize
    let sanitized;
    try {
      sanitized = sanitizeSvg(rawContent);
    } catch (cause) {
      throw new ExternalIconImportError({
        code: 'parse_failed',
        message: 'Failed to parse or sanitize SVG input',
        adapterId: ADAPTER_ID,
        request,
        cause,
      });
    }

    return {
      intermediate: { kind: 'svg-source', svgContent: sanitized.svg },
      svgContent: sanitized.svg,
      suggestedName: sourceName,
      provenance: {
        adapterId: ADAPTER_ID,
        sourceLibrary: sourceType,
        importedAt: new Date().toISOString(),
      },
      warnings: sanitized.warnings,
    };
  },
};

function stripSvgExtension(filename: string): string {
  return filename.replace(/\.svg$/i, '').trim() || 'Uploaded SVG';
}

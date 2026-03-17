import { editorStore } from '@/lib/editor-store/store';
import { normalizeSvg } from './normalize';
import { sanitizeSvg } from './sanitize';
import { adapterRegistry, type ExternalIconImportRequest } from './adapter-sdk';
import { registerBuiltinAdapters } from './adapters';
import { convertNormalizedIconToIcon } from './convert-normalized-icon';
import type { Icon } from '@/lib/schema/types';

export type PreparedExternalImport = {
  icon: Icon;
  normalized: ReturnType<typeof normalizeSvg>;
  previewSvg: string;
  sourceLabel: string;
};

export async function prepareExternalImport(options: {
  adapterId: string;
  request: ExternalIconImportRequest;
  existingIconIds?: Iterable<string>;
}): Promise<PreparedExternalImport> {
  registerBuiltinAdapters();
  const adapter = adapterRegistry.get(options.adapterId);
  if (!adapter) {
    throw new Error('Import source is unavailable. Please choose another source.');
  }

  let fetched;
  try {
    fetched = await adapter.fetch(options.request);
  } catch {
    throw new Error(readableImportError(options.adapterId));
  }

  let sanitized;
  try {
    sanitized = sanitizeSvg(fetched.intermediate.svgContent);
  } catch {
    throw new Error('The SVG could not be validated. Please check the file or try another icon.');
  }

  let normalized;
  try {
    normalized = normalizeSvg(sanitized.svg, {
      name: fetched.suggestedName,
      tags: fetched.suggestedTags,
      provenance: fetched.provenance,
      upstreamWarnings: [...fetched.warnings, ...sanitized.warnings],
    });
  } catch {
    throw new Error('The icon could not be imported due to unsupported SVG structure.');
  }

  const icon = convertNormalizedIconToIcon(normalized, {
    sourceName: fetched.suggestedName,
    existingIconIds: options.existingIconIds,
  });

  return {
    icon,
    normalized,
    previewSvg: sanitized.svg,
    sourceLabel: buildSourceLabel(fetched.provenance),
  };
}

export function acceptPreparedImport(prepared: PreparedExternalImport): string {
  editorStore.getState().insertIcon(prepared.icon);
  return editorStore.getState().currentIconId ?? prepared.icon.id;
}

function buildSourceLabel(provenance: {
  sourceLibrary?: string;
  sourceIconId?: string;
  sourceVersion?: string;
}): string {
  const lib = provenance.sourceLibrary ?? 'External source';
  const iconId = provenance.sourceIconId ? ` / ${provenance.sourceIconId}` : '';
  const version = provenance.sourceVersion ? ` (v${provenance.sourceVersion})` : '';
  return `${lib}${iconId}${version}`;
}

function readableImportError(adapterId: string): string {
  if (adapterId === 'lucide') {
    return 'Lucide icon was not found. Check the icon name and try again.';
  }
  return 'Import failed. Please verify the source input and try again.';
}

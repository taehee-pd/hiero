import type { ExternalIconWarning } from './adapter-sdk';
import type { NormalizedIcon } from './normalized-ir';

export type ImportUxStatus =
  | 'idle'
  | 'validating'
  | 'importing'
  | 'success'
  | 'success_with_warnings'
  | 'failed';

export type ImportUxState = {
  status: ImportUxStatus;
  errorMessage?: string;
  warnings: ExternalIconWarning[];
  normalized?: NormalizedIcon;
  previewSvg?: string;
  sourceLabel?: string;
  unsupportedSummary: Array<{ kind: string; count: number }>;
};

export type ImportUxEvent =
  | { type: 'reset' }
  | { type: 'start_validating' }
  | { type: 'start_importing' }
  | {
      type: 'prepared';
      normalized: NormalizedIcon;
      previewSvg: string;
      warnings: ExternalIconWarning[];
      sourceLabel: string;
    }
  | { type: 'failed'; message: string };

export const INITIAL_IMPORT_UX_STATE: ImportUxState = {
  status: 'idle',
  warnings: [],
  unsupportedSummary: [],
};

export function reduceImportUxState(state: ImportUxState, event: ImportUxEvent): ImportUxState {
  switch (event.type) {
    case 'reset':
      return { ...INITIAL_IMPORT_UX_STATE };
    case 'start_validating':
      return {
        ...state,
        status: 'validating',
        errorMessage: undefined,
      };
    case 'start_importing':
      return {
        ...state,
        status: 'importing',
        errorMessage: undefined,
      };
    case 'prepared': {
      const unsupportedSummary = summarizeUnsupportedFeatures(event.normalized);
      return {
        status: event.warnings.length > 0 ? 'success_with_warnings' : 'success',
        errorMessage: undefined,
        warnings: event.warnings,
        normalized: event.normalized,
        previewSvg: event.previewSvg,
        sourceLabel: event.sourceLabel,
        unsupportedSummary,
      };
    }
    case 'failed':
      return {
        ...state,
        status: 'failed',
        errorMessage: event.message,
      };
    default:
      return state;
  }
}

export function summarizeUnsupportedFeatures(
  normalized: NormalizedIcon,
): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();

  const visit = (node: NormalizedIcon['nodes'][number]): void => {
    for (const unsupported of node.sourceMeta.unsupported) {
      counts.set(unsupported.kind, (counts.get(unsupported.kind) ?? 0) + 1);
    }
    for (const child of node.children ?? []) visit(child);
  };

  for (const node of normalized.nodes) visit(node);

  return Array.from(counts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

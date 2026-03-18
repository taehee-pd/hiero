import { describe, expect, test } from 'bun:test';
import {
  INITIAL_IMPORT_UX_STATE,
  reduceImportUxState,
  summarizeUnsupportedFeatures,
  type ImportUxState,
} from '../lib/import';
import type { NormalizedIcon } from '../lib/import/normalized-ir';

function makeNormalized(): NormalizedIcon {
  return {
    name: 'State Test',
    tags: [],
    viewBox: [0, 0, 24, 24],
    warnings: [],
    nodes: [
      {
        index: 0,
        kind: 'path',
        geometry: { kind: 'path', d: 'M0 0' },
        style: {},
        sourceMeta: {
          sourceTag: 'path',
          unsupported: [
            { kind: 'filter', value: 'url(#f)' },
            { kind: 'filter', value: 'url(#f2)' },
            { kind: 'mask', value: 'url(#m)' },
          ],
        },
      },
    ],
  };
}

describe('import UX model', () => {
  test('transitions idle -> validating -> importing -> success_with_warnings', () => {
    let state: ImportUxState = { ...INITIAL_IMPORT_UX_STATE };

    state = reduceImportUxState(state, { type: 'start_validating' });
    expect(state.status).toBe('validating');

    state = reduceImportUxState(state, { type: 'start_importing' });
    expect(state.status).toBe('importing');

    state = reduceImportUxState(state, {
      type: 'prepared',
      normalized: makeNormalized(),
      previewSvg: '<svg/>',
      warnings: [{ code: 'unsupported_feature_dropped', severity: 'warning', message: 'Dropped feature' }],
      sourceLabel: 'Lucide / alert',
    });

    expect(state.status).toBe('success_with_warnings');
    expect(state.previewSvg).toContain('<svg');
    expect(state.sourceLabel).toContain('Lucide');
    expect(state.unsupportedSummary).toEqual([
      { kind: 'filter', count: 2 },
      { kind: 'mask', count: 1 },
    ]);
  });

  test('transitions to failed and reset', () => {
    let state: ImportUxState = { ...INITIAL_IMPORT_UX_STATE };
    state = reduceImportUxState(state, { type: 'failed', message: 'Import failed' });
    expect(state.status).toBe('failed');
    expect(state.errorMessage).toBe('Import failed');

    state = reduceImportUxState(state, { type: 'reset' });
    expect(state).toEqual(INITIAL_IMPORT_UX_STATE);
  });

  test('summarizes unsupported features deterministically', () => {
    const summary = summarizeUnsupportedFeatures(makeNormalized());
    expect(summary).toEqual([
      { kind: 'filter', count: 2 },
      { kind: 'mask', count: 1 },
    ]);
  });
});

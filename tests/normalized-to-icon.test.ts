import { describe, expect, test } from 'bun:test';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { convertNormalizedIconToIcon } from '../lib/import';
import type { NormalizedIcon } from '../lib/import/normalized-ir';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function makeNormalized(): NormalizedIcon {
  return {
    name: 'alert-triangle',
    tags: ['alerts', 'status'],
    viewBox: [0, 0, 32, 32],
    provenance: {
      adapterId: 'lucide',
      sourceLibrary: 'Lucide',
      sourceVersion: '0.0.0-test',
      sourceIconId: 'alert-triangle',
      sourceLicense: 'ISC',
      importedAt: '2026-01-01T00:00:00.000Z',
    },
    warnings: [],
    nodes: [
      {
        index: 0,
        kind: 'rect',
        geometry: { kind: 'rect', x: 2, y: 2, width: 12, height: 8, rx: 2, ry: 2 },
        style: {
          fill: { mode: 'fixed', value: '#111111' },
          stroke: { mode: 'fixed', value: '#f97316' },
          strokeWidth: 2,
          fillOpacity: 0.9,
          strokeOpacity: 0.7,
          lineCap: 'round',
          lineJoin: 'bevel',
        },
        transform: { x: 3, y: 4 },
        sourceMeta: {
          sourceTag: 'rect',
          sourceNodeId: 'frame',
          sourceClassName: 'primary-shape',
          originalTransform: 'translate(3 4)',
          unsupported: [{ kind: 'filter', value: 'url(#drop)' }],
        },
      },
      {
        index: 1,
        kind: 'line',
        geometry: { kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10 },
        style: { stroke: { mode: 'currentColor' }, strokeWidth: 1.5 },
        sourceMeta: {
          sourceTag: 'line',
          unsupported: [],
        },
      },
    ],
  };
}

describe('convertNormalizedIconToIcon', () => {
  test('converts one normalized asset to one editable icon schema object', () => {
    const icon = convertNormalizedIconToIcon(makeNormalized(), {
      existingIconIds: ['icon-alert-triangle'],
      sourceName: 'alert-triangle.svg',
    });

    expect(icon.id).toBe('icon-alert-triangle-2');
    expect(icon.name).toBe('Alert Triangle');
    expect(icon.tags).toEqual(['alerts', 'status']);
    expect(icon.variants.v32).toBeDefined();
    expect(icon.variants.v32!.viewBox).toEqual([0, 0, 32, 32]);

    const layers = icon.variants.v32!.layers;
    expect(Object.keys(layers)).toEqual(['frame', 'line-2']);

    expect(layers.frame).toMatchObject({
      id: 'frame',
      style: {
        fill: { mode: 'fixed', value: '#111111' },
        stroke: { mode: 'fixed', value: '#f97316' },
        strokeWidth: 2,
        fillOpacity: 0.9,
        strokeOpacity: 0.7,
        lineCap: 'round',
        lineJoin: 'bevel',
      },
      transform: { x: 3, y: 4 },
      importMeta: {
        sourceTag: 'rect',
        sourceNodeId: 'frame',
        sourceClassName: 'primary-shape',
        originalTransform: 'translate(3 4)',
        unsupported: [{ kind: 'filter', value: 'url(#drop)' }],
      },
    });
    expect(layers.frame?.path?.d).toContain('M4 2');

    expect(layers['line-2']).toMatchObject({
      id: 'line-2',
      style: {
        stroke: { mode: 'currentColor' },
        strokeWidth: 1.5,
      },
      path: {
        d: 'M0 0 L10 10',
      },
    });

    expect(icon.meta?.externalImport).toMatchObject({
      adapterId: 'lucide',
      sourceIconId: 'alert-triangle',
    });
  });

  test('converted icon can be inserted and edited via editor store actions', () => {
    editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
    clearHistory();

    const icon = convertNormalizedIconToIcon(makeNormalized(), {
      sourceName: 'editable.svg',
      existingIconIds: Object.keys(editorStore.getState().project?.icons ?? {}),
    });

    editorStore.getState().insertIcon(icon);
    editorStore.getState().setLayerVisibility(icon.id, 'frame', false);

    const saved = editorStore.getState().project?.icons[icon.id];
    expect(saved).toBeDefined();
    expect(saved?.variants.v32?.layers.frame?.visible).toBe(false);
  });
});

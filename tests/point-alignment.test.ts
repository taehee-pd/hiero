import { describe, expect, test } from 'bun:test';
import { parseSvgPath } from '../lib/editor-core/parse';
import {
  alignSelectedPoints,
  distributeSelectedPoints,
} from '../lib/editor-core/vector-commands';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap(pathD: string) {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  editorStore.getState().patchLayer('icon-chevron', 'default', 'chevron', {
    path: { d: pathD },
  });
  editorStore.getState().setSelection({
    layerIds: ['chevron'],
    pointIds: ['0:0', '0:1', '0:2'],
  });
}

function getPointPositions() {
  return parseSvgPath(
    editorStore.getState().project!.icons['icon-chevron'].variants.v24.states.default.layers.chevron
      .path!.d,
  ).subPaths[0]!.points.map((point) => point.position);
}

describe('point alignment within a path', () => {
  test('aligns selected points along the y-axis max anchor', () => {
    bootstrap('M0 0 L4 6 L8 10');

    expect(alignSelectedPoints('y', 'max')).toBeTrue();
    expect(getPointPositions().map((point) => point.y)).toEqual([10, 10, 10]);
  });

  test('distributes selected points evenly on the y-axis regardless of selection order', () => {
    bootstrap('M0 0 L4 2 L8 20');
    editorStore.getState().setSelection({
      layerIds: ['chevron'],
      pointIds: ['0:2', '0:0', '0:1'],
    });

    expect(distributeSelectedPoints('y')).toBeTrue();
    expect(getPointPositions().map((point) => point.y)).toEqual([0, 10, 20]);
  });
});

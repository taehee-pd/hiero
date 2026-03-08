import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { mapPointIntoBounds } from '../lib/editor-core/path-editor';
import { editorStore } from '../lib/editor-store/store';
import {
  alignSelectedPoints,
  deleteSelectedPoint,
  deleteSelectedPoints,
  distributeSelectedPoints,
  getSelectedPointsBoundingBox,
  insertPointAfterSelection,
  nudgeSelectedPointByArrow,
  setSelectedPointType,
  toggleSelectedPathClosed,
  toggleSelectedPointType,
} from '../lib/editor-core/vector-commands';
import { parseSvgPath } from '../lib/editor-core/parse';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
}

function setupLayerSelection(pointKey: string) {
  return setupLayerMultiSelection([pointKey]);
}

function setupLayerMultiSelection(pointKeys: string[]) {
  const state = editorStore.getState();
  const iconId = state.currentIconId!;
  const stateId = state.currentStateId!;
  const layerId = 'chevron';
  state.setSelection({ layerIds: [layerId], pointIds: pointKeys });
  return { iconId, stateId, layerId };
}

describe('vector commands', () => {
  test('deletes selected point', () => {
    bootstrap();
    const { iconId, stateId, layerId } = setupLayerSelection('0:1');
    const before = editorStore.getState().project!.icons[iconId].states[stateId].layers[layerId].path!
      .d;

    expect(deleteSelectedPoint()).toBeTrue();

    const after = editorStore.getState().project!.icons[iconId].states[stateId].layers[layerId].path!
      .d;
    expect(after).not.toBe(before);
    expect(after).toBe('M9.5 7 L9.5 17');
  });

  test('toggles selected point type corner/smooth', () => {
    bootstrap();
    setupLayerSelection('0:1');

    expect(toggleSelectedPointType()).toBeTrue();
    const smooth =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(smooth.includes('C')).toBeTrue();

    expect(toggleSelectedPointType()).toBeTrue();
    const corner =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(corner).toBe('M9.5 7 C9.5 7 14.5 12 14.5 12 C14.5 12 9.5 17 9.5 17');
  });

  test('inserts midpoint after selection', () => {
    bootstrap();
    setupLayerSelection('0:0');

    expect(insertPointAfterSelection()).toBeTrue();

    const d = editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!
      .d;
    expect(d).toBe('M9.5 7 L12 9.5 L14.5 12 L9.5 17');
  });

  test('toggles path closed state', () => {
    bootstrap();
    setupLayerSelection('0:0');

    expect(toggleSelectedPathClosed()).toBeTrue();
    const closed =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(closed.endsWith(' Z')).toBeTrue();

    expect(toggleSelectedPathClosed()).toBeTrue();
    const reopened =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(reopened).toBe('M9.5 7 L14.5 12 L9.5 17');
  });

  test('nudges selected point by arrow key', () => {
    bootstrap();
    setupLayerSelection('0:1');

    expect(nudgeSelectedPointByArrow('ArrowRight')).toBeTrue();

    const d = editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!
      .d;
    expect(d).toBe('M9.5 7 L15 12 L9.5 17');
  });

  test('returns the selected points bounding box', () => {
    bootstrap();
    setupLayerMultiSelection(['0:0', '0:1', '0:2']);

    expect(getSelectedPointsBoundingBox()).toEqual({
      minX: 9.5,
      minY: 7,
      maxX: 14.5,
      maxY: 17,
      points: [
        { key: '0:0', x: 9.5, y: 7 },
        { key: '0:1', x: 14.5, y: 12 },
        { key: '0:2', x: 9.5, y: 17 },
      ],
    });
  });

  test('aligns selected points to the left edge of their bounding box', () => {
    bootstrap();
    setupLayerMultiSelection(['0:0', '0:1', '0:2']);

    expect(alignSelectedPoints('x', 'min')).toBeTrue();

    const d =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    const path = parseSvgPath(d);
    const xValues = path.subPaths[0]!.points.map((point) => point.position.x);
    expect(xValues).toEqual([9.5, 9.5, 9.5]);
  });

  test('distributes selected points evenly on an axis', () => {
    bootstrap();
    const state = editorStore.getState();
    state.patchLayer('icon-chevron', 'default', 'chevron', {
      path: { d: 'M0 0 L2 0 L15 0 L20 0' },
    });
    setupLayerMultiSelection(['0:0', '0:1', '0:2', '0:3']);

    expect(distributeSelectedPoints('x')).toBeTrue();

    const d =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(d).toBe('M0 0 L6.667 0 L13.333 0 L20 0');
  });

  test('sets symmetric point type with mirrored handles', () => {
    bootstrap();
    const state = editorStore.getState();
    state.patchLayer('icon-chevron', 'default', 'chevron', {
      path: { d: 'M0 0 L10 10 L20 0' },
    });
    setupLayerSelection('0:1');

    expect(setSelectedPointType('symmetric')).toBeTrue();

    const d =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    const path = parseSvgPath(d);
    const point = path.subPaths[0]!.points[1]!;
    expect(point.handleIn).not.toBeNull();
    expect(point.handleOut).not.toBeNull();
    expect(point.handleIn!.x + point.handleOut!.x).toBeCloseTo(point.position.x * 2, 3);
    expect(point.handleIn!.y + point.handleOut!.y).toBeCloseTo(point.position.y * 2, 3);
  });

  test('scales bbox positions by 2x using normalized bounds math', () => {
    const oldBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const newBounds = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    expect(points.map((point) => mapPointIntoBounds(point, oldBounds, newBounds))).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ]);
  });

  test('nudges all selected points by arrow key', () => {
    bootstrap();
    setupLayerMultiSelection(['0:0', '0:1', '0:2']);

    expect(nudgeSelectedPointByArrow('ArrowRight')).toBeTrue();

    const d =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(d).toBe('M10 7 L15 12 L10 17');
  });

  test('deletes all selected points in one command', () => {
    bootstrap();
    setupLayerMultiSelection(['0:0', '0:1']);

    expect(deleteSelectedPoints()).toBeTrue();

    const d =
      editorStore.getState().project!.icons['icon-chevron'].states.default.layers['chevron'].path!.d;
    expect(d).toBe('M9.5 17');
  });
});

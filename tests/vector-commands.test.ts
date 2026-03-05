import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { editorStore } from '../lib/editor-store/store';
import {
  deleteSelectedPoint,
  insertPointAfterSelection,
  nudgeSelectedPointByArrow,
  toggleSelectedPathClosed,
  toggleSelectedPointType,
} from '../lib/editor-core/vector-commands';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
}

function setupLayerSelection(pointKey: string) {
  const state = editorStore.getState();
  const iconId = state.currentIconId!;
  const stateId = state.currentStateId!;
  const layerId = 'chevron';
  state.setSelection({ layerIds: [layerId], pointIds: [pointKey] });
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
});

import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { editorStore } from '../lib/editor-store/store';
import {
  canRedo,
  canUndo,
  clearHistory,
  commitHistory,
  pauseHistory,
  redo,
  resumeHistory,
  undo,
} from '../lib/editor-store/history';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('editor history', () => {
  test('undo/redo works for standard project mutations', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const stateId = state.currentStateId!;
    const layerId = 'chevron';

    const before = editorStore.getState().project!.icons[iconId].states[stateId].layers[layerId]
      .visible;

    state.setLayerVisibility(iconId, stateId, layerId, false);
    expect(canUndo()).toBeTrue();

    undo();
    const afterUndo = editorStore.getState().project!.icons[iconId].states[stateId].layers[layerId]
      .visible;
    expect(afterUndo).toBe(before);
    expect(canRedo()).toBeTrue();

    redo();
    const afterRedo = editorStore.getState().project!.icons[iconId].states[stateId].layers[layerId]
      .visible;
    expect(afterRedo).toBe(false);
  });

  test('paused history batches mutations until commitHistory', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const stateId = state.currentStateId!;
    const layerId = 'chevron';

    const startPath = editorStore
      .getState()
      .project!.icons[iconId]
      .states[stateId]
      .layers[layerId]
      .path!.d;

    pauseHistory();
    state.patchLayer(iconId, stateId, layerId, {
      path: { d: 'M0 0 L1 1', fillRule: 'nonzero' },
    });
    state.patchLayer(iconId, stateId, layerId, {
      path: { d: 'M0 0 L2 2', fillRule: 'nonzero' },
    });

    expect(canUndo()).toBeFalse();

    resumeHistory();
    commitHistory('pointer-up');
    expect(canUndo()).toBeTrue();

    undo();
    const afterUndo = editorStore
      .getState()
      .project!.icons[iconId]
      .states[stateId]
      .layers[layerId]
      .path!.d;
    expect(afterUndo).toBe(startPath);

    redo();
    const afterRedo = editorStore
      .getState()
      .project!.icons[iconId]
      .states[stateId]
      .layers[layerId]
      .path!.d;
    expect(afterRedo).toBe('M0 0 L2 2');
  });
});

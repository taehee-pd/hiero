import { editorStore } from './store';

export function undo() {
  editorStore.temporal.getState().undo();
}

export function redo() {
  editorStore.temporal.getState().redo();
}

export function canUndo(): boolean {
  return editorStore.temporal.getState().pastStates.length > 0;
}

export function canRedo(): boolean {
  return editorStore.temporal.getState().futureStates.length > 0;
}

export function clearHistory() {
  editorStore.temporal.getState().clear();
}

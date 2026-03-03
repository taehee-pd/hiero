import { editorStore } from './store';

function getTemporalState() {
  return editorStore.temporal.getState();
}

export function undo() {
  getTemporalState().undo();
}

export function redo() {
  getTemporalState().redo();
}

export function canUndo(): boolean {
  return getTemporalState().pastStates.length > 0;
}

export function canRedo(): boolean {
  return getTemporalState().futureStates.length > 0;
}

export function clearHistory() {
  getTemporalState().clear();
}

export function pauseHistory() {
  getTemporalState().pause();
}

export function resumeHistory() {
  getTemporalState().resume();
}

export function commitHistory(label?: string) {
  getTemporalState().commit(label);
}

import { editorStore } from './store';

let historyPaused = false;

function getTemporalState(): any {
  return editorStore.temporal.getState() as any;
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
  historyPaused = true;
  const temporal = getTemporalState();
  if (typeof temporal.pause === 'function') temporal.pause();
  if (typeof temporal.setIsTracking === 'function') temporal.setIsTracking(false);
}

export function resumeHistory() {
  historyPaused = false;
  const temporal = getTemporalState();
  if (typeof temporal.resume === 'function') temporal.resume();
  if (typeof temporal.setIsTracking === 'function') temporal.setIsTracking(true);
}

/**
 * Explicit history checkpoint API used by pointer sessions.
 * History records on each project mutation; checkpoint is primarily semantic.
 */
export function commitHistory(_label?: string) {
  const temporal = getTemporalState();
  if (historyPaused) {
    if (typeof temporal.resume === 'function') temporal.resume();
    if (typeof temporal.pause === 'function') temporal.pause();
  }
}

export function isHistoryPaused(): boolean {
  return historyPaused;
}

import type { Project, Layer } from '@/lib/schema/types';
import type { Tool, SelectionState, ViewportState } from './types';

export type EditorState = {
  project: Project | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  currentStateId: string | null;
  selection: SelectionState;
  viewport: ViewportState;
  tool: Tool;
};

export type EditorActions = {
  loadProject(project: Project): void;
  newProject(): void;
  setCurrentIcon(id: string): void;
  setCurrentVariant(id: string): void;
  setCurrentState(id: string): void;
  patchLayer(iconId: string, stateId: string, layerId: string, patch: Partial<Layer>): void;
  setLayerVisibility(iconId: string, stateId: string, layerId: string, visible: boolean): void;
  setSelection(selection: SelectionState): void;
  clearSelection(): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setTool(tool: Tool): void;
  updateProjectMeta(patch: Partial<Project['meta']>): void;
  pauseHistory(): void;
  resumeHistory(): void;
  commitHistory(label?: string): void;
};

export type EditorStore = EditorState & EditorActions;

type TemporalSnapshot = { project: Project | null };

type TemporalState = {
  pastStates: TemporalSnapshot[];
  futureStates: TemporalSnapshot[];
  undo(): void;
  redo(): void;
  clear(): void;
  pause(): void;
  resume(): void;
  setIsTracking(v: boolean): void;
};

const initialState: EditorState = {
  project: null,
  currentIconId: null,
  currentVariantId: null,
  currentStateId: null,
  selection: { layerIds: [], pointIds: [] },
  viewport: { zoom: 12, panX: 0, panY: 0 },
  tool: 'select',
};

let currentState: EditorStore;
const listeners = new Set<() => void>();
let tracking = true;
const pastStates: TemporalSnapshot[] = [];
const futureStates: TemporalSnapshot[] = [];

function emit() {
  for (const l of listeners) l();
}

function applySnapshot(snapshot: TemporalSnapshot) {
  currentState = {
    ...currentState,
    project: snapshot.project,
  };
  emit();
}

const temporalState: TemporalState = {
  pastStates,
  futureStates,
  undo() {
    const prev = pastStates.pop();
    if (!prev) return;
    futureStates.push({ project: currentState.project });
    applySnapshot(prev);
  },
  redo() {
    const next = futureStates.pop();
    if (!next) return;
    pastStates.push({ project: currentState.project });
    applySnapshot(next);
  },
  clear() {
    pastStates.length = 0;
    futureStates.length = 0;
  },
  pause() {
    tracking = false;
  },
  resume() {
    tracking = true;
  },
  setIsTracking(v: boolean) {
    tracking = v;
  },
};

const editorStoreApi = {
  getState: () => currentState,
  setState: (updater: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore> | EditorStore), replace = false) => {
    const prev = currentState;
    const nextPatch = typeof updater === 'function' ? updater(prev) : updater;
    const next = replace ? (nextPatch as EditorStore) : ({ ...prev, ...nextPatch } as EditorStore);

    if (tracking && prev.project !== next.project) {
      pastStates.push({ project: prev.project });
      if (pastStates.length > 100) pastStates.shift();
      futureStates.length = 0;
    }

    currentState = next;
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  temporal: {
    getState: () => temporalState,
  },
};

function createActions(): EditorActions {
  return {
    loadProject(project) {
      const firstIconId = Object.keys(project.icons)[0] ?? null;
      const firstIcon = firstIconId ? project.icons[firstIconId] : null;
      const firstVariantId = firstIcon ? Object.keys(firstIcon.variants)[0] ?? null : null;
      const firstStateId = firstIcon ? Object.keys(firstIcon.states)[0] ?? null : null;

      editorStoreApi.setState({
        project,
        currentIconId: firstIconId,
        currentVariantId: firstVariantId,
        currentStateId: firstStateId,
        selection: { layerIds: [], pointIds: [] },
        viewport: { zoom: 12, panX: 0, panY: 0 },
      });
    },

    newProject() {
      const now = new Date().toISOString();
      const project: Project = {
        version: '1.0',
        meta: { name: 'Untitled', createdAt: now, updatedAt: now },
        icons: {},
      };
      editorStoreApi.setState({ ...initialState, project });
    },

    setCurrentIcon(id) {
      editorStoreApi.setState((s) => {
        const icon = s.project?.icons[id];
        if (!icon) return s;
        return {
          currentIconId: id,
          currentVariantId: Object.keys(icon.variants)[0] ?? null,
          currentStateId: Object.keys(icon.states)[0] ?? null,
          selection: { layerIds: [], pointIds: [] },
        };
      });
    },

    setCurrentVariant(id) {
      editorStoreApi.setState({ currentVariantId: id });
    },

    setCurrentState(id) {
      editorStoreApi.setState({ currentStateId: id, selection: { layerIds: [], pointIds: [] } });
    },

    patchLayer(iconId, stateId, layerId, patch) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const state = icon?.states[stateId];
        const layer = state?.layers[layerId];
        if (!icon || !state || !layer) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                states: {
                  ...icon.states,
                  [stateId]: {
                    ...state,
                    layers: {
                      ...state.layers,
                      [layerId]: { ...layer, ...patch },
                    },
                  },
                },
              },
            },
          },
        };
      });
    },

    setLayerVisibility(iconId, stateId, layerId, visible) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        const icon = s.project.icons[iconId];
        const state = icon?.states[stateId];
        const layer = state?.layers[layerId];
        if (!icon || !state || !layer) return s;

        return {
          project: {
            ...s.project,
            icons: {
              ...s.project.icons,
              [iconId]: {
                ...icon,
                states: {
                  ...icon.states,
                  [stateId]: {
                    ...state,
                    layers: {
                      ...state.layers,
                      [layerId]: { ...layer, visible },
                    },
                  },
                },
              },
            },
          },
        };
      });
    },

    setSelection(selection) {
      editorStoreApi.setState({ selection });
    },

    clearSelection() {
      editorStoreApi.setState({ selection: { layerIds: [], pointIds: [] } });
    },

    setViewport(viewport) {
      editorStoreApi.setState((s) => ({ viewport: { ...s.viewport, ...viewport } }));
    },

    setTool(tool) {
      editorStoreApi.setState({ tool, selection: { layerIds: [], pointIds: [] } });
    },

    updateProjectMeta(patch) {
      editorStoreApi.setState((s) => {
        if (!s.project) return s;
        return {
          project: {
            ...s.project,
            meta: { ...s.project.meta, ...patch },
          },
        };
      });
    },

    pauseHistory() {
      temporalState.pause();
      temporalState.setIsTracking(false);
    },

    resumeHistory() {
      temporalState.resume();
      temporalState.setIsTracking(true);
    },

    commitHistory(_label?: string) {},
  };
}

currentState = {
  ...initialState,
  ...createActions(),
};

export const editorStore = editorStoreApi;

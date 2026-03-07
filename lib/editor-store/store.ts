import type { Project, Layer } from '@/lib/schema/types';
import { booleanOp, type BooleanMode } from '@/lib/editor-core/boolean-ops';
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
  applyBoolean(mode: BooleanMode): Promise<void>;
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
  commit(_label?: string): void;
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

const MAX_HISTORY = 100;
let tracking = true;
let transactionBase: Project | null | undefined;
const pastStates: TemporalSnapshot[] = [];
const futureStates: TemporalSnapshot[] = [];

function emit() {
  for (const l of listeners) l();
}

function pushHistorySnapshot(project: Project | null) {
  pastStates.push({ project });
  if (pastStates.length > MAX_HISTORY) pastStates.shift();
  futureStates.length = 0;
}

function applySnapshot(snapshot: TemporalSnapshot) {
  currentState = {
    ...currentState,
    project: snapshot.project,
    selection: { layerIds: [], pointIds: [] },
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
    transactionBase = undefined;
  },

  pause() {
    if (!tracking) return;
    tracking = false;
    transactionBase = currentState.project;
  },

  resume() {
    tracking = true;
  },

  commit(_label?: string) {
    if (transactionBase === undefined) return;
    if (transactionBase !== currentState.project) {
      pushHistorySnapshot(transactionBase);
    }
    transactionBase = undefined;
  },
};

const editorStoreApi = {
  getState: () => currentState,
  setState: (
    updater: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore> | EditorStore),
    replace = false,
  ) => {
    const prev = currentState;
    const nextPatch = typeof updater === 'function' ? updater(prev) : updater;
    const next = replace
      ? (nextPatch as EditorStore)
      : ({ ...prev, ...nextPatch } as EditorStore);

    if (prev.project !== next.project) {
      if (tracking) {
        pushHistorySnapshot(prev.project);
      } else if (transactionBase === undefined) {
        transactionBase = prev.project;
      }
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

function resetHistoryForLoadedDocument() {
  temporalState.clear();
}

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
      resetHistoryForLoadedDocument();
    },

    newProject() {
      const now = new Date().toISOString();
      const project: Project = {
        version: '1.0',
        meta: { name: 'Untitled', createdAt: now, updatedAt: now },
        icons: {},
      };
      editorStoreApi.setState({ ...initialState, project });
      resetHistoryForLoadedDocument();
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
    },

    resumeHistory() {
      temporalState.resume();
    },

    commitHistory(label?: string) {
      temporalState.commit(label);
    },

    async applyBoolean(mode) {
      const snapshot = editorStoreApi.getState();
      const iconId = snapshot.currentIconId;
      const stateId = snapshot.currentStateId;
      const selectedLayerIds = Array.from(new Set(snapshot.selection.layerIds));
      if (!snapshot.project || !iconId || !stateId || selectedLayerIds.length < 2) return;

      const icon = snapshot.project.icons[iconId];
      const state = icon?.states[stateId];
      if (!icon || !state) return;

      const selectedLayers = selectedLayerIds.map((layerId) => ({
        layerId,
        layer: state.layers[layerId],
      }));

      if (selectedLayers.some(({ layer }) => !layer?.path?.d)) return;

      let result = selectedLayers[0]!.layer.path!.d;
      for (const { layer } of selectedLayers.slice(1)) {
        result = await booleanOp(mode, result, layer.path!.d);
      }

      temporalState.pause();
      try {
        editorStoreApi.setState((s) => {
          if (!s.project) return s;
          const liveIcon = s.project.icons[iconId];
          const liveState = liveIcon?.states[stateId];
          const primaryLayerId = selectedLayerIds[0]!;
          const primaryLayer = liveState?.layers[primaryLayerId];
          if (!liveIcon || !liveState || !primaryLayer?.path) return s;

          const nextLayers = { ...liveState.layers };
          nextLayers[primaryLayerId] = {
            ...primaryLayer,
            path: {
              ...primaryLayer.path,
              d: result,
            },
          };

          for (const layerId of selectedLayerIds.slice(1)) {
            delete nextLayers[layerId];
          }

          return {
            project: {
              ...s.project,
              icons: {
                ...s.project.icons,
                [iconId]: {
                  ...liveIcon,
                  states: {
                    ...liveIcon.states,
                    [stateId]: {
                      ...liveState,
                      layers: nextLayers,
                    },
                  },
                },
              },
            },
            selection: {
              layerIds: [primaryLayerId],
              pointIds: [],
            },
          };
        });
      } finally {
        temporalState.resume();
        temporalState.commit(`boolean:${mode}`);
      }
    },
  };
}

currentState = {
  ...initialState,
  ...createActions(),
};

export const editorStore = editorStoreApi;

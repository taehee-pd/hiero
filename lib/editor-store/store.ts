import type { Project, Icon, Layer } from '@/lib/schema/types';
import type {
  Tool,
  SelectionState,
  ViewportState,
  ShapeType,
  PointMarqueeState,
  PointTransformLabelState,
} from './types';
import { booleanOp, type BooleanMode } from '@/lib/editor-core/boolean-ops';
import type { SnapTarget } from '@/lib/editor-core/snap-engine';

export type EditorState = {
  project: Project | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  currentStateId: string | null;
  selection: SelectionState;
  activeSnapGuides: SnapTarget[];
  snapEnabled: boolean;
  viewport: ViewportState;
  tool: Tool;
  shapeSubTool: ShapeType;
  shapePolygonSides: number;
  shapeStarPoints: number;
  pointMarquee: PointMarqueeState | null;
  pointTransformLabel: PointTransformLabelState | null;
};

export type EditorActions = {
  loadProject(project: Project): void;
  newProject(): void;
  insertIcon(icon: Icon): void;
  setCurrentIcon(id: string): void;
  setCurrentVariant(id: string): void;
  setCurrentState(id: string): void;
  patchLayer(iconId: string, stateId: string, layerId: string, patch: Partial<Layer>): void;
  setLayerVisibility(iconId: string, stateId: string, layerId: string, visible: boolean): void;
  setSelection(selection: SelectionState): void;
  clearSelection(): void;
  setActiveSnapGuides(guides: SnapTarget[]): void;
  toggleSnap(): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setTool(tool: Tool): void;
  setShapeSubTool(shapeSubTool: ShapeType): void;
  setShapePolygonSides(sides: number): void;
  setShapeStarPoints(points: number): void;
  setPointMarquee(marquee: PointMarqueeState | null): void;
  setPointTransformLabel(label: PointTransformLabelState | null): void;
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
  discard(): void;
  commit(_label?: string): void;
};

const initialState: EditorState = {
  project: null,
  currentIconId: null,
  currentVariantId: null,
  currentStateId: null,
  selection: { layerIds: [], pointIds: [] },
  activeSnapGuides: [],
  snapEnabled: true,
  viewport: { zoom: 12, panX: 0, panY: 0 },
  tool: 'select',
  shapeSubTool: 'rectangle',
  shapePolygonSides: 5,
  shapeStarPoints: 5,
  pointMarquee: null,
  pointTransformLabel: null,
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
    activeSnapGuides: [],
    pointMarquee: null,
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

  discard() {
    if (transactionBase === undefined) return;
    currentState = {
      ...currentState,
      project: transactionBase,
    };
    tracking = true;
    transactionBase = undefined;
    emit();
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
        activeSnapGuides: [],
        snapEnabled: true,
        viewport: { zoom: 12, panX: 0, panY: 0 },
        pointMarquee: null,
        pointTransformLabel: null,
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

    insertIcon(icon) {
      editorStoreApi.setState((s) => {
        const now = new Date().toISOString();
        const project =
          s.project ??
          ({
            version: '1.0',
            meta: { name: 'Untitled', createdAt: now, updatedAt: now },
            icons: {},
          } satisfies Project);

        const nextIconId = ensureUniqueIconId(icon.id, Object.keys(project.icons));
        const nextIcon =
          nextIconId === icon.id
            ? icon
            : {
                ...icon,
                id: nextIconId,
              };
        const nextVariantId = Object.keys(nextIcon.variants)[0] ?? null;
        const nextStateId = Object.keys(nextIcon.states)[0] ?? null;

        return {
          project: {
            ...project,
            meta: { ...project.meta, updatedAt: now },
            icons: {
              ...project.icons,
              [nextIconId]: nextIcon,
            },
          },
          currentIconId: nextIconId,
          currentVariantId: nextVariantId,
          currentStateId: nextStateId,
          selection: { layerIds: [], pointIds: [] },
          activeSnapGuides: [],
          pointMarquee: null,
          pointTransformLabel: null,
        };
      });
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
          activeSnapGuides: [],
          pointMarquee: null,
        };
      });
    },

    setCurrentVariant(id) {
      editorStoreApi.setState({ currentVariantId: id, activeSnapGuides: [], pointMarquee: null });
    },

    setCurrentState(id) {
      editorStoreApi.setState({
        currentStateId: id,
        selection: { layerIds: [], pointIds: [] },
        activeSnapGuides: [],
        pointMarquee: null,
      });
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
      editorStoreApi.setState({
        selection: { layerIds: [], pointIds: [] },
        activeSnapGuides: [],
        pointMarquee: null,
      });
    },

    setActiveSnapGuides(guides) {
      editorStoreApi.setState({ activeSnapGuides: guides });
    },

    toggleSnap() {
      editorStoreApi.setState((s) => ({
        snapEnabled: !s.snapEnabled,
        activeSnapGuides: s.snapEnabled ? [] : s.activeSnapGuides,
      }));
    },

    setViewport(viewport) {
      editorStoreApi.setState((s) => ({ viewport: { ...s.viewport, ...viewport } }));
    },

    setTool(tool) {
      editorStoreApi.setState({
        tool,
        selection: { layerIds: [], pointIds: [] },
        activeSnapGuides: [],
        pointMarquee: null,
      });
    },

    setShapeSubTool(shapeSubTool) {
      editorStoreApi.setState({ shapeSubTool });
    },

    setShapePolygonSides(sides) {
      editorStoreApi.setState({ shapePolygonSides: clampInteger(sides, 3) });
    },

    setShapeStarPoints(points) {
      editorStoreApi.setState({ shapeStarPoints: clampInteger(points, 2) });
    },

    setPointMarquee(marquee) {
      editorStoreApi.setState({ pointMarquee: marquee });
    },

    setPointTransformLabel(label) {
      editorStoreApi.setState({ pointTransformLabel: label });
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

function clampInteger(value: number, minimum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.round(value));
}

function ensureUniqueIconId(candidate: string, existingIds: string[]): string {
  if (!existingIds.includes(candidate)) return candidate;

  let counter = 2;
  let nextId = `${candidate}-${counter}`;
  while (existingIds.includes(nextId)) {
    counter += 1;
    nextId = `${candidate}-${counter}`;
  }
  return nextId;
}

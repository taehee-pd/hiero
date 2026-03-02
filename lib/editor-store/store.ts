import { createStore } from 'zustand/vanilla';
import { temporal } from 'zundo';
import type { Project, Layer } from '@/lib/schema/types';
import type { Tool, SelectionState, ViewportState } from './types';

// ── State shape ──────────────────────────────────────────────

export type EditorState = {
  project: Project | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  currentStateId: string | null;
  selection: SelectionState;
  viewport: ViewportState;
  tool: Tool;
};

// ── Actions ──────────────────────────────────────────────────

export type EditorActions = {
  loadProject(project: Project): void;
  newProject(): void;
  setCurrentIcon(id: string): void;
  setCurrentVariant(id: string): void;
  setCurrentState(id: string): void;
  patchLayer(
    iconId: string,
    stateId: string,
    layerId: string,
    patch: Partial<Layer>,
  ): void;
  setLayerVisibility(
    iconId: string,
    stateId: string,
    layerId: string,
    visible: boolean,
  ): void;
  setSelection(selection: SelectionState): void;
  clearSelection(): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setTool(tool: Tool): void;
  updateProjectMeta(patch: Partial<Project['meta']>): void;
};

export type EditorStore = EditorState & EditorActions;

// ── Initial state ────────────────────────────────────────────

const initialState: EditorState = {
  project: null,
  currentIconId: null,
  currentVariantId: null,
  currentStateId: null,
  selection: { layerIds: [], pointIds: [] },
  viewport: { zoom: 12, panX: 0, panY: 0 },
  tool: 'select',
};

// ── Store factory ────────────────────────────────────────────

export const editorStore = createStore<EditorStore>()(
  temporal(
    (set) => ({
      ...initialState,

      loadProject(project: Project) {
        const firstIconId = Object.keys(project.icons)[0] ?? null;
        const firstIcon = firstIconId ? project.icons[firstIconId] : null;
        const firstVariantId = firstIcon
          ? Object.keys(firstIcon.variants)[0] ?? null
          : null;
        const firstStateId = firstIcon
          ? Object.keys(firstIcon.states)[0] ?? null
          : null;

        set({
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
        set({
          ...initialState,
          project,
        });
      },

      setCurrentIcon(id: string) {
        set((s) => {
          const icon = s.project?.icons[id];
          if (!icon) return s;
          const firstVariant = Object.keys(icon.variants)[0] ?? null;
          const firstState = Object.keys(icon.states)[0] ?? null;
          return {
            ...s,
            currentIconId: id,
            currentVariantId: firstVariant,
            currentStateId: firstState,
            selection: { layerIds: [], pointIds: [] },
          };
        });
      },

      setCurrentVariant(id: string) {
        set({ currentVariantId: id });
      },

      setCurrentState(id: string) {
        set({
          currentStateId: id,
          selection: { layerIds: [], pointIds: [] },
        });
      },

      patchLayer(
        iconId: string,
        stateId: string,
        layerId: string,
        patch: Partial<Layer>,
      ) {
        set((s) => {
          if (!s.project) return s;
          const icon = s.project.icons[iconId];
          if (!icon) return s;
          const state = icon.states[stateId];
          if (!state) return s;
          const layer = state.layers[layerId];
          if (!layer) return s;

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

      setLayerVisibility(
        iconId: string,
        stateId: string,
        layerId: string,
        visible: boolean,
      ) {
        set((s) => {
          if (!s.project) return s;
          const icon = s.project.icons[iconId];
          if (!icon) return s;
          const state = icon.states[stateId];
          if (!state) return s;
          const layer = state.layers[layerId];
          if (!layer) return s;

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

      setSelection(selection: SelectionState) {
        set({ selection });
      },

      clearSelection() {
        set({ selection: { layerIds: [], pointIds: [] } });
      },

      setViewport(viewport: Partial<ViewportState>) {
        set((s) => ({ viewport: { ...s.viewport, ...viewport } }));
      },

      setTool(tool: Tool) {
        set({ tool, selection: { layerIds: [], pointIds: [] } });
      },

      updateProjectMeta(patch: Partial<Project['meta']>) {
        set((s) => {
          if (!s.project) return s;
          return {
            project: {
              ...s.project,
              meta: { ...s.project.meta, ...patch },
            },
          };
        });
      },
    }),
    {
      // zundo config: only track project mutations for undo/redo
      partialize: (state) => ({
        project: state.project,
      }),
      limit: 100,
    },
  ),
);

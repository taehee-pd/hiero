import { useMemo, useSyncExternalStore } from 'react';
import { editorStore, type EditorStore } from './store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
  selectCurrentLayers,
  selectIconList,
} from './selectors';
import type { Icon, Variant, State, Layer } from '@/lib/schema/types';
import type { Tool, SelectionState, ViewportState } from './types';

export function useEditorStore<T>(selector: (s: EditorStore) => T): T {
  const state = useSyncExternalStore(
    editorStore.subscribe,
    editorStore.getState,
    editorStore.getState,
  );

  return selector(state);
}

export function useCurrentIcon(): Icon | null {
  return useEditorStore(selectCurrentIcon);
}

export function useCurrentVariant(): Variant | null {
  return useEditorStore(selectCurrentVariant);
}

export function useCurrentState(): State | null {
  return useEditorStore(selectCurrentState);
}

export function useCurrentLayers(): Layer[] {
  return useEditorStore(selectCurrentLayers);
}

export function useIconList(): Array<{ id: string; name: string }> {
  return useEditorStore(selectIconList);
}

export function useTool(): Tool {
  return useEditorStore((s) => s.tool);
}

export function useSelection(): SelectionState {
  return useEditorStore((s) => s.selection);
}

export function useViewport(): ViewportState {
  return useEditorStore((s) => s.viewport);
}

export function useEditorActions() {
  const state = useSyncExternalStore(
    editorStore.subscribe,
    editorStore.getState,
    editorStore.getState,
  );

  return useMemo(
    () => ({
      loadProject: state.loadProject,
      newProject: state.newProject,
      setCurrentIcon: state.setCurrentIcon,
      setCurrentVariant: state.setCurrentVariant,
      setCurrentState: state.setCurrentState,
      patchLayer: state.patchLayer,
      setLayerVisibility: state.setLayerVisibility,
      setSelection: state.setSelection,
      clearSelection: state.clearSelection,
      setViewport: state.setViewport,
      setTool: state.setTool,
      setShapeSubTool: state.setShapeSubTool,
      setShapePolygonSides: state.setShapePolygonSides,
      setShapeStarPoints: state.setShapeStarPoints,
      setPointTransformLabel: state.setPointTransformLabel,
      updateProjectMeta: state.updateProjectMeta,
      pauseHistory: state.pauseHistory,
      resumeHistory: state.resumeHistory,
      commitHistory: state.commitHistory,
    }),
    [state],
  );
}

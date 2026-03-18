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
      loadWorkspace: state.loadWorkspace,
      loadProject: state.loadProject,
      newProject: state.newProject,
      insertIcon: state.insertIcon,
      addVariant: state.addVariant,
      removeVariant: state.removeVariant,
      patchVariant: state.patchVariant,
      addTransition: state.addTransition,
      removeTransition: state.removeTransition,
      patchTransition: state.patchTransition,
      addEffect: state.addEffect,
      removeEffect: state.removeEffect,
      patchEffect: state.patchEffect,
      duplicateLayersToVariant: state.duplicateLayersToVariant,
      setCurrentIcon: state.setCurrentIcon,
      setCurrentVariant: state.setCurrentVariant,
      setCurrentState: state.setCurrentState,
      setStateTopology: state.setStateTopology,
      setSelectedIconGuideIndex: state.setSelectedIconGuideIndex,
      patchLayer: state.patchLayer,
      setLayerVisibility: state.setLayerVisibility,
      setClipMask: state.setClipMask,
      releaseClipMask: state.releaseClipMask,
      setSelection: state.setSelection,
      clearSelection: state.clearSelection,
      setActiveSnapGuides: state.setActiveSnapGuides,
      toggleSnap: state.toggleSnap,
      toggleGuidesVisible: state.toggleGuidesVisible,
      setGuideStyle: state.setGuideStyle,
      setViewport: state.setViewport,
      setTool: state.setTool,
      setShapeSubTool: state.setShapeSubTool,
      setShapePolygonSides: state.setShapePolygonSides,
      setShapeStarPoints: state.setShapeStarPoints,
      setPointMarquee: state.setPointMarquee,
      setPointTransformLabel: state.setPointTransformLabel,
      setTransitionPreview: state.setTransitionPreview,
      setSelectedTransitionId: state.setSelectedTransitionId,
      updateProjectMeta: state.updateProjectMeta,
      addGuideMaster: state.addGuideMaster,
      updateGuideMaster: state.updateGuideMaster,
      removeGuideMaster: state.removeGuideMaster,
      addGuideItem: state.addGuideItem,
      updateGuideItem: state.updateGuideItem,
      removeGuideItem: state.removeGuideItem,
      addIconGuide: state.addIconGuide,
      updateIconGuide: state.updateIconGuide,
      removeIconGuide: state.removeIconGuide,
      removeSelectedGuides: state.removeSelectedGuides,
      addCollection: state.addCollection,
      removeCollection: state.removeCollection,
      renameCollection: state.renameCollection,
      addIconToCollection: state.addIconToCollection,
      removeIconFromCollection: state.removeIconFromCollection,
      toggleFavorite: state.toggleFavorite,
      addIconSet: state.addIconSet,
      removeIconSet: state.removeIconSet,
      renameIconSet: state.renameIconSet,
      setActiveIconSet: state.setActiveIconSet,
      updateIconSetSync: state.updateIconSetSync,
      openIconTab: state.openIconTab,
      closeIconTab: state.closeIconTab,
      setActiveTab: state.setActiveTab,
      generateVariantMatrix: state.generateVariantMatrix,
      upsertSymbolComponent: state.upsertSymbolComponent,
      removeSymbolComponent: state.removeSymbolComponent,
      removeSelectedLayers: state.removeSelectedLayers,
      pauseHistory: state.pauseHistory,
      resumeHistory: state.resumeHistory,
      commitHistory: state.commitHistory,
    }),
    [state],
  );
}

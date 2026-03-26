import { useSyncExternalStore } from 'react';
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

// Actions are stable references on the store, so we build the object once.
const editorActions = {
  loadWorkspace: editorStore.getState().loadWorkspace,
  loadProject: editorStore.getState().loadProject,
  newProject: editorStore.getState().newProject,
  createBlankIcon: editorStore.getState().createBlankIcon,
  insertIcon: editorStore.getState().insertIcon,
  renameIcon: editorStore.getState().renameIcon,
  duplicateIcon: editorStore.getState().duplicateIcon,
  removeIcon: editorStore.getState().removeIcon,
  addVariant: editorStore.getState().addVariant,
  removeVariant: editorStore.getState().removeVariant,
  patchVariant: editorStore.getState().patchVariant,
  addState: editorStore.getState().addState,
  renameState: editorStore.getState().renameState,
  duplicateState: editorStore.getState().duplicateState,
  removeState: editorStore.getState().removeState,
  addTransition: editorStore.getState().addTransition,
  removeTransition: editorStore.getState().removeTransition,
  patchTransition: editorStore.getState().patchTransition,
  addEffect: editorStore.getState().addEffect,
  removeEffect: editorStore.getState().removeEffect,
  patchEffect: editorStore.getState().patchEffect,
  duplicateLayersToVariant: editorStore.getState().duplicateLayersToVariant,
  setCurrentIcon: editorStore.getState().setCurrentIcon,
  setCurrentVariant: editorStore.getState().setCurrentVariant,
  setCurrentState: editorStore.getState().setCurrentState,
  setStateTopology: editorStore.getState().setStateTopology,
  setSelectedIconGuideIndex: editorStore.getState().setSelectedIconGuideIndex,
  patchLayer: editorStore.getState().patchLayer,
  renameLayer: editorStore.getState().renameLayer,
  setLayerVisibility: editorStore.getState().setLayerVisibility,
  setClipMask: editorStore.getState().setClipMask,
  releaseClipMask: editorStore.getState().releaseClipMask,
  setSelection: editorStore.getState().setSelection,
  clearSelection: editorStore.getState().clearSelection,
  setActiveSnapGuides: editorStore.getState().setActiveSnapGuides,
  toggleSnap: editorStore.getState().toggleSnap,
  toggleGuidesVisible: editorStore.getState().toggleGuidesVisible,
  setGuideStyle: editorStore.getState().setGuideStyle,
  setViewport: editorStore.getState().setViewport,
  setTool: editorStore.getState().setTool,
  setShapeSubTool: editorStore.getState().setShapeSubTool,
  setShapePolygonSides: editorStore.getState().setShapePolygonSides,
  setShapeStarPoints: editorStore.getState().setShapeStarPoints,
  setPointMarquee: editorStore.getState().setPointMarquee,
  setPointTransformLabel: editorStore.getState().setPointTransformLabel,
  setTransitionPreview: editorStore.getState().setTransitionPreview,
  startTransitionPreview: editorStore.getState().startTransitionPreview,
  updateTransitionPreview: editorStore.getState().updateTransitionPreview,
  stopTransitionPreview: editorStore.getState().stopTransitionPreview,
  setSelectedTransitionId: editorStore.getState().setSelectedTransitionId,
  updateProjectMeta: editorStore.getState().updateProjectMeta,
  addGuideMaster: editorStore.getState().addGuideMaster,
  updateGuideMaster: editorStore.getState().updateGuideMaster,
  removeGuideMaster: editorStore.getState().removeGuideMaster,
  addGuideItem: editorStore.getState().addGuideItem,
  updateGuideItem: editorStore.getState().updateGuideItem,
  removeGuideItem: editorStore.getState().removeGuideItem,
  addIconGuide: editorStore.getState().addIconGuide,
  updateIconGuide: editorStore.getState().updateIconGuide,
  removeIconGuide: editorStore.getState().removeIconGuide,
  removeSelectedGuides: editorStore.getState().removeSelectedGuides,
  addCollection: editorStore.getState().addCollection,
  removeCollection: editorStore.getState().removeCollection,
  renameCollection: editorStore.getState().renameCollection,
  addIconToCollection: editorStore.getState().addIconToCollection,
  removeIconFromCollection: editorStore.getState().removeIconFromCollection,
  toggleFavorite: editorStore.getState().toggleFavorite,
  addIconSet: editorStore.getState().addIconSet,
  removeIconSet: editorStore.getState().removeIconSet,
  renameIconSet: editorStore.getState().renameIconSet,
  setActiveIconSet: editorStore.getState().setActiveIconSet,
  updateIconSetSync: editorStore.getState().updateIconSetSync,
  addSyncTarget: editorStore.getState().addSyncTarget,
  updateSyncTarget: editorStore.getState().updateSyncTarget,
  removeSyncTarget: editorStore.getState().removeSyncTarget,
  schedulePendingPublish: editorStore.getState().schedulePendingPublish,
  cancelPendingPublish: editorStore.getState().cancelPendingPublish,
  openIconTab: editorStore.getState().openIconTab,
  closeIconTab: editorStore.getState().closeIconTab,
  setActiveTab: editorStore.getState().setActiveTab,
  generateVariantMatrix: editorStore.getState().generateVariantMatrix,
  upsertSymbolComponent: editorStore.getState().upsertSymbolComponent,
  removeSymbolComponent: editorStore.getState().removeSymbolComponent,
  removeSelectedLayers: editorStore.getState().removeSelectedLayers,
  pauseHistory: editorStore.getState().pauseHistory,
  resumeHistory: editorStore.getState().resumeHistory,
  commitHistory: editorStore.getState().commitHistory,
};

export function useEditorActions() {
  return editorActions;
}

import { useStore } from 'zustand';
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

// Generic selector hook
export function useEditorStore<T>(selector: (s: EditorStore) => T): T {
  return useStore(editorStore, selector);
}

// ── Convenience hooks ────────────────────────────────────────

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

// ── Action hooks (stable references) ────────────────────────

export function useEditorActions() {
  return useEditorStore((s) => ({
    loadProject: s.loadProject,
    newProject: s.newProject,
    setCurrentIcon: s.setCurrentIcon,
    setCurrentVariant: s.setCurrentVariant,
    setCurrentState: s.setCurrentState,
    patchLayer: s.patchLayer,
    setLayerVisibility: s.setLayerVisibility,
    setSelection: s.setSelection,
    clearSelection: s.clearSelection,
    setViewport: s.setViewport,
    setTool: s.setTool,
    updateProjectMeta: s.updateProjectMeta,
  }));
}

import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import type { Tool } from '@/lib/editor-store/types';
import { alignLayers } from './layer-arrange';
import {
  deleteSelectedPoints,
  insertPointAfterSelection,
  nudgeSelectedPointByArrow,
  nudgeSelectedLayerByArrow,
  toggleSelectedPathClosed,
  toggleSelectedPointType,
} from './vector-commands';

const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'select',
  a: 'direct-select',
  p: 'pen',
  u: 'shape',
};

const ALIGN_SHORTCUTS = {
  l: 'left',
  c: 'center-h',
  r: 'right',
  t: 'top',
  m: 'center-v',
  b: 'bottom',
} as const;

/**
 * Global keyboard event handler for the editor.
 * Handles tool shortcuts and undo/redo.
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  if (el.isContentEditable) return true;

  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function handleEditorKeyDown(e: KeyboardEvent): void {
  // Skip if user is typing in form/content-editable controls
  if (isEditableEventTarget(e.target)) return;

  const key = e.key.toLowerCase();
  const mod = e.metaKey || e.ctrlKey;

  // R6 / UX-2.5: `?` opens the keyboard-shortcuts cheat sheet. We don't call
  // the dialog directly from here — the Navbar / Toolbar dialog state lives
  // inside their components. A custom event keeps this handler UI-agnostic.
  // Dispatch on `globalThis` because in the browser it aliases `window` and
  // in Bun's test runtime `window` is undefined but `globalThis.dispatchEvent`
  // still works.
  if (!mod && !e.altKey && (e.key === '?' || (e.shiftKey && key === '/'))) {
    e.preventDefault();
    const target = globalThis as unknown as {
      dispatchEvent?: (event: Event) => boolean;
    };
    if (typeof target.dispatchEvent === 'function') {
      target.dispatchEvent(new CustomEvent('contour:open-shortcuts'));
    }
    return;
  }

  // Layer reorder shortcuts (Figma-parity): ⌘↑/⌘↓ move one step, ⌘⌥↑/⌘⌥↓ move to top/bottom.
  if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
      reorderSelectedLayers?: (direction: 'up' | 'down' | 'front' | 'back') => void;
    };
    if (state.selection.layerIds.length > 0 && typeof state.reorderSelectedLayers === 'function') {
      e.preventDefault();
      const direction =
        e.altKey
          ? e.key === 'ArrowUp'
            ? 'front'
            : 'back'
          : e.key === 'ArrowUp'
            ? 'up'
            : 'down';
      state.reorderSelectedLayers(direction);
      return;
    }
  }

  // Layer clipboard shortcuts: ⌘C/⌘V/⌘D/⌘A
  if (mod && !e.shiftKey && !e.altKey && (key === 'c' || key === 'v' || key === 'd' || key === 'a')) {
    const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
      copySelectedLayers?: () => void;
      pasteLayers?: () => void;
      duplicateSelectedLayers?: () => void;
      setSelection?: (selection: { layerIds: string[]; pointIds: string[] }) => void;
    };
    if (key === 'c' && state.selection.layerIds.length > 0 && typeof state.copySelectedLayers === 'function') {
      e.preventDefault();
      state.copySelectedLayers();
      return;
    }
    if (key === 'v' && typeof state.pasteLayers === 'function') {
      e.preventDefault();
      state.pasteLayers();
      return;
    }
    if (key === 'd' && state.selection.layerIds.length > 0 && typeof state.duplicateSelectedLayers === 'function') {
      e.preventDefault();
      state.duplicateSelectedLayers();
      return;
    }
    if (key === 'a' && state.currentIconId && state.currentVariantId) {
      const icon = state.project?.icons[state.currentIconId];
      const variant = icon?.variants[state.currentVariantId];
      if (variant && typeof state.setSelection === 'function') {
        e.preventDefault();
        state.setSelection({ layerIds: Object.keys(variant.layers), pointIds: [] });
        return;
      }
    }
  }

  // Undo / Redo
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  // Windows/Linux convention for redo
  if (mod && !e.shiftKey && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }

  if (mod && e.shiftKey && !e.altKey) {
    const mode = ALIGN_SHORTCUTS[key as keyof typeof ALIGN_SHORTCUTS];
    if (mode) {
      const state = editorStore.getState();
      if (
        state.selection.layerIds.length > 1 &&
        state.currentIconId &&
        state.currentTypeId
      ) {
        e.preventDefault();
        alignLayers(mode, state.selection.layerIds, state.currentIconId, state.currentTypeId);
        return;
      }
    }

    if (e.code === 'Semicolon' || key === ';' || key === ':') {
      const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
        toggleSnap?: () => void;
      };
      if (typeof state.toggleSnap === 'function') {
        e.preventDefault();
        state.toggleSnap();
        return;
      }
    }
  }

  if (mod && !e.shiftKey && !e.altKey && (e.code === 'Semicolon' || key === ';')) {
    const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
      toggleGuidesVisible?: () => void;
    };
    if (typeof state.toggleGuidesVisible === 'function') {
      e.preventDefault();
      state.toggleGuidesVisible();
      return;
    }
  }

  // Tool shortcuts (single key, no modifier)
  if (!mod && !e.shiftKey && !e.altKey) {
    const tool = TOOL_SHORTCUTS[key];
    if (tool) {
      e.preventDefault();
      editorStore.getState().setTool(tool);
    }
  }

  if (key === 'delete' || key === 'backspace') {
    const state = editorStore.getState();
    if (deleteSelectedPoints()) {
      e.preventDefault();
      return;
    }

    const selectedGuideIndexes = state.selection.guideIndexes ?? [];
    const hasLayers = state.selection.layerIds.length > 0;
    if (state.currentIconId && (selectedGuideIndexes.length > 0 || hasLayers)) {
      if (selectedGuideIndexes.length > 0) {
        state.removeSelectedGuides(state.currentIconId, selectedGuideIndexes);
      }
      if (hasLayers) {
        state.removeSelectedLayers();
      }
      e.preventDefault();
    }
    return;
  }

  if (e.shiftKey && !mod && key === 'c') {
    if (toggleSelectedPointType()) {
      e.preventDefault();
    }
    return;
  }

  if (e.shiftKey && !mod && key === 'o') {
    if (toggleSelectedPathClosed()) {
      e.preventDefault();
    }
    return;
  }

  if (e.shiftKey && !mod && key === 'i') {
    if (insertPointAfterSelection()) {
      e.preventDefault();
    }
    return;
  }

  if (nudgeSelectedPointByArrow(e.key, e.shiftKey)) {
    e.preventDefault();
    return;
  }

  // Fallback: nudge entire layer via transform for non-editable paths
  if (nudgeSelectedLayerByArrow(e.key, e.shiftKey)) {
    e.preventDefault();
    return;
  }

  // Escape: switch to select tool if in direct-select, then always clear selection.
  if (key === 'escape') {
    e.preventDefault();
    const state = editorStore.getState();

    if (state.tool === 'direct-select') {
      state.setTool('select');
    }

    state.clearSelection();
  }
}

import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import type { Tool } from '@/lib/editor-store/types';
import {
  deleteSelectedPoint,
  insertPointAfterSelection,
  nudgeSelectedPointByArrow,
  toggleSelectedPathClosed,
  toggleSelectedPointType,
} from './vector-commands';

const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'select',
  a: 'direct-select',
  p: 'pen',
  u: 'shape',
  g: 'guide',
};

/**
 * Global keyboard event handler for the editor.
 * Handles tool shortcuts and undo/redo.
 */
export function handleEditorKeyDown(e: KeyboardEvent): void {
  // Skip if user is typing in an input/textarea
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const key = e.key.toLowerCase();
  const mod = e.metaKey || e.ctrlKey;

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

  // Tool shortcuts (single key, no modifier)
  if (!mod && !e.shiftKey && !e.altKey) {
    const tool = TOOL_SHORTCUTS[key];
    if (tool) {
      e.preventDefault();
      editorStore.getState().setTool(tool);
    }
  }

  if (key === 'delete' || key === 'backspace') {
    if (deleteSelectedPoint()) {
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

  if (nudgeSelectedPointByArrow(e.key)) {
    e.preventDefault();
    return;
  }

  // Escape exits direct-select mode first, then point editing, then clears selection.
  if (key === 'escape') {
    e.preventDefault();
    const state = editorStore.getState();

    if (state.tool === 'direct-select') {
      state.setTool('select');
      return;
    }

    if (state.selection.pointIds.length > 0) {
      state.setSelection({ layerIds: state.selection.layerIds, pointIds: [] });
      return;
    }

    state.clearSelection();
  }
}

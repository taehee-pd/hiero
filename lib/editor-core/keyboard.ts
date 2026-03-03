import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import type { Tool } from '@/lib/editor-store/types';

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

  // Escape exits point editing first, then clears selection.
  if (key === 'escape') {
    e.preventDefault();
    const state = editorStore.getState();
    if (state.selection.pointIds.length > 0) {
      state.setSelection({ layerIds: state.selection.layerIds, pointIds: [] });
      return;
    }

    state.clearSelection();
  }
}

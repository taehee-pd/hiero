import { describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';
import { canRedo, clearHistory, undo } from '../lib/editor-store/history';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('keyboard shortcuts', () => {
  test('escape exits direct-select mode back to select', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('direct-select');
    state.setSelection({ layerIds: ['chevron'], pointIds: ['0:1'] });

    let prevented = false;
    handleEditorKeyDown({
      key: 'Escape',
      target: { tagName: 'DIV' },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent);

    const next = editorStore.getState();
    expect(prevented).toBeTrue();
    expect(next.tool).toBe('select');
    expect(next.selection.layerIds.length).toBe(0);
    expect(next.selection.pointIds.length).toBe(0);
  });

  test('ctrl+y triggers redo on windows/linux keyboards', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const stateId = state.currentStateId!;

    state.setLayerVisibility(iconId, stateId, 'chevron', false);
    undo();
    expect(canRedo()).toBeTrue();

    handleEditorKeyDown({
      key: 'y',
      target: { tagName: 'DIV' },
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as KeyboardEvent);

    const visible = editorStore.getState().project!.icons[iconId].states[stateId].layers['chevron']
      .visible;
    expect(visible).toBeFalse();
  });

  test('ignores shortcuts while editing inside contenteditable elements', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('pen');

    handleEditorKeyDown({
      key: 'v',
      target: { isContentEditable: true, tagName: 'DIV' },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as KeyboardEvent);

    expect(editorStore.getState().tool).toBe('pen');
  });
});

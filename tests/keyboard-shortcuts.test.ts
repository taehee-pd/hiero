import { describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
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
});

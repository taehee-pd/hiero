import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { exportSvgString } from '../lib/export/export-svg';
import { editorStore } from '../lib/editor-store/store';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
}

describe('safety net checks', () => {
  test('svg export resolves token paints with token set values', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-chevron']);
    icon.states.default.layers.chevron.style.stroke = { mode: 'token', token: 'accent' };

    const svg = exportSvgString(icon, 'v24', 'default', SAMPLE_PROJECT.tokenSet?.colors);
    expect(svg).toContain('stroke="#38bdf8"');
  });

  test('keyboard tool shortcuts are ignored while typing in inputs', () => {
    bootstrap();
    editorStore.getState().setTool('pen');

    handleEditorKeyDown({
      key: 'v',
      target: { tagName: 'INPUT' },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as KeyboardEvent);

    expect(editorStore.getState().tool).toBe('pen');
  });
});

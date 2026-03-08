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

  test('svg export excludes guide presets and guide items', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-chevron']);
    icon.variants.v24.guideSetId = 'master';
    icon.guides = {
      master: {
        id: 'master',
        items: [
          { kind: 'hline', y: 12 },
          { kind: 'vline', x: 12 },
        ],
      },
    };

    const svg = exportSvgString(icon, 'v24', 'default', SAMPLE_PROJECT.tokenSet?.colors);

    expect(svg).not.toContain('guide');
    expect(svg).not.toContain('hline');
    expect(svg).not.toContain('vline');
  });

  test('svg export emits deterministic gradient defs and references', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-chevron']);
    icon.states.default.layers.chevron.style.fill = {
      mode: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    };
    icon.states.default.layers.chevron.style.stroke = {
      mode: 'radialGradient',
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [
        { offset: 0, color: '#38bdf8' },
        { offset: 1, color: '#0f172a' },
      ],
    };

    const svg = exportSvgString(icon, 'v24', 'default', SAMPLE_PROJECT.tokenSet?.colors);

    expect(svg).toContain('<defs>');
    expect(svg).toContain('id="gradient-chevron-fill"');
    expect(svg).toContain('id="gradient-chevron-stroke"');
    expect(svg).toContain('fill="url(#gradient-chevron-fill)"');
    expect(svg).toContain('stroke="url(#gradient-chevron-stroke)"');
    expect(svg).toContain('stop-opacity="0.4"');
  });
});

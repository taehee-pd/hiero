import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { importSvgFileIntoEditor } from '../lib/import';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('svg import flow', () => {
  test('imports an svg file into the current project and activates the new icon', async () => {
    bootstrap();

    const source = new File(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <g fill="#0f172a" stroke="#38bdf8" stroke-width="2" opacity="0.75" transform="translate(2 2)">
            <rect id="frame" x="2" y="2" width="12" height="8" rx="2" />
            <line id="slash" x1="4" y1="18" x2="18" y2="26" stroke-linecap="round" />
          </g>
        </svg>`,
      ],
      'media-toggle.svg',
      { type: 'image/svg+xml' },
    );

    const importedIconId = await importSvgFileIntoEditor(source);
    const state = editorStore.getState();
    const importedIcon = state.project?.icons[importedIconId];

    expect(importedIconId).toBe('icon-media-toggle');
    expect(state.currentIconId).toBe(importedIconId);
    expect(state.currentVariantId).toBe('v32');
    expect(state.currentStateId).toBe('default');
    expect(importedIcon?.name).toBe('Media Toggle');
    expect(importedIcon?.variants.v32.viewBox).toEqual([0, 0, 32, 32]);
    expect(Object.keys(importedIcon?.variants.v32.states!.default.layers ?? {})).toEqual([
      'frame',
      'slash',
    ]);
    expect(importedIcon?.variants.v32.states!.default.layers.frame).toMatchObject({
      id: 'frame',
      path: {
        d: 'M4 2 L12 2 C13.104569 2 14 2.895431 14 4 L14 8 C14 9.104569 13.104569 10 12 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 4 C2 2.895431 2.895431 2 4 2 Z',
      },
      style: {
        fill: { mode: 'fixed', value: '#0f172a' },
        stroke: { mode: 'fixed', value: '#38bdf8' },
        strokeWidth: 2,
        fillOpacity: 0.75,
        strokeOpacity: 0.75,
      },
      transform: { x: 2, y: 2 },
    });
    expect(importedIcon?.variants.v32.states!.default.layers.slash).toMatchObject({
      id: 'slash',
      path: {
        d: 'M4 18 L18 26',
      },
      style: {
        fill: { mode: 'fixed', value: '#0f172a' },
        stroke: { mode: 'fixed', value: '#38bdf8' },
        strokeWidth: 2,
        fillOpacity: 0.75,
        strokeOpacity: 0.75,
        lineCap: 'round',
      },
      transform: { x: 2, y: 2 },
    });
  });
});

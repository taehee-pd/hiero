import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { exportSvgString } from '../lib/export/export-svg';
import { editorStore } from '../lib/editor-store/store';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';
import { buildLayerPanelRows } from '../lib/editor-store/selectors';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
}

function getVariantState(icon = structuredClone(SAMPLE_PROJECT.icons['icon-home'])) {
  return icon.variants.v24.states.default;
}

describe('safety net checks', () => {
  test('svg export resolves token paints with token set values', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-home']);
    getVariantState(icon).layers.roof.style.stroke = { mode: 'token', token: 'accent' };

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

  test('svg export remains unaffected by project guide masters', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    project.guideMasters = {
      master: {
        id: 'master',
        name: '24px Master',
        targetSize: 24,
        viewBox: [0, 0, 24, 24],
        items: [
          { kind: 'hline', y: 12 },
          { kind: 'vline', x: 12 },
        ],
      },
    };
    editorStore.getState().loadProject(project);
    const icon = editorStore.getState().project!.icons['icon-home'];

    const svg = exportSvgString(icon, 'v24', 'default', SAMPLE_PROJECT.tokenSet?.colors);

    expect(svg).not.toContain('guide');
    expect(svg).not.toContain('hline');
    expect(svg).not.toContain('vline');
  });

  test('svg export emits deterministic gradient defs and references', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-home']);
    getVariantState(icon).layers.roof.style.fill = {
      mode: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    };
    getVariantState(icon).layers.roof.style.stroke = {
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
    expect(svg).toContain('id="gradient-roof-fill"');
    expect(svg).toContain('id="gradient-roof-stroke"');
    expect(svg).toContain('fill="url(#gradient-roof-fill)"');
    expect(svg).toContain('stroke="url(#gradient-roof-stroke)"');
    expect(svg).toContain('stop-opacity="0.4"');
  });

  test('svg export emits clip paths and suppresses visible mask layers', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-home']);
    getVariantState(icon).layers.mask = {
      id: 'mask',
      isClipMask: true,
      path: { d: 'M2 2 H22 V22 H2 Z', fillRule: 'evenodd' },
      style: {},
      transform: { x: 1, y: 2 },
    };
    getVariantState(icon).layers.roof.clipPathLayerId = 'mask';

    const svg = exportSvgString(icon, 'v24', 'default', SAMPLE_PROJECT.tokenSet?.colors);

    expect(svg).toContain('<clipPath id="clip-roof">');
    expect(svg).toContain(
      '<path d="M2 2 H22 V22 H2 Z" fill-rule="evenodd" transform="translate(1, 2)"/>',
    );
    expect(svg).toContain('id="roof"');
    expect(svg).toContain('clip-path="url(#clip-roof)"');
    expect(svg).not.toContain('id="mask"');
  });

  test('clipping mask store actions assign and release mask relationships', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const variantId = state.currentVariantId!;
    const stateId = state.currentStateId!;

    state.setClipMask('house', ['roof']);

    let layers = editorStore.getState().project!.icons[iconId].variants[variantId].states[stateId]
      .layers;
    expect(layers.house!.isClipMask).toBeTrue();
    expect(layers.roof!.clipPathLayerId).toBe('house');

    state.releaseClipMask('house');

    layers = editorStore.getState().project!.icons[iconId].variants[variantId].states[stateId]
      .layers;
    expect(layers.house!.isClipMask).toBeFalse();
    expect(layers.roof!.clipPathLayerId).toBeUndefined();
  });

  test('layer panel rows nest clipped layers beneath their mask rows', () => {
    const rows = buildLayerPanelRows([
      { id: 'target-a', style: {}, path: { d: 'M0 0 H1 V1 Z' }, clipPathLayerId: 'mask' },
      { id: 'free', style: {}, path: { d: 'M0 0 H1 V1 Z' } },
      { id: 'mask', style: {}, path: { d: 'M0 0 H1 V1 Z' }, isClipMask: true },
      { id: 'target-b', style: {}, path: { d: 'M0 0 H1 V1 Z' }, clipPathLayerId: 'mask' },
    ]);

    expect(rows.map((row) => `${row.depth}:${row.layer.id}`)).toEqual([
      '0:free',
      '0:mask',
      '1:target-a',
      '1:target-b',
    ]);
    expect(rows[1]!.clippedLayerIds).toEqual(['target-a', 'target-b']);
    expect(rows[2]!.maskLayerId).toBe('mask');
  });
});

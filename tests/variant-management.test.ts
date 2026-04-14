import { describe, expect, test } from 'bun:test';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('variant management', () => {
  test('adds and removes variants via the store', () => {
    bootstrap();

    const state = editorStore.getState();
    state.addVariant('icon-home', {
      size: 32,
      viewBox: [0, 0, 32, 32],
      sourceVariantId: 'v24',
    });

    let icon = editorStore.getState().project!.icons['icon-home']!;
    expect(icon.variants.v32).toMatchObject({
      id: 'v32',
      size: 32,
      viewBox: [0, 0, 32, 32],
      defaultType: 'default',
    });
    expect(editorStore.getState().currentVariantId).toBe('v32');

    editorStore.getState().removeVariant('icon-home', 'v32');

    icon = editorStore.getState().project!.icons['icon-home']!;
    expect(icon.variants.v32).toBeUndefined();
    expect(editorStore.getState().currentVariantId).toBe('v24');
  });

  test('switching variants updates currentVariantId', () => {
    bootstrap();

    const state = editorStore.getState();
    state.addVariant('icon-home', {
      size: 16,
      viewBox: [0, 0, 16, 16],
      sourceVariantId: 'v24',
    });
    state.addVariant('icon-home', {
      size: 32,
      viewBox: [0, 0, 32, 32],
      sourceVariantId: 'v24',
    });

    editorStore.getState().setCurrentVariant('v16');
    expect(editorStore.getState().currentVariantId).toBe('v16');

    editorStore.getState().setCurrentVariant('v32');
    expect(editorStore.getState().currentVariantId).toBe('v32');
  });
});

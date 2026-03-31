import { describe, expect, test } from 'bun:test';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('icon and variant management', () => {
  test('creates a blank icon and focuses it', () => {
    bootstrap();

    const iconId = editorStore.getState().createBlankIcon({ name: 'Fresh Start' });
    expect(iconId).toBe('fresh-start');
    expect(editorStore.getState().currentIconId).toBe('fresh-start');

    const icon = editorStore.getState().project?.icons['fresh-start'];
    expect(icon?.name).toBe('Fresh Start');
    expect(icon?.variants.v24?.layers).toEqual({});
  });

  test('adds a variant and layers are copied from source', () => {
    bootstrap();

    const state = editorStore.getState();
    state.addVariant('icon-home', {
      size: 32,
      viewBox: [0, 0, 32, 32],
      sourceVariantId: 'v24',
    });

    const v32 = editorStore.getState().project?.icons['icon-home']?.variants.v32;
    expect(v32).toBeDefined();
    expect(v32?.size).toBe(32);
    expect(Object.keys(v32?.layers ?? {})).toEqual(
      Object.keys(editorStore.getState().project?.icons['icon-home']?.variants.v24?.layers ?? {}),
    );
  });
});

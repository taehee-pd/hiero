import { describe, expect, test } from 'bun:test';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('variant matrix and symbol components', () => {
  test('generates variant matrix entries for weight x scale x size combinations', () => {
    bootstrap();

    const state = editorStore.getState();
    const created = state.generateVariantMatrix('icon-home', {
      sizes: [16, 24],
      weights: ['regular', 'bold'],
      scales: ['small', 'medium', 'large'],
      sourceVariantId: 'v24',
    });

    expect(created.length).toBe(12);

    const icon = editorStore.getState().project!.icons['icon-home']!;
    const combos = Object.values(icon.variants).map((variant) => `${variant.size}-${variant.weight ?? 'regular'}-${variant.scale ?? 'medium'}`);

    expect(combos).toContain('16-regular-small');
    expect(combos).toContain('16-bold-large');
    expect(combos).toContain('24-regular-large');
    expect(combos).toContain('24-bold-small');
  });

  test('assigns and removes symbol components on icon', () => {
    bootstrap();
    const state = editorStore.getState();

    state.upsertSymbolComponent('icon-home', {
      kind: 'badge',
      layerIds: ['roof', 'house'],
      position: 'topTrailing',
    });

    let icon = editorStore.getState().project!.icons['icon-home']!;
    expect(icon.components?.badge).toEqual({
      kind: 'badge',
      layerIds: ['roof', 'house'],
      position: 'topTrailing',
    });

    state.upsertSymbolComponent('icon-home', {
      kind: 'badge',
      layerIds: ['roof', 'roof', 'house'],
      position: 'center',
    });

    icon = editorStore.getState().project!.icons['icon-home']!;
    expect(icon.components?.badge?.layerIds).toEqual(['roof', 'house']);

    state.removeSymbolComponent('icon-home', 'badge');
    icon = editorStore.getState().project!.icons['icon-home']!;
    expect(icon.components?.badge).toBeUndefined();
  });
});

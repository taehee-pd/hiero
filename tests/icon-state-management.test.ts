import { describe, expect, test } from 'bun:test';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('icon and state management', () => {
  test('creates a blank icon and focuses it', () => {
    bootstrap();

    const iconId = editorStore.getState().createBlankIcon({ name: 'Fresh Start' });
    expect(iconId).toBe('fresh-start');
    expect(editorStore.getState().currentIconId).toBe('fresh-start');

    const icon = editorStore.getState().project?.icons['fresh-start'];
    expect(icon?.name).toBe('Fresh Start');
    expect(icon?.variants.v24?.states.default?.layers).toEqual({});
  });

  test('adds, renames, duplicates, and removes states across variants', () => {
    bootstrap();

    const state = editorStore.getState();
    state.addVariant('icon-chevron', {
      size: 32,
      viewBox: [0, 0, 32, 32],
      sourceVariantId: 'v24',
    });

    const createdStateId = state.addState('icon-chevron', { name: 'hover' });
    expect(createdStateId).toBe('hover');
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v24?.states.hover).toBeDefined();
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v32?.states.hover).toBeDefined();

    state.addTransition('icon-chevron', {
      id: 'default-to-hover',
      from: 'default',
      to: 'hover',
      strategy: 'replace',
      durationMs: 180,
      layerBindings: [],
    });

    const renamedStateId = state.renameState('icon-chevron', 'hover', 'active');
    expect(renamedStateId).toBe('active');
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v24?.states.hover).toBeUndefined();
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v24?.states.active).toBeDefined();
    expect(editorStore.getState().project?.icons['icon-chevron']?.transitions['default-to-active']).toBeUndefined();
    expect(
      Object.values(editorStore.getState().project?.icons['icon-chevron']?.transitions ?? {})[0],
    ).toMatchObject({ from: 'default', to: 'active' });

    const duplicateStateId = state.duplicateState('icon-chevron', 'active');
    expect(duplicateStateId).toBe('active-copy');
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v24?.states['active-copy']).toBeDefined();
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v32?.states['active-copy']).toBeDefined();

    state.removeState('icon-chevron', 'active');
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v24?.states.active).toBeUndefined();
    expect(editorStore.getState().project?.icons['icon-chevron']?.variants.v32?.states.active).toBeUndefined();
    expect(Object.keys(editorStore.getState().project?.icons['icon-chevron']?.transitions ?? {})).toHaveLength(0);
  });
});

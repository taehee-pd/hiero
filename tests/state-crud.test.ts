import { describe, expect, test, beforeEach } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
}

function getVariant() {
  const state = editorStore.getState();
  const icon = state.currentIconId ? state.project?.icons[state.currentIconId] : null;
  const variant = icon && state.currentVariantId ? icon.variants[state.currentVariantId] : null;
  return variant;
}

describe('state CRUD', () => {
  beforeEach(() => {
    bootstrap();
    // Ensure we have a current icon
    const state = editorStore.getState();
    expect(state.currentIconId).toBeDefined();
    expect(state.currentVariantId).toBeDefined();
  });

  test('addState creates a new state with copies of current layers', () => {
    const iconId = editorStore.getState().currentIconId!;
    const variantBefore = getVariant()!;
    const layerCountBefore = Object.keys(variantBefore.layers).length;

    editorStore.getState().addState(iconId, 'hover');

    const variant = getVariant()!;
    expect(variant.states).toBeDefined();
    expect(variant.states!['hover']).toBeDefined();
    expect(variant.states!['hover'].id).toBe('hover');
    expect(Object.keys(variant.states!['hover'].layers)).toHaveLength(layerCountBefore);
    expect(editorStore.getState().currentStateId).toBe('hover');
  });

  test('addState is a no-op if state already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'active');
    editorStore.getState().addState(iconId, 'active'); // duplicate

    const variant = getVariant()!;
    const stateIds = Object.keys(variant.states ?? {});
    const activeCount = stateIds.filter((id) => id === 'active').length;
    expect(activeCount).toBe(1);
  });

  test('removeState removes the state and switches to another', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'hover');
    editorStore.getState().addState(iconId, 'active');

    editorStore.getState().removeState(iconId, 'hover');

    const variant = getVariant()!;
    expect(variant.states?.['hover']).toBeUndefined();
    expect(variant.states?.['active']).toBeDefined();
  });

  test('removeState falls back to legacy default when last authored state is removed', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'only-state');

    editorStore.getState().removeState(iconId, 'only-state');

    const variant = getVariant()!;
    // withLegacyVariantStateView creates a compatibility "default" state from layers
    expect(variant.states?.['only-state']).toBeUndefined();
  });

  test('renameState changes state ID and updates currentStateId', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'old-name');

    editorStore.getState().renameState(iconId, 'old-name', 'new-name');

    const variant = getVariant()!;
    expect(variant.states?.['old-name']).toBeUndefined();
    expect(variant.states?.['new-name']).toBeDefined();
    expect(variant.states!['new-name'].id).toBe('new-name');
    expect(editorStore.getState().currentStateId).toBe('new-name');
  });

  test('renameState is a no-op if target name already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'alpha');
    editorStore.getState().addState(iconId, 'beta');

    editorStore.getState().renameState(iconId, 'alpha', 'beta'); // collision

    const variant = getVariant()!;
    expect(variant.states?.['alpha']).toBeDefined(); // unchanged
    expect(variant.states?.['beta']).toBeDefined();
  });

  test('duplicateState creates a deep copy of the source state', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'base');

    editorStore.getState().duplicateState(iconId, 'base', 'base-copy');

    const variant = getVariant()!;
    expect(variant.states?.['base']).toBeDefined();
    expect(variant.states?.['base-copy']).toBeDefined();
    expect(variant.states!['base-copy'].id).toBe('base-copy');
    // Deep copy — different object references
    expect(variant.states!['base-copy'].layers).not.toBe(variant.states!['base'].layers);
    expect(editorStore.getState().currentStateId).toBe('base-copy');
  });

  test('duplicateState is a no-op if target already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addState(iconId, 'source');
    editorStore.getState().addState(iconId, 'target');

    const statesBefore = Object.keys(getVariant()!.states ?? {}).length;
    editorStore.getState().duplicateState(iconId, 'source', 'target');

    expect(Object.keys(getVariant()!.states ?? {})).toHaveLength(statesBefore);
  });
});

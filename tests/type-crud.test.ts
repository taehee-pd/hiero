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

describe('type CRUD', () => {
  beforeEach(() => {
    bootstrap();
    // Ensure we have a current icon
    const state = editorStore.getState();
    expect(state.currentIconId).toBeDefined();
    expect(state.currentVariantId).toBeDefined();
  });

  test('addType creates a new type with copies of current layers', () => {
    const iconId = editorStore.getState().currentIconId!;
    const variantBefore = getVariant()!;
    const layerCountBefore = Object.keys(variantBefore.layers).length;

    editorStore.getState().addType(iconId, 'hover');

    const variant = getVariant()!;
    expect(variant.types).toBeDefined();
    expect(variant.types!['hover']).toBeDefined();
    expect(variant.types!['hover'].id).toBe('hover');
    expect(Object.keys(variant.types!['hover'].layers)).toHaveLength(layerCountBefore);
    expect(editorStore.getState().currentTypeId).toBe('hover');
  });

  test('addType is a no-op if state already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'active');
    editorStore.getState().addType(iconId, 'active'); // duplicate

    const variant = getVariant()!;
    const stateIds = Object.keys(variant.types ?? {});
    const activeCount = stateIds.filter((id) => id === 'active').length;
    expect(activeCount).toBe(1);
  });

  test('removeType removes the state and switches to another', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'hover');
    editorStore.getState().addType(iconId, 'active');

    editorStore.getState().removeType(iconId, 'hover');

    const variant = getVariant()!;
    expect(variant.types?.['hover']).toBeUndefined();
    expect(variant.types?.['active']).toBeDefined();
  });

  test('removeType preserves currentTypeId when deleting a non-active type', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'alpha');
    editorStore.getState().addType(iconId, 'beta');

    // beta is now current (addType switches to it)
    expect(editorStore.getState().currentTypeId).toBe('beta');

    // Delete alpha (not the active type)
    editorStore.getState().removeType(iconId, 'alpha');

    // currentTypeId should still be beta, not switched
    expect(editorStore.getState().currentTypeId).toBe('beta');
    const variant = getVariant()!;
    expect(variant.types?.['alpha']).toBeUndefined();
    expect(variant.types?.['beta']).toBeDefined();
  });

  test('removeType switches currentTypeId only when deleting the active type', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'first');
    editorStore.getState().addType(iconId, 'second');

    // Switch to 'first'
    editorStore.getState().setCurrentType('first');
    expect(editorStore.getState().currentTypeId).toBe('first');

    // Delete 'first' (the active type) — should switch to remaining
    editorStore.getState().removeType(iconId, 'first');
    expect(editorStore.getState().currentTypeId).not.toBe('first');
    expect(editorStore.getState().currentTypeId).toBeDefined();
  });

  test('removeType falls back to legacy default when last authored type is removed', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'only-type');

    editorStore.getState().removeType(iconId, 'only-type');

    const variant = getVariant()!;
    // normalizeVariant creates a compatibility "default" type from layers
    expect(variant.types?.['only-type']).toBeUndefined();
  });

  test('renameType changes state ID and updates currentTypeId', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'old-name');

    editorStore.getState().renameType(iconId, 'old-name', 'new-name');

    const variant = getVariant()!;
    expect(variant.types?.['old-name']).toBeUndefined();
    expect(variant.types?.['new-name']).toBeDefined();
    expect(variant.types!['new-name'].id).toBe('new-name');
    expect(editorStore.getState().currentTypeId).toBe('new-name');
  });

  test('renameType is a no-op if target name already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'alpha');
    editorStore.getState().addType(iconId, 'beta');

    editorStore.getState().renameType(iconId, 'alpha', 'beta'); // collision

    const variant = getVariant()!;
    expect(variant.types?.['alpha']).toBeDefined(); // unchanged
    expect(variant.types?.['beta']).toBeDefined();
  });

  test('duplicateType creates a deep copy of the source state', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'base');

    editorStore.getState().duplicateType(iconId, 'base', 'base-copy');

    const variant = getVariant()!;
    expect(variant.types?.['base']).toBeDefined();
    expect(variant.types?.['base-copy']).toBeDefined();
    expect(variant.types!['base-copy'].id).toBe('base-copy');
    // Deep copy — different object references
    expect(variant.types!['base-copy'].layers).not.toBe(variant.types!['base'].layers);
    expect(editorStore.getState().currentTypeId).toBe('base-copy');
  });

  test('duplicateType is a no-op if target already exists', () => {
    const iconId = editorStore.getState().currentIconId!;
    editorStore.getState().addType(iconId, 'source');
    editorStore.getState().addType(iconId, 'target');

    const typesBefore = Object.keys(getVariant()!.types ?? {}).length;
    editorStore.getState().duplicateType(iconId, 'source', 'target');

    expect(Object.keys(getVariant()!.types ?? {})).toHaveLength(typesBefore);
  });
});

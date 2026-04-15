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

function getTypeCatalog() {
  return editorStore.getState().project?.types ?? {};
}

describe('type CRUD (universal)', () => {
  beforeEach(() => {
    bootstrap();
    // Ensure we have a current icon
    const state = editorStore.getState();
    expect(state.currentIconId).toBeDefined();
    expect(state.currentVariantId).toBeDefined();
  });

  test('addType registers the type in the IconSet catalog and propagates to every variant', () => {
    const variantBefore = getVariant()!;
    const layerCountBefore = Object.keys(variantBefore.layers).length;

    editorStore.getState().addType('hover');

    // Catalog entry
    expect(getTypeCatalog()['hover']).toBeDefined();
    expect(getTypeCatalog()['hover'].id).toBe('hover');

    // Propagation: the current variant has the type with cloned layers
    const variant = getVariant()!;
    expect(variant.types).toBeDefined();
    expect(variant.types!['hover']).toBeDefined();
    expect(Object.keys(variant.types!['hover'].layers)).toHaveLength(layerCountBefore);

    // Propagation: every other icon + every other variant also has it
    const project = editorStore.getState().project!;
    for (const icon of Object.values(project.icons)) {
      for (const v of Object.values(icon.variants)) {
        expect(v.types?.['hover']).toBeDefined();
      }
    }

    expect(editorStore.getState().currentTypeId).toBe('hover');
  });

  test('addType is a no-op if the type is already in the catalog', () => {
    editorStore.getState().addType('active');
    editorStore.getState().addType('active'); // duplicate

    const count = Object.keys(getTypeCatalog()).filter((id) => id === 'active').length;
    expect(count).toBe(1);
  });

  test('removeType removes the type from the catalog and every variant', () => {
    editorStore.getState().addType('hover');
    editorStore.getState().addType('active');

    editorStore.getState().removeType('hover');

    // Catalog
    expect(getTypeCatalog()['hover']).toBeUndefined();
    expect(getTypeCatalog()['active']).toBeDefined();

    // Every variant across every icon
    const project = editorStore.getState().project!;
    for (const icon of Object.values(project.icons)) {
      for (const v of Object.values(icon.variants)) {
        expect(v.types?.['hover']).toBeUndefined();
        expect(v.types?.['active']).toBeDefined();
      }
    }
  });

  test('removeType preserves currentTypeId when deleting a non-active type', () => {
    editorStore.getState().addType('alpha');
    editorStore.getState().addType('beta');

    // beta is now current (addType switches to it)
    expect(editorStore.getState().currentTypeId).toBe('beta');

    // Delete alpha (not the active type)
    editorStore.getState().removeType('alpha');

    // currentTypeId should still be beta, not switched
    expect(editorStore.getState().currentTypeId).toBe('beta');
    expect(getTypeCatalog()['alpha']).toBeUndefined();
    expect(getTypeCatalog()['beta']).toBeDefined();
  });

  test('removeType switches currentTypeId only when deleting the active type', () => {
    editorStore.getState().addType('first');
    editorStore.getState().addType('second');

    // Switch to 'first'
    editorStore.getState().setCurrentType('first');
    expect(editorStore.getState().currentTypeId).toBe('first');

    // Delete 'first' (the active type) — should switch to a remaining type
    editorStore.getState().removeType('first');
    expect(editorStore.getState().currentTypeId).not.toBe('first');
    expect(editorStore.getState().currentTypeId).toBeDefined();
  });

  test('renameType changes the catalog ID, updates every variant, and updates currentTypeId', () => {
    editorStore.getState().addType('old-name');

    editorStore.getState().renameType('old-name', 'new-name');

    expect(getTypeCatalog()['old-name']).toBeUndefined();
    expect(getTypeCatalog()['new-name']).toBeDefined();
    expect(getTypeCatalog()['new-name'].id).toBe('new-name');

    const project = editorStore.getState().project!;
    for (const icon of Object.values(project.icons)) {
      for (const v of Object.values(icon.variants)) {
        expect(v.types?.['old-name']).toBeUndefined();
        expect(v.types?.['new-name']).toBeDefined();
        expect(v.types!['new-name'].id).toBe('new-name');
      }
    }

    expect(editorStore.getState().currentTypeId).toBe('new-name');
  });

  test('renameType is a no-op if the target name already exists', () => {
    editorStore.getState().addType('alpha');
    editorStore.getState().addType('beta');

    editorStore.getState().renameType('alpha', 'beta'); // collision

    expect(getTypeCatalog()['alpha']).toBeDefined(); // unchanged
    expect(getTypeCatalog()['beta']).toBeDefined();
  });

  test('duplicateType creates a deep-cloned entry in the catalog and on every variant', () => {
    editorStore.getState().addType('base');

    editorStore.getState().duplicateType('base', 'base-copy');

    expect(getTypeCatalog()['base']).toBeDefined();
    expect(getTypeCatalog()['base-copy']).toBeDefined();
    expect(getTypeCatalog()['base-copy'].id).toBe('base-copy');

    const variant = getVariant()!;
    expect(variant.types?.['base-copy']).toBeDefined();
    expect(variant.types!['base-copy'].id).toBe('base-copy');
    // Deep copy — different object references
    expect(variant.types!['base-copy'].layers).not.toBe(variant.types!['base'].layers);
    expect(editorStore.getState().currentTypeId).toBe('base-copy');
  });

  test('duplicateType is a no-op if the target already exists in the catalog', () => {
    editorStore.getState().addType('source');
    editorStore.getState().addType('target');

    const typesBefore = Object.keys(getTypeCatalog()).length;
    editorStore.getState().duplicateType('source', 'target');

    expect(Object.keys(getTypeCatalog())).toHaveLength(typesBefore);
  });

  test('switching icons preserves the currently-selected universal type', () => {
    editorStore.getState().addType('filled');
    expect(editorStore.getState().currentTypeId).toBe('filled');

    // Find another icon to switch to
    const project = editorStore.getState().project!;
    const originalIconId = editorStore.getState().currentIconId!;
    const otherIconId = Object.keys(project.icons).find((id) => id !== originalIconId);
    expect(otherIconId).toBeDefined();

    editorStore.getState().setCurrentIcon(otherIconId!);

    // currentTypeId should still be 'filled'
    expect(editorStore.getState().currentTypeId).toBe('filled');
    // And the new icon's current variant should have the filled type
    const variant = getVariant()!;
    expect(variant.types?.['filled']).toBeDefined();
  });

  test('setTypeName updates the display label without changing the catalog id', () => {
    // Default type rename is implemented as a display-label update so the
    // structural id `'default'` stays stable across the runtime, export,
    // and transition pipelines.
    editorStore.getState().setTypeName('default', 'Base');

    const catalog = getTypeCatalog();
    expect(catalog['default']).toBeDefined();
    expect(catalog['default']?.name).toBe('Base');

    // Structural id must NOT change — any consumer reading variant.types
    // with the literal key 'default' must keep working.
    const variant = getVariant()!;
    expect(variant.types?.['default']).toBeDefined();
    expect(variant.defaultType).toBe('default');
  });

  test('setTypeName with empty string clears the custom label', () => {
    editorStore.getState().setTypeName('default', 'Base');
    expect(getTypeCatalog()['default']?.name).toBe('Base');

    editorStore.getState().setTypeName('default', '   ');
    expect(getTypeCatalog()['default']?.name).toBeUndefined();
  });

  test('setTypeName is a no-op for unknown type ids', () => {
    const before = getTypeCatalog();
    editorStore.getState().setTypeName('nonexistent', 'Base');
    expect(getTypeCatalog()).toEqual(before);
  });
});

describe('type catalog preservation across variant/icon creation', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('addVariant preserves every type from the source variant', () => {
    // Preexisting bug: addVariant used to call normalizeVariant without
    // passing the source variant's per-type layer map, which silently
    // erased every non-default type. This test locks in the fix.
    editorStore.getState().addType('filled');
    editorStore.getState().addType('line');

    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const sourceVariantId = state.currentVariantId!;
    const sourceVariant = state.project!.icons[iconId]!.variants[sourceVariantId]!;
    expect(Object.keys(sourceVariant.types ?? {}).sort()).toEqual(
      ['default', 'filled', 'line'].sort(),
    );

    editorStore.getState().addVariant(iconId, {
      size: 48,
      sourceVariantId,
    });

    const newState = editorStore.getState();
    const newVariantId = newState.currentVariantId!;
    expect(newVariantId).not.toBe(sourceVariantId);
    const newVariant = newState.project!.icons[iconId]!.variants[newVariantId]!;
    expect(Object.keys(newVariant.types ?? {}).sort()).toEqual(
      ['default', 'filled', 'line'].sort(),
    );
  });

  test('new blank icon inherits every type from the IconSet catalog', () => {
    // Preexisting bug: createBlankIcon used to synthesize a fresh
    // `default` type regardless of what types existed in the catalog,
    // leaving new icons inconsistent with the universal-types invariant.
    editorStore.getState().addType('filled');
    editorStore.getState().addType('line');

    const blankId = editorStore.getState().createBlankIcon({ name: 'Blank' });
    expect(blankId).toBeDefined();

    const icon = editorStore.getState().project!.icons[blankId!]!;
    const variant = Object.values(icon.variants)[0]!;
    expect(Object.keys(variant.types ?? {}).sort()).toEqual(
      ['default', 'filled', 'line'].sort(),
    );
  });
});

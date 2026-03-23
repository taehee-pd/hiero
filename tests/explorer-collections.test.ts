import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { createImportedIcon } from '../lib/import/import-svg-file';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  editorStore.setState({ favorites: [] });
}

describe('explorer collections and favorites', () => {
  test('adds/removes icons from collections', () => {
    bootstrap();

    const state = editorStore.getState();
    state.addCollection({
      id: 'actions',
      name: 'Actions',
      iconIds: [],
    });

    state.addIconToCollection('actions', 'icon-search');
    state.addIconToCollection('actions', 'icon-home');
    expect(editorStore.getState().project?.collections?.actions?.iconIds).toEqual([
      'icon-search',
      'icon-home',
    ]);

    state.removeIconFromCollection('actions', 'icon-search');
    expect(editorStore.getState().project?.collections?.actions?.iconIds).toEqual([
      'icon-home',
    ]);
  });

  test('toggles favorites', () => {
    bootstrap();

    const state = editorStore.getState();
    state.toggleFavorite('icon-search');
    expect(editorStore.getState().favorites).toContain('icon-search');

    state.toggleFavorite('icon-search');
    expect(editorStore.getState().favorites).not.toContain('icon-search');
  });

  test('parses sample svg into an icon', () => {
    const icon = createImportedIcon(
      `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g><path d="M2 2 L22 2 L22 22 Z"/><path d="M4 4 L20 4 L20 20 Z"/></g></svg>`,
      { sourceName: 'sample-shape.svg' },
    );

    expect(icon.name).toBe('Sample Shape');
    expect(icon.id.startsWith('icon-sample-shape')).toBeTrue();
    const variant = icon.variants.v24;
    expect(variant).toBeDefined();
    expect(variant.viewBox).toEqual([0, 0, 24, 24]);
    expect(Object.keys(variant.states.default.layers).length).toBe(2);
  });
});

import { describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
  editorStore.setState({ favorites: [], openTabs: [], activeTabId: null });
}

describe('workspace store', () => {
  test('wraps a legacy project inside a workspace', () => {
    bootstrap();

    const state = editorStore.getState();
    expect(state.workspace?.version).toBe('2.0');
    expect(Object.keys(state.workspace?.iconSets ?? {})).toHaveLength(1);
    expect(state.activeIconSetId).toBeDefined();
    expect(state.project?.meta.name).toBe(SAMPLE_PROJECT.meta.name);
  });

  test('switches icon sets and editor tabs', () => {
    bootstrap();

    const originalSetId = editorStore.getState().activeIconSetId!;
    const nextSetId = editorStore.getState().addIconSet('Outlined');
    expect(nextSetId).toBeDefined();
    if (!nextSetId) throw new Error('expected icon set id');

    editorStore.getState().insertIcon(structuredClone(SAMPLE_PROJECT.icons['icon-search']));

    const firstTabId = editorStore.getState().openIconTab(originalSetId, 'icon-home');
    const secondTabId = editorStore.getState().openIconTab(nextSetId, 'icon-search');

    expect(editorStore.getState().openTabs).toHaveLength(2);
    expect(editorStore.getState().activeTabId).toBe(secondTabId);
    expect(editorStore.getState().activeIconSetId).toBe(nextSetId);
    expect(editorStore.getState().currentIconId).toBe('icon-search');

    if (!firstTabId) throw new Error('expected first tab id');
    editorStore.getState().setActiveTab(firstTabId);

    expect(editorStore.getState().activeIconSetId).toBe(originalSetId);
    expect(editorStore.getState().currentIconId).toBe('icon-home');
  });
});

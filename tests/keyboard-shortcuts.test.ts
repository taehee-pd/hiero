import { describe, expect, test } from 'bun:test';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';
import { canRedo, clearHistory, undo } from '../lib/editor-store/history';
import type { Project } from '../lib/schema/types';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

const ALIGN_SHORTCUT_PROJECT: Project = {
  version: '1.0',
  meta: {
    name: 'Keyboard Align',
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
  },
  icons: {
    arrange: {
      id: 'arrange',
      name: 'Arrange',
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          defaultState: 'default',
        },
      },
      states: {
        default: {
          id: 'default',
          layers: {
            a: {
              id: 'a',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 0, y: 0 },
            },
            b: {
              id: 'b',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 20, y: 10 },
            },
            c: {
              id: 'c',
              path: { d: 'M0 0 H10 V10 H0 Z' },
              style: {},
              transform: { x: 50, y: 20 },
            },
          },
        },
      },
      transitions: {},
    },
  },
};

function triggerKey(key: string, options?: Partial<KeyboardEvent>) {
  handleEditorKeyDown({
    key,
    target: { tagName: 'DIV' },
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {},
    ...options,
  } as unknown as KeyboardEvent);
}

function bootstrapAlignShortcutSelection() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(ALIGN_SHORTCUT_PROJECT));
  clearHistory();
  state.setSelection({ layerIds: ['a', 'b', 'c'], pointIds: [] });
}

function getArrangeLayerTransform(layerId: 'a' | 'b' | 'c') {
  return editorStore.getState().project!.icons.arrange.states.default.layers[layerId].transform!;
}

describe('keyboard shortcuts', () => {
  test('escape exits direct-select mode back to select', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('direct-select');
    state.setSelection({ layerIds: ['chevron'], pointIds: ['0:1'] });

    let prevented = false;
    handleEditorKeyDown({
      key: 'Escape',
      target: { tagName: 'DIV' },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent);

    const next = editorStore.getState();
    expect(prevented).toBeTrue();
    expect(next.tool).toBe('select');
    expect(next.selection.layerIds.length).toBe(0);
    expect(next.selection.pointIds.length).toBe(0);
  });

  test('ctrl+y triggers redo on windows/linux keyboards', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const stateId = state.currentStateId!;

    state.setLayerVisibility(iconId, stateId, 'chevron', false);
    undo();
    expect(canRedo()).toBeTrue();

    triggerKey('y', { ctrlKey: true });

    const visible = editorStore.getState().project!.icons[iconId].states[stateId].layers['chevron']
      .visible;
    expect(visible).toBeFalse();
  });

  test('ignores shortcuts while editing inside contenteditable elements', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('pen');

    handleEditorKeyDown({
      key: 'v',
      target: { isContentEditable: true, tagName: 'DIV' },
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => {},
    } as unknown as KeyboardEvent);

    expect(editorStore.getState().tool).toBe('pen');
  });

  test('guide shortcut is disabled in the editor canvas workflow', () => {
    bootstrap();
    const state = editorStore.getState();
    state.setTool('select');

    triggerKey('g');

    expect(editorStore.getState().tool).toBe('select');
  });

  test('cmd/ctrl+shift+semicolon toggles snapping', () => {
    bootstrap();
    const state = editorStore.getState() as ReturnType<typeof editorStore.getState> & {
      toggleSnap?: () => void;
    };
    let toggled = false;
    state.toggleSnap = () => {
      toggled = true;
    };

    let prevented = false;
    handleEditorKeyDown({
      key: ':',
      code: 'Semicolon',
      target: { tagName: 'DIV' },
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent);

    expect(prevented).toBeTrue();
    expect(toggled).toBeTrue();
  });

  test('ctrl+shift+l aligns selected layers left', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('l', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').x).toBe(0);
    expect(getArrangeLayerTransform('b').x).toBe(0);
    expect(getArrangeLayerTransform('c').x).toBe(0);
  });

  test('ctrl+shift+c aligns selected layers to horizontal center', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('c', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').x).toBe(25);
    expect(getArrangeLayerTransform('b').x).toBe(25);
    expect(getArrangeLayerTransform('c').x).toBe(25);
  });

  test('ctrl+shift+r aligns selected layers right', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('r', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').x).toBe(50);
    expect(getArrangeLayerTransform('b').x).toBe(50);
    expect(getArrangeLayerTransform('c').x).toBe(50);
  });

  test('ctrl+shift+t aligns selected layers top', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('t', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').y).toBe(0);
    expect(getArrangeLayerTransform('b').y).toBe(0);
    expect(getArrangeLayerTransform('c').y).toBe(0);
  });

  test('ctrl+shift+m aligns selected layers to vertical center', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('m', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').y).toBe(10);
    expect(getArrangeLayerTransform('b').y).toBe(10);
    expect(getArrangeLayerTransform('c').y).toBe(10);
  });

  test('ctrl+shift+b aligns selected layers bottom', () => {
    bootstrapAlignShortcutSelection();

    triggerKey('b', { ctrlKey: true, shiftKey: true });

    expect(getArrangeLayerTransform('a').y).toBe(20);
    expect(getArrangeLayerTransform('b').y).toBe(20);
    expect(getArrangeLayerTransform('c').y).toBe(20);
  });
});

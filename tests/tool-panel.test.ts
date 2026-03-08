import { describe, expect, test } from 'bun:test';
import { getShapeSubToolLabel } from '../components/editor/ToolPanel';
import { clearHistory } from '../lib/editor-store/history';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(SAMPLE_PROJECT));
  clearHistory();
}

describe('tool panel shape sub tool state', () => {
  test('defaults to rectangle and seeds the 24px guide preset in a fresh editor state', () => {
    editorStore.getState().newProject();
    clearHistory();
    expect(editorStore.getState().shapeSubTool).toBe('rectangle');
    expect(editorStore.getState().guidesVisible).toBeTrue();
    expect(editorStore.getState().guideStyle).toBe('subtle');
    expect(editorStore.getState().project?.guideMasters).toEqual({
      'preset-24': {
        id: 'preset-24',
        name: '24px Standard',
        targetSize: 24,
        viewBox: [0, 0, 24, 24],
        items: [
          { kind: 'rect', x: 1, y: 1, width: 22, height: 22 },
          { kind: 'rect', x: 3, y: 3, width: 18, height: 18 },
          { kind: 'ellipse', cx: 12, cy: 12, rx: 10, ry: 10 },
          { kind: 'rect', x: 2, y: 4, width: 20, height: 16 },
          { kind: 'rect', x: 4, y: 2, width: 16, height: 20 },
          { kind: 'hline', y: 12 },
          { kind: 'vline', x: 12 },
        ],
      },
    });
  });

  test('updates shape sub tool through store action', () => {
    bootstrap();
    const state = editorStore.getState();

    state.setShapeSubTool('star');

    expect(editorStore.getState().shapeSubTool).toBe('star');
  });

  test('maps active shape labels for the toolbar tooltip', () => {
    expect(getShapeSubToolLabel('rectangle')).toBe('Rectangle');
    expect(getShapeSubToolLabel('ellipse')).toBe('Ellipse');
    expect(getShapeSubToolLabel('polygon')).toBe('Polygon');
    expect(getShapeSubToolLabel('star')).toBe('Star');
    expect(getShapeSubToolLabel('line')).toBe('Line');
  });
});

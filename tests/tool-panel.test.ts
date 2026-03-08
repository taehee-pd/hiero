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
  test('defaults to rectangle in a fresh editor state', () => {
    editorStore.getState().newProject();
    clearHistory();
    expect(editorStore.getState().shapeSubTool).toBe('rectangle');
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

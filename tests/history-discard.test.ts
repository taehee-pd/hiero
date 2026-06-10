/**
 * A5 — destructive-operation rollback contract
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The temporal store's pause → mutate → discard/commit transaction is
 * what guarantees a failed boolean op or derivation never leaves
 * half-applied state. These tests pin the primitives' behavior:
 *
 *   - discard() restores the pre-pause snapshot and pushes no history
 *   - commit() after a real change pushes exactly one undoable entry
 *   - tracking resumes after a discard (no stuck-paused history)
 */
import { beforeEach, describe, expect, test } from 'bun:test';

import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
}

function temporal() {
  return editorStore.temporal.getState();
}

function mutateProject() {
  editorStore.setState((s) => {
    if (!s.project) return s;
    return {
      project: {
        ...s.project,
        meta: { ...s.project.meta, name: `${s.project.meta.name}*` },
      },
    };
  });
}

describe('temporal transaction rollback (A5)', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('discard restores the pre-pause state and pushes no history', () => {
    const before = editorStore.getState();
    const historyBefore = temporal().pastStates.length;

    temporal().pause();
    mutateProject();
    expect(editorStore.getState().project).not.toBe(before.project);

    temporal().discard();

    const after = editorStore.getState();
    expect(after.project).toBe(before.project);
    expect(after.isDirty).toBe(before.isDirty);
    expect(temporal().pastStates.length).toBe(historyBefore);
  });

  test('commit after a real change pushes exactly one undoable entry', () => {
    const before = editorStore.getState();
    const historyBefore = temporal().pastStates.length;

    temporal().pause();
    mutateProject();
    mutateProject();
    temporal().resume();
    temporal().commit('test:batch');

    expect(temporal().pastStates.length).toBe(historyBefore + 1);

    temporal().undo();
    expect(editorStore.getState().project).toBe(before.project);
  });

  test('commit without changes is a no-op entry-wise', () => {
    const historyBefore = temporal().pastStates.length;
    temporal().pause();
    temporal().resume();
    temporal().commit('test:noop');
    expect(temporal().pastStates.length).toBe(historyBefore);
  });

  test('tracking resumes after discard — later edits are undoable again', () => {
    temporal().pause();
    mutateProject();
    temporal().discard();

    const historyBefore = temporal().pastStates.length;
    mutateProject();
    expect(temporal().pastStates.length).toBe(historyBefore + 1);
  });
});

import { describe, expect, test } from 'bun:test';

import { createIconRuntimeStore } from '../lib/runtime-core/store';
import { SAMPLE_RUNTIME_EXPORT } from '../lib/runtime-react/demo-fixture';

const payload = SAMPLE_RUNTIME_EXPORT.variant;

describe('runtime core store', () => {
  test('steps track transitions and settles into the requested state', () => {
    let now = 0;
    const store = createIconRuntimeStore(payload, {
      autoTick: false,
      now: () => now,
    });

    store.setState('active');

    let snapshot = store.getSnapshot();
    expect(snapshot.currentStateId).toBe('active');
    expect(snapshot.settledStateId).toBe('default');
    expect(snapshot.activeTransitionId).toBe('activate');

    now = 110;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    const chevron = snapshot.snapshot.layers.find((layer) => layer.id === 'chevron');
    expect(snapshot.isAnimating).toBeTrue();
    expect(chevron?.transform).toContain('translate(-0.75, 0)');
    expect(chevron?.pathLengthProgress).toBeGreaterThan(0.5);
    expect(chevron?.pathLengthProgress).toBeLessThan(0.7);

    now = 240;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    expect(snapshot.isAnimating).toBeFalse();
    expect(snapshot.activeTransitionId).toBeUndefined();
    expect(snapshot.currentStateId).toBe('active');
    expect(snapshot.settledStateId).toBe('active');
    expect(
      snapshot.snapshot.layers.some((layer) => layer.d === 'M7 5l7 7-7 7'),
    ).toBeTrue();
  });

  test('reverses an in-flight transition from the active logical state', () => {
    let now = 0;
    const store = createIconRuntimeStore(payload, {
      autoTick: false,
      now: () => now,
    });

    store.setState('active');
    let snapshot = store.getSnapshot();
    expect(snapshot.activeTransitionId).toBe('activate');

    store.setState('default');
    snapshot = store.getSnapshot();

    expect(snapshot.currentStateId).toBe('default');
    expect(snapshot.settledStateId).toBe('default');
    expect(snapshot.activeTransitionId).toBe('reset');

    now = 181;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    expect(snapshot.activeTransitionId).toBeUndefined();
    expect(snapshot.currentStateId).toBe('default');
    expect(snapshot.settledStateId).toBe('default');
  });

  test('ignores duplicate requests for the already-targeted state while animating', () => {
    let now = 0;
    const store = createIconRuntimeStore(payload, {
      autoTick: false,
      now: () => now,
    });

    store.setState('active');
    const firstSnapshot = store.getSnapshot();
    expect(firstSnapshot.activeTransitionId).toBe('activate');
    expect(firstSnapshot.settledStateId).toBe('default');

    store.setState('active');
    const secondSnapshot = store.getSnapshot();

    expect(secondSnapshot.activeTransitionId).toBe('activate');
    expect(secondSnapshot.settledStateId).toBe('default');
    expect(secondSnapshot.isAnimating).toBeTrue();

    now = 221;
    store.advanceTo(now);
    const finalSnapshot = store.getSnapshot();

    expect(finalSnapshot.activeTransitionId).toBeUndefined();
    expect(finalSnapshot.currentStateId).toBe('active');
    expect(finalSnapshot.settledStateId).toBe('active');
  });

  test('plays draw effects and clears them once complete', () => {
    let now = 0;
    const store = createIconRuntimeStore(payload, {
      autoTick: false,
      now: () => now,
    });

    store.playEffect('drawOn');

    now = 160;
    store.advanceTo(now);
    let snapshot = store.getSnapshot();
    const chevron = snapshot.snapshot.layers.find((layer) => layer.id === 'chevron');

    expect(snapshot.activeEffectId).toBe('drawOn');
    expect(snapshot.isAnimating).toBeTrue();
    expect(chevron?.pathLengthProgress).toBeGreaterThan(0.45);
    expect(chevron?.pathLengthProgress).toBeLessThan(0.55);

    now = 321;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    expect(snapshot.activeEffectId).toBeUndefined();
    expect(snapshot.isAnimating).toBeFalse();
  });
});

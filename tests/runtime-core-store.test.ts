import { describe, expect, test } from 'bun:test';

import type { RuntimeVariantPayload } from '../lib/export/export-runtime-json';
import { createIconRuntimeStore } from '../lib/runtime-core/store';
import { SAMPLE_RUNTIME_EXPORT } from '../lib/runtime-react/demo-fixture';

const payload = SAMPLE_RUNTIME_EXPORT.variant;

const SPRING_PAYLOAD: RuntimeVariantPayload = {
  variant: {
    id: 'v24',
    size: 24,
    viewBox: [0, 0, 24, 24],
    defaultState: 'default',
  },
  states: {
    default: {
      layers: [
        {
          id: 'line',
          d: 'M0 0L10 10',
          fill: { kind: 'none' },
          stroke: { kind: 'solid', color: '#000000' },
        },
      ],
    },
    active: {
      layers: [
        {
          id: 'line',
          d: 'M0 0L10 10',
          fill: { kind: 'none' },
          stroke: { kind: 'solid', color: '#000000' },
        },
      ],
    },
  },
  transitions: {
    activate: {
      from: 'default',
      to: 'active',
      strategy: 'track',
      durationMs: 400,
      easing: { type: 'spring', stiffness: 170, damping: 12, mass: 1 },
      layerBindings: [
        {
          fromLayerId: 'line',
          toLayerId: 'line',
          tracks: [{ property: 'translateX', keyframes: [0, 10] }],
        },
      ],
    },
  },
};

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

    const roofLayer = snapshot.snapshot.layers.find((layer) => layer.id === 'roof');
    expect(snapshot.isAnimating).toBeTrue();
    expect(roofLayer?.transform).toContain('translate(-0.75, 0)');
    expect(roofLayer?.pathLengthProgress).toBeGreaterThan(0.5);
    expect(roofLayer?.pathLengthProgress).toBeLessThan(0.7);

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
    const roofLayer = snapshot.snapshot.layers.find((layer) => layer.id === 'roof');

    expect(snapshot.activeEffectId).toBe('drawOn');
    expect(snapshot.isAnimating).toBeTrue();
    expect(roofLayer?.pathLengthProgress).toBeGreaterThan(0.7);
    expect(roofLayer?.pathLengthProgress).toBeLessThan(0.8);

    now = 321;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    expect(snapshot.activeEffectId).toBeUndefined();
    expect(snapshot.isAnimating).toBeFalse();
  });

  test('preserves spring overshoot for numeric tracks until the declared duration settles', () => {
    let now = 0;
    const store = createIconRuntimeStore(SPRING_PAYLOAD, {
      autoTick: false,
      now: () => now,
    });

    store.setState('active');

    now = 240;
    store.advanceTo(now);
    let snapshot = store.getSnapshot();
    const lineDuringOvershoot = snapshot.snapshot.layers.find((layer) => layer.id === 'line');

    expect(snapshot.isAnimating).toBeTrue();
    expect(lineDuringOvershoot?.transform).toContain('translate(11.');

    now = 400;
    store.advanceTo(now);
    snapshot = store.getSnapshot();

    expect(snapshot.isAnimating).toBeFalse();
    expect(snapshot.activeTransitionId).toBeUndefined();
    expect(snapshot.settledStateId).toBe('active');
  });
});

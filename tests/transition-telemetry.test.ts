/**
 * W5-6 acceptance: telemetry emitter is pluggable; default no-op;
 * captures the canonical 5-tuple per resolution.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import { resolveMorph } from '../lib/runtime-core/cascade';
import {
  captureToBuffer,
  emitResolutionEvent,
  setTelemetryEmitter,
  type TelemetryEvent,
} from '../lib/runtime-core/transition-telemetry';
import type { Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };

function fillLayer(d: string, id = 'l'): Layer {
  return { id, style: { fill: FILL }, path: { d } } as Layer;
}

afterEach(() => {
  // Restore the no-op emitter so test ordering doesn't leak
  // captures across files.
  setTelemetryEmitter(() => {});
});

describe('transition-telemetry', () => {
  test('default emitter is no-op (does not throw)', () => {
    expect(() =>
      emitResolutionEvent(
        resolveMorph(
          fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
          fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
        ),
        { durationMs: 300 },
      ),
    ).not.toThrow();
  });

  test('captureToBuffer collects the canonical 5-tuple', () => {
    const buffer: TelemetryEvent[] = [];
    setTelemetryEmitter(captureToBuffer(buffer));

    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    emitResolutionEvent(r, { durationMs: 300, iconSetVersion: '1.2.3' });

    expect(buffer.length).toBe(1);
    const event = buffer[0]!;
    expect(event.tier).toBe(r.tier);
    expect(event.taxonomy).toBe(r.taxonomy);
    expect(event.distortion).toBe(r.distortion);
    expect(event.signalKind).toBe(r.signal?.kind ?? null);
    expect(event.durationMs).toBe(300);
    expect(event.iconSetVersion).toBe('1.2.3');
    expect(typeof event.recordedAt).toBe('string');
  });

  test('iconSetVersion defaults to null when omitted', () => {
    const buffer: TelemetryEvent[] = [];
    setTelemetryEmitter(captureToBuffer(buffer));

    emitResolutionEvent(
      resolveMorph(
        fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
        fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
      ),
      { durationMs: 200 },
    );

    expect(buffer[0]!.iconSetVersion).toBeNull();
  });

  test('setTelemetryEmitter returns the previous emitter', () => {
    const a = (_e: TelemetryEvent) => {};
    const b = (_e: TelemetryEvent) => {};
    const prev = setTelemetryEmitter(a);
    expect(typeof prev).toBe('function');
    const wasA = setTelemetryEmitter(b);
    expect(wasA).toBe(a);
  });

  test('resolveMorph auto-emits when telemetry option is supplied (W5-6)', () => {
    const buffer: TelemetryEvent[] = [];
    setTelemetryEmitter(captureToBuffer(buffer));

    resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
      { telemetry: { durationMs: 240, iconSetVersion: '1.0.0' } },
    );

    expect(buffer.length).toBe(1);
    expect(buffer[0]!.durationMs).toBe(240);
    expect(buffer[0]!.iconSetVersion).toBe('1.0.0');
    expect(buffer[0]!.tier).toBeDefined();
  });

  test('resolveMorph does NOT emit when telemetry option is absent', () => {
    const buffer: TelemetryEvent[] = [];
    setTelemetryEmitter(captureToBuffer(buffer));

    resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );

    expect(buffer.length).toBe(0);
  });
});

import type { SpringConfig } from '../schema';
import { getEasingFunction } from './easing';
import type { InterpolatedValues, FrameHandle } from './scheduler';
import type { DrawAnnotation } from './draw-executor';
import { computeDrawOnValues, computeDrawOffValues } from './draw-executor';
import { estimateSpringDuration, springProgress } from './spring';
import { lerpPalette } from './color-interpolation';

/**
 * Color overrides keyed by layer ID → property → hex string.
 * Used for variableColor effects that cannot be represented as numeric values.
 */
export type ColorOverrides = Record<string, Record<string, string>>;

/**
 * Runtime effect definition from the exported payload.
 */
export type EffectDefinition = {
  kind: string;
  durationMs: number;
  easing?: string | SpringConfig;
  delay?: number;
  repeat?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
  /** Palette of hex colors for the variableColor effect. */
  palette?: string[];
  /** Custom keyframed tracks for the 'custom' effect kind. */
  customTracks?: Array<{
    property: string;
    keyframes: number[];
    easing?: string | SpringConfig;
  }>;
};

export type EffectFrameCallback = (values: InterpolatedValues, colorOverrides?: ColorOverrides) => void;
export type EffectCompleteCallback = () => void;

export type EffectSchedulerOptions = {
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => FrameHandle;
  cancelFrame?: (handle: FrameHandle) => void;
  onFrame?: EffectFrameCallback;
  /** Required for lineDrawOn/lineDrawOff effects */
  drawAnnotation?: DrawAnnotation;
  /** Layer IDs the effect applies to (for non-draw effects) */
  targetLayerIds?: string[];
};

/**
 * Schedules frame-by-frame playback of a standalone effect.
 *
 * Effects differ from transitions:
 * - They're not tied to state changes
 * - They can repeat (finite or infinite)
 * - They have a single `kind` that determines the transform/opacity deltas
 */
export class EffectScheduler {
  private readonly effect: EffectDefinition;
  private readonly now: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => FrameHandle;
  private readonly cancelFrame: (handle: FrameHandle) => void;
  private readonly onFrameCallback: EffectFrameCallback;
  private readonly drawAnnotation?: DrawAnnotation;
  private readonly targetLayerIds: string[];
  private readonly completeListeners = new Set<EffectCompleteCallback>();
  private readonly progressAtElapsed: (elapsedMs: number) => number;
  private readonly effectiveDurationMs: number;

  private activeHandle: FrameHandle | null = null;
  private startedAt = 0;
  private running = false;
  private currentIteration = 0;

  constructor(effect: EffectDefinition, options: EffectSchedulerOptions = {}) {
    this.effect = effect;
    this.now = options.now ?? defaultNow;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
    this.onFrameCallback = options.onFrame ?? (() => {});
    this.drawAnnotation = options.drawAnnotation;
    this.targetLayerIds = options.targetLayerIds ?? [];
    const { durationMs, progressAtElapsed } = resolveEffectProgressController(
      effect.easing,
      effect.durationMs,
    );
    this.progressAtElapsed = progressAtElapsed;
    this.effectiveDurationMs = durationMs;
  }

  start(): void {
    if (this.running) this.cancel();
    this.running = true;
    this.currentIteration = 0;
    this.startedAt = this.now();
    this.emitFrame(0);

    if (this.effectiveDurationMs <= 0) {
      this.emitFrame(1);
      this.finish();
      return;
    }

    this.scheduleNextFrame();
  }

  cancel(): void {
    if (this.activeHandle !== null) {
      this.cancelFrame(this.activeHandle);
      this.activeHandle = null;
    }
    this.running = false;
  }

  onComplete(callback: EffectCompleteCallback): () => void {
    this.completeListeners.add(callback);
    return () => this.completeListeners.delete(callback);
  }

  private scheduleNextFrame(): void {
    this.activeHandle = this.requestFrame(() => {
      if (!this.running) return;

      const elapsed = this.now() - this.startedAt;
      const durationMs = this.effectiveDurationMs;
      const delayMs = this.effect.delay ?? 0;

      if (elapsed < delayMs) {
        this.scheduleNextFrame();
        return;
      }

      const effectElapsed = elapsed - delayMs;
      const rawProgress = effectElapsed / durationMs;
      const maxIterations = this.effect.repeat === 'infinite' ? Infinity : (this.effect.repeat ?? 1);

      if (rawProgress >= maxIterations) {
        this.emitFrame(1);
        this.finish();
        return;
      }

      this.currentIteration = Math.floor(rawProgress);
      const iterationProgress = rawProgress - this.currentIteration;

      // Handle alternate direction
      const direction = this.effect.direction ?? 'normal';
      let progress: number;
      if (direction === 'reverse') {
        progress = 1 - iterationProgress;
      } else if (direction === 'alternate') {
        progress = this.currentIteration % 2 === 0 ? iterationProgress : 1 - iterationProgress;
      } else {
        progress = iterationProgress;
      }

      this.emitFrame(progress);
      this.scheduleNextFrame();
    });
  }

  private emitFrame(rawProgress: number): void {
    const easedProgress = this.progressAtElapsed(
      clamp01(rawProgress) * Math.max(this.effectiveDurationMs, 1),
    );

    if (this.effect.kind === 'variableColor' && this.effect.palette?.length) {
      // variableColor produces color overrides, not numeric interpolated values
      const color = lerpPalette(this.effect.palette, easedProgress);
      const colorOverrides: ColorOverrides = {};
      for (const id of this.targetLayerIds) {
        colorOverrides[id] = { fill: color };
      }
      this.onFrameCallback({}, colorOverrides);
      return;
    }

    const values = computeEffectValues(
      this.effect.kind,
      easedProgress,
      this.targetLayerIds,
      this.drawAnnotation,
      this.effect.customTracks,
    );
    this.onFrameCallback(values);
  }

  private finish(): void {
    this.cancel();
    for (const listener of this.completeListeners) {
      listener();
    }
  }
}

/**
 * Compute per-layer transform/opacity deltas for a single effect frame.
 */
export function computeEffectValues(
  kind: string,
  progress: number,
  targetLayerIds: string[],
  drawAnnotation?: DrawAnnotation,
  customTracks?: EffectDefinition['customTracks'],
): InterpolatedValues {
  switch (kind) {
    case 'lineDrawOn':
      return drawAnnotation ? computeDrawOnValues(drawAnnotation, progress) : {};
    case 'lineDrawOff':
      return drawAnnotation ? computeDrawOffValues(drawAnnotation, progress) : {};
    case 'bounce':
      return applyToLayers(targetLayerIds, computeBounce(progress));
    case 'pulse':
      return applyToLayers(targetLayerIds, computePulse(progress));
    case 'rotate':
      return applyToLayers(targetLayerIds, computeRotate(progress));
    case 'breathe':
      return applyToLayers(targetLayerIds, computeBreathe(progress));
    case 'wiggle':
      return applyToLayers(targetLayerIds, computeWiggle(progress));
    case 'scale':
      return applyToLayers(targetLayerIds, computeScale(progress));
    case 'appear':
      return applyToLayers(targetLayerIds, { opacity: progress });
    case 'disappear':
      return applyToLayers(targetLayerIds, { opacity: 1 - progress });
    case 'custom':
      return computeCustomEffect(progress, targetLayerIds, customTracks);
    default:
      return {};
  }
}

function computeCustomEffect(
  progress: number,
  targetLayerIds: string[],
  customTracks?: EffectDefinition['customTracks'],
): InterpolatedValues {
  if (!customTracks || customTracks.length === 0) return {};

  const values: Record<string, number> = {};
  for (const track of customTracks) {
    let easedProgress = progress;
    if (track.easing && typeof track.easing === 'string') {
      easedProgress = getEasingFunction(track.easing)(clamp01(progress));
    }

    if (track.keyframes.length === 0) continue;
    if (track.keyframes.length === 1) {
      values[track.property] = track.keyframes[0]!;
      continue;
    }

    const scaled = clamp01(easedProgress) * (track.keyframes.length - 1);
    const index = Math.min(Math.floor(scaled), track.keyframes.length - 2);
    const localProgress = scaled - index;
    const start = track.keyframes[index]!;
    const end = track.keyframes[index + 1]!;
    values[track.property] = start + (end - start) * localProgress;
  }

  return applyToLayers(targetLayerIds, values);
}

function applyToLayers(
  layerIds: string[],
  values: Record<string, number>,
): InterpolatedValues {
  const result: InterpolatedValues = {};
  for (const id of layerIds) {
    result[id] = { ...values };
  }
  return result;
}

// --- Effect math ---

function computeBounce(t: number): Record<string, number> {
  // Bounce: translateY goes up then back down
  // Peak at t=0.5, return to 0 at t=1
  const y = -Math.sin(t * Math.PI) * 8;
  return { translateY: y };
}

function computePulse(t: number): Record<string, number> {
  // Pulse: scale up then back to 1
  // Peak scale at t=0.5
  const s = 1 + Math.sin(t * Math.PI) * 0.15;
  return { scale: s };
}

function computeRotate(t: number): Record<string, number> {
  // Full 360 rotation over the effect duration
  return { rotate: t * 360 };
}

function computeBreathe(t: number): Record<string, number> {
  // Breathe: opacity pulses between 0.4 and 1.0
  const opacity = 0.4 + Math.sin(t * Math.PI) * 0.6;
  return { opacity };
}

function computeWiggle(t: number): Record<string, number> {
  // Wiggle: small oscillating rotation
  const angle = Math.sin(t * Math.PI * 4) * 12;
  return { rotate: angle };
}

function computeScale(t: number): Record<string, number> {
  // Scale: grow from 1 to 1.2 then back to 1
  const s = 1 + Math.sin(t * Math.PI) * 0.2;
  return { scale: s };
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function resolveEffectProgressController(
  easing: string | SpringConfig | undefined,
  durationMs: number,
): {
  durationMs: number;
  progressAtElapsed: (elapsedMs: number) => number;
} {
  if (typeof easing === 'string' || easing === undefined) {
    const easingFunction = getEasingFunction(easing ?? 'linear');
    return {
      durationMs: Math.max(0, durationMs),
      progressAtElapsed: (elapsedMs) =>
        easingFunction(clamp01(elapsedMs / Math.max(durationMs, 1))),
    };
  }

  const effectiveDurationMs = Math.min(
    Math.max(durationMs, 0),
    estimateSpringDuration(easing),
  );
  return {
    durationMs: effectiveDurationMs,
    progressAtElapsed: (elapsedMs) => springProgress(easing, elapsedMs),
  };
}

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function defaultRequestFrame(callback: FrameRequestCallback): FrameHandle {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(defaultNow()), 16);
}

function defaultCancelFrame(handle: FrameHandle): void {
  if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}

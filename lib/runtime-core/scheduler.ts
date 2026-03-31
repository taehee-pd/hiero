import type { SpringConfig, TimelineTrack } from '../schema';
import { interpolateColor } from './color';
import { getEasingFunction } from './easing';
import { estimateSpringDuration, springProgress } from './spring';
import type { ResolvedLayerBinding, ResolvedTransition } from './transition-resolver';

export type AnimatedValue = number | string;
export type LayerInterpolatedValues = Record<string, AnimatedValue>;
export type InterpolatedValues = Record<string, LayerInterpolatedValues>;
export type FrameCallback = (
  progress: number,
  interpolatedValues: InterpolatedValues,
) => void;
export type CompleteCallback = () => void;
export type FrameHandle = number | ReturnType<typeof setTimeout>;

export type TransitionSchedulerOptions = {
  now?: () => number;
  onFrame?: FrameCallback;
  requestFrame?: (callback: FrameRequestCallback) => FrameHandle;
  cancelFrame?: (handle: FrameHandle) => void;
};

export class BlendScheduler {
  private readonly values: InterpolatedValues;
  private readonly now: () => number;
  private readonly onFrameCallback: FrameCallback;
  private readonly requestFrame: (callback: FrameRequestCallback) => FrameHandle;
  private readonly cancelFrame: (handle: FrameHandle) => void;
  private readonly completeListeners = new Set<CompleteCallback>();
  private readonly durationMs: number;

  private activeHandle: FrameHandle | null = null;
  private startedAt = 0;
  private running = false;

  constructor(
    values: InterpolatedValues,
    durationMs: number,
    options: TransitionSchedulerOptions = {},
  ) {
    this.values = values;
    this.durationMs = Math.max(0, durationMs);
    this.now = options.now ?? defaultNow;
    this.onFrameCallback = options.onFrame ?? (() => {});
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  }

  start(): void {
    if (this.running) {
      this.cancel();
    }

    this.running = true;
    this.startedAt = this.now();
    this.emitFrame(0);

    if (this.durationMs <= 0) {
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

  onComplete(callback: CompleteCallback): () => void {
    this.completeListeners.add(callback);
    return () => {
      this.completeListeners.delete(callback);
    };
  }

  private scheduleNextFrame(): void {
    this.activeHandle = this.requestFrame(() => {
      if (!this.running) {
        return;
      }

      const elapsed = this.now() - this.startedAt;
      const progress = clamp01(elapsed / this.durationMs);
      this.emitFrame(progress);

      if (progress >= 1) {
        this.finish();
        return;
      }

      this.scheduleNextFrame();
    });
  }

  private emitFrame(progress: number): void {
    this.onFrameCallback(progress, blendInterpolatedValues(this.values, progress));
  }

  private finish(): void {
    this.cancel();
    for (const listener of this.completeListeners) {
      listener();
    }
  }
}

export class TransitionScheduler {
  private readonly transition: ResolvedTransition;
  private readonly now: () => number;
  private readonly onFrameCallback: FrameCallback;
  private readonly progressAtElapsed: (elapsedMs: number) => number;
  private readonly effectiveDurationMs: number;
  private readonly requestFrame: (callback: FrameRequestCallback) => FrameHandle;
  private readonly cancelFrame: (handle: FrameHandle) => void;
  private readonly completeListeners = new Set<CompleteCallback>();

  private activeHandle: FrameHandle | null = null;
  private startedAt = 0;
  private running = false;
  private lastProgress = 0;
  private lastInterpolatedValues: InterpolatedValues = {};

  constructor(transition: ResolvedTransition, options: TransitionSchedulerOptions = {}) {
    this.transition = transition;
    this.now = options.now ?? defaultNow;
    this.onFrameCallback = options.onFrame ?? (() => {});
    const { durationMs, progressAtElapsed } = resolveProgressController(
      transition.easing,
      transition.durationMs,
    );
    this.progressAtElapsed = progressAtElapsed;
    this.effectiveDurationMs = durationMs;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  }

  start(): void {
    if (this.running) {
      this.cancel();
    }

    this.running = true;
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

  interrupt(
    blendOutMs: number,
    options: TransitionSchedulerOptions = {},
  ): BlendScheduler | null {
    const capturedValues =
      Object.keys(this.lastInterpolatedValues).length > 0
        ? this.lastInterpolatedValues
        : interpolateTransitionValues(this.transition, this.lastProgress);
    this.cancel();

    if (blendOutMs <= 0 || Object.keys(capturedValues).length === 0) {
      return null;
    }

    return new BlendScheduler(capturedValues, blendOutMs, {
      now: options.now ?? this.now,
      onFrame: options.onFrame,
      requestFrame: options.requestFrame ?? this.requestFrame,
      cancelFrame: options.cancelFrame ?? this.cancelFrame,
    });
  }

  onComplete(callback: CompleteCallback): () => void {
    this.completeListeners.add(callback);
    return () => {
      this.completeListeners.delete(callback);
    };
  }

  private scheduleNextFrame(): void {
    this.activeHandle = this.requestFrame(() => {
      if (!this.running) {
        return;
      }

      const elapsed = this.now() - this.startedAt;
      const progress = this.progressAtElapsed(elapsed);
      this.emitFrame(progress);

      if (elapsed >= this.effectiveDurationMs) {
        this.emitFrame(1);
        this.finish();
        return;
      }

      this.scheduleNextFrame();
    });
  }

  private emitFrame(progress: number): void {
    this.lastProgress = progress;
    this.lastInterpolatedValues = interpolateTransitionValues(this.transition, progress);
    this.onFrameCallback(progress, this.lastInterpolatedValues);
  }

  private finish(): void {
    this.cancel();
    for (const listener of this.completeListeners) {
      listener();
    }
  }
}

export function interpolateTransitionValues(
  transition: ResolvedTransition,
  progress: number,
): InterpolatedValues {
  const easedProgress = applyProgressEasing(
    transition.easing,
    progress,
    transition.durationMs,
  );
  return buildInterpolatedValues(
    transition.layerBindings,
    easedProgress,
    transition.easing,
    transition.durationMs,
  );
}

function buildInterpolatedValues(
  layerBindings: ResolvedLayerBinding[],
  progress: number,
  transitionEasing?: string | SpringConfig,
  transitionDurationMs?: number,
): InterpolatedValues {
  const values: InterpolatedValues = {};

  for (const binding of layerBindings) {
    const layerId = binding.toLayer?.id ?? binding.fromLayer?.id;
    if (!layerId || binding.tracks.length === 0) {
      continue;
    }

    const layerValues = (values[layerId] ??= {});
    for (const track of binding.tracks) {
      const localProgress = localBindingProgress(progress, binding, layerBindings);
      layerValues[track.property] = interpolateTrack(
        track,
        localProgress,
        transitionEasing,
        transitionDurationMs,
      );
    }
  }

  return values;
}

function localBindingProgress(
  globalProgress: number,
  binding: ResolvedLayerBinding,
  allBindings: ResolvedLayerBinding[],
): number {
  const totalMs = Math.max(
    ...allBindings.map(
      (candidate) => (candidate.delayMs ?? 0) + (candidate.durationMs ?? 0),
    ),
    1,
  );
  const elapsed = globalProgress * totalMs;
  const duration = Math.max(binding.durationMs ?? 0, 1);
  return (elapsed - (binding.delayMs ?? 0)) / duration;
}

function interpolateTrack(
  track: TimelineTrack,
  progress: number,
  transitionEasing?: string | SpringConfig,
  transitionDurationMs?: number,
): AnimatedValue {
  const effectiveProgress = resolveTrackProgress(track, progress, transitionEasing, transitionDurationMs);
  if ((track.property as string) === 'fill' || (track.property as string) === 'stroke') {
    return interpolateStringKeyframes(track.keyframes as unknown as string[], effectiveProgress);
  }
  return interpolateNumericKeyframes(track.keyframes, effectiveProgress);
}

/**
 * If the track has its own easing, apply it to override the transition-level easing.
 * The raw progress coming in has already been eased by the transition easing,
 * so we need to "un-ease" and "re-ease" with the track easing.
 * For simplicity, when a track has per-track easing, we treat the incoming
 * progress as raw (0-1 linear) and apply only the track easing.
 */
function resolveTrackProgress(
  track: TimelineTrack,
  progress: number,
  _transitionEasing?: string | SpringConfig,
  _transitionDurationMs?: number,
): number {
  if (!track.easing) return progress;

  if (typeof track.easing === 'string') {
    const easingFn = getEasingFunction(track.easing);
    return easingFn(clamp01(progress));
  }

  // Spring easing on a per-track basis
  const duration = _transitionDurationMs ?? 300;
  return springProgress(track.easing, clamp01(progress) * duration);
}

function interpolateNumericKeyframes(keyframes: number[], progress: number): number {
  if (keyframes.length === 0) {
    return 0;
  }

  if (keyframes.length === 1) {
    return keyframes[0]!;
  }

  const scaled = progress * (keyframes.length - 1);
  const index = resolveSegmentIndex(scaled, keyframes.length);
  const localProgress = scaled - index;
  const start = keyframes[index]!;
  const end = keyframes[index + 1]!;
  return start + (end - start) * localProgress;
}

function interpolateStringKeyframes(keyframes: string[], progress: number): string {
  if (keyframes.length === 0) {
    return '#000000';
  }

  if (keyframes.length === 1) {
    return keyframes[0]!;
  }

  const scaled = clamp(progress, 0, 1) * (keyframes.length - 1);
  const index = resolveSegmentIndex(scaled, keyframes.length);
  const localProgress = clamp(scaled - index, 0, 1);
  const start = keyframes[index]!;
  const end = keyframes[index + 1]!;
  return interpolateColor(start, end, localProgress);
}

function resolveSegmentIndex(scaled: number, keyframeLength: number): number {
  if (scaled <= 0) {
    return 0;
  }
  if (scaled >= keyframeLength - 1) {
    return keyframeLength - 2;
  }
  return Math.floor(scaled);
}

function blendInterpolatedValues(
  values: InterpolatedValues,
  progress: number,
): InterpolatedValues {
  const blended: InterpolatedValues = {};
  for (const [layerId, layerValues] of Object.entries(values)) {
    const nextValues: LayerInterpolatedValues = {};
    for (const [property, value] of Object.entries(layerValues)) {
      nextValues[property] = blendValueToRest(property, value, progress);
    }
    blended[layerId] = nextValues;
  }
  return blended;
}

function blendValueToRest(
  property: string,
  value: AnimatedValue,
  progress: number,
): AnimatedValue {
  if (typeof value === 'string') {
    return value;
  }

  const restValue = getRestValue(property);
  return value + (restValue - value) * clamp01(progress);
}

function getRestValue(property: string): number {
  switch (property) {
    case 'scale':
    case 'opacity':
    case 'pathLength':
    case 'trimEnd':
    case 'variableValue':
      return 1;
    case 'trimStart':
    case 'trimOffset':
      return 0;
    default:
      return 0;
  }
}

function resolveProgressController(
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

  const estimatedDuration = estimateSpringDuration(easing);
  const effectiveDurationMs = Math.min(Math.max(durationMs, 0), estimatedDuration);
  return {
    durationMs: effectiveDurationMs,
    progressAtElapsed: (elapsedMs) => springProgress(easing, elapsedMs),
  };
}

function applyProgressEasing(
  easing: string | SpringConfig | undefined,
  progress: number,
  durationMs: number,
): number {
  if (typeof easing === 'string' || easing === undefined) {
    const easingFunction = getEasingFunction(easing ?? 'linear');
    return easingFunction(clamp01(progress));
  }

  const effectiveDurationMs = Math.min(
    Math.max(durationMs, 0),
    estimateSpringDuration(easing),
  );
  return springProgress(easing, clamp01(progress) * effectiveDurationMs);
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (value <= min) return min;
  if (value >= max) return max;
  return value;
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

  return setTimeout(() => {
    callback(defaultNow());
  }, 16);
}

function defaultCancelFrame(handle: FrameHandle): void {
  if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle);
}

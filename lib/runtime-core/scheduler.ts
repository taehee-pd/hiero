import { getEasingFunction } from './easing';
import type { ResolvedLayerBinding, ResolvedTransition } from './transition-resolver';

export type InterpolatedValues = Record<string, Record<string, number>>;
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

export class TransitionScheduler {
  private readonly transition: ResolvedTransition;
  private readonly now: () => number;
  private readonly onFrameCallback: FrameCallback;
  private readonly easing: (t: number) => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => FrameHandle;
  private readonly cancelFrame: (handle: FrameHandle) => void;
  private readonly completeListeners = new Set<CompleteCallback>();

  private activeHandle: FrameHandle | null = null;
  private startedAt = 0;
  private running = false;

  constructor(transition: ResolvedTransition, options: TransitionSchedulerOptions = {}) {
    this.transition = transition;
    this.now = options.now ?? defaultNow;
    this.onFrameCallback = options.onFrame ?? (() => {});
    this.easing = getEasingFunction(transition.easing);
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

    if (this.transition.durationMs <= 0) {
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
      const progress = clamp01(elapsed / this.transition.durationMs);
      this.emitFrame(progress);

      if (progress >= 1) {
        this.finish();
        return;
      }

      this.scheduleNextFrame();
    });
  }

  private emitFrame(progress: number): void {
    const easedProgress = this.easing(clamp01(progress));
    this.onFrameCallback(
      clamp01(progress),
      buildInterpolatedValues(this.transition.layerBindings, easedProgress),
    );
  }

  private finish(): void {
    this.cancel();
    for (const listener of this.completeListeners) {
      listener();
    }
  }
}

function buildInterpolatedValues(
  layerBindings: ResolvedLayerBinding[],
  progress: number,
): InterpolatedValues {
  const values: InterpolatedValues = {};

  for (const binding of layerBindings) {
    const layerId = binding.toLayer?.id ?? binding.fromLayer?.id;
    if (!layerId || binding.tracks.length === 0) {
      continue;
    }

    const layerValues = (values[layerId] ??= {});
    for (const track of binding.tracks) {
      layerValues[track.property] = interpolateKeyframes(track.keyframes, progress);
    }
  }

  return values;
}

function interpolateKeyframes(keyframes: number[], progress: number): number {
  if (keyframes.length === 0) {
    return 0;
  }

  if (keyframes.length === 1) {
    return keyframes[0]!;
  }

  const scaled = clamp01(progress) * (keyframes.length - 1);
  const index = Math.min(Math.floor(scaled), keyframes.length - 2);
  const localProgress = scaled - index;
  const start = keyframes[index]!;
  const end = keyframes[index + 1]!;
  return start + (end - start) * localProgress;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
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

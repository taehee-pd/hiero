import type { DomRenderer } from '@/lib/runtime-dom';
import type { Effect } from '@/lib/schema/types';

export class EffectPlayer {
  private rafId: number | null = null;
  private startTime = 0;
  private elapsedBeforePause = 0;
  private speed = 1;
  private playing = false;
  private completedLoops = 0;
  private readonly baseStateId: string;

  constructor(
    private readonly effect: Effect,
    private readonly renderer: DomRenderer,
  ) {
    const variant = (renderer as unknown as { variant?: { defaultState: string } }).variant;
    this.baseStateId = variant?.defaultState ?? 'default';
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    const now = performance.now();
    this.startTime = now - this.elapsedBeforePause;
    this.schedule();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  stop(): void {
    this.pause();
    this.elapsedBeforePause = 0;
    this.completedLoops = 0;
    this.seek(0);
  }

  seek(t: number): void {
    const clamped = clamp01(t);
    this.applyProgress(clamped);
    this.elapsedBeforePause = clamped * this.effect.durationMs;
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(multiplier, 0.01);
  }

  private schedule(): void {
    this.rafId = requestAnimationFrame((timestamp) => {
      if (!this.playing) return;

      const delay = this.effect.delay ?? 0;
      const elapsedRaw = (timestamp - this.startTime) * this.speed;
      if (elapsedRaw < delay) {
        this.schedule();
        return;
      }

      const elapsed = elapsedRaw - delay;
      const duration = Math.max(this.effect.durationMs, 1);
      const loopIndex = Math.floor(elapsed / duration);
      const loopProgress = (elapsed % duration) / duration;
      this.elapsedBeforePause = elapsedRaw;

      const repeat = this.effect.repeat ?? 0;
      const maxLoops = repeat === 'infinite' ? Number.POSITIVE_INFINITY : repeat + 1;
      if (loopIndex >= maxLoops) {
        this.completedLoops = maxLoops;
        this.applyProgress(this.resolveDirectionalProgress(1, maxLoops - 1));
        this.pause();
        return;
      }

      this.completedLoops = loopIndex;
      this.applyProgress(this.resolveDirectionalProgress(loopProgress, loopIndex));
      this.schedule();
    });
  }

  private resolveDirectionalProgress(progress: number, loopIndex: number): number {
    const direction = this.effect.direction ?? 'normal';
    if (direction === 'reverse') {
      return 1 - progress;
    }
    if (direction === 'alternate') {
      return loopIndex % 2 === 0 ? progress : 1 - progress;
    }
    return progress;
  }

  private applyProgress(progress: number): void {
    const layerIds = this.getLayerIds();
    const values = buildInterpolatedValues(this.effect.kind, progress, layerIds);
    this.renderer.applyFrame(this.baseStateId, progress, values);
  }

  private getLayerIds(): string[] {
    const entries = (this.renderer as unknown as { layerElements?: Map<string, unknown> }).layerElements;
    if (entries && typeof entries.keys === 'function') {
      return Array.from(entries.keys());
    }
    return [];
  }
}

function buildInterpolatedValues(
  kind: Effect['kind'],
  t: number,
  layerIds: string[],
): Record<string, Record<string, number>> {
  const easedSin = Math.sin(t * Math.PI);
  const wave = Math.sin(t * Math.PI * 2);
  const values: Record<string, Record<string, number>> = {};

  for (const layerId of layerIds) {
    const v: Record<string, number> = {};

    switch (kind) {
      case 'bounce':
        v.scale = 1 + 0.18 * easedSin;
        break;
      case 'pulse':
      case 'breathe':
        v.scale = 1 + 0.08 * wave;
        break;
      case 'wiggle':
        v.rotate = 8 * wave;
        break;
      case 'rotate':
        v.rotate = 360 * t;
        break;
      case 'lineDrawOn':
        v.pathLength = t;
        break;
      case 'lineDrawOff':
        v.pathLength = 1 - t;
        break;
      case 'appear':
        v.opacity = t;
        v.scale = 0.92 + 0.08 * t;
        break;
      case 'disappear':
        v.opacity = 1 - t;
        v.scale = 1 - 0.08 * t;
        break;
      case 'variableColor':
        v.opacity = 0.65 + 0.35 * (0.5 + 0.5 * wave);
        break;
      case 'scale':
        v.scale = 1 + 0.1 * wave;
        break;
      default:
        break;
    }

    values[layerId] = v;
  }

  return values;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

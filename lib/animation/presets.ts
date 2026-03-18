import type { Effect } from '@/lib/schema/types';

export type PresetOptions = {
  durationMs?: number;
  easing?: Effect['easing'];
  delay?: number;
  repeat?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
};

function withBase(effect: Effect, options?: PresetOptions): Effect {
  return {
    ...effect,
    durationMs: options?.durationMs ?? effect.durationMs,
    easing: options?.easing ?? effect.easing,
    delay: options?.delay ?? 0,
    repeat: options?.repeat ?? 0,
    direction: options?.direction ?? 'normal',
  };
}

function createId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const animationPresets = {
  bounce(options?: PresetOptions): Effect {
    return withBase({ id: createId('bounce'), kind: 'bounce', durationMs: 550, easing: 'ease-out' }, options);
  },
  pulse(options?: PresetOptions): Effect {
    return withBase({ id: createId('pulse'), kind: 'pulse', durationMs: 900, easing: 'ease-in-out' }, options);
  },
  wiggle(options?: PresetOptions): Effect {
    return withBase({ id: createId('wiggle'), kind: 'wiggle', durationMs: 650, easing: 'ease-in-out' }, options);
  },
  rotate(options?: PresetOptions): Effect {
    return withBase({ id: createId('rotate'), kind: 'rotate', durationMs: 1200, easing: 'linear' }, options);
  },
  breathe(options?: PresetOptions): Effect {
    return withBase({ id: createId('breathe'), kind: 'breathe', durationMs: 1500, easing: 'ease-in-out' }, options);
  },
  drawOn(options?: PresetOptions): Effect {
    return withBase({ id: createId('draw-on'), kind: 'lineDrawOn', durationMs: 1000, easing: 'ease-out' }, options);
  },
  drawOff(options?: PresetOptions): Effect {
    return withBase({ id: createId('draw-off'), kind: 'lineDrawOff', durationMs: 1000, easing: 'ease-in' }, options);
  },
  appear(options?: PresetOptions): Effect {
    return withBase({ id: createId('appear'), kind: 'appear', durationMs: 350, easing: 'ease-out' }, options);
  },
  disappear(options?: PresetOptions): Effect {
    return withBase({ id: createId('disappear'), kind: 'disappear', durationMs: 300, easing: 'ease-in' }, options);
  },
  variableColor(options?: PresetOptions): Effect {
    return withBase({ id: createId('variable-color'), kind: 'variableColor', durationMs: 1400, easing: 'linear' }, options);
  },
};

export const PRESET_CARDS: Array<{ key: keyof typeof animationPresets; label: string; description: string }> = [
  { key: 'bounce', label: 'Bounce', description: 'Scale up then settle' },
  { key: 'pulse', label: 'Pulse', description: 'Rhythmic scale oscillation' },
  { key: 'wiggle', label: 'Wiggle', description: 'Rotation oscillation' },
  { key: 'rotate', label: 'Rotate', description: 'Continuous/partial rotation' },
  { key: 'breathe', label: 'Breathe', description: 'Smooth scale in/out' },
  { key: 'drawOn', label: 'Draw On', description: 'Path reveal 0 → 1' },
  { key: 'drawOff', label: 'Draw Off', description: 'Path hide 1 → 0' },
  { key: 'appear', label: 'Appear', description: 'Opacity in + optional scale' },
  { key: 'disappear', label: 'Disappear', description: 'Opacity out + optional scale' },
  { key: 'variableColor', label: 'Variable Color', description: 'Cycle through palette colors' },
];

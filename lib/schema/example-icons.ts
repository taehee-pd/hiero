/**
 * B1 — bundled example icons (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * Remixable starter content that demonstrates Hiero's differentiators
 * in the first session, without reading docs:
 *
 *   - Play ⇄ Pause      cross-icon morph transition (autoMorph)
 *   - Check             draw-on effect (trim-path reveal on an open path)
 *   - Activity          slide-mode draw effect on a longer open path
 *
 * They ship inside the starter project AND can be re-inserted into any
 * project via the command palette ("Add example icons"). All geometry
 * is original or Lucide-derived (ISC/MIT-compatible), 24×24 stroke
 * icons matching the starter set's style.
 */

import { normalizeVariant, type Icon, type Layer } from './types';

const STROKE_STYLE: Layer['style'] = {
  fill: { mode: 'fixed', value: 'none' },
  stroke: { mode: 'currentColor' },
  strokeWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
};

function strokeLayer(id: string, d: string, role: Layer['role'] = 'primary'): Layer {
  return {
    id,
    role,
    visible: true,
    path: { d },
    style: { ...STROKE_STYLE },
  } as Layer;
}

export const EXAMPLE_PLAY_ICON: Icon = {
  id: 'example-play',
  name: 'Play (morph demo)',
  category: 'examples',
  tags: ['example', 'play', 'media', 'morph'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      name: '24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      guideMasterId: 'preset-24',
      layers: {
        triangle: strokeLayer('triangle', 'M6 4 L20 12 L6 20 Z'),
      },
    }),
  },
  transitions: {
    'to-pause': {
      id: 'to-pause',
      fromIconId: 'example-play',
      toIconId: 'example-pause',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      strategy: 'auto',
      duration: 0.3,
      durationMs: 300,
      cadence: 'soft',
    },
  },
};

export const EXAMPLE_PAUSE_ICON: Icon = {
  id: 'example-pause',
  name: 'Pause (morph demo)',
  category: 'examples',
  tags: ['example', 'pause', 'media', 'morph'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      name: '24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      guideMasterId: 'preset-24',
      layers: {
        'bar-left': strokeLayer('bar-left', 'M7 5 L10 5 L10 19 L7 19 Z'),
        'bar-right': strokeLayer('bar-right', 'M14 5 L17 5 L17 19 L14 19 Z', 'secondary'),
      },
    }),
  },
  transitions: {
    'to-play': {
      id: 'to-play',
      fromIconId: 'example-pause',
      toIconId: 'example-play',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      strategy: 'auto',
      duration: 0.3,
      durationMs: 300,
      cadence: 'soft',
    },
  },
};

export const EXAMPLE_CHECK_ICON: Icon = {
  id: 'example-check',
  name: 'Check (draw-on demo)',
  category: 'examples',
  tags: ['example', 'check', 'draw', 'success'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      name: '24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      guideMasterId: 'preset-24',
      layers: {
        check: strokeLayer('check', 'M4 12.5 L9.5 18 L20 6'),
      },
    }),
  },
  effects: {
    'draw-on': {
      id: 'draw-on',
      kind: 'draw',
      durationMs: 600,
      easing: 'ease-out',
      drawConfig: { mode: 'reveal' },
    },
  },
};

export const EXAMPLE_ACTIVITY_ICON: Icon = {
  id: 'example-activity',
  name: 'Activity (draw slide demo)',
  category: 'examples',
  tags: ['example', 'activity', 'draw', 'pulse'],
  variants: {
    v24: normalizeVariant({
      id: 'v24',
      name: '24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      guideMasterId: 'preset-24',
      layers: {
        pulse: strokeLayer('pulse', 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'),
      },
    }),
  },
  effects: {
    'draw-slide': {
      id: 'draw-slide',
      kind: 'draw',
      durationMs: 1200,
      repeat: 'infinite',
      drawConfig: { mode: 'slide', windowSize: 0.25 },
    },
  },
};

/** Insertion order matters: morph pair first so the pair reads as a unit. */
export const EXAMPLE_ICONS: Icon[] = [
  EXAMPLE_PLAY_ICON,
  EXAMPLE_PAUSE_ICON,
  EXAMPLE_CHECK_ICON,
  EXAMPLE_ACTIVITY_ICON,
];

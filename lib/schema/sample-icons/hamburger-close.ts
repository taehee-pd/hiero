import type { Icon } from '../types';

const SHARED_STROKE_STYLE = {
  fill: { mode: 'fixed', value: 'none' } as const,
  stroke: { mode: 'currentColor' } as const,
  strokeWidth: 2,
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
};

export const HAMBURGER_CLOSE_ICON: Icon = {
  id: 'hamburger-close',
  name: 'Hamburger Close',
  category: 'navigation',
  tags: ['menu', 'close', 'toggle'],
  variants: {
    '24': {
      id: '24',
      size: 24,
      viewBox: [0, 0, 24, 24],
      defaultState: 'open',
      states: {
        open: {
          id: 'open',
          layers: {
            top: {
              id: 'top',
              path: { d: 'M5 7H19' },
              style: SHARED_STROKE_STYLE,
            },
            middle: {
              id: 'middle',
              path: { d: 'M5 12H19' },
              style: SHARED_STROKE_STYLE,
            },
            bottom: {
              id: 'bottom',
              path: { d: 'M5 17H19' },
              style: SHARED_STROKE_STYLE,
            },
          },
        },
        closed: {
          id: 'closed',
          layers: {
            top: {
              id: 'top',
              path: { d: 'M6 6L18 18' },
              style: SHARED_STROKE_STYLE,
              transform: { rotate: 45, y: 5 },
            },
            middle: {
              id: 'middle',
              visible: false,
              path: { d: 'M5 12H19' },
              style: SHARED_STROKE_STYLE,
            },
            bottom: {
              id: 'bottom',
              path: { d: 'M6 18L18 6' },
              style: SHARED_STROKE_STYLE,
              transform: { rotate: -45, y: -5 },
            },
          },
        },
      },
    },
  },
  transitions: {
    'open-to-closed': {
      id: 'open-to-closed',
      from: 'open',
      to: 'closed',
      strategy: 'track',
      durationMs: 300,
      easing: 'ease-in-out',
      layerBindings: [
        {
          fromLayerId: 'top',
          toLayerId: 'top',
          tracks: [
            { property: 'rotate', keyframes: [0, 45] },
            { property: 'translateY', keyframes: [0, 5] },
          ],
        },
        {
          fromLayerId: 'middle',
          toLayerId: 'middle',
          tracks: [{ property: 'opacity', keyframes: [1, 0] }],
        },
        {
          fromLayerId: 'bottom',
          toLayerId: 'bottom',
          tracks: [
            { property: 'rotate', keyframes: [0, -45] },
            { property: 'translateY', keyframes: [0, -5] },
          ],
        },
      ],
    },
    'closed-to-open': {
      id: 'closed-to-open',
      from: 'closed',
      to: 'open',
      strategy: 'track',
      durationMs: 300,
      easing: 'ease-in-out',
      layerBindings: [
        {
          fromLayerId: 'top',
          toLayerId: 'top',
          tracks: [
            { property: 'rotate', keyframes: [45, 0] },
            { property: 'translateY', keyframes: [5, 0] },
          ],
        },
        {
          fromLayerId: 'middle',
          toLayerId: 'middle',
          tracks: [{ property: 'opacity', keyframes: [0, 1] }],
        },
        {
          fromLayerId: 'bottom',
          toLayerId: 'bottom',
          tracks: [
            { property: 'rotate', keyframes: [-45, 0] },
            { property: 'translateY', keyframes: [-5, 0] },
          ],
        },
      ],
    },
  },
};

import type { Project } from './types';

/**
 * Sample project with a simple chevron-right icon for dev/testing.
 * Three layers: outer circle background, chevron stroke, and a small dot accent.
 */
export const SAMPLE_PROJECT: Project = {
  version: '1.0',
  meta: {
    name: 'Icophone Starter',
    createdAt: '2026-03-03T00:00:00Z',
    updatedAt: '2026-03-03T00:00:00Z',
  },
  icons: {
    'icon-chevron': {
      id: 'icon-chevron',
      name: 'Chevron Right',
      category: 'navigation',
      tags: ['arrow', 'chevron', 'right'],
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          defaultState: 'default',
        },
      },
      states: {
        default: {
          id: 'default',
          layers: {
            'bg-circle': {
              id: 'bg-circle',
              role: 'secondary',
              visible: true,
              path: {
                d: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Z',
              },
              style: {
                fill: { mode: 'fixed', value: '#1e293b' },
                fillOpacity: 1,
              },
            },
            chevron: {
              id: 'chevron',
              role: 'primary',
              visible: true,
              path: {
                d: 'M9.5 7l5 5-5 5',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
            'accent-dot': {
              id: 'accent-dot',
              role: 'tertiary',
              visible: true,
              path: {
                d: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
              },
              style: {
                fill: { mode: 'fixed', value: '#38bdf8' },
                fillOpacity: 0.8,
              },
            },
          },
        },
      },
      transitions: {},
    },
    'icon-play': {
      id: 'icon-play',
      name: 'Play',
      category: 'media',
      tags: ['play', 'media', 'start'],
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          defaultState: 'default',
        },
      },
      states: {
        default: {
          id: 'default',
          layers: {
            triangle: {
              id: 'triangle',
              role: 'primary',
              visible: true,
              path: {
                d: 'M6.5 4.268a1 1 0 0 1 1.5-.866l11 6.732a1 1 0 0 1 0 1.732l-11 6.732a1 1 0 0 1-1.5-.866V4.268Z',
              },
              style: {
                fill: { mode: 'currentColor' },
              },
            },
          },
        },
      },
      transitions: {},
    },
  },
  tokenSet: {
    colors: {
      primary: '#e2e8f0',
      accent: '#38bdf8',
    },
  },
};

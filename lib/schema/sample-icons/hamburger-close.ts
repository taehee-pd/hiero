import { withLegacyVariantStateView, type Icon, type LayerBinding } from '../types';

const SHARED_STROKE_STYLE = {
  fill: { mode: 'fixed', value: 'none' } as const,
  stroke: { mode: 'currentColor' } as const,
  strokeWidth: 2,
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
};

/**
 * Hamburger/Close icon with two variant poses (open, closed).
 * Transition configs are exported separately as they are runtime-owned.
 */
export const HAMBURGER_CLOSE_ICON: Icon = {
  id: 'hamburger-close',
  name: 'Hamburger Close',
  category: 'navigation',
  tags: ['menu', 'close', 'toggle'],
  variants: {
    '24-open': withLegacyVariantStateView({
      id: '24-open',
      size: 24,
      viewBox: [0, 0, 24, 24],
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
    }),
    '24-closed': withLegacyVariantStateView({
      id: '24-closed',
      size: 24,
      viewBox: [0, 0, 24, 24],
      layers: {
        top: {
          id: 'top',
          path: { d: 'M5 7H19' },
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
          path: { d: 'M5 17H19' },
          style: SHARED_STROKE_STYLE,
          transform: { rotate: -45, y: -5 },
        },
      },
    }),
  },
};

/** Layer bindings for open-to-closed transition (runtime-owned). */
export const HAMBURGER_CLOSE_BINDINGS: LayerBinding[] = [
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
];

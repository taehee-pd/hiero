import { withLegacyVariantStateView, type Project } from './types';
import { createWorkspaceFromProject } from './workspace';

/**
 * Sample project with popular Lucide icons for dev/testing.
 * Each icon uses official Lucide SVG paths (24x24 viewBox, stroke-based).
 */
const BASE_SAMPLE_PROJECT: Project = {
  version: '1.0',
  meta: {
    name: 'Coniva Starter',
    createdAt: '2026-03-03T00:00:00Z',
    updatedAt: '2026-03-03T00:00:00Z',
  },
  icons: {
    'icon-home': {
      id: 'icon-home',
      name: 'Home',
      category: 'general',
      tags: ['home', 'house', 'main'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            roof: {
              id: 'roof',
              role: 'primary',
              visible: true,
              path: { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
            house: {
              id: 'house',
              role: 'primary',
              visible: true,
              path: {
                d: 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
    'icon-search': {
      id: 'icon-search',
      name: 'Search',
      category: 'general',
      tags: ['search', 'find', 'magnify'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            circle: {
              id: 'circle',
              role: 'primary',
              visible: true,
              path: { d: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z' },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
            handle: {
              id: 'handle',
              role: 'primary',
              visible: true,
              path: { d: 'm21 21-4.3-4.3' },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
    'icon-heart': {
      id: 'icon-heart',
      name: 'Heart',
      category: 'general',
      tags: ['heart', 'love', 'favorite'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            heart: {
              id: 'heart',
              role: 'primary',
              visible: true,
              path: {
                d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
    'icon-bell': {
      id: 'icon-bell',
      name: 'Bell',
      category: 'communication',
      tags: ['bell', 'notification', 'alert'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            bell: {
              id: 'bell',
              role: 'primary',
              visible: true,
              path: {
                d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
            clapper: {
              id: 'clapper',
              role: 'secondary',
              visible: true,
              path: { d: 'M13.73 21a2 2 0 0 1-3.46 0' },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
    'icon-settings': {
      id: 'icon-settings',
      name: 'Settings',
      category: 'general',
      tags: ['settings', 'gear', 'cog', 'preferences'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            gear: {
              id: 'gear',
              role: 'primary',
              visible: true,
              path: {
                d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
            center: {
              id: 'center',
              role: 'secondary',
              visible: true,
              path: {
                d: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
    'icon-star': {
      id: 'icon-star',
      name: 'Star',
      category: 'general',
      tags: ['star', 'favorite', 'rating'],
      variants: {
        v24: withLegacyVariantStateView({
          id: 'v24',
          name: '24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          guideMasterId: 'preset-24',
          layers: {
            star: {
              id: 'star',
              role: 'primary',
              visible: true,
              path: {
                d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a.53.53 0 0 0 .4.29l5.16.756a.53.53 0 0 1 .294.904l-3.733 3.638a.53.53 0 0 0-.152.469l.882 5.14a.53.53 0 0 1-.77.56l-4.613-2.426a.53.53 0 0 0-.494 0L7.148 18.73a.53.53 0 0 1-.77-.56l.882-5.14a.53.53 0 0 0-.152-.47L3.376 8.924a.53.53 0 0 1 .294-.904l5.16-.756a.53.53 0 0 0 .4-.29z',
              },
              style: {
                fill: { mode: 'fixed', value: 'none' },
                stroke: { mode: 'currentColor' },
                strokeWidth: 2,
                lineCap: 'round',
                lineJoin: 'round',
              },
            },
          },
        }),
      },
    },
  },
  tokenSet: {
    colors: {
      primary: '#e2e8f0',
      accent: '#38bdf8',
    },
  },
};

export const SAMPLE_PROJECT: Project = BASE_SAMPLE_PROJECT;

export const SAMPLE_WORKSPACE = createWorkspaceFromProject(SAMPLE_PROJECT, 'starter');

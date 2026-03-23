import { exportRuntimeIconVariant } from '@/lib/export/export-runtime-json';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';

const runtimeProject = structuredClone(SAMPLE_PROJECT);
const runtimeIcon = runtimeProject.icons['icon-home']!;
const runtimeVariant = runtimeIcon.variants.v24;
const defaultState = runtimeVariant.states.default;

runtimeVariant.states.active = {
  ...structuredClone(defaultState),
  id: 'active',
  layers: {
    ...structuredClone(defaultState.layers),
    roof: {
      ...structuredClone(defaultState.layers.roof),
      path: {
        d: 'M7 5l7 7-7 7',
      },
    },
  },
};

runtimeIcon.customGuides = [
  { kind: 'drawPoint', layerId: 'roof', t: 0, direction: 'forward' },
  { kind: 'drawPoint', layerId: 'roof', t: 1, direction: 'forward' },
];

runtimeIcon.transitions = {
  activate: {
    id: 'activate',
    from: 'default',
    to: 'active',
    strategy: 'track',
    durationMs: 220,
    easing: 'ease-in-out',
    layerBindings: [
      {
        fromLayerId: 'roof',
        toLayerId: 'roof',
        tracks: [
          { property: 'opacity', keyframes: [0.35, 1] },
          { property: 'translateX', keyframes: [-1.5, 0] },
          { property: 'pathLength', keyframes: [0.15, 1] },
        ],
      },
    ],
  },
  reset: {
    id: 'reset',
    from: 'active',
    to: 'default',
    strategy: 'replace',
    durationMs: 180,
    easing: 'ease-out',
    layerBindings: [],
  },
};

runtimeIcon.effects = {
  pulse: {
    id: 'pulse',
    kind: 'pulse',
    durationMs: 360,
    easing: 'ease-in-out',
  },
  drawOn: {
    id: 'drawOn',
    kind: 'lineDrawOn',
    durationMs: 320,
    easing: 'ease-out',
  },
};

export const SAMPLE_RUNTIME_EXPORT = exportRuntimeIconVariant(
  runtimeProject,
  runtimeIcon.id,
  runtimeVariant.id,
);

export const SAMPLE_RUNTIME_PAYLOAD = SAMPLE_RUNTIME_EXPORT.variant;

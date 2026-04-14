import { exportRuntimeIconVariant } from '@/lib/export/export-runtime-json';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';

const runtimeProject = structuredClone(SAMPLE_PROJECT);
const runtimeIcon = runtimeProject.icons['icon-home']!;
const runtimeVariant = runtimeIcon.variants.v24;
const defaultType = runtimeVariant.types!.default;

runtimeVariant.types!.active = {
  ...structuredClone(defaultType),
  id: 'active',
  layers: {
    ...structuredClone(defaultType.layers),
    roof: {
      ...structuredClone(defaultType.layers.roof),
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
    fromIconId: runtimeIcon.id,
    toIconId: runtimeIcon.id,
    fromVariantId: runtimeVariant.id,
    toVariantId: runtimeVariant.id,
    from: 'default',
    to: 'active',
    strategy: 'lineAnimation',
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
    fromIconId: runtimeIcon.id,
    toIconId: runtimeIcon.id,
    fromVariantId: runtimeVariant.id,
    toVariantId: runtimeVariant.id,
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

const defaultExport = exportRuntimeIconVariant(
  runtimeProject,
  runtimeIcon.id,
  runtimeVariant.id,
);

const activeProject = structuredClone(runtimeProject);
activeProject.icons[runtimeIcon.id]!.variants[runtimeVariant.id]!.layers =
  structuredClone(runtimeVariant.types!.active!.layers);
const activeExport = exportRuntimeIconVariant(
  activeProject,
  runtimeIcon.id,
  runtimeVariant.id,
);

export const SAMPLE_RUNTIME_EXPORT = {
  ...defaultExport,
  variant: {
    ...defaultExport.variant,
    types: {
      default: { layers: defaultExport.variant.layers },
      active: { layers: activeExport.variant.layers },
    },
  },
};

export const SAMPLE_RUNTIME_PAYLOAD = SAMPLE_RUNTIME_EXPORT.variant;

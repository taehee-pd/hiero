import type { SpringConfig } from '@/lib/schema/types';

export const COMPILED_ICON_SCHEMA_URI =
  'https://hiero.dev/schemas/compiled-icon/1.0.0' as const;
export const PACKAGE_MANIFEST_SCHEMA_URI =
  'https://hiero.dev/schemas/manifest/1.0.0' as const;
export const ICON_CHANGE_RECORD_SCHEMA_URI =
  'https://hiero.dev/schemas/change-record/1.0.0' as const;

export type CompiledRenderingMode =
  | 'monochrome'
  | 'hierarchical'
  | 'palette'
  | 'multicolor';

export type CompiledTransitionStrategy =
  | 'track'
  | 'strictMorph'
  | 'bestGuessMorph'
  | 'replace';

export type CompiledTrackProperty =
  | 'opacity'
  | 'rotate'
  | 'translateX'
  | 'translateY'
  | 'scale'
  | 'pathLength'
  | 'trimStart'
  | 'trimEnd'
  | 'trimOffset';

export type CompiledEffectKind =
  | 'bounce'
  | 'pulse'
  | 'breathe'
  | 'wiggle'
  | 'rotate'
  | 'scale'
  | 'variableColor'
  | 'lineDrawOn'
  | 'lineDrawOff'
  | 'draw'
  | 'custom';

export type CompiledIcon = {
  $schema: typeof COMPILED_ICON_SCHEMA_URI;
  id: string;
  name: string;
  componentName: string;
  meta: {
    category: string;
    tags: string[];
    updatedAt: string;
    version: string;
    contentHash: string;
  };
  variants: Record<string, CompiledVariant>;
  transitions: CompiledTransition[];
  effects: CompiledEffect[];
};

export type CompiledVariant = {
  size: number;
  viewBox: [number, number, number, number];
  layers: CompiledLayerSet;
};

export type CompiledLayerSet = {
  layers: CompiledLayer[];
};

export type CompiledLayer = {
  id: string;
  role: string;
  path: {
    d: string;
    fillRule?: 'nonzero' | 'evenodd';
  };
  style: {
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
  transform?: {
    x: number;
    y: number;
    rotate: number;
    scaleX: number;
    scaleY: number;
  };
};

export type CompiledTransition = {
  from: string;
  to: string;
  durationMs: number;
  easing: string | SpringConfig;
  strategy: CompiledTransitionStrategy;
  bindings: CompiledLayerBinding[];
};

export type CompiledLayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: Array<{
    property: CompiledTrackProperty;
    keyframes: number[] | string[];
  }>;
  morph?: {
    topology: 'strict' | 'bestGuess';
  };
};

export type CompiledEffect = {
  kind: CompiledEffectKind;
  durationMs: number;
  easing: string | SpringConfig;
  params?: Record<string, number | string | boolean>;
};

export type PackageManifest = {
  $schema: typeof PACKAGE_MANIFEST_SCHEMA_URI;
  package: {
    name: string;
    version: string;
    builtAt: string;
    iconSchemaVersion: string;
    iconCount: number;
    gitSha?: string;
    gitBranch?: string;
  };
  icons: Record<string, IconEntry>;
  collections: Record<string, CollectionEntry>;
};

export type IconEntry = {
  id: string;
  name: string;
  componentName: string;
  category: string;
  tags: string[];
  version: string;
  updatedAt: string;
  contentHash: string;
  supportedSizes: number[];
  supportedModes: CompiledRenderingMode[];
  hasAnimation: boolean;
  hasMorphTransition: boolean;
  compiledPath: string;
};

export type CollectionEntry = {
  name: string;
  description?: string;
  iconIds: string[];
};

export type IconVersionBump = 'major' | 'minor' | 'patch';

export type IconChangeKind =
  | 'geometry'
  | 'style'
  | 'state-added'
  | 'state-removed'
  | 'variant-added'
  | 'variant-removed'
  | 'mode-added'
  | 'mode-removed'
  | 'animation-added'
  | 'animation-changed'
  | 'animation-removed'
  | 'effect-added'
  | 'effect-removed'
  | 'metadata'
  | 'breaking';

export type IconChangeRecord = {
  $schema: typeof ICON_CHANGE_RECORD_SCHEMA_URI;
  iconId: string;
  iconName: string;
  componentName: string;
  fromVersion: string;
  toVersion: string;
  publishedAt: string;
  bump: IconVersionBump;
  isBreaking: boolean;
  designerNote?: string;
  changes: IconChange[];
};

export type IconChange = {
  kind: IconChangeKind;
  summary: string;
  breaking: boolean;
  scope?: {
    variantSize?: number;
    stateId?: string;
    layerId?: string;
    renderingMode?: CompiledRenderingMode;
    effectKind?: CompiledEffectKind;
  };
};

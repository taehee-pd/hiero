// Coniva Schema Types — canonical data model for icon projects.
// All geometry is stored as SVG path `d` strings.

// ---------------------------------------------------------------------------
// Internal runtime adapter — NOT a product concept.
// Used at the runtime boundary to bridge variant layers to transition resolver.
// ---------------------------------------------------------------------------
export type LayerSnapshot = {
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};

export type State = {
  id: string;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};

function buildDefaultLegacyState(v: Variant): State {
  const fallbackState = Object.values(v.states ?? {})[0];
  return {
    id: v.defaultState ?? fallbackState?.id ?? 'default',
    layers: v.layers ?? fallbackState?.layers ?? {},
    topology: v.topology ?? fallbackState?.topology,
  };
}

export function getVariantDefaultStateId(v: Variant): string {
  return v.defaultState ?? Object.keys(v.states ?? {})[0] ?? 'default';
}

export function getVariantState(v: Variant, stateId?: string | null): State {
  const resolvedStateId = stateId ?? getVariantDefaultStateId(v);
  const state = v.states?.[resolvedStateId];
  if (state) {
    return {
      ...state,
      topology: state.topology ?? v.topology,
    };
  }
  return buildDefaultLegacyState(v);
}

export function withLegacyVariantStateView(v: Variant): Variant {
  const defaultState = getVariantDefaultStateId(v);
  const defaultStateView = v.states?.[defaultState];
  const fallbackState = Object.values(v.states ?? {})[0];
  const normalizedLayers =
    v.layers ?? defaultStateView?.layers ?? fallbackState?.layers ?? {};
  const normalizedTopology =
    v.topology ?? defaultStateView?.topology ?? fallbackState?.topology;
  return {
    ...v,
    layers: normalizedLayers,
    topology: normalizedTopology,
    defaultState,
    states: {
      ...(v.states ?? {}),
      [defaultState]: {
        ...(defaultStateView ?? {}),
        id: defaultState,
        layers: normalizedLayers,
        topology: normalizedTopology,
      },
    },
  };
}

/** Convert a flat Variant into a LayerSnapshot for runtime functions. */
export function variantToSnapshot(v: Variant, stateId?: string | null): LayerSnapshot {
  const state = getVariantState(v, stateId);
  return { layers: state.layers, topology: state.topology };
}

// ---------------------------------------------------------------------------
// Workspace & Project
// ---------------------------------------------------------------------------

export type IconSet = {
  version: '1.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  icons: Record<string, Icon>;
  guideMasters?: Record<string, GuideMaster>;
  tokenSet?: TokenSet;
  exportProfiles?: ExportProfile[];
  collections?: Record<string, Collection>;
};

export type Project = IconSet;

export type Workspace = {
  version: '2.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  iconSets: Record<string, IconSet>;
  activeIconSetId?: string;
};

// ---------------------------------------------------------------------------
// Icon & Variant
// ---------------------------------------------------------------------------

export type IconExternalImportMeta = {
  adapterId: string;
  sourceLibrary?: string;
  sourceVersion?: string;
  sourceIconId?: string;
  sourceLicense?: string;
  importedAt: string;
};

export type Icon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  customGuides?: GuideItem[];
  variants: Record<string, Variant>;
  transitions?: Record<string, Transition>;
  effects?: Record<string, Effect>;
  components?: Record<string, SymbolComponent>;
  meta?: {
    externalImport?: IconExternalImportMeta;
    /** Derivation specs for derived variants (Phase N). */
    derivedSpecs?: import('./variant-derivation').DerivedVariantSpec[];
  };
};

export type Variant = {
  id: string;
  name?: string;
  size: number;
  viewBox: [number, number, number, number];
  renderingMode?: RenderingMode;
  guideMasterId?: string;
  weight?: SymbolWeight;
  scale?: SymbolScale;
  style?: 'outline' | 'fill' | 'slash' | 'circle' | 'square' | 'badge' | string;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
  /** Compatibility-only state view for partially migrated modules and tests. */
  defaultState?: string;
  /** Compatibility-only state view for partially migrated modules and tests. */
  states?: Record<string, State>;
  variableValue?: number;  // 0.0-1.0, controls progressive layer fill
  weightControlPoints?: {
    ultralight?: string;  // SVG d string
    thin?: string;
    light?: string;
    regular?: string;
    medium?: string;
    semibold?: string;
    bold?: string;
    heavy?: string;
    black?: string;
  };
};

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export type Layer = {
  id: string;
  role?: 'primary' | 'secondary' | 'tertiary' | string;
  visible?: boolean;
  clipPathLayerId?: string;
  isClipMask?: boolean;
  groupId?: string;
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };
  style: {
    fill?: PaintRef;
    stroke?: PaintRef;
    strokeWidth?: number;
    fillOpacity?: number;
    strokeOpacity?: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
  transform?: {
    x?: number;
    y?: number;
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
  };
  importMeta?: SvgImportLayerMeta;
};

export type SvgImportLayerMeta = {
  sourceTag:
    | 'path'
    | 'rect'
    | 'circle'
    | 'ellipse'
    | 'line'
    | 'polygon'
    | 'polyline';
  sourceNodeId?: string;
  sourceClassName?: string;
  originalTransform?: string;
  unsupported?: SvgUnsupportedFeature[];
};

export type SvgUnsupportedFeature = {
  kind:
    | 'clipPath'
    | 'mask'
    | 'pattern'
    | 'filter'
    | 'cssClass'
    | 'styleElement'
    | 'gradientTransform'
    | 'gradientUnits'
    | 'gradientSpreadMethod'
    | 'gradientHref'
    | 'radialGradientFocus'
    | 'unsupportedPaintReference'
    | 'unsupportedAttribute'
    | string;
  value?: string;
  refId?: string;
  raw?: string;
  attributes?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

export type PaintRef =
  | { mode: 'currentColor' }
  | { mode: 'fixed'; value: string }
  | { mode: 'token'; token: string }
  | { mode: 'linearGradient'; stops: GradientStop[]; angle: number }
  | {
      mode: 'radialGradient';
      stops: GradientStop[];
      cx: number;
      cy: number;
      r: number;
    };

export type GradientStop = { offset: number; color: string; opacity?: number };

// ---------------------------------------------------------------------------
// Transitions — runtime-owned, icon-to-icon
// ---------------------------------------------------------------------------

export type RuntimeTransitionIntent = {
  id: string;
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  strategy: 'strictMorph' | 'bestGuessMorph' | 'lineAnimation' | 'replace';
  durationMs: number;
  easing?: string | SpringConfig;
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};

export type Transition = RuntimeTransitionIntent & {
  from?: string;
  to?: string;
  variantId?: string;
  layerBindings?: LayerBinding[];
  stagger?: TransitionStagger;
  effects?: string[];
};

export type LayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: TimelineTrack[];
  delayMs?: number;
  durationMs?: number;
  morph?: {
    topology: 'strict' | 'bestGuess';
  };
  compoundTrimMode?: CompoundTrimMode;
};

/**
 * Controls how trim path operations are applied to compound paths
 * with multiple open subpaths.
 *
 * - `'simultaneously'`: All subpaths are treated as one continuous path;
 *   the trim range maps across the combined total length.
 * - `'individually'`:  Each subpath is trimmed independently using the
 *   same normalised start/end/offset values.
 *
 * Mirrors After Effects' "Trim Multiple Shapes" behaviour.
 */
export type CompoundTrimMode = 'simultaneously' | 'individually';

export type TimelineTrack =
  | { property: 'opacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'rotate'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateX'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateY'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'scale'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'pathLength'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimStart'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimEnd'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimOffset'; keyframes: number[]; easing?: string | SpringConfig };

export type SpringConfig = {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass?: number;
  velocity?: number;
};

export type TransitionStagger = {
  mode: 'linear' | 'from-center' | 'from-edges' | 'random' | 'individually';
  perLayerMs: number;
  easing?: string;
};

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

export type TopologyContract = {
  locked: boolean;
  layerPairs: Array<{
    layerId: string;
    subpathCount: number;
    commandSignature: string[];
    closed: boolean[];
  }>;
};

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

export type GuideSet = {
  id: string;
  items: GuideItem[];
};

export type GuideMaster = {
  id: string;
  name: string;
  targetSize: number;
  viewBox: [number, number, number, number];
  items: GuideItem[];
};

export type GuideItem =
  | { kind: 'hline'; y: number }
  | { kind: 'vline'; x: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | {
      kind: 'drawPoint';
      layerId: string;
      t: number;
      direction?: 'forward' | 'reverse';
    };

// ---------------------------------------------------------------------------
// Collections, Symbols, Tokens
// ---------------------------------------------------------------------------

export type Collection = {
  id: string;
  name: string;
  iconIds: string[];
  description?: string;
};

export type SymbolWeight =
  | 'ultralight'
  | 'thin'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'heavy'
  | 'black';

export type SymbolScale = 'small' | 'medium' | 'large';

export type SymbolComponent = {
  kind: 'badge' | 'slash' | 'enclosure';
  layerIds: string[];
  position?:
    | 'topLeading'
    | 'topTrailing'
    | 'bottomLeading'
    | 'bottomTrailing'
    | 'center';
};

export type TokenSet = {
  // Named slots such as primary, secondary, and tertiary are used by palette rendering.
  colors?: Record<string, string>;
};

export type ExportProfile = {
  id: string;
  format: 'svg' | 'react' | 'runtime-json' | 'lottie';
  options?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type Effect = {
  id: string;
  kind:
    | 'bounce'
    | 'pulse'
    | 'breathe'
    | 'wiggle'
    | 'rotate'
    | 'scale'
    | 'appear'
    | 'disappear'
    | 'variableColor'
    | 'lineDrawOn'
    | 'lineDrawOff'
    | 'custom';
  durationMs: number;
  easing?: string | SpringConfig;
  delay?: number;
  repeat?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
  /** Palette of hex colors for the variableColor effect. */
  palette?: string[];
  customTracks?: TimelineTrack[];
};

export type RenderingMode =
  | 'monochrome'
  | 'hierarchical'
  | 'palette'
  | 'multicolor';

// ---------------------------------------------------------------------------
// Sync Targets
// ---------------------------------------------------------------------------

export type SyncTarget = {
  id: string;
  name: string;
  platform: 'react' | 'swift' | 'flutter' | 'web-component';
  deliveryMode: 'local-directory' | 'git-pr' | 'npm-registry';
  adapterConfig?: Record<string, unknown>;
  localDirectory?: { path: string };
  gitPr?: {
    owner: string;
    repo: string;
    baseBranch: string;
    packagePath?: string;
  };
  npmRegistry?: {
    registry: string;
    scope?: string;
    packageName: string;
    lastPublishedVersion?: string;
    tokenStored?: boolean;
  };
  autoPublish?: {
    on: 'save' | 'manual';
    semver: 'patch' | 'minor' | 'major';
  };
  dryRun?: boolean;
};

// ---------------------------------------------------------------------------
// Interaction Triggers (advisory metadata for code generation)
// ---------------------------------------------------------------------------

export type StateTrigger = {
  event: 'hover' | 'tap' | 'longPress' | 'focus' | 'auto';
};

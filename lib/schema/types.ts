// Cuneiform Schema Types — canonical data model for icon projects.
// All geometry is stored as SVG path `d` strings.

// ---------------------------------------------------------------------------
// Internal runtime adapter — NOT a product concept.
// Used at the runtime boundary to bridge variant layers to transition resolver.
// ---------------------------------------------------------------------------
export type LayerSnapshot = {
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};

/**
 * IconType — a named visual style within a Variant (e.g. "line", "filled", "colored").
 * Free-form identifier: users can name types whatever they want.
 * Not to be confused with interaction states (hover, active, etc.); those are handled
 * separately via `StateTrigger` in consumer code.
 */
export type IconType = {
  id: string;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};

function buildDefaultIconType(v: Variant): IconType {
  const fallbackType = Object.values(v.types ?? {})[0];
  return {
    id: v.defaultType ?? fallbackType?.id ?? 'default',
    layers: v.layers ?? fallbackType?.layers ?? {},
    topology: v.topology ?? fallbackType?.topology,
  };
}

export function getVariantDefaultTypeId(v: Variant): string {
  return v.defaultType ?? Object.keys(v.types ?? {})[0] ?? 'default';
}

export function getVariantType(v: Variant, typeId?: string | null): IconType {
  const resolvedTypeId = typeId ?? getVariantDefaultTypeId(v);
  const iconType = v.types?.[resolvedTypeId];
  if (iconType) {
    return {
      ...iconType,
      topology: iconType.topology ?? v.topology,
    };
  }
  // Flat-variant model: no matching type — use top-level layers as fallback.
  // (The runtime renderer intentionally passes variant ids here for variant-
  // switch flows, so a missing lookup here is expected, not a bug.)
  return buildDefaultIconType(v);
}

/**
 * Normalize a flat variant into the `types` shape. Ensures a default IconType
 * entry exists keyed by `defaultType`, populated from the top-level layers.
 * Used by sample fixtures and importers to produce a canonical variant.
 */
export function normalizeVariant(v: Variant): Variant {
  const defaultType = getVariantDefaultTypeId(v);
  const defaultTypeView = v.types?.[defaultType];
  const fallbackType = Object.values(v.types ?? {})[0];
  const normalizedLayers =
    v.layers ?? defaultTypeView?.layers ?? fallbackType?.layers ?? {};
  const normalizedTopology =
    v.topology ?? defaultTypeView?.topology ?? fallbackType?.topology;
  return {
    ...v,
    layers: normalizedLayers,
    topology: normalizedTopology,
    defaultType,
    types: {
      ...(v.types ?? {}),
      [defaultType]: {
        ...(defaultTypeView ?? {}),
        id: defaultType,
        layers: normalizedLayers,
        topology: normalizedTopology,
      },
    },
  };
}

/** Convert a flat Variant into a LayerSnapshot for runtime functions. */
export function variantToSnapshot(v: Variant, typeId?: string | null): LayerSnapshot {
  const iconType = getVariantType(v, typeId);
  return { layers: iconType.layers, topology: iconType.topology };
}

// ---------------------------------------------------------------------------
// Workspace & Project
// ---------------------------------------------------------------------------

/**
 * IconSetTypeDef — universal type metadata registered at the IconSet level.
 * Each icon's variants carry per-type layer geometry under `Variant.types`,
 * but the list of available types (the "catalog") lives here so that adding,
 * removing, or renaming a type propagates across every icon in the set.
 */
export type IconSetTypeDef = {
  id: string;
  name?: string;
};

export type IconSet = {
  version: '1.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  icons: Record<string, Icon>;
  syncTargets?: SyncTarget[];
  guideMasters?: Record<string, GuideMaster>;
  tokenSet?: TokenSet;
  exportProfiles?: ExportProfile[];
  collections?: Record<string, Collection>;
  /** Universal type catalog — shared across every icon and variant in the set. */
  types?: Record<string, IconSetTypeDef>;
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
  /** Default IconType id for this variant (e.g. "line", "filled"). */
  defaultType?: string;
  /** Named visual types within this variant (e.g. "line", "filled", "colored"). */
  types?: Record<string, IconType>;
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
  /** Draw animation order (1-based). Same number = simultaneous, different = sequential. Default: 1 */
  drawOrder?: number;
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };
  /**
   * Optional parametric shape descriptor. `path.d` is canonical; `primitive` is
   * metadata that lets the Inspector surface editable parameters (e.g. polygon
   * sides, star points). It MUST be cleared whenever path topology is modified
   * outside a primitive-regeneration flow — the `patchLayer` store action
   * enforces this by dropping `primitive` when `path` is patched without an
   * explicit new primitive.
   */
  primitive?: PrimitiveShape;
  /**
   * Breadcrumb set when a primitive is cleared because the path was mutated
   * outside a primitive-regeneration flow. The Inspector uses this to tell
   * the user *"this was a polygon, but you've since modified it"* rather
   * than silently hiding the Sides/Points control.
   */
  formerPrimitiveKind?: PrimitiveShape['kind'];
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

export type PrimitiveShape =
  | {
      kind: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      radius?: number;
    }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | {
      kind: 'polygon';
      cx: number;
      cy: number;
      r: number;
      sides: number;
      rotation?: number;
    }
  | {
      kind: 'star';
      cx: number;
      cy: number;
      outerR: number;
      innerR: number;
      points: number;
      rotation?: number;
    }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

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
  strategy: 'auto' | 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'lineAnimation' | 'replace';
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
  /**
   * Playback mode, mirroring SF Symbols 7's three-way pattern
   * (see ANIMATE_PANEL_REVAMP_PLAN.md §2.5):
   *
   * - `linear` — staggered "By Layer" (default). Layers start in order with
   *   `perLayerMs` between each.
   * - `simultaneous` — "Whole Symbol". Every layer starts at t=0; `perLayerMs`
   *   is ignored.
   * - `individually` — one layer at a time, sequentially, using the full
   *   transition duration per layer.
   * - `from-center` / `from-edges` / `random` — advanced staggers retained
   *   for power users and existing projects; surfaced only in the Animate
   *   panel's Advanced disclosure.
   */
  mode:
    | 'linear'
    | 'simultaneous'
    | 'from-center'
    | 'from-edges'
    | 'random'
    | 'individually';
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
  /**
   * Parametric guides — `hline` / `vline` / `rect` / `ellipse` / `drawPoint`.
   * Authored by the Guide panel's parameter form and feed the snap engine.
   * On first enter of Guide editing mode, the geometric kinds (everything
   * except `drawPoint`) are migrated into `layers` so the user can edit them
   * with the normal toolbar. `drawPoint` stays here because it references a
   * layer id and has no geometric footprint.
   */
  items: GuideItem[];
  /**
   * Full-fat layer tree for this master. Edited on canvas via Guide editing
   * mode with the same toolbar used for icon editing (select, pen, shape
   * with every sub-tool, etc.). Contributes edge/anchor snap targets via
   * the existing layer-bounds logic when the master is bound to a variant.
   * Optional for back-compat with stored projects; normalised to `{}` by
   * `migrateProjectForGuideMasters` and populated on first enter of Guide
   * editing mode by the items → layers migration.
   */
  layers?: Record<string, Layer>;
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
    | 'draw'
    | 'custom';
  durationMs: number;
  easing?: string | SpringConfig;
  delay?: number;
  repeat?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate';
  /** Palette of hex colors for the variableColor effect. */
  palette?: string[];
  customTracks?: TimelineTrack[];
  /** Configuration for the 'draw' effect (trim-based path drawing). */
  drawConfig?: DrawConfig;
};

/**
 * Configuration for the 'draw' effect.
 *
 * Controls how stroke visibility is animated using trimStart/trimEnd/trimOffset.
 * Only applicable to open (non-closed) vector paths with a stroke style.
 *
 * - `'reveal'`: Stroke draws from start to end (trimEnd: 0→1)
 * - `'erase'`:  Stroke erases from start to end (trimStart: 0→1)
 * - `'slide'`:  A fixed-width visible window slides along the path
 */
export type DrawConfig = {
  mode: 'reveal' | 'erase' | 'slide';
  /** For 'slide' mode: fraction of path visible at any time (0-1). Default 0.2 */
  windowSize?: number;
  /** Initial trimOffset value (0-1). Default 0 */
  initialOffset?: number;
  /** How to handle compound paths with multiple open subpaths. Default 'simultaneously' */
  compoundTrimMode?: CompoundTrimMode;
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

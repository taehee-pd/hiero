// Hiero Schema Types — canonical data model for icon projects.
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
  /**
   * Optional non-destructive compound representation. When present,
   * `path.d` is the *cached evaluation* of `compound.tree` over
   * `compound.operands`. The renderer / exporter / hit-tester always
   * reads `path.d`; only the Inspector and the W3+ resolver read
   * `compound`.
   *
   * Path-invariant rule (mirrored on the `primitive` invariant
   * above): when `path.d` is mutated outside the compound-evaluation
   * flow, `compound` MUST be cleared. `patchLayer` enforces this;
   * `applyBoolean` is the one path that writes both atomically.
   *
   * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.2,
   * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §4.1.
   */
  compound?: LayerCompound;
  /**
   * Breadcrumb set when a compound is cleared because the path was
   * mutated outside the compound-evaluation flow. Mirrors
   * `formerPrimitiveKind` so the Inspector can explain why the
   * operand-tree disclosure has gone away.
   */
  formerCompound?: true;
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
// Compound paths (non-destructive boolean operations)
// ---------------------------------------------------------------------------

/**
 * Boolean operation kinds the editor authors. Mirrors the
 * `BooleanMode` accepted by `lib/editor-core/boolean-ops.ts` (which
 * consumes Paper.js).
 */
export type CompoundOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

/**
 * One node in a compound expression tree. A leaf references a stored
 * operand by id; an op applies a {@link CompoundOp} to its children
 * in left-to-right order. The tree is shape-only; operand geometry
 * lives in {@link LayerCompound.operands}.
 *
 * Trees are generally small (most compounds are one op + two leaves);
 * deeper trees describe operator chains like `subtract(unite(A, B), C)`.
 */
export type CompoundNode =
  | { kind: 'leaf'; operandId: string }
  | { kind: 'op'; op: CompoundOp; children: CompoundNode[] };

/**
 * Operand geometry referenced by `CompoundNode.kind === 'leaf'`.
 * `transform` is optional and applies before evaluation; in the
 * common case operands have no transform and inherit the layer's.
 */
export type CompoundOperand = {
  d: string;
  transform?: {
    x?: number;
    y?: number;
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
  };
};

/**
 * The compound metadata block on `Layer`. See `Layer.compound` for
 * the path-invariant contract.
 */
export type LayerCompound = {
  tree: CompoundNode;
  operands: Record<string, CompoundOperand>;
  /**
   * Bumped on every tree/operand edit. Drives resolver memoisation
   * (W4 cache key) without depending on canonical-form tree-equality.
   */
  cacheVersion: number;
};

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

export type PaintRef =
  | { mode: 'currentColor' }
  | { mode: 'fixed'; value: string }
  | { mode: 'token'; token: string; fallback?: string }
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

/**
 * Authored cadence (Layer 1 in the UX progressive-disclosure model).
 * `'soft'` (default) and `'snappy'` are the only authored values
 * today. The Layer-2 timing-curve override (W4-8) widens this back
 * to include `'custom'` plus a separate `Transition.timing` block.
 * Until that lands the union stays narrow — a silent soft fallback
 * for an unknown cadence breaks the §1 motion contract (two
 * distinct cadences, predictable).
 *
 * MUST stay in sync with `lib/runtime-core/motion-curves.ts`.
 */
export type Cadence = 'soft' | 'snappy';

/**
 * Named, art-directed fallback motions. Closed list — anything not in
 * this union is a contract violation. The resolver picks a default
 * by topological signal; the author can override at the `Transition`
 * level when the cascade has landed in T8.
 *
 * Spec: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.8.
 */
export type FallbackName =
  | 'radial-pop'
  | 'directional-replace-up'
  | 'directional-replace-down'
  | 'directional-replace-left'
  | 'directional-replace-right'
  | 'directional-replace-toward'
  | 'directional-replace-away'
  | 'draw-replace'
  | 'scale-pop';

/**
 * Address of a vertex within a canonicalized layer path. `subpathId`
 * is a stable identifier derived during canonicalization; it survives
 * non-destructive path edits. `vertexIndex` is the 0-based position
 * within the subpath's resampled polyline.
 */
export type VertexAddr = {
  subpathId: string;
  vertexIndex: number;
};

/**
 * Author-supplied correspondence pins. Subpath hints constrain the
 * Hungarian assignment; vertex hints anchor per-pair vertex
 * correspondence inside T1. Hints are pair-specific (live on
 * `Transition`, not `Layer`) and feed the resolver as *hard*
 * constraints, not soft penalties.
 *
 * Spec: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §4.4.
 */
export type CorrespondenceHints = {
  subpath: Array<[fromId: string, toId: string]>;
  vertex: Array<[from: VertexAddr, to: VertexAddr]>;
};

export type RuntimeTransitionIntent = {
  id: string;
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  /**
   * @deprecated W4 — strategy selection moves into the resolver
   * cascade. Authors no longer pick a tier. Surfaced only via the
   * debug pill (NEXT_PUBLIC_HIERO_DEBUG=1). Retained on the schema
   * during W1-W3 so the legacy resolver continues to render.
   */
  strategy: 'auto' | 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'lineAnimation' | 'replace';
  /**
   * @deprecated W4 — superseded by `Transition.duration` (seconds).
   * The two co-exist during W1-W3; resolver derivation lives in
   * transition-resolver.ts.
   */
  durationMs: number;
  /**
   * @deprecated W4 — superseded by `Transition.cadence` and the
   * Layer-2 timing-curve override.
   */
  easing?: string | SpringConfig;
  /**
   * @deprecated W4 — superseded by `Transition.fallbackOverride`
   * with the named fallback library (`directional-replace-*` etc.).
   */
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};

/**
 * `Transition` is the authored representation of an icon-to-icon
 * transition. Algorithm reads it; UI writes it.
 *
 * **Authored axes (the contract):** `duration`, `cadence`,
 * `fallbackOverride`, `correspondenceHints`. These are the only
 * fields the user is *allowed* to configure. Anything else here is
 * either identity (`id`, `fromIconId`, `toIconId`, variant ids),
 * non-strategy infrastructure (`layerBindings.compoundTrimMode`,
 * `stagger`, `effects`), or `@deprecated W4` legacy that ships out
 * with the new cascade.
 *
 * Schema-lint enforces no NEW algorithm-mechanism field lands on
 * `Transition` — see `scripts/check-non-debug-copy.ts` and the W1-U1
 * contract test.
 *
 * Spec: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.1.
 */
export type Transition = RuntimeTransitionIntent & {
  /**
   * Duration in **seconds**. Canonical authored value (Layer 1).
   * Resolver derives the legacy `durationMs` from this; W4 will
   * delete `durationMs` outright.
   */
  duration?: number;
  /** Cadence axis (Layer 1). Defaults to `'soft'`. */
  cadence?: Cadence;
  /**
   * Author override for the named fallback motion. Surfaced in the UI
   * only when the resolver landed in T8 for this pair. Defaults to
   * the resolver's pick when absent.
   */
  fallbackOverride?: FallbackName;
  /**
   * Author-supplied correspondence pins (Layer 2). Defaults to no
   * pins on either axis.
   */
  correspondenceHints?: CorrespondenceHints;

  // ── identity / infrastructure (not user-authored) ──
  from?: string;
  to?: string;
  variantId?: string;
  layerBindings?: LayerBinding[];
  stagger?: TransitionStagger;
  effects?: string[];
};

/**
 * Authored fields the W1-U1 schema lint enforces. Used by the
 * `scripts/check-transition-schema.ts` lint to ensure no new
 * algorithm-mechanism field lands on `Transition`.
 */
export const TRANSITION_AUTHORED_AXES = [
  'duration',
  'cadence',
  'fallbackOverride',
  'correspondenceHints',
] as const;

export type TransitionAuthoredAxis = (typeof TRANSITION_AUTHORED_AXES)[number];

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

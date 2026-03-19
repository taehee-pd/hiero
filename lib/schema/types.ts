// Coniva Schema Types — canonical data model for icon projects.
// All geometry is stored as SVG path `d` strings.

export type GitHubSyncSettings = {
  owner: string;
  repo: string;
  baseBranch: string;
  packagePath: string;
  exportFormat: 'react' | 'svg' | 'both';
};

/**
 * A sync target describes how generated adapter output is delivered
 * to a consuming repository or directory.
 */
export type SyncTarget = {
  id: string;
  /** Human-readable label (e.g. "Production React Repo"). */
  name: string;
  /** The target platform adapter to use. */
  platform: 'react' | 'swift' | 'flutter' | 'web-component';
  /** How the output is delivered. */
  deliveryMode: 'local-directory' | 'git-pr';
  /** Adapter-specific configuration. */
  adapterConfig?: {
    /** Runtime package import path (React adapter). */
    runtimePackage?: string;
    /** Emit TypeScript. Default true. */
    typescript?: boolean;
    /** Output subdirectory inside the target. */
    outputDir?: string;
  };
  /** Local-directory connector config. */
  localDirectory?: {
    path: string;
  };
  /** Git PR connector config. */
  gitPr?: {
    owner: string;
    repo: string;
    baseBranch: string;
    /** Path prefix inside the repo (e.g. "packages/icons"). */
    packagePath?: string;
  };
};

export type IconSet = {
  version: '1.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  icons: Record<string, Icon>;
  guideMasters?: Record<string, GuideMaster>;
  tokenSet?: TokenSet;
  exportProfiles?: ExportProfile[];
  collections?: Record<string, Collection>;
  sync?: GitHubSyncSettings;
  syncTargets?: SyncTarget[];
};

export type Project = IconSet;

export type Workspace = {
  version: '2.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  iconSets: Record<string, IconSet>;
  activeIconSetId?: string;
};

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
  transitions: Record<string, Transition>;
  effects?: Record<string, Effect>;
  components?: Record<string, SymbolComponent>;
  meta?: {
    externalImport?: IconExternalImportMeta;
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
  defaultState: string;
  states: Record<string, State>;
};

export type State = {
  id: string;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};

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

export type StateTrigger = {
  event: 'hover' | 'tap' | 'longPress' | 'focus' | 'auto';
};

export type Transition = {
  id: string;
  from: string;
  to: string;
  strategy: 'track' | 'strictMorph' | 'bestGuessMorph' | 'replace';
  durationMs: number;
  easing?: string | SpringConfig;
  stagger?: TransitionStagger;
  layerBindings: LayerBinding[];
  triggers?: StateTrigger[];
};

export type LayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: TimelineTrack[];
  delayMs?: number;
  durationMs?: number;
  morph?: {
    topology: 'strict' | 'bestGuess';
    mixer?: 'native' | 'flubber';
  };
};

export type TimelineTrack =
  | { property: 'opacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'rotate'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateX'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateY'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'scale'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'pathLength'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'fill'; keyframes: string[]; easing?: string | SpringConfig }
  | { property: 'stroke'; keyframes: string[]; easing?: string | SpringConfig };

export type SpringConfig = {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass?: number;
  velocity?: number;
};

export type TransitionStagger = {
  mode: 'linear' | 'from-center' | 'from-edges' | 'random';
  perLayerMs: number;
  easing?: string;
};

export type TopologyContract = {
  locked: boolean;
  layerPairs: Array<{
    layerId: string;
    subpathCount: number;
    commandSignature: string[];
    closed: boolean[];
  }>;
};

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
  customTracks?: TimelineTrack[];
};

export type RenderingMode =
  | 'monochrome'
  | 'hierarchical'
  | 'palette'
  | 'multicolor';

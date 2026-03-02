// Icophone Schema Types — canonical data model for icon projects.
// All geometry is stored as SVG path `d` strings.

export type Project = {
  version: '1.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  icons: Record<string, Icon>;
  tokenSet?: TokenSet;
  exportProfiles?: ExportProfile[];
};

export type Icon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variants: Record<string, Variant>;
  states: Record<string, State>;
  transitions: Record<string, Transition>;
  effects?: Record<string, Effect>;
  guides?: Record<string, GuideSet>;
};

export type Variant = {
  id: string;
  size: number;
  viewBox: [number, number, number, number];
  defaultState: string;
  guideSetId?: string;
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
};

export type PaintRef =
  | { mode: 'currentColor' }
  | { mode: 'fixed'; value: string }
  | { mode: 'token'; token: string };

export type Transition = {
  id: string;
  from: string;
  to: string;
  strategy: 'track' | 'strictMorph' | 'bestGuessMorph' | 'replace';
  durationMs: number;
  easing?: string;
  layerBindings: LayerBinding[];
};

export type LayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: TimelineTrack[];
  morph?: {
    topology: 'strict' | 'bestGuess';
    mixer?: 'native' | 'flubber';
  };
};

export type TimelineTrack =
  | { property: 'opacity'; keyframes: number[] }
  | { property: 'rotate'; keyframes: number[] }
  | { property: 'translateX'; keyframes: number[] }
  | { property: 'translateY'; keyframes: number[] }
  | { property: 'scale'; keyframes: number[] }
  | { property: 'pathLength'; keyframes: number[] };

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

export type TokenSet = {
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
    | 'variableColor'
    | 'lineDrawOn'
    | 'lineDrawOff';
  durationMs: number;
  easing?: string;
};

// Rendering modes for icon display
export type RenderingMode =
  | 'monochrome'
  | 'hierarchical'
  | 'palette'
  | 'multicolor';

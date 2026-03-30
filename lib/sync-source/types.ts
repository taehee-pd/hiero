/**
 * Sync-source types — canonical source-of-truth schema for GitHub PR sync.
 *
 * These types define the versioned, deterministic representation of icons
 * that gets committed to a target repository. They are intentionally separate
 * from both editor document state and compiled runtime output.
 */

import type {
  Effect,
  PaintRef,
  RenderingMode,
  SymbolWeight,
  SymbolScale,
  TopologyContract,
} from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/** Bump when the icon.json canonical format changes. */
export const ICON_SOURCE_SCHEMA_VERSION = '1.0.0';
export const SYNC_SOURCE_MANIFEST_SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// icon.json — per-icon canonical source
// ---------------------------------------------------------------------------

/**
 * Canonical source layer — stripped of editor-only metadata like `importMeta`,
 * `isClipMask` internal flags, and `groupId`.
 */
export type SourceLayer = {
  id: string;
  role?: 'primary' | 'secondary' | 'tertiary' | string;
  visible?: boolean;
  clipPathLayerId?: string;
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

export type SourceVariant = {
  id: string;
  name?: string;
  size: number;
  viewBox: [number, number, number, number];
  renderingMode?: RenderingMode;
  weight?: SymbolWeight;
  scale?: SymbolScale;
  layers: Record<string, SourceLayer>;
  topology?: TopologyContract;
};

export type SourceEffect = Effect;

export type SourceTransition = import('@/lib/schema/types').Transition;

export type IconSourceFile = {
  schemaVersion: string;
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variants: Record<string, SourceVariant>;
  transitions?: Record<string, SourceTransition>;
  effects?: Record<string, SourceEffect>;
};

// ---------------------------------------------------------------------------
// manifest.json — index of all icons in the source payload
// ---------------------------------------------------------------------------

export type SyncSourceManifestEntry = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variantCount: number;
  sizes: number[];
  hasTransitions: boolean;
  hasEffects: boolean;
  sourcePath: string;
  previewPath: string;
};

export type SyncSourceManifest = {
  schemaVersion: string;
  generatedAt: string;
  iconCount: number;
  icons: Record<string, SyncSourceManifestEntry>;
};

// ---------------------------------------------------------------------------
// Full payload — the set of files to commit
// ---------------------------------------------------------------------------

export type SourcePayloadFile = {
  path: string;
  contents: string;
};

export type SourcePayload = {
  files: SourcePayloadFile[];
  manifest: SyncSourceManifest;
  iconCount: number;
};

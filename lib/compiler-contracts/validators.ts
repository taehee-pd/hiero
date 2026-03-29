import type {
  CollectionEntry,
  CompiledEffect,
  CompiledEffectKind,
  CompiledIcon,
  CompiledLayer,
  CompiledLayerBinding,
  CompiledLayerSet,
  CompiledRenderingMode,
  CompiledTransition,
  CompiledTrackProperty,
  CompiledVariant,
  IconChange,
  IconChangeKind,
  IconChangeRecord,
  IconEntry,
  PackageManifest,
} from './types';
import {
  COMPILED_ICON_SCHEMA_URI,
  ICON_CHANGE_RECORD_SCHEMA_URI,
  PACKAGE_MANIFEST_SCHEMA_URI,
} from './types';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((item) => typeof item === 'string');
}

function isNumberArray(val: unknown): val is number[] {
  return Array.isArray(val) && val.every((item) => typeof item === 'number');
}

function isSpringConfig(val: unknown): boolean {
  return (
    isObject(val) &&
    val.type === 'spring' &&
    typeof val.stiffness === 'number' &&
    typeof val.damping === 'number' &&
    (val.mass === undefined || typeof val.mass === 'number') &&
    (val.velocity === undefined || typeof val.velocity === 'number')
  );
}

function isRecordOf<T>(
  val: unknown,
  predicate: (item: unknown) => item is T,
): val is Record<string, T> {
  return isObject(val) && Object.values(val).every((item) => predicate(item));
}

/** The original 4 modes that every compiled state MUST contain. */
const REQUIRED_RENDERING_MODES: CompiledRenderingMode[] = [
  'monochrome',
  'hierarchical',
  'palette',
  'multicolor',
];

/** All known rendering modes. */
const RENDERING_MODES: CompiledRenderingMode[] = [
  ...REQUIRED_RENDERING_MODES,
];

const TRACK_PROPERTIES: CompiledTrackProperty[] = [
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
  'pathLength',
  'trimStart',
  'trimEnd',
  'trimOffset',
];

const EFFECT_KINDS: CompiledEffectKind[] = [
  'bounce',
  'pulse',
  'breathe',
  'wiggle',
  'rotate',
  'scale',
  'variableColor',
  'lineDrawOn',
  'lineDrawOff',
];

const CHANGE_KINDS: IconChangeKind[] = [
  'geometry',
  'style',
  'state-added',
  'state-removed',
  'variant-added',
  'variant-removed',
  'mode-added',
  'mode-removed',
  'animation-added',
  'animation-changed',
  'animation-removed',
  'effect-added',
  'effect-removed',
  'metadata',
  'breaking',
];

export function isCompiledLayer(val: unknown): val is CompiledLayer {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.role !== 'string') return false;

  if (!isObject(val.path)) return false;
  if (typeof val.path.d !== 'string') return false;
  if (
    val.path.fillRule !== undefined &&
    val.path.fillRule !== 'nonzero' &&
    val.path.fillRule !== 'evenodd'
  ) {
    return false;
  }

  if (!isObject(val.style)) return false;
  if (typeof val.style.fill !== 'string') return false;
  if (typeof val.style.fillOpacity !== 'number') return false;
  if (typeof val.style.stroke !== 'string') return false;
  if (typeof val.style.strokeOpacity !== 'number') return false;
  if (typeof val.style.strokeWidth !== 'number') return false;
  if (
    val.style.lineCap !== undefined &&
    (typeof val.style.lineCap !== 'string' || !['butt', 'round', 'square'].includes(val.style.lineCap))
  ) {
    return false;
  }
  if (
    val.style.lineJoin !== undefined &&
    (typeof val.style.lineJoin !== 'string' || !['miter', 'round', 'bevel'].includes(val.style.lineJoin))
  ) {
    return false;
  }

  if (val.transform !== undefined) {
    if (!isObject(val.transform)) return false;
    if (typeof val.transform.x !== 'number') return false;
    if (typeof val.transform.y !== 'number') return false;
    if (typeof val.transform.rotate !== 'number') return false;
    if (typeof val.transform.scaleX !== 'number') return false;
    if (typeof val.transform.scaleY !== 'number') return false;
  }

  return true;
}

export function isCompiledLayerSet(val: unknown): val is CompiledLayerSet {
  return isObject(val) && Array.isArray(val.layers) && val.layers.every(isCompiledLayer);
}

export function isCompiledVariant(val: unknown): val is CompiledVariant {
  if (!isObject(val)) return false;
  if (typeof val.size !== 'number') return false;
  if (
    !Array.isArray(val.viewBox) ||
    val.viewBox.length !== 4 ||
    !val.viewBox.every((n) => typeof n === 'number')
  ) {
    return false;
  }
  return isCompiledLayerSet(val.layers);
}

export function isCompiledLayerBinding(val: unknown): val is CompiledLayerBinding {
  if (!isObject(val)) return false;
  if (val.fromLayerId !== undefined && typeof val.fromLayerId !== 'string') return false;
  if (val.toLayerId !== undefined && typeof val.toLayerId !== 'string') return false;

  if (val.tracks !== undefined) {
    if (!Array.isArray(val.tracks)) return false;
    for (const track of val.tracks) {
      if (!isObject(track)) return false;
      if (!TRACK_PROPERTIES.includes(track.property as CompiledTrackProperty)) {
        return false;
      }
      if (
        !isNumberArray(track.keyframes) &&
        !isStringArray(track.keyframes)
      ) {
        return false;
      }
    }
  }

  if (val.morph !== undefined) {
    if (!isObject(val.morph)) return false;
    if (!['strict', 'bestGuess'].includes(val.morph.topology as string)) return false;
  }

  return true;
}

export function isCompiledTransition(val: unknown): val is CompiledTransition {
  if (!isObject(val)) return false;
  if (typeof val.from !== 'string') return false;
  if (typeof val.to !== 'string') return false;
  if (typeof val.durationMs !== 'number') return false;
  if (typeof val.easing !== 'string' && !isSpringConfig(val.easing)) return false;
  if (!['track', 'strictMorph', 'bestGuessMorph', 'replace'].includes(val.strategy as string)) {
    return false;
  }
  return Array.isArray(val.bindings) && val.bindings.every(isCompiledLayerBinding);
}

export function isCompiledEffect(val: unknown): val is CompiledEffect {
  if (!isObject(val)) return false;
  if (!EFFECT_KINDS.includes(val.kind as CompiledEffectKind)) return false;
  if (typeof val.durationMs !== 'number') return false;
  if (typeof val.easing !== 'string' && !isSpringConfig(val.easing)) return false;

  if (val.params !== undefined) {
    if (!isObject(val.params)) return false;
    if (
      !Object.values(val.params).every((param) =>
        ['string', 'number', 'boolean'].includes(typeof param),
      )
    ) {
      return false;
    }
  }

  return true;
}

export function isCompiledIcon(val: unknown): val is CompiledIcon {
  if (!isObject(val)) return false;
  if (val.$schema !== COMPILED_ICON_SCHEMA_URI) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.name !== 'string') return false;
  if (typeof val.componentName !== 'string') return false;

  if (!isObject(val.meta)) return false;
  if (typeof val.meta.category !== 'string') return false;
  if (!isStringArray(val.meta.tags)) return false;
  if (typeof val.meta.updatedAt !== 'string') return false;
  if (typeof val.meta.version !== 'string') return false;
  if (typeof val.meta.contentHash !== 'string') return false;

  if (!isRecordOf(val.variants, isCompiledVariant)) return false;
  if (!Array.isArray(val.transitions) || !val.transitions.every(isCompiledTransition)) {
    return false;
  }
  if (!Array.isArray(val.effects) || !val.effects.every(isCompiledEffect)) {
    return false;
  }

  return true;
}

export function isIconEntry(val: unknown): val is IconEntry {
  if (!isObject(val)) return false;
  if (typeof val.id !== 'string') return false;
  if (typeof val.name !== 'string') return false;
  if (typeof val.componentName !== 'string') return false;
  if (typeof val.category !== 'string') return false;
  if (!isStringArray(val.tags)) return false;
  if (typeof val.version !== 'string') return false;
  if (typeof val.updatedAt !== 'string') return false;
  if (typeof val.contentHash !== 'string') return false;
  if (!isNumberArray(val.supportedSizes)) return false;
  if (
    !Array.isArray(val.supportedModes) ||
    !val.supportedModes.every((mode) => RENDERING_MODES.includes(mode as CompiledRenderingMode))
  ) {
    return false;
  }
  if (typeof val.hasAnimation !== 'boolean') return false;
  if (typeof val.hasMorphTransition !== 'boolean') return false;
  if (typeof val.compiledPath !== 'string') return false;
  return true;
}

export function isCollectionEntry(val: unknown): val is CollectionEntry {
  if (!isObject(val)) return false;
  if (typeof val.name !== 'string') return false;
  if (val.description !== undefined && typeof val.description !== 'string') return false;
  if (!isStringArray(val.iconIds)) return false;
  return true;
}

export function isPackageManifest(val: unknown): val is PackageManifest {
  if (!isObject(val)) return false;
  if (val.$schema !== PACKAGE_MANIFEST_SCHEMA_URI) return false;

  if (!isObject(val.package)) return false;
  if (typeof val.package.name !== 'string') return false;
  if (typeof val.package.version !== 'string') return false;
  if (typeof val.package.builtAt !== 'string') return false;
  if (typeof val.package.iconSchemaVersion !== 'string') return false;
  if (typeof val.package.iconCount !== 'number') return false;
  if (val.package.gitSha !== undefined && typeof val.package.gitSha !== 'string') return false;
  if (val.package.gitBranch !== undefined && typeof val.package.gitBranch !== 'string') {
    return false;
  }

  if (!isRecordOf(val.icons, isIconEntry)) return false;
  if (!isRecordOf(val.collections, isCollectionEntry)) return false;

  return true;
}

export function isIconChange(val: unknown): val is IconChange {
  if (!isObject(val)) return false;
  if (!CHANGE_KINDS.includes(val.kind as IconChangeKind)) return false;
  if (typeof val.summary !== 'string') return false;
  if (typeof val.breaking !== 'boolean') return false;

  if (val.scope !== undefined) {
    if (!isObject(val.scope)) return false;
    if (val.scope.variantSize !== undefined && typeof val.scope.variantSize !== 'number') {
      return false;
    }
    if (val.scope.stateId !== undefined && typeof val.scope.stateId !== 'string') return false;
    if (val.scope.layerId !== undefined && typeof val.scope.layerId !== 'string') return false;
    if (
      val.scope.renderingMode !== undefined &&
      !RENDERING_MODES.includes(val.scope.renderingMode as CompiledRenderingMode)
    ) {
      return false;
    }
    if (
      val.scope.effectKind !== undefined &&
      !EFFECT_KINDS.includes(val.scope.effectKind as CompiledEffectKind)
    ) {
      return false;
    }
  }

  return true;
}

export function isIconChangeRecord(val: unknown): val is IconChangeRecord {
  if (!isObject(val)) return false;
  if (val.$schema !== ICON_CHANGE_RECORD_SCHEMA_URI) return false;
  if (typeof val.iconId !== 'string') return false;
  if (typeof val.iconName !== 'string') return false;
  if (typeof val.componentName !== 'string') return false;
  if (typeof val.fromVersion !== 'string') return false;
  if (typeof val.toVersion !== 'string') return false;
  if (typeof val.publishedAt !== 'string') return false;
  if (!['major', 'minor', 'patch'].includes(val.bump as string)) return false;
  if (typeof val.isBreaking !== 'boolean') return false;
  if (val.designerNote !== undefined && typeof val.designerNote !== 'string') return false;
  if (!Array.isArray(val.changes) || !val.changes.every(isIconChange)) return false;
  return true;
}

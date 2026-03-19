import type { SVGProps } from 'react';

import type { CompiledIcon, CompiledLayerSet, CompiledRenderingMode } from '@/lib/compiler-contracts';
import {
  COMPILED_ICON_SCHEMA_URI,
  isCompiledIcon,
} from '@/lib/compiler-contracts';

export type IconBaseProps = SVGProps<SVGSVGElement> & {
  size?: number;
  renderingMode?: CompiledRenderingMode;
  paletteColors?: Partial<Record<string, string>>;
  state?: string;
  transition?: boolean | { durationMs?: number; easing?: string };
  animate?: string | null;
  animateRepeat?: 'once' | 'loop' | number;
};

export type IconFallbackBehavior = {
  sizeFallback: 'nearest' | 'scale';
  modeFallback: 'monochrome';
  stateFallback: 'default';
};

export type IconComponentMeta = {
  id: string;
  name: string;
  componentName: string;
  schema: string;
  version: string;
  availableSizes: number[];
  availableStates: string[];
  availableModes: CompiledRenderingMode[];
};

export const DEFAULT_ICON_FALLBACK_BEHAVIOR: IconFallbackBehavior = {
  sizeFallback: 'nearest',
  modeFallback: 'monochrome',
  stateFallback: 'default',
};

export type ResolveSizeResult = {
  requestedSize: number;
  resolvedVariantId: string;
  resolvedVariantSize: number;
  renderSize: number;
  viewBox: [number, number, number, number];
};

export function resolveRequestedSize(
  icon: CompiledIcon,
  requestedSize?: number,
  fallback: IconFallbackBehavior['sizeFallback'] = DEFAULT_ICON_FALLBACK_BEHAVIOR.sizeFallback,
): ResolveSizeResult {
  const candidates = Object.entries(icon.variants)
    .map(([variantId, variant]) => ({ variantId, size: variant.size, viewBox: variant.viewBox }))
    .sort((a, b) => a.size - b.size);

  if (candidates.length === 0) {
    warnDev(`Icon "${icon.id}" has no compiled variants.`);
    return {
      requestedSize: requestedSize ?? 0,
      resolvedVariantId: '',
      resolvedVariantSize: 0,
      renderSize: requestedSize ?? 0,
      viewBox: [0, 0, 0, 0],
    };
  }

  const wanted = requestedSize ?? candidates[0]!.size;
  const exact = candidates.find((candidate) => candidate.size === wanted);
  const resolved = exact ?? nearestCandidate(candidates, wanted);

  if (!exact) {
    warnDev(
      `Size ${wanted} is not available for icon "${icon.id}". Falling back to ${resolved.size} (${fallback}).`,
    );
  }

  return {
    requestedSize: wanted,
    resolvedVariantId: resolved.variantId,
    resolvedVariantSize: resolved.size,
    renderSize: fallback === 'scale' ? wanted : resolved.size,
    viewBox: [...resolved.viewBox],
  };
}

export function resolveRequestedState(
  variant: CompiledIcon['variants'][string],
  requestedState?: string,
  fallback: IconFallbackBehavior['stateFallback'] = DEFAULT_ICON_FALLBACK_BEHAVIOR.stateFallback,
): string {
  const stateIds = Object.keys(variant.states).sort((a, b) => a.localeCompare(b));
  if (stateIds.length === 0) {
    warnDev('No states were found in compiled variant.');
    return fallback;
  }

  const wanted = requestedState ?? fallback;
  if (variant.states[wanted]) {
    return wanted;
  }

  const fallbackState = variant.states[fallback]
    ? fallback
    : stateIds[0]!;

  warnDev(`State "${wanted}" is not available. Falling back to "${fallbackState}".`);
  return fallbackState;
}

export function resolveRequestedRenderingMode(
  state: { modes: Partial<Record<CompiledRenderingMode, CompiledLayerSet>> },
  requestedMode?: CompiledRenderingMode,
  fallback: IconFallbackBehavior['modeFallback'] = DEFAULT_ICON_FALLBACK_BEHAVIOR.modeFallback,
): CompiledRenderingMode {
  const modeKeys = Object.keys(state.modes).filter(Boolean) as CompiledRenderingMode[];

  const wanted = requestedMode ?? fallback;
  if (state.modes[wanted]) {
    return wanted;
  }

  if (state.modes[fallback]) {
    warnDev(`Mode "${wanted}" is not available. Falling back to "${fallback}".`);
    return fallback;
  }

  const firstMode = modeKeys[0] ?? 'monochrome';
  warnDev(`Mode "${wanted}" is not available. Falling back to "${firstMode}".`);
  return firstMode;
}

export function resolvePaletteColors(
  renderingMode: CompiledRenderingMode,
  paletteColors?: Partial<Record<string, string>>,
): Partial<Record<string, string>> | undefined {
  if (renderingMode !== 'palette') {
    if (paletteColors && Object.keys(paletteColors).length > 0) {
      warnDev('paletteColors was provided but ignored outside palette rendering mode.');
    }
    return undefined;
  }

  return paletteColors;
}

export type CompiledIconMigrationHook = (
  payload: unknown,
  schemaUri: string,
) => unknown;

export type ParseCompiledIconOptions = {
  migrationHook?: CompiledIconMigrationHook;
};

export function parseCompiledIconJson(
  input: string | unknown,
  options?: ParseCompiledIconOptions,
): { icon: CompiledIcon; meta: IconComponentMeta } {
  const payload =
    typeof input === 'string'
      ? (JSON.parse(input) as unknown)
      : input;

  if (!isObject(payload) || typeof payload.$schema !== 'string') {
    throw new Error('Invalid compiled icon payload: missing $schema.');
  }

  const migrated =
    payload.$schema === COMPILED_ICON_SCHEMA_URI
      ? payload
      : applyMigrationHook(payload, payload.$schema, options?.migrationHook);

  if (!isCompiledIcon(migrated)) {
    throw new Error('Invalid compiled icon payload.');
  }

  return {
    icon: migrated,
    meta: buildIconComponentMeta(migrated),
  };
}

function applyMigrationHook(
  payload: unknown,
  schemaUri: string,
  migrationHook?: CompiledIconMigrationHook,
): unknown {
  if (!migrationHook) {
    throw new Error(`Unsupported compiled icon schema: ${schemaUri}`);
  }

  return migrationHook(payload, schemaUri);
}

function buildIconComponentMeta(icon: CompiledIcon): IconComponentMeta {
  const availableSizes = Object.values(icon.variants)
    .map((variant) => variant.size)
    .sort((a, b) => a - b);

  const availableStates = Array.from(
    new Set(
      Object.values(icon.variants).flatMap((variant) => Object.keys(variant.states)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const availableModes = Array.from(
    new Set(
      Object.values(icon.variants).flatMap((variant) =>
        Object.values(variant.states).flatMap((state) =>
          Object.keys(state.modes) as CompiledRenderingMode[],
        ),
      ),
    ),
  ).sort((left, right) => modeOrder(left) - modeOrder(right));

  return {
    id: icon.id,
    name: icon.name,
    componentName: icon.componentName,
    schema: icon.$schema,
    version: icon.meta.version,
    availableSizes,
    availableStates,
    availableModes,
  };
}

function nearestCandidate<T extends { size: number }>(candidates: T[], wanted: number): T {
  return candidates.reduce((best, current) => {
    const bestDiff = Math.abs(best.size - wanted);
    const currentDiff = Math.abs(current.size - wanted);
    if (currentDiff < bestDiff) return current;
    if (currentDiff === bestDiff && current.size < best.size) return current;
    return best;
  }, candidates[0]!);
}

function modeOrder(mode: CompiledRenderingMode): number {
  const order: CompiledRenderingMode[] = ['monochrome', 'hierarchical', 'palette', 'multicolor'];
  const index = order.indexOf(mode);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function warnDev(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[coniva-runtime] ${message}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

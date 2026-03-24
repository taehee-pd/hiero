import type { Icon, Variant, State, Layer, SymbolComponent } from './types';
import { booleanOp } from '@/lib/editor-core/boolean-ops';

// ── Variant derivation types ──────────────────────────────────────────

export type SymbolVariantModifier =
  | 'fill'
  | 'circle'
  | 'square'
  | 'slash'
  | 'badge';

export type DerivedVariantSpec = {
  baseVariantId: string;
  modifier: SymbolVariantModifier;
  /** For badge/slash: which component kind to toggle */
  componentKind?: 'badge' | 'slash' | 'enclosure';
};

// ── Helpers ───────────────────────────────────────────────────────────

function hasComponentOfKind(
  components: Record<string, SymbolComponent> | undefined,
  kind: SymbolComponent['kind'],
): boolean {
  if (!components) return false;
  return Object.values(components).some((c) => c.kind === kind);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Check if a variant can derive a modified version.
 *
 * - `'fill'`   — always possible (manual fill authoring).
 * - `'circle'` / `'square'` — requires an enclosure component.
 * - `'slash'`  — requires a slash component.
 * - `'badge'`  — requires a badge component.
 */
export function canDeriveVariant(
  icon: Pick<Icon, 'variants' | 'components'>,
  variantId: string,
  modifier: SymbolVariantModifier,
): boolean {
  // Verify the variant actually exists
  if (!icon.variants[variantId]) return false;

  switch (modifier) {
    case 'fill':
      // Fill derivation is always possible
      return true;
    case 'circle':
    case 'square':
      return hasComponentOfKind(icon.components, 'enclosure');
    case 'slash':
      return hasComponentOfKind(icon.components, 'slash');
    case 'badge':
      return hasComponentOfKind(icon.components, 'badge');
    default:
      return false;
  }
}

/**
 * List available modifiers for a given variant.
 */
export function availableModifiers(
  icon: Pick<Icon, 'variants' | 'components'>,
  variantId: string,
): SymbolVariantModifier[] {
  const all: SymbolVariantModifier[] = [
    'fill',
    'circle',
    'square',
    'slash',
    'badge',
  ];
  return all.filter((m) => canDeriveVariant(icon, variantId, m));
}

/**
 * Derive a variant spec (metadata only — actual generation requires
 * path boolean operations which are deferred to a future phase).
 */
export function createDerivedVariantSpec(
  baseVariantId: string,
  modifier: SymbolVariantModifier,
): DerivedVariantSpec {
  const spec: DerivedVariantSpec = { baseVariantId, modifier };

  switch (modifier) {
    case 'circle':
    case 'square':
      spec.componentKind = 'enclosure';
      break;
    case 'slash':
      spec.componentKind = 'slash';
      break;
    case 'badge':
      spec.componentKind = 'badge';
      break;
    // 'fill' has no componentKind
  }

  return spec;
}

// ── Variant generation engine (Phase N) ──────────────────────────────

/**
 * Merge multiple layer paths into a single compound path via boolean union.
 */
async function mergedPathOfLayers(
  layerIds: string[],
  state: State,
): Promise<string> {
  let merged = '';
  for (const layerId of layerIds) {
    const layer = state.layers[layerId];
    if (!layer?.path?.d) continue;
    if (!merged) {
      merged = layer.path.d;
    } else {
      merged = await booleanOp('unite', merged, layer.path.d);
    }
  }
  return merged;
}

/**
 * Deep-clone a layer object.
 */
function cloneLayer(layer: Layer): Layer {
  return JSON.parse(JSON.stringify(layer));
}

/**
 * Deep-clone a record of states.
 */
function cloneStates(states: Record<string, State>): Record<string, State> {
  return JSON.parse(JSON.stringify(states));
}

/**
 * Get the component of a given kind from an icon's components map.
 */
function getComponent(
  icon: Icon,
  kind: SymbolComponent['kind'],
): SymbolComponent | undefined {
  if (!icon.components) return undefined;
  return Object.values(icon.components).find((c) => c.kind === kind);
}

/**
 * Check if a layer belongs to a component (by being in its layerIds).
 */
function isComponentLayer(icon: Icon, layerId: string): boolean {
  if (!icon.components) return false;
  return Object.values(icon.components).some((c) =>
    c.layerIds.includes(layerId),
  );
}

/**
 * Apply a derived variant to an icon, producing a new Icon with the
 * derived variant added. This is the core Phase N engine.
 *
 * - `fill`: style transform (no boolean ops)
 * - `slash`: subtract slash component from primary layers
 * - `circle`/`square`: unite enclosure component with primary layers
 * - `badge`: subtract badge from overlapping layers, keep badge visible
 */
export async function applyDerivedVariant(
  icon: Icon,
  spec: DerivedVariantSpec,
): Promise<Icon> {
  const baseVariant = icon.variants[spec.baseVariantId];
  if (!baseVariant) throw new Error(`Base variant "${spec.baseVariantId}" not found`);

  const derivedVariantId = `${spec.baseVariantId}.${spec.modifier}`;
  const derivedStates = cloneStates(baseVariant.states);
  const defaultStateId = Object.keys(derivedStates)[0];
  if (!defaultStateId) throw new Error('Base variant has no states');

  for (const [_stateId, state] of Object.entries(derivedStates)) {
    switch (spec.modifier) {
      case 'fill':
        applyFillDerivation(state);
        break;
      case 'slash':
        await applySlashDerivation(icon, state);
        break;
      case 'circle':
      case 'square':
        await applyEnclosureDerivation(icon, state);
        break;
      case 'badge':
        await applyBadgeDerivation(icon, state);
        break;
    }
  }

  const derivedVariant: Variant = {
    ...baseVariant,
    id: derivedVariantId,
    name: `${baseVariant.name ?? spec.baseVariantId} (${spec.modifier})`,
    states: derivedStates,
  };

  // Store the derivation spec in meta for re-derive support
  const existingSpecs = icon.meta?.derivedSpecs ?? [];
  const updatedSpecs = [
    ...existingSpecs.filter(
      (s) =>
        !(s.baseVariantId === spec.baseVariantId && s.modifier === spec.modifier),
    ),
    spec,
  ];

  return {
    ...icon,
    variants: {
      ...icon.variants,
      [derivedVariantId]: derivedVariant,
    },
    meta: {
      ...icon.meta,
      derivedSpecs: updatedSpecs,
    },
  };
}

// ── Modifier-specific derivation logic ───────────────────────────────

/**
 * N1: Fill derivation — pure style transform, no boolean ops.
 * For each layer with stroke but no fill, produce a filled copy.
 *
 * currentColor is treated as a valid paint (it renders at runtime),
 * so a layer with `stroke: { mode: 'currentColor' }` IS considered
 * to have a stroke, and `fill: { mode: 'currentColor' }` IS considered
 * to have a fill.
 */
function applyFillDerivation(state: State): void {
  for (const [layerId, layer] of Object.entries(state.layers)) {
    if (!layer.style) continue;

    // A layer "has stroke" if stroke paint exists (any mode, including currentColor)
    const hasStroke = !!layer.style.stroke;
    // A layer "has fill" if fill paint exists (any mode, including currentColor)
    const hasFill = !!layer.style.fill;

    if (hasStroke && !hasFill) {
      const cloned = cloneLayer(layer);
      cloned.style = {
        ...cloned.style,
        fill: layer.style.stroke,
        stroke: undefined,
        strokeWidth: 0,
      };
      state.layers[layerId] = cloned;
    }
  }
}

/**
 * N2: Slash derivation — subtract slash component from primary layers.
 */
async function applySlashDerivation(icon: Icon, state: State): Promise<void> {
  const comp = getComponent(icon, 'slash');
  if (!comp) return;

  const slashPath = await mergedPathOfLayers(comp.layerIds, state);
  if (!slashPath) return;

  for (const [layerId, layer] of Object.entries(state.layers)) {
    if (comp.layerIds.includes(layerId)) {
      // Hide slash component layers in derived state
      state.layers[layerId] = { ...layer, visible: false };
      continue;
    }
    if (!layer.path?.d || isComponentLayer(icon, layerId)) continue;

    const result = await booleanOp('subtract', layer.path.d, slashPath);
    if (result) {
      state.layers[layerId] = {
        ...layer,
        path: { ...layer.path, d: result },
      };
    }
  }
}

/**
 * N3: Circle/square derivation — unite enclosure with primary layers.
 */
async function applyEnclosureDerivation(
  icon: Icon,
  state: State,
): Promise<void> {
  const comp = getComponent(icon, 'enclosure');
  if (!comp) return;

  const enclosurePath = await mergedPathOfLayers(comp.layerIds, state);
  if (!enclosurePath) return;

  for (const [layerId, layer] of Object.entries(state.layers)) {
    if (comp.layerIds.includes(layerId)) {
      // Hide enclosure layers — they're now merged
      state.layers[layerId] = { ...layer, visible: false };
      continue;
    }
    if (!layer.path?.d || isComponentLayer(icon, layerId)) continue;

    const result = await booleanOp('unite', layer.path.d, enclosurePath);
    if (result) {
      state.layers[layerId] = {
        ...layer,
        path: { ...layer.path, d: result },
      };
    }
  }
}

/**
 * N4: Badge derivation — subtract badge from overlapping layers,
 * keep badge layers visible.
 */
async function applyBadgeDerivation(icon: Icon, state: State): Promise<void> {
  const comp = getComponent(icon, 'badge');
  if (!comp) return;

  const badgePath = await mergedPathOfLayers(comp.layerIds, state);
  if (!badgePath) return;

  for (const [layerId, layer] of Object.entries(state.layers)) {
    // Badge layers stay visible — they render in the derived variant
    if (comp.layerIds.includes(layerId)) continue;
    if (!layer.path?.d || isComponentLayer(icon, layerId)) continue;

    const result = await booleanOp('subtract', layer.path.d, badgePath);
    if (result) {
      state.layers[layerId] = {
        ...layer,
        path: { ...layer.path, d: result },
      };
    }
  }
}

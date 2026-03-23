import type { Icon, SymbolComponent } from './types';

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

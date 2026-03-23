# Derived Variant Generation Spec

**Phase:** N
**Modules:**
- `lib/schema/variant-derivation.ts` (engine)
- `components/editor/InspectorPanel.tsx` (UI)
- `lib/editor-core/boolean-ops.ts` (boolean primitive)

Completes the SF Symbols variant system by generating fill, slash,
circle, square, and badge derived variants from a base variant using
path boolean operations.

---

## Background

`variant-derivation.ts` already implements:
- `SymbolVariantModifier` union type
- `canDeriveVariant(icon, variantId, modifier) → boolean`
- `availableModifiers(icon, variantId) → SymbolVariantModifier[]`
- `createDerivedVariantSpec(baseVariantId, modifier) → DerivedVariantSpec`

What is **missing** is the actual geometry generation step:
`applyDerivedVariant(icon, spec) → Icon`.

---

## New Function: `applyDerivedVariant`

```ts
export function applyDerivedVariant(
  icon: Icon,
  spec: DerivedVariantSpec,
): Icon
```

Returns a **new `Icon`** (immutable, does not mutate input) with an
additional variant added. The new variant ID is
`${spec.baseVariantId}-${spec.modifier}`.

### Modifier implementations

#### `'fill'`

No boolean ops needed — style transformation only.

For each layer in the base state:
- If `layer.style.stroke` is set and `layer.style.fill` is absent or
  `{ mode: 'currentColor' }`:
  - Copy the layer.
  - Set `style.fill = layer.style.stroke`.
  - Set `style.strokeWidth = 0` and `style.stroke = undefined`.
- Layers without stroke pass through unchanged.

Result: an icon that renders filled instead of stroked.

#### `'slash'`

Requires `SymbolComponent` of kind `'slash'` in `icon.components`.

```
slashPath = mergedPathOfLayers(icon.components['slash'].layerIds, baseState)
```

For each primary/secondary/tertiary layer in the base state:
```ts
derivedD = booleanOp('subtract', layer.path.d, slashPath)
```

The slash component layers are set `visible: false` in the derived
state (they are already baked in).

#### `'circle'` / `'square'`

Requires `SymbolComponent` of kind `'enclosure'`.

```
enclosurePath = mergedPathOfLayers(icon.components['enclosure'].layerIds, baseState)
```

For each primary layer in the base state:
```ts
derivedD = booleanOp('unite', layer.path.d, enclosurePath)
```

Enclosure layers are set `visible: false` in derived state.

#### `'badge'`

Requires `SymbolComponent` of kind `'badge'`.

```
badgePath = mergedPathOfLayers(icon.components['badge'].layerIds, baseState)
```

For primary layers where the badge overlaps:
```ts
derivedD = booleanOp('subtract', layer.path.d, badgePath)
```

Badge component layers are **kept visible** in derived state (badge
itself is shown, just carved out from the base shape).

---

## Helper: `mergedPathOfLayers`

```ts
function mergedPathOfLayers(
  layerIds: string[],
  state: State,
): string
```

Unions all the paths in the layer list into a single compound path
string using repeated `booleanOp('unite', ...)` calls.

---

## Schema Addition

Add to `Icon.meta`:

```ts
meta?: {
  externalImport?: IconExternalImportMeta;
  derivedSpecs?: DerivedVariantSpec[];   // NEW
};
```

Stores which derivations have been applied. Used by the "Re-derive
variants" warning to know which specs to re-run after base edits.

---

## Editor UI

### Derive Variant Panel (InspectorPanel)

Location: collapsed section "Derived Variants" below symbol components.

- Show a button per modifier returned by `availableModifiers()`.
- Disabled if `canDeriveVariant()` returns false.
- On click: run `applyDerivedVariant()`, dispatch `addVariant()` to
  store, show a toast "Fill variant created".
- Show a spinner while running (ops can take ~50ms on complex paths).

### Re-derive Warning

When the base variant's geometry changes and `icon.meta.derivedSpecs`
is non-empty, show a yellow banner above the canvas:

> "Derived variants (fill, slash) may be out of date.
>  [Re-derive All]  [Dismiss]"

"Re-derive All" loops over `derivedSpecs`, removes old derived
variants, and re-applies each spec.

---

## Error Handling

| Error condition | Behaviour |
|---|---|
| `booleanOp` returns empty string | Keep the layer unchanged; emit `warn: boolean-result-empty` |
| Missing component for modifier | `canDeriveVariant()` returns false — button is disabled |
| Mismatched path commands | `booleanOp` handles via Paper.js; result path may simplify |

---

## Files

| File | Purpose |
|---|---|
| `lib/schema/variant-derivation.ts` | Add `applyDerivedVariant`, `mergedPathOfLayers` |
| `lib/schema/types.ts` | Add `meta.derivedSpecs` |
| `components/editor/InspectorPanel.tsx` | Derive Variant panel, re-derive banner |
| `tests/derived-variants.test.ts` | Boolean correctness tests |

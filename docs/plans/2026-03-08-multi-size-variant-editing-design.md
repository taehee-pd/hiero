---
status: implemented
last-reviewed: 2026-03-18
---

# Multi-Size Variant Editing Design

## Goal

Support icon variants as independent masters with their own layer/state trees, plus a canvas-level variant picker for switching and creating sizes quickly.

## Data Model

- `Icon.states` moves into `Variant.states`.
- `Variant` owns:
  - `id`
  - `name?`
  - `size`
  - `viewBox`
  - `guideMasterId?`
  - `defaultState`
  - `states`
- `size` is editable metadata, not a unique identifier.
- Global guide presets remain in `project.guideMasters`.

## Store Behavior

- `addVariant(iconId, size, viewBox, options?)`
  - clones states/layers from a source variant
  - auto-scales `viewBox`
  - keeps path data unchanged
- `removeVariant(iconId, variantId)`
  - removes a variant unless it is the last one
  - switches the editor to a fallback variant if needed
- `duplicateLayersToVariant(iconId, fromVariantId, toVariantId, stateId?)`
  - clones source layers into a target variant

## Migration

- On load, legacy icon-level `states` are copied into each variant that does not already own its own state tree.
- Legacy guide set references are migrated into global guide masters.

## UI

- Add a canvas header variant row with:
  - active variant label
  - variant chips
  - `+` button with preset sizes `12, 16, 20, 24, 32, 48`
  - custom numeric size input
  - remove current variant action

## Verification

- Switching variants preserves the current state when it exists in the target variant.
- Adding a variant clones editable layers from the active variant.
- Editing one variant no longer mutates another.
- Export/render use the active variant's nested state tree.

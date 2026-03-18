---
status: implemented
last-reviewed: 2026-03-18
---

# Runtime JSON Export Design

## Goal

Add a deterministic `runtime-json` export layer that turns the editor's project model into a publishable runtime contract for animated SVG icon components.

The export contract should support SF Symbols-style icon-level animation authoring while keeping each exported variant self-contained and directly executable by the runtime library.

## Current Context

- The editor stores:
  - icon-level `transitions` and `effects`
  - variant-local `states`
  - token references in layer paint styles
- The existing SVG exporter already establishes several useful rules:
  - stable layer ordering
  - token resolution
  - canonical transform serialization
  - editor-only metadata stripping

The new runtime export should reuse those normalization rules instead of inventing a separate geometry path.

## Approaches Considered

### 1. Global Meta + Variant Layer Payloads

- `meta.json` contains identity, states, transitions, effects, and variant registry
- `v24.json` contains only state geometry for that variant

Pros:
- less duplicated transition metadata

Cons:
- runtime must join global behavior with variant-local geometry
- invalid transitions can leak into a variant that cannot actually execute them
- weakens the "self-contained runtime file" goal

### 2. Self-Contained Variant Runtime Files

- `meta.json` contains identity and variant manifest only
- each variant file contains the executable state graph and layer payload for that variant

Pros:
- runtime stays simple
- each file is deterministic and cacheable
- publish-time validation can reject invalid transitions before release

Cons:
- duplicates some transition/effect metadata across variants

### 3. Export Everything, Filter in Runtime

- exporter copies icon-level transitions/effects into every variant file
- runtime decides what is valid

Pros:
- smallest exporter

Cons:
- pushes correctness into every consumer
- runtime contract is no longer trustworthy
- makes CI validation weaker and harder to explain

## Recommendation

Use approach 2.

Author transitions and effects once at the icon level in the editor, then materialize only the subset that is valid for each concrete variant during export.

This is the closest fit to the SF Symbols goal:

- authoring intent remains icon-level
- exported runtime data is concrete and executable per rendered symbol
- invalid correspondences are caught at export time, not at render time

For `meta.json`, include only discoverability metadata. Do not list raw authored transition IDs there. The executable transition graph belongs in each variant file after validation.

## Runtime Package Shape

```text
icons/
  index.json
  chevron-right/
    meta.json
    v24.json
    v16.json
```

### `icons/index.json`

Manifest for discovery and code generation.

```ts
type RuntimeIconManifest = {
  icons: Array<{
    id: string;
    name: string;
    category?: string;
    tags?: string[];
    variants: string[];
  }>;
};
```

### `icons/<icon>/meta.json`

Static icon metadata and variant registry only.

```ts
type RuntimeIconMeta = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variants: Record<
    string,
    {
      size: number;
      viewBox: [number, number, number, number];
      defaultState: string;
    }
  >;
};
```

### `icons/<icon>/v24.json`

Self-contained executable payload for one variant.

```ts
type RuntimeVariantPayload = {
  variant: {
    id: string;
    size: number;
    viewBox: [number, number, number, number];
    defaultState: string;
  };
  states: Record<string, RuntimeState>;
  transitions: Record<string, RuntimeTransition>;
  effects?: Record<string, RuntimeEffect>;
};
```

## Export Rules

### Source of Truth

- `Icon.transitions` and `Icon.effects` remain editor-owned authoring data
- `Variant.states` remains the geometry source of truth for a concrete size variant

### Normalization

- resolve token paints to concrete color strings before serialization
- serialize transforms in a fixed order:
  - `translate`
  - `rotate`
  - `scale`
- strip editor-only data:
  - guides
  - import metadata
  - layer roles
  - topology contracts after validation
  - any store-only concerns such as selection/history
- emit layers in deterministic order by sorted layer ID
- emit object keys in deterministic order so equal input produces byte-identical JSON

### Layer Output

Each exported runtime layer includes only runtime-relevant SVG data:

- `id`
- `d`
- `fillRule?`
- `fill`
- `stroke`
- `strokeWidth?`
- `fillOpacity?`
- `strokeOpacity?`
- `lineCap?`
- `lineJoin?`
- `transform?`

Clip/mask handling should follow the same rendered result as the static SVG export path. If the current runtime contract is path-only, clip-path support may need either:

- inclusion in `RuntimeLayer`, or
- a documented temporary exclusion from `runtime-json`

That detail should be settled during implementation, but the export must not silently diverge from the static SVG output.

## Validation

Validation happens in the exporter, not in the runtime library.

For a transition to be included in a variant payload:

- `from` and `to` states must both exist in that variant
- referenced `fromLayerId` and `toLayerId` must exist in those states
- `track` bindings must use supported runtime properties
- `morph` bindings must satisfy the geometry constraints needed for the chosen topology mode

If a transition is invalid for a variant:

- omit it from that variant payload
- emit a diagnostic explaining why

Suggested export modes:

- local preview mode:
  - export valid data
  - surface warnings
- publish mode:
  - fail if any expected exported variant has transition diagnostics

This preserves icon-level authoring convenience without allowing broken runtime data into release artifacts.

## Exporter API

Create `lib/export/export-runtime-json.ts` with two entry points:

```ts
type RuntimeExportDiagnostic = {
  level: 'warning' | 'error';
  iconId: string;
  variantId?: string;
  transitionId?: string;
  message: string;
};

function exportRuntimeIconVariant(
  project: Project,
  iconId: string,
  variantId: string,
): {
  meta: RuntimeIconMeta;
  variant: RuntimeVariantPayload;
  diagnostics: RuntimeExportDiagnostic[];
};

function exportRuntimePackage(project: Project): {
  manifest: RuntimeIconManifest;
  files: Array<{ path: string; contents: string }>;
  diagnostics: RuntimeExportDiagnostic[];
};
```

The file writer can be added later. The first implementation should focus on deterministic in-memory export so it is easy to test.

## Determinism Requirements

The runtime exporter must be byte-stable:

- same project data in memory produces the same serialized files
- object order and array order are explicit, never incidental
- no timestamps or environment-dependent fields appear in generated output

This makes CI diffs small, enables snapshot tests, and avoids accidental churn in the runtime library repo.

## Testing

Add tests for:

- stable output for the same project input
- token color resolution
- transform serialization
- per-variant filtering of invalid transitions
- omission of editor-only metadata
- manifest generation across multiple icons and variants
- parity checks between exported runtime layer styling and static SVG export styling

Use the existing sample project and focused fixture projects rather than large snapshots only.

## Publish Boundary

The runtime export layer is the contract boundary between the editor and the runtime library.

- editor concerns stop at authoring and validation
- runtime concerns start at rendering and animation playback
- sync/publish tooling should consume exported files, not raw editor project JSON

That keeps the runtime package insulated from future editor changes.

## References

- [WWDC25 Session 337](https://developer.apple.com/videos/play/wwdc2025/337/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)

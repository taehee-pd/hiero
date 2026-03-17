# Import Adapter SDK and Pipeline Contract

This document defines the external icon import architecture for adapters,
normalization boundaries, provenance, diagnostics, and test expectations.

## Adapter lifecycle

1. **Register** adapter into `adapterRegistry` with a unique `descriptor.id`.
2. **Resolve** adapter by id, input mode, or source type.
3. **Fetch** source input through `adapter.fetch(request)`.
4. **Sanitize** fetched SVG with `sanitizeSvg`.
5. **Normalize** sanitized SVG into `NormalizedIcon` via `normalizeSvg`.
6. **Convert** `NormalizedIcon` into internal `Icon` schema via `convertNormalizedIconToIcon`.
7. **Insert** resulting icon into store/project (`insertIcon`).

Adapters must remain stateless and deterministic for identical inputs.

## Normalized representation contract

Adapters are constrained to import IR boundaries:

- `ExternalIconImportResult.intermediate: { kind: 'svg-source', svgContent }`
- `svgContent` is retained as a compatibility alias.
- Adapters must **not** emit internal schema types (`Icon`, `Layer`, etc.).

Adapter-specific source resolution (e.g. Lucide lookup) stays in adapter modules,
never in generic sanitizer/normalizer/conversion logic.

## Provenance requirements

Each adapter result must include `ExternalIconProvenance`:

- `adapterId` (required)
- `sourceLibrary`, `sourceVersion`, `sourceIconId`, `sourceLicense` (optional)
- `importedAt` ISO timestamp (required)

During schema conversion, provenance is persisted on
`Icon.meta.externalImport`.

## Warning and error expectations

Diagnostics must use typed warnings/errors and remain user-readable:

- UX states: `idle`, `validating`, `importing`, `success`,
  `success_with_warnings`, `failed`.
- Do not expose raw parser internals in normal UX.
- Developer diagnostics may be shown in explicit debug mode.

Warnings should include fidelity-loss/unsupported notices when applicable
(e.g. unsupported features dropped, style dependencies removed,
transform flattening loss).

## Test requirements for adapters

Any new adapter must include and/or update:

1. **Registry tests**
   - registration, duplicate id handling
   - resolution by input mode and source type
2. **Adapter contract tests**
   - supported input mode success
   - unsupported mode typed error
   - deterministic output shape
3. **Source adapter tests**
   - source-specific happy paths and edge cases
4. **Normalization + sanitization tests**
   - unsupported feature handling, security stripping, warning mapping
5. **Schema conversion tests**
   - valid editable `Icon` output with default variant/state/layers
6. **Provenance tests**
   - provenance carried from adapter through conversion
7. **UX/store transition tests**
   - expected state transitions and import acceptance behavior

Fixtures should cover:

- simple path-only icons
- primitive-heavy icons
- grouped/transformed icons
- multi-node library icons
- unsupported clipPath/mask
- unsafe SVG input
- deterministic output verification

## Minimal adapter template

Use `lib/import/adapters/_template.ts` as the canonical starter.

Minimum requirements in template implementations:

- declare `capabilities.inputModes` and `capabilities.sourceType`
- reject unsupported modes with `ExternalIconImportError`
- return `intermediate.svgContent` + provenance + warnings
- keep source resolution in adapter-specific code

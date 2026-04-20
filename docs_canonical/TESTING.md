# Testing

## Current Strategy

Testing in this repository is code-centric and broad in module coverage, but only partially formalized as policy.

Observed test types include:

- pure module/unit tests
- editor behavior tests
- export and compile pipeline tests
- runtime core and runtime DOM tests
- snapshot tests for deterministic output
- store and workspace behavior tests

## Test Runner

The active test runner is Bun's built-in test framework.

Evidence:

- test files import from `bun:test`
- test suites live under `tests/`
- legacy docs reference `bun test`

Recommended command:

- `bun test`

Repository script entrypoints include:

- `corepack pnpm test` (full Bun suite)
- `corepack pnpm test:sync` (sync/export integration-focused suite)

## Test Directory Structure

- `tests/`: primary test suites
- `tests/__snapshots__/`: snapshot artifacts
- `tests/fixtures/`: sample inputs and contract fixtures
- `tests/helpers/`: test-only helpers

Representative areas covered:

- `tests/runtime-core.test.ts`
- `tests/runtime-dom.test.ts`
- `tests/runtime-react.test.tsx`
- `tests/export-runtime-json.test.ts`
- `tests/compile-pipeline.test.ts`
- `tests/workspace-store.test.ts`
- `tests/svg-import.test.ts`
- `tests/platform-types.test.ts`
- `tests/react-adapter.test.ts`
- `tests/manifest-cleanup.test.ts`
- `tests/storybook-generator.test.ts`
- `tests/lottie-export.test.ts`
- `tests/derived-variants.test.ts`
- `tests/weight-interpolation-cubic.test.ts`
- `tests/adapter-heroicons.test.ts`
- `tests/adapter-phosphor.test.ts`
- `tests/adapter-material-symbols.test.ts`
- `tests/npm-connector.test.ts`
- `tests/phase-c-editor-animation.test.ts`
- `tests/phase-d-react-api.test.tsx`
- `tests/phase6-sync-distribution.test.ts`
- `tests/phase-7-cross-platform.test.ts`
- `tests/phase-8-morph.test.ts`
- `tests/phase-78-coverage-boost.test.ts`
- `tests/morph.test.ts`

## Testing Conventions

Observed conventions in the current codebase:

- deterministic and regression-sensitive outputs are snapshotted
- tests exercise library modules directly rather than only through UI integration
- feature-specific tests are grouped by behavior area
- sample schema data and fixtures are reused for repeatability
- browser-only dependencies such as Paper.js boolean ops are mocked in
  Bun tests rather than executed directly

## Coverage Expectations

Phase A runtime/export surfaces have a scoped LCOV threshold gate via `scripts/check-coverage.ts` (line coverage >= 60%) enforced in CI. The coverage scope includes `lib/export/export-runtime-json.ts`, `lib/runtime-core/`, `lib/runtime-dom/`, and `lib/runtime-react/`.

Safe working expectation for contributors and agents:

- add or update tests when changing schema behavior, editor logic, exports, runtime behavior, or compile contracts
- run targeted tests for the area being changed
- run broader test sweeps when changes affect shared schema, export formats, or runtime layers

## Build and Verification Pairing

Testing should be paired with build checks where relevant:

- use `bun test` for logic and output verification
- use `npx tsc --noEmit` for type verification
- use `bun run lint` for ESLint enforcement (0 errors + 0 warnings gate)
- use `corepack pnpm build` for Next.js build validation
- when touching `packages/hiero-cli/`, also run `cd packages/hiero-cli && bun run build && node dist/bin.js --help` to smoke-test the built binary, and `npm pack --dry-run` to verify the tarball contents

## Export Adapter Test Expectations

Cross-platform export adapters (`lib/export/adapters/`) should have tests covering:

- Adapter output structure (file paths, barrel exports, component shape)
- Downgrade rule application (morph -> crossfade, spring -> ease-in-out, etc.)
- Platform diagnostic emission via `checkPlatformCapabilities()`
- Stale-file manifest computation (`manifest-cleanup.ts`)

Existing tests: `tests/react-adapter.test.ts`, `tests/manifest-cleanup.test.ts`, `tests/storybook-generator.test.ts`, `tests/platform-types.test.ts`, `tests/phase-7-cross-platform.test.ts`. Swift and Flutter adapter tests are covered in the Phase 7 test file.

## Newer Surface Expectations

Additional observed coverage areas now include:

- Lottie export and downgrade diagnostics: `tests/lottie-export.test.ts`
- Derived variant generation and mocked boolean ops:
  `tests/derived-variants.test.ts`
- Cubic weight interpolation and validation:
  `tests/weight-interpolation-cubic.test.ts`
- External import adapters:
  `tests/adapter-heroicons.test.ts`,
  `tests/adapter-phosphor.test.ts`,
  `tests/adapter-material-symbols.test.ts`
- npm-registry connector, dry-run flow, bump recommendation, and auto-publish manager:
  `tests/npm-connector.test.ts`
- Animate panel revamp regression (no strategy dropdown, no compatibility
  badges, no `role="alert"`, Advanced disclosure collapsed by default,
  SF Symbols 7 hierarchy labels): `tests/transition-panel.test.tsx`
- Phase R6 navigation (`?` → `hiero:open-shortcuts` custom event,
  Shift+/ fallback, input-suppression): `tests/r6-navigation.test.tsx`

## Cross-Icon Morphing Test Expectations

Phase 8 morphing tests (`tests/phase-8-morph.test.ts`, `tests/morph.test.ts`) cover:

- Arc-to-cubic conversion (simple, degenerate, large, elliptical, rotated arcs)
- Rotational interpolation (t=0, t=1, midpoint, coincident handles)
- Shape index optimization (open paths, misaligned closed paths, segment rotation)
- Cross-icon morphing pipeline (sub-path matching, subdivision, centroid collapse, interpolation)
- Topology incompatibility detection (compatible, stroke-to-fill, subpath mismatch)
- Coordinated crossfade (opacity curves, scale emphasis, draw-coordinated mode)
- Geometry change warnings (`detectGeometryBreaks` for subpath/closed/command/point changes)
- Transition resolver integration (crossIconMorph fallback, topology override, topology analysis attachment)
- Unified autoMorph: automatic strategy selection (identity, intrinsicStrict, bestGuess, pointSampled)
- Intrinsic interpolation: polar decomposition roundtrip, angle lerp (shortest-arc), handle decompose/reconstruct, degenerate chord handling
- Draw animation: open-path guard (isPathFullyOpen, isStrokedLayer, isDrawEligible, filterDrawEligibleLayers), trim value computation (reveal/erase/slide modes), trim offset rotation

## Known Conflicts / Notes

- The root `package.json` now defines `test` as `bun test`, so repository-level test entrypoints are explicit.
- Legacy planning docs state that test runner formalization is still pending; that remains true from an operational-policy standpoint even though the practical runner is identifiable from the codebase.

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
- `tests/phase-c-editor-animation.test.ts`
- `tests/phase-d-react-api.test.tsx`
- `tests/phase6-sync-distribution.test.ts`

## Testing Conventions

Observed conventions in the current codebase:

- deterministic and regression-sensitive outputs are snapshotted
- tests exercise library modules directly rather than only through UI integration
- feature-specific tests are grouped by behavior area
- sample schema data and fixtures are reused for repeatability

## Coverage Expectations

Phase A runtime/export surfaces have a scoped LCOV threshold gate via `scripts/check-coverage.ts` (line coverage >= 60%) enforced in CI. The coverage scope includes `lib/export/export-runtime-json.ts`, `lib/runtime-core/`, `lib/runtime-dom/`, and `lib/runtime-react/`.

Safe working expectation for contributors and agents:

- add or update tests when changing schema behavior, editor logic, exports, runtime behavior, or compile contracts
- run targeted tests for the area being changed
- run broader test sweeps when changes affect shared schema, export formats, or runtime layers

## Build and Verification Pairing

Testing should be paired with build checks where relevant:

- use `bun test` for logic and output verification
- use `corepack pnpm build` for Next.js build validation
- use `corepack pnpm desktop:build` or `desktop:dist` when changing desktop build or release behavior

## Export Adapter Test Expectations

Cross-platform export adapters (`lib/export/adapters/`) should have tests covering:

- Adapter output structure (file paths, barrel exports, component shape)
- Downgrade rule application (morph -> crossfade, spring -> ease-in-out, etc.)
- Platform diagnostic emission via `checkPlatformCapabilities()`
- Stale-file manifest computation (`manifest-cleanup.ts`)

Existing tests: `tests/react-adapter.test.ts`, `tests/manifest-cleanup.test.ts`, `tests/storybook-generator.test.ts`, `tests/platform-types.test.ts`. Swift and Flutter adapter tests are not yet formalized as standalone test files.

## Known Conflicts / Notes

- The root `package.json` now defines `test` as `bun test`, so repository-level test entrypoints are explicit.
- Legacy planning docs state that test runner formalization is still pending; that remains true from an operational-policy standpoint even though the practical runner is identifiable from the codebase.

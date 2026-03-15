# Icon Authoring Tool

A Next.js-based icon editor for authoring and inspecting SVG path layers across icon states and variants.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Zustand + zundo for editor state and undo/redo history
- Paper.js runtime (overlay rendering for selection/grid helpers)

## Getting Started

Prerequisites:

- Node.js 20+
- Corepack enabled

Install dependencies:

```bash
corepack pnpm install
```

Run the dev server:

```bash
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `corepack pnpm dev` - start local development server
- `corepack pnpm build` - production build
- `corepack pnpm start` - run production server
- `corepack pnpm lint` - run ESLint (requires eslint to be installed/configured)
- `corepack pnpm desktop:dev` - start the web dev server if needed and launch the Electrobun desktop app
- `corepack pnpm desktop:build` - build the desktop app bundle
- `corepack pnpm desktop:dist` - build desktop distribution artifacts

## Desktop Development

The desktop shell lives under `desktop/` and wraps the same app with native menus, file dialogs, and desktop file I/O.

Use:

```bash
corepack pnpm desktop:dev
```

That command:

- reuses an existing Next dev server on `http://localhost:3000` when present
- otherwise starts the Next dev server
- launches the desktop app through the repaired Electrobun CLI path

### Electrobun vendor patch

This repo currently applies a small postinstall patch in [desktop/scripts/patch-electrobun-wrapper.cjs](/Users/taehee/IconStudio/desktop/scripts/patch-electrobun-wrapper.cjs).

Why it exists:

- the published `electrobun` package's binary wrapper was failing for this project with opaque `Bundle failed` errors
- the published source CLI also ships missing source-side modules needed for `dev` and `build`
- the patch restores those missing pieces and reroutes the wrapper to the working source CLI

The patch is reapplied automatically on `pnpm --dir desktop install`.

## Project Structure

- `app/` - Next.js app router entrypoints
- `components/editor/` - editor shell, toolbar, panels, and canvas
- `lib/editor-store/` - Zustand store, selectors, hooks, history integration
- `lib/editor-renderer-svg/` - SVG geometry rendering
- `lib/editor-overlay-canvas/` - editor-only overlay drawing (grid, selection, guides)
- `lib/schema/` - canonical project/icon schema types and sample project
- `public/vendor/paper-core.min.js` - Paper.js browser runtime loaded by overlay hook
- `desktop/` - Electrobun shell, native bridge, and desktop build scripts

## Notes

- The overlay canvas is editor-only; it does not affect SVG export output.
- Geometry source-of-truth remains SVG `d` path data in the schema layer model.

## Compiler Pipeline (end-to-end)

Data flow is intentionally linear and deterministic:

1. **Editor model (`Project`)** -> `exportCompiledIconFile` (one file per icon)
2. **Compiled icons** -> `generatePackageManifestFile` (`icons.manifest.json`)
3. **Compiled icons + manifest** -> `generateReactIconComponents` (runtime-ready React files)
4. Optional: **previous compiled build + current compiled build** -> `diffCompiledIcons` (`IconChangeRecord` files)

Use the integrated command:

```bash
bun scripts/compile-icons.ts \
  --project tests/fixtures/e2e/compiler-project.json \
  --out ./.artifacts/icons \
  --package-name @icophone/icons \
  --package-version 1.0.0 \
  --generate-react
```

### Schema evolution notes

- Breaking compiled schema changes must bump the `$schema` **major** version.
- Runtime loader migration is selected by schema version (manifest/package schema context + compiled `$schema`), then routed through the migration hook in `parseCompiledIconJson`.
- Mixed compiled icon schema versions in one manifest are rejected.

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

## Project Structure

- `app/` - Next.js app router entrypoints
- `components/editor/` - editor shell, toolbar, panels, and canvas
- `lib/editor-store/` - Zustand store, selectors, hooks, history integration
- `lib/editor-renderer-svg/` - SVG geometry rendering
- `lib/editor-overlay-canvas/` - editor-only overlay drawing (grid, selection, guides)
- `lib/schema/` - canonical project/icon schema types and sample project
- `public/vendor/paper-core.min.js` - Paper.js browser runtime loaded by overlay hook

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

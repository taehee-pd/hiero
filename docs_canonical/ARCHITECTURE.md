# Architecture

## System Overview

This repository is a shared product codebase for an icon design tool that runs in both web and desktop environments.

The web app is a Next.js App Router application. The desktop app is an Electrobun shell that hosts the same UI and adds native file, menu, window, and release capabilities. Authoring data flows through a shared schema and editor store, then into import, export, compile, and runtime layers.

## Primary Runtime Surfaces

- Explorer surface: `app/page.tsx` renders the icon library and browsing workflow.
- Editor surface: `app/editor/page.tsx` renders the authoring workspace.
- Desktop surface: `desktop/src/bun/` and `desktop/src/mainview/` wrap the same app with native capabilities.

## Core Module Boundaries

### Schema and Documents

`lib/schema/` is the canonical document and type boundary.

- `types.ts` defines the core product model.
- `guards.ts` validates `Project` and `Workspace` inputs.
- `workspace.ts` handles workspace/project conversion and icon-set selection.

All higher layers depend on this model.

### Editor State and Authoring Logic

`lib/editor-store/` is the application state boundary for authoring.

- owns loaded `workspace` and active `project`
- tracks current icon, variant, state, selection, tabs, favorites, and dirty state
- exposes editing actions, history boundaries, and view state

`lib/editor-core/` contains lower-level editing and geometry logic:

- path parsing and serialization
- point and layer editing commands
- snapping, topology, boolean ops, and shape generation
- keyboard handling and viewport math

### Rendering

- `lib/editor-renderer-svg/`: renders authored state into SVG for the editor and preview use cases.
- `lib/editor-overlay-canvas/`: renders non-exported overlays such as guides, selection affordances, and editor feedback.

These modules support the editor UI but do not define the canonical document shape.

### Import and Export

- `lib/import/`: converts SVG input into schema-compliant icon data.
- `lib/export/`: produces SVG, runtime JSON, compiled icon artifacts, package manifests, change diffs, and generated React component outputs.
- `lib/compiler-contracts/`: validates compiled/exported artifact shapes.

The export layer is already active and is not only a roadmap concern.

### Runtime Consumption

The repository contains multiple runtime-focused layers:

- `lib/runtime-core/`: transition resolution, easing, scheduling, and state-machine behavior
- `lib/runtime-dom/`: DOM renderer/driver for runtime icons
- `lib/runtime-react/`: React wrapper components and hooks
- `lib/runtime-sdk/`: compiled icon rendering primitives and renderer logic

These layers consume icon data after authoring/export rather than participating in editor state directly.

### Platform Boundary

Desktop-only behavior crosses through a platform boundary:

- `desktop/src/shared/rpc-types.ts`: typed request/message contract
- `lib/platform/bridge.ts`: browser-side environment abstraction
- `desktop/src/bun/`: native file/menu/window/update operations

This keeps product UI code mostly shared between browser and desktop.

## High-Level Data Flow

Authoring flow:

1. A project or workspace document is loaded through the editor store.
2. Editor components read state through `lib/editor-store/` selectors and hooks.
3. Editing actions call into store actions and `lib/editor-core/` utilities.
4. The editor renderer and overlay layers visualize current authored state.

Import/export flow:

1. SVG input is normalized into the schema through `lib/import/`.
2. Export modules serialize the current model into SVG, runtime JSON, or compiled artifacts.
3. Compile pipeline code writes deterministic files for downstream consumers.
4. Runtime layers render authored or compiled icon data outside the editor.

Desktop flow:

1. The webview hosts the same UI as the browser app.
2. Desktop bridge code sends typed requests to the Bun main process.
3. Bun-side handlers perform native file I/O, menus, export actions, and release-related tasks.

## Architectural Constraints

- Shared model first: editor, exports, and runtime-related code are anchored to the schema layer.
- Dual-document compatibility: legacy `Project` files and newer `Workspace` files must both remain readable.
- Deterministic outputs: compile and export code sorts and serializes data in stable ways for repeatable artifacts and tests.
- Shared UI across web and desktop: native capabilities must route through the platform bridge instead of scattering platform checks across product code.
- Desktop production build depends on a static Next export staged into the Electrobun mainview.

## Known Conflicts / Notes

- Some legacy docs describe runtime/export work as future phases, but the repository already contains real runtime and export implementations under `lib/export/` and `lib/runtime-*`.
- Desktop architecture docs are broadly accurate, but naming in those docs still uses `Icophone` rather than a single settled product name.

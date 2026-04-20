---
status: partially-implemented
last-reviewed: 2026-03-18
---

# Target Codebase Export Plan

## Goal

Make Hiero export an icon set directly into a target application codebase instead of assuming the primary delivery mechanism is a standalone npm package.

The target may be:

- a Storybook-based design system repo
- a Sanity Studio repo
- another React codebase that wants generated icon files checked into source control

Package publishing remains useful, but it becomes a secondary output mode rather than the default plan.

## Primary Decision

The system should be designed around `target adapters`.

Flow:

Editor -> runtime-json export -> target adapter -> generated files in target repo -> target repo build/test/deploy

Not:

Editor -> generated library repo -> npm publish -> consumer update

This is the better default for teams that already have an existing application or design system repository and want icons committed directly into that codebase.

## Why This Is Better

- It matches how Storybook and Sanity teams usually work: icons live inside the product repo or design-system repo they already review and deploy.
- It reduces packaging friction during adoption.
- It makes preview and review simpler because generated files show up in the same PR as the consuming code.
- It keeps runtime-json as the internal contract while allowing multiple delivery adapters later.

The runtime contract still matters, but the output destination changes from "published package" to "generated source files inside a chosen repo."

## Architecture Change

The four-layer model becomes:

- Editor
- Exporter
- Target Adapter Layer
- Host Codebase

### Editor

Still owns:

- icon authoring
- states, transitions, effects
- SF Symbols-style semantic annotations

### Exporter

Still owns:

- deterministic runtime-json
- static SVG fallback export
- diagnostics and validation

### Target Adapter Layer

New primary layer.

It owns:

- mapping exported artifacts into a specific repo layout
- generating wrapper files for the host environment
- optionally copying or vendoring runtime helpers into the target codebase
- generating index files, stories, preview components, and registration glue

### Host Codebase

Examples:

- Storybook monorepo
- Sanity Studio app
- Next.js design-system site

This repo becomes the final delivery artifact instead of an intermediate library package repo.

## Export Modes

Support these modes in order:

### 1. `target-codebase`

Primary mode.

Writes generated files directly into a checked-out target repo path.

Example outputs:

- `src/icons/generated/*`
- `src/components/icons/*`
- `stories/icons/*.stories.tsx`
- `sanity/lib/icons/*`

### 2. `runtime-json`

Raw structured export for debugging, tests, or custom downstream tooling.

### 3. `package`

Optional later mode that builds an npm package when a team explicitly wants library publishing.

## Target Adapter Model

Adapters should be explicit and opinionated.

```ts
type ExportTarget =
  | {
      kind: 'storybook-react';
      rootDir: string;
      iconDataDir: string;
      componentDir: string;
      storiesDir?: string;
    }
  | {
      kind: 'sanity-studio';
      rootDir: string;
      iconDataDir: string;
      componentDir: string;
      previewDir?: string;
    }
  | {
      kind: 'react-app';
      rootDir: string;
      iconDataDir: string;
      componentDir: string;
    };
```

Each adapter takes the exported runtime payloads and writes host-specific files.

## Adapter Responsibilities

### Shared responsibilities

Every adapter should:

- write runtime-json-derived icon data files
- write generated React icon components that consume the local runtime helpers
- write deterministic barrel/index files
- remove stale generated files for deleted icons
- produce a summary of created, updated, and removed files

### Storybook adapter

Should additionally:

- generate icon showcase stories
- generate a catalog story or index for browsing icons
- keep generated stories separate from hand-written stories

Recommended output shape:

- `src/icons/generated/data/*.ts`
- `src/icons/generated/components/*.tsx`
- `src/icons/generated/index.ts`
- `src/icons/generated/stories/*.stories.tsx`

### Sanity adapter

Should additionally:

- generate icon preview components for studio UIs
- generate helper registries for field options or preview lookups
- avoid assuming control of Sanity schema structure unless explicitly configured

Recommended output shape:

- `src/icons/generated/data/*.ts`
- `src/icons/generated/components/*.tsx`
- `src/icons/generated/registry.ts`
- `src/icons/generated/previews/*.tsx`

The exporter should integrate with a host repo, not attempt to own the entire Sanity schema.

## Runtime Delivery Strategy

Do not require the target codebase to install a separately published runtime package for the first phase.

Instead, use one of these two strategies:

### Preferred: vendored runtime helpers

Generate or copy a small stable runtime layer into the target repo:

- `src/icons/generated/runtime/*`

Pros:

- no package registry dependency
- self-contained PRs
- easier adoption in Storybook and Sanity repos

Cons:

- runtime code is duplicated across target repos

### Secondary: workspace or package dependency

Later, teams can switch adapters to import the runtime from a published package or shared workspace package.

That should remain optional.

## Publish and Sync Change

The sync pipeline should target a codebase repo directly.

Recommended primary flow:

1. user selects a target repo path or connected repo
2. editor exports runtime-json
3. adapter writes generated files into configured directories
4. editor creates a branch and commit in that same target repo
5. CI in the target repo runs Storybook, Sanity, app tests, or deployment checks

This is a better review unit than publishing to a separate icon-library repo and waiting for downstream consumers to upgrade.

## Config Model

Add target export configuration to the project:

```ts
type TargetExportConfig = {
  defaultTarget?: ExportTarget;
  preserveManualFiles?: boolean;
  generatedFileBanner?: string;
};
```

Do not hard-code Storybook or Sanity assumptions in the core exporter. Keep those in adapters.

## Implementation Order

### Step 1

Keep the current deterministic runtime-json exporter as the internal source format.

### Step 2

Add a `target-codebase` generation layer:

- `lib/export/generate-target-codebase.ts`
- `lib/export/targets/storybook-react.ts`
- `lib/export/targets/sanity-studio.ts`
- `lib/export/targets/react-app.ts`

### Step 3

Generate vendored runtime helpers plus icon components into the target repo.

### Step 4

Add repo write/sync behavior:

- local directory export first
- branch/commit automation second

### Step 5

Only after that, add optional package export mode.

## Roadmap Implication

The order should now be:

1. deterministic runtime-json export
2. local target-codebase generation
3. Storybook adapter
4. Sanity adapter
5. target repo sync/commit flow
6. optional package publishing

This is the right planning shape if the goal is "icons should land directly inside the consuming codebase."

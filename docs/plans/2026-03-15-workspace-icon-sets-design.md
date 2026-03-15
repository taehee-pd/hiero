# Workspace Icon Sets Design

## Goal

Evolve Icophone from a single-library project into a workspace model that supports:

- multiple icon sets inside one workspace
- icon-set level styles, collections, export profiles, and GitHub sync targets
- bulk export and GitHub sync for an entire icon set from the explorer
- a Figma-like hierarchy of `workspace > icon set > icon`
- desktop-only editor tabs that can open multiple icons while still editing one active icon at a time

## Product Shape

### Hierarchy

The primary content hierarchy becomes:

1. workspace
2. icon set
3. icon

An icon set is the logical replacement for today's top-level `Project`. It owns:

- metadata and name
- icons
- collections
- guide masters
- token/style data
- export profiles
- GitHub sync settings

### Explorer

The explorer becomes the workspace home.

- Left rail: icon sets
- Main pane: icons for the selected icon set
- Bulk actions operate on the selected icon set
- Workspace actions can later expand to `Export all sets` and `Sync all sets`

Each icon set row/card should surface:

- name
- icon count
- style/tone metadata when present
- GitHub sync target summary
- bulk actions such as export and sync

### Editor

The editor remains single-target at the canvas level.

- Only one icon is editable at a time
- Desktop adds a tab strip above the editor
- Each tab points to one icon in one icon set
- Switching tabs swaps the active editor context

The tab strip is session UI, not canonical document content.

## Data Model

### Workspace

Introduce a top-level `Workspace` document with:

- `version`
- `meta`
- `iconSets`
- `activeIconSetId` (optional convenience field)

### Icon Set

The existing `Project` shape becomes the basis for `IconSet`.

This keeps editor logic reusable because most icon-authoring behavior still works against one active icon set at a time.

### GitHub Sync Settings

GitHub sync settings move from local UI persistence into icon-set data so they travel with the workspace:

- owner
- repo
- base branch
- package path
- export format

## Migration

Compatibility must remain smooth.

- Legacy `Project` files are still openable
- On load, a legacy project is migrated into a one-set workspace
- New saves use the workspace format

This avoids breaking current files while unlocking the new hierarchy.

## Desktop Scope

Desktop-only behavior includes:

- multi-tab icon editing
- tab restoration as session state later if desired
- keeping one active editor target at a time

The web app can continue to open one active icon editor context without the full desktop multi-tab shell.

## Reliability Requirements

- Bulk export must export all icons in the selected icon set
- GitHub sync must use the selected icon set's own sync config
- Editor mutations must persist back into the active icon set inside the workspace
- Switching icon sets or tabs must not lose unsaved edits

## Testing Focus

- schema guards for workspace and legacy-project migration
- store behavior for active icon set switching
- explorer bulk export for an icon set
- GitHub sync per icon set
- editor tabs switching the active icon without mutating the wrong set

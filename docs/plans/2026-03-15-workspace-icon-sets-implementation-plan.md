---
status: implemented
last-reviewed: 2026-03-18
---

# Workspace Icon Sets Implementation Plan

## Goal

Ship the first usable version of workspace-based icon sets with whole-set export and GitHub sync from the explorer, while keeping the existing editor mostly intact.

## Constraints

- The current store is project-centric and many editor actions mutate `project`
- Existing editor UI assumes a single active icon and variant
- Existing GitHub sync is project-wide and configured in a standalone dialog
- We need legacy project compatibility

## Strategy

### Phase 1: Schema and Guarding

- Add `Workspace`, `IconSet`, and `GitHubSyncSettings` types
- Treat the current `Project` shape as the shape of an `IconSet`
- Add guards for both workspace and legacy project files
- Add migration helpers from legacy `Project` to `Workspace`

### Phase 2: Store Foundation

- Extend editor store state with:
  - `workspace`
  - `activeIconSetId`
  - `openTabs`
  - `activeTabId`
- Keep `project` as the active icon set snapshot for editor compatibility
- Centralize syncing so any `project` mutation also writes back into the active icon set in `workspace`
- Add actions to:
  - create/remove/rename icon sets
  - switch active icon set
  - open/focus/close editor tabs

### Phase 3: Explorer Revamp

- Replace the single-library mental model with workspace + icon-set navigation
- Add icon-set level bulk export
- Add icon-set level GitHub sync controls
- Keep selection-based actions for icon-level batch workflows

### Phase 4: Editor Tabs

- Add a desktop-only tab strip above the editor
- Opening an icon from the explorer opens or focuses a tab
- Tab selection switches active icon set and icon
- Closing tabs chooses an adjacent tab when possible

### Phase 5: Persistence and Save/Open

- Save workspaces through the existing desktop save path
- Load either workspace or legacy project files
- Preserve icon-set GitHub settings in the saved document

### Phase 6: Verification

- Add tests for migration, store sync, bulk export naming, and tab behavior
- Run the relevant test subset first, then the broader suite if time allows

## First Release Scope

This release should include:

- workspace document support
- multiple icon sets in one workspace
- whole-icon-set export from the explorer
- whole-icon-set GitHub sync from the explorer
- desktop editor tabs for icons within the loaded workspace

This release can defer:

- cross-workspace tab sessions
- workspace-wide sync-all orchestration
- advanced session restore
- fully redesigned style-management UI for icon sets

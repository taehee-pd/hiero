---
status: approved
last-reviewed: 2026-03-28
---

# Workspace Persistence And Publish Flow

Date: 2026-03-28

## Goal

Close the highest-impact production-readiness gaps by:

- treating persistence as workspace-level autosave
- wiring export and publish entry points to the existing UI
- making npm publish safe and predictable with explicit immediate publish and cancellable delayed auto-publish

## Approved Direction

- Persist the full active `Workspace`, not individual icons.
- Reuse the existing persistence adapter boundary and explorer recent-projects surface.
- Keep Lottie export in the editor toolbar flow rather than inventing a second export surface.
- Keep delivery target management in the explorer project view.
- Distinguish immediate publish from save-triggered auto-publish:
  - manual publish runs now
  - auto-publish schedules after a successful save and can be canceled

## Architecture

### Persistence

- `lib/persistence/adapter.ts` remains the storage boundary.
- `IndexedDBAdapter` remains the default web implementation.
- `useAutoSave()` subscribes to editor-store changes and only schedules saves for dirty workspace mutations.
- Explorer recent projects load and hydrate the current workspace directly from persistence.

### Export Wiring

- `components/editor/Toolbar.tsx` opens `LottieExportPanel` from the existing export menu/sheet flow.
- `components/explorer/ExplorerShell.tsx` mounts `SyncTargetPanel` in the project sidebar.

### Publish Flow

- Manual publish is immediate and uses the selected semver bump.
- Auto-publish is scheduled only after a save succeeds.
- Pending publishes are tracked per target so countdowns and cancellation stay target-specific.
- Successful publish updates the stored target metadata without re-triggering the auto-publish loop.

## Data Flow

### Workspace Save

1. Editor mutations mark the store dirty.
2. `useAutoSave()` sees a dirty workspace change and debounces persistence.
3. Persistence success calls `markSaved()`.
4. `useAutoPublish()` reacts to that save event and schedules any `autoPublish.on === 'save'` npm targets.

### Manual Publish

1. User chooses bump type in `SyncTargetPanel`.
2. User clicks `Publish Now` or `Preview Publish`.
3. Client builds the publish payload from the current project.
4. Payload is posted to `/api/publish-npm`.
5. On success, the target’s published-version metadata is updated in-store.

## Guardrails

- Do not autosave clean hydration loads.
- Do not make the manual publish button wait five minutes.
- Do not schedule a fresh auto-publish because publish metadata itself was saved.
- Keep the implementation compatible with both web and desktop shells.

## Verification

- Add or update targeted tests for persistence behavior and npm publish flow.
- Run targeted Bun tests for persistence and npm publishing.
- Run repo-level lint, test, and build checks before closing the work.

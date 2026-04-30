# Save-State Taxonomy

**Status:** Reviewed
**Primary files:** `lib/persistence/save-state.ts`, `components/studio/Navbar.tsx`, `components/editor/Toolbar.tsx`

## Overview

Hiero exposes three durability tiers (autosave, draft checkpoint, published version) and one pre-tier transient state (`isDirty`). The save badge in the studio chrome must render exactly one of four states at any moment, with non-overlapping copy and a documented precedence rule.

The Hiero Self-Hosted Studio Spec Sheet calls this out as essential (§B6 + §C10):

> The product must clearly distinguish these states:
> - Unsaved changes
> - Autosaved locally
> - Saved draft
> - Published vX.Y.Z
>
> This is not just a visual issue. It requires state modeling and copy discipline.

## Goals

- One pure function decides the state — no inline conditionals scattered across components
- Copy is locked: "Unsaved changes", "Autosaved locally", "Saved draft", "Published vX.Y.Z"
- Cmd+S creates a draft checkpoint (the new explicit Save), not a file download
- The same taxonomy is applied across both the studio Navbar and the per-icon Toolbar so the badge means the same thing in both places

## Non-Goals

- This is **not** a substitute for `editorStore.isDirty` — that flag stays the canonical "transient changes pending" signal
- This does **not** trigger any side effects — pure function, render-time only

## State machine

```text
                          deriveSaveState(input)
                                  │
                                  ▼
                            isDirty?
                              │
                ┌─────────────┴──────────────┐
                │ yes                        │ no
                ▼                            ▼
            'unsaved'                  most-recent timestamp wins
                                            │
              ┌─────────────────────────────┼──────────────────────────────┐
              │                             │                              │
              ▼                             ▼                              ▼
   publishedAt is most recent    checkpointAt is most recent     only autosaveAt or nothing
              │                             │                              │
              ▼                             ▼                              ▼
        'published'                  'draft-saved'                   'autosaved'
```

### Precedence rules

```typescript
function deriveSaveState({
  isDirty,
  lastAutosaveAt,
  lastCheckpointAt,
  lastPublishedAt,
}: SaveStateInput): SaveState {
  if (isDirty) return 'unsaved';                            // dirty always wins
  if (publishedAt >= checkpointAt && publishedAt > -∞)       // ties favor publish
    return 'published';                                     //   (stronger guarantee)
  if (checkpointAt > -∞) return 'draft-saved';
  if (autosaveAt > -∞) return 'autosaved';
  return 'autosaved';                                       // clean blank slate
}
```

The "ties favor publish" rule matters for the moment immediately after a publish: `markPublished` and `markCheckpointSaved` may write within the same millisecond.

## Copy contract

```typescript
function formatSaveStateLabel(
  state: SaveState,
  agoLabel: string | null,
  publishedVersion: string | null,
): string;
```

| State | Without timestamp | With "X ago" | With version |
|---|---|---|---|
| `unsaved` | `"Unsaved changes"` | (always) | (always) |
| `published` | `"Published"` | (always) | `"Published v1.2.0"` |
| `draft-saved` | `"Saved draft"` | `"Saved draft just now"` | (n/a) |
| `autosaved` | `"Autosaved locally"` | `"Autosaved 30s ago"` | (n/a) |

Copy is sentence case throughout, per `STYLEGUIDE.md` "All-caps styling ban."

## Editor store fields

```typescript
type EditorState = {
  isDirty: boolean;
  lastSavedAt: number | null;        // autosave timestamp (existing)
  lastCheckpointAt: number | null;   // explicit Save / Cmd+S (Phase 1)
  lastPublishedAt: number | null;    // publish (Phase 2)
  lastPublishedVersion: string | null;
};

type EditorActions = {
  markSaved(updatedAt?: string): void;             // existing — autosave hook
  markCheckpointSaved(at?: number): void;          // Phase 1
  markPublished(version: string, at?: number): void; // Phase 2
};
```

All three timestamps reset to `null` when a new project is loaded (via `...initialState` spread in `loadWorkspace` / `loadProject` / `newProject`).

## Visual mapping

| State | Variant | Driving timestamp |
|---|---|---|
| `unsaved` | `warning` | (none — no "ago" label) |
| `published` | `success` | `lastPublishedAt` |
| `draft-saved` | `neutral` | `lastCheckpointAt` |
| `autosaved` | `neutral` | `lastSavedAt` |

Both `Navbar.tsx` and `Toolbar.tsx` derive `drivingTimestamp` from the resolved state and feed it into a 10-second relative-time interval to refresh the "X ago" label.

## Cmd+S binding

A global `keydown` listener on `window`:

```text
keydown
  │
  ▼
key.toLowerCase() === 's' AND (metaKey OR ctrlKey)
  │
  ├── altKey OR shiftKey  ─── ignore (let app/OS handle)
  ├── target is INPUT/TEXTAREA/contentEditable  ─── ignore (don't steal in-input save)
  │
  └── otherwise
       │
       ▼
       event.preventDefault()
       saveDraftCheckpoint() (lib/persistence/use-persistence.ts)
       toast({ title: 'Saved draft' })
```

The pre-Phase-1 dropdown menu item that triggered a JSON file download has been renamed to "Export project file…" — `Cmd+S` now points at the new flow.

## Test contract

- `tests/save-state.test.ts` — 16-combination boolean × timestamp matrix; ties favor `published`; clean-slate is `autosaved`; label rendering for each state
- `tests/persistence-manager.test.ts` — Cmd+S flushes pending autosave with the queued workspace, then writes the checkpoint with the explicit payload (race-prevention)
- DOM tests for the keybinding ignoring focused inputs (covered indirectly through component contracts)

## Edge cases

- **Race during typing.** User types → autosave is debounced → user hits Cmd+S. The manager cancels the pending timer, flushes the queued workspace as autosave, then writes the new payload as a checkpoint. Both `lastSavedAt` and `lastCheckpointAt` advance in order.
- **Publish then immediate edit.** After `markPublished`, `lastPublishedAt > 0`; user types → `isDirty=true` → state = `'unsaved'` (dirty wins). Re-saving without publishing → state = `'draft-saved'` (most recent of {checkpoint, publish}).
- **Restore-from-history then publish again.** Restore loads the snapshot as a dirty draft → `'unsaved'`. Cmd+S → `'draft-saved'`. Publish → `'published'`.

## Open future work

- Persisted `lastPublishedVersion` across reloads — currently lives in editor store only. If reload happens before re-publish the badge falls back to `draft-saved` even if a publish happened. Hydrating from `listVersionSnapshots()` on load would close this.
- Cross-tab sync — if a user has the studio open in two tabs, autosave and checkpoint events from one don't reach the other. Out of scope for the first pass.

## Related specs

- `specs/schema/draft-checkpoint.md` — durability tier between autosave and publish
- `specs/schema/version-snapshot.md` — the publish record that drives `'published'`
- `specs/export/publish-transaction.md` — wires `markPublished` after a successful publish

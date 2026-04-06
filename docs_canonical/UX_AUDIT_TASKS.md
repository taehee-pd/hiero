# UX Flow Audit — Phased Task Document

## Purpose

This document catalogs UX gaps, friction points, and missing affordances
identified through a systematic audit of the Contour Contour.
Each issue is grounded in the actual codebase (components, routes, store
actions) and organized into phases by severity and dependency order.

**Last updated:** 2026-03-20
**Audit scope:** Explorer (workspace/project views), Editor (canvas/panels),
Import/Export, Animation Studio, Sync, and cross-surface navigation.

**Resolved in the 2026-03-20 UX pass:** workspace-level import CTA,
project-level blank-icon creation CTA, clearer editor file/export hierarchy,
single-click project entry, improved empty project guidance, and explorer
icon-grid accessibility roles for list semantics and decorative thumbnails.

---

## Audit Methodology

The audit applied the following design heuristics:
- **Nielsen's 10 Usability Heuristics** (visibility of system status, match
  between system and real world, user control and freedom, consistency,
  error prevention, recognition over recall, flexibility, aesthetic design,
  error recovery, help and documentation)
- **Task-flow completeness** — can every canonical user task be completed
  without a workaround?
- **Progressive disclosure** — are complex features hidden until needed?
- **Reversibility** — can destructive actions be undone?
- **Empty-state guidance** — do empty views guide users toward their next action?
- **Discoverability** — are key features findable without prior knowledge?

---

## Phase 1 — Critical Flow Gaps (Blocks Core Tasks)

These issues prevent users from completing fundamental workflows without
workarounds or confusion.

### UX-1.4 — No way to create a new icon state from the editor

**Severity:** High
**Location:** `components/editor/EditorShell.tsx` (no state management UI),
`components/editor/TransitionPanel.tsx:64-67` (state IDs from variant)
**Heuristic:** Task-flow completeness

Icons support multiple states (e.g., "default", "active", "hover") which are
the basis of transitions and animations. However, there is no UI to create,
rename, duplicate, or delete states. The TransitionPanel reads state IDs but
offers no way to add new ones. Users must rely on import or manual JSON
editing to create multi-state icons.

**Fix:** Add a "States" section to the editor left panel or inspector that
allows:
- Creating a new state (duplicate from current or blank)
- Renaming states
- Deleting states (with transition dependency warning)
- Switching between states for editing

---

### UX-1.5 — No way to add or manage transitions from the Animation Studio panel

**Severity:** High
**Location:** `components/editor/AnimationStudioPanel.tsx:137-148`
**Heuristic:** Task-flow completeness, visibility

The Animation Studio panel shows existing transitions in a dropdown but has
no button to create new transitions. The "Add Transition" UI exists in
`TransitionPanel.tsx`, so the create affordance is split across two panels.
Users must know to look in the right place.

**Fix:** Add a "+ New Transition" button below the transition dropdown in
AnimationStudioPanel. This can either open an inline form (like
TransitionPanel's `isAddOpen` state) or navigate/scroll to the
TransitionPanel.

---

## Phase 2 — Navigation & Discoverability

Issues that cause confusion about where features are or how to reach them.

### UX-2.2 — Editor ↔ Explorer navigation is inconsistent

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx:69-74` (back button labeled
"library"), `components/explorer/ExplorerShell.tsx:338-356` (breadcrumb)
**Heuristic:** Consistency

- The editor has a small "library" link button in the CurrentDocumentPanel.
- The explorer has a breadcrumb navigation in the header.
- There is no unified navigation model. The editor does not have breadcrumbs.
- The "library" button text is lowercase and doesn't match the explorer's
  "Contour Workspace" label.

**Fix:** Implement consistent breadcrumb navigation across both surfaces:
`Workspace > Project > Icon` in the editor, matching the explorer's
breadcrumb style.

---

### UX-2.3 — Project and collection context menus still use `prompt()` dialogs instead of proper UI

**Severity:** Medium
**Location:** `components/explorer/ExplorerShell.tsx:294-314`
(handleIconSetContext, handleCollectionContext)
**Heuristic:** Aesthetic and minimalist design, match between system and
real world

Right-clicking a project card shows `prompt('Type "rename" or "delete"')`.
This is a placeholder UX that forces users to type action names. Collections
use the same pattern. This breaks user expectations of right-click context
menus and makes the workspace feel less polished than the rest of the tool.

**Fix:** Replace `prompt()` calls with a proper `ContextMenu` or
`DropdownMenu` component from the UI library. On desktop, wire up
`showNativeContextMenu()` (already used for icon context menus).

---

### UX-2.5 — No keyboard shortcuts reference or help

**Severity:** Medium
**Location:** `lib/editor-core/keyboard.ts` (keyboard handling exists but
is undocumented in UI)
**Heuristic:** Help and documentation, flexibility

The editor supports keyboard shortcuts (tool switching, zoom, undo/redo)
but there is no shortcut cheat sheet, help panel, or tooltip hints showing
keyboard accelerators next to toolbar buttons.

**Fix:** Add keyboard shortcut hints to toolbar button tooltips (e.g.,
"Select Tool (V)"). Add a `?` keyboard shortcut or Help menu that shows a
shortcut reference panel.

---

### UX-2.6 — No icon search or filtering in the editor

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx` (no search UI)
**Heuristic:** Flexibility, efficiency

When editing a project with many icons, there is no way to search for or
filter icons within the editor. Users must go back to the explorer to find
a specific icon.

**Fix:** Add an icon switcher/search in the editor (e.g., a command palette
triggered by `Cmd+K` or a searchable dropdown in the toolbar/left panel).

### UX-2.7 — Timeline keyframe edits still rely on a raw `prompt()` input

**Severity:** Low
**Location:** `components/editor/TimelineEditor.tsx:278-301`
**Heuristic:** Error prevention, recognition over recall

Keyframe value editing in the timeline editor uses `prompt('Set keyframe
value', '0')` from a custom context menu. The interaction is hard to
discover, easy to mistype, and inconsistent with the richer controls used
elsewhere in the editor.

**Fix:** Replace the prompt with an inline numeric field or a small edit
popover that validates the value before committing it.

---

## Phase 3 — Empty States & Onboarding

Issues where the app fails to guide users when content is missing.

### UX-3.2 — Editor empty state still lacks a direct import path

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx`
**Heuristic:** Error recovery, visibility

The editor now shows a real empty state with "New icon" and "Back to
library" actions, which is a big improvement. However, users who arrive in
the editor expecting to import an existing SVG still have to leave the page
and recover through the library or toolbar flow.

**Fix:** Add a third CTA in the empty editor state that opens the existing
import flow directly.

---

### UX-3.3 — Animation Studio shows "No transitions available" with no creation path

**Severity:** Low
**Location:** `components/editor/AnimationStudioPanel.tsx:147-148`
**Heuristic:** Empty-state guidance

When an icon has no transitions, the timeline section says "No transitions
available for timeline editing." but doesn't guide users to create one.
There is a create path in `TransitionPanel.tsx`, but the Animation Studio
empty state does not point at it.

**Fix:** Add inline guidance: "Create states for this icon first, then add
transitions between them." with a link/button to the state management UI
(once UX-1.4 is implemented).

---

### UX-3.4 — Layer panel "No layers" state offers no guidance

**Severity:** Low
**Location:** `components/editor/LayerPanel.tsx:44-47`
**Heuristic:** Empty-state guidance

When viewing an icon state with no layers, the layer panel shows "No layers"
with no hint on how to add layers (pen tool, shape tool, or import).

**Fix:** Add contextual tips: "Use the Pen tool (P) or Shape tool (R) to
draw, or drag an SVG file onto the canvas."

---

## Phase 4 — Destructive Action Safety

Issues where the app allows irreversible actions without confirmation.

### UX-4.1 — Variant deletion has no confirmation

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx:207-216` (delete variant
button)
**Heuristic:** Error prevention

The trash icon button for removing a variant performs the action immediately
with no confirmation dialog. Variants contain significant design work.

**Fix:** Add a confirmation dialog: "Delete the {size}px variant? This
cannot be undone." (Note: Zustand + zundo provides undo, but users don't
know that.)

---

### UX-4.2 — Transition deletion has no confirmation

**Severity:** Medium
**Location:** `components/editor/TransitionPanel.tsx` (delete button)
**Heuristic:** Error prevention

Transitions with layer bindings, easing configs, and timing can be deleted
with a single click.

**Fix:** Add a confirmation dialog, or implement an undo toast pattern
("Transition deleted. Undo?").

---

### UX-4.3 — Project deletion uses `prompt()` with no safety check

**Severity:** High
**Location:** `components/explorer/ExplorerShell.tsx:302-303`
**Heuristic:** Error prevention

Deleting a project requires typing "delete" in a `prompt()` dialog, but
there's no additional check about unsaved work, icon count, or whether the
project has sync targets configured.

**Fix:** Replace with a proper confirmation dialog that shows:
- Project name and icon count
- Whether there are sync targets configured
- A "Type project name to confirm" safety pattern for projects with > 0 icons

---

## Phase 5 — Polish & Efficiency

Lower-priority improvements that reduce friction for power users.

### UX-5.1 — No drag-and-drop for SVG import in the explorer

**Severity:** Low
**Location:** `components/explorer/ExplorerShell.tsx` (no drop zone)
**Heuristic:** Flexibility, efficiency

The project detail view supports importing via file picker but not via
drag-and-drop onto the icon grid. The editor Canvas already supports SVG
drop, so this gap is specific to the explorer surface.

**Fix:** Add a drop zone overlay on the project detail icon grid that
accepts `.svg` files and calls the existing `createImportedIcon()` pipeline.

---

### UX-5.2 — No multi-select in the icon grid for batch operations

**Severity:** Low
**Location:** `components/explorer/ExplorerShell.tsx:806` (checkbox per icon)
**Heuristic:** Flexibility, efficiency

Selection is toggle-per-icon only. There is no shift-click range select,
Cmd+A select all, or drag-to-select rectangle. Batch operations (export,
categorize) are cumbersome with many icons.

**Fix:** Implement:
- Shift+click for range selection
- Cmd/Ctrl+A for select all (visible)
- Optional: drag-to-select rectangle

---

### UX-5.3 — No icon rename from the editor

**Severity:** Low
**Location:** `components/editor/EditorShell.tsx:51-52`
(CurrentDocumentPanel shows icon name but it's not editable)
**Heuristic:** Flexibility, efficiency

The icon name is displayed in the CurrentDocumentPanel but cannot be
edited inline. Users must go back to the explorer or edit JSON.

**Fix:** Make the icon name in CurrentDocumentPanel double-click-editable
or add a rename action to the icon's context menu.

---

### UX-5.4 — No icon duplication

**Severity:** Low
**Location:** No existing UI for this action
**Heuristic:** Flexibility, efficiency

There is no way to duplicate an existing icon (to use as a starting point
for a variant or related icon). Users must export and re-import.

**Fix:** Add "Duplicate Icon" to the icon context menu in the explorer
and as an action in the editor toolbar.

---

### UX-5.5 — Collection management is hidden behind right-click

**Severity:** Low
**Location:** `components/explorer/ExplorerShell.tsx:675-700`
**Heuristic:** Discoverability

Collections exist in the sidebar, but the collection workflow is still split
between the visible `+` affordance and hidden right-click actions. There is
no visible "Add to collection" control on selected icons or in the hover
actions, and rename/delete remains context-menu only.

**Fix:** Add an "Add to Collection" option in the icon hover overlay
(alongside favorite and select buttons) or in the batch action bar when
icons are selected.

---

### UX-5.6 — Sync settings are per-dialog with no persistent indicator

**Severity:** Low
**Location:** `components/export/SyncPrPanel.tsx`
**Heuristic:** Visibility of system status

GitHub sync settings (repo, branch) are configured inside the "Create PR"
dialog. There's no persistent indicator in the explorer or editor showing
whether sync is configured, last sync status, or pending changes.

**Fix:** Add a sync status indicator in the project detail header showing:
- Connected repo (already shown on line 740-744 but very subtle)
- Last sync time
- Number of changed icons since last sync

---

## Phase 6 — Accessibility

### UX-6.1 — No visible focus indicators on many interactive elements

**Severity:** Medium
**Location:** Throughout — icon cards, sidebar buttons, toolbar
**Heuristic:** Accessibility (WCAG 2.1 AA)

While `focus-visible` classes are used on project cards
(`ExplorerShell.tsx:527`), many interactive elements (icon grid articles,
sidebar buttons, toolbar buttons) lack clear focus ring styles for keyboard
navigation.

**Fix:** Audit all interactive elements and ensure `focus-visible:ring-2`
or equivalent is applied consistently.

---

## Implementation Priority Matrix

| Phase | Theme | Est. Effort | Impact |
|-------|-------|-------------|--------|
| **1** | Critical flow gaps | Medium | Unblocks core workflows |
| **2** | Navigation & discoverability | Medium | Reduces confusion |
| **3** | Empty states & onboarding | Low | Improves first-run experience |
| **4** | Destructive action safety | Low | Prevents data loss |
| **5** | Polish & efficiency | Medium | Power user satisfaction |
| **6** | Accessibility | Medium | Compliance & inclusivity |

**Recommended order:** Phase 1 → Phase 4 → Phase 3 → Phase 2 → Phase 6 → Phase 5

Phases 1 and 4 address the most impactful issues (missing workflows and
data loss risks). Phase 3 is low-effort with high first-impression impact.
Phase 2 improves daily usability. Phase 6 ensures compliance. Phase 5 is
polish.

---

## Source Basis

This audit is derived from:
- Direct code review of `components/explorer/ExplorerShell.tsx` (902 lines)
- Direct code review of `components/editor/EditorShell.tsx` (391 lines)
- Direct code review of `components/editor/Toolbar.tsx` (346 lines)
- Direct code review of `components/editor/AnimationStudioPanel.tsx` (216 lines)
- Direct code review of `components/editor/TransitionPanel.tsx`
- Direct code review of `components/editor/ImportIconDialog.tsx` (187 lines)
- Direct code review of `components/editor/LayerPanel.tsx`
- Direct code review of `lib/import/import-svg-file.ts`
- Direct code review of `lib/editor-store/store.ts` and `types.ts`
- Route analysis of `app/page.tsx`, `app/editor/page.tsx`, `app/editor/[iconId]/page.tsx`
- Store action analysis of `lib/editor-store/` (EditorState, EditorActions)
- Playwright screenshot verification of `/` and `/editor/icon-chevron?set=starter`

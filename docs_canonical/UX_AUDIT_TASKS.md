# UX Flow Audit — Phased Task Document

## Purpose

This document catalogs UX gaps, friction points, and missing affordances
identified through a systematic audit of the Coniva icon authoring tool.
Each issue is grounded in the actual codebase (components, routes, store
actions) and organized into phases by severity and dependency order.

**Last updated:** 2026-03-19
**Audit scope:** Explorer (workspace/project views), Editor (canvas/panels),
Import/Export, Animation Studio, Sync, and cross-surface navigation.

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

### UX-1.1 — No "Create New Icon" in Explorer project view

**Severity:** Critical
**Location:** `components/explorer/ExplorerShell.tsx:378-399`
**Heuristic:** Task-flow completeness, visibility of system status

The project detail view has Import, Export, and Create PR buttons but no
"Create New Icon" (blank canvas) button. Users who want to draw a new icon
from scratch must:
1. Import a dummy SVG file, or
2. Navigate to the editor and use File > New (which creates a new *project*,
   not a new icon within the current project).

**Fix:** Add a `+ New Icon` button in the project detail header bar
(line ~379) that calls a new `createBlankIcon()` store action. The action
should insert an icon with a single empty 24px variant and navigate to the
editor. The empty-state view (line 749-755) should also surface this action
as a prominent CTA.

---

### UX-1.2 — Import is only available inside a project, not from workspace level

**Severity:** High
**Location:** `components/explorer/ExplorerShell.tsx:372-377` (workspace
header shows only "New project"), `components/explorer/ExplorerShell.tsx:486-503`
(empty workspace)
**Heuristic:** Task-flow completeness, flexibility and efficiency

Users at the workspace level see only "New project." To import SVGs they
must first create a project, enter it, then click Import. This is a 3-step
process for what should be 1 step. New users landing on an empty workspace
have no path to get icons into the tool without knowing to create a project first.

**Fix:**
- Add an "Import SVGs" action to the workspace-level header that either
  auto-creates a project or prompts for one.
- In the empty workspace state (line 487-491), add a secondary CTA:
  "Import existing SVGs" alongside the implied "Create a new project."

---

### UX-1.3 — Editor "New" button creates a new project, losing current context

**Severity:** High
**Location:** `components/editor/Toolbar.tsx:71-74` (`handleNew`)
**Heuristic:** Error prevention, user control and freedom

The "New" button in the editor toolbar calls `newProject()`, which replaces
the entire workspace state. There is no confirmation dialog. Users can
accidentally lose unsaved work. The mental model ("New" = new icon) clashes
with the actual behavior ("New" = new empty project).

**Fix:**
- Rename to "New Project" for clarity.
- Add a confirmation dialog when `isDirty` is true.
- Add a separate "New Icon" action that inserts a blank icon into the
  current project (same as UX-1.1).

---

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
no button to create new transitions. The "Add Transition" UI exists only in
`TransitionPanel.tsx` which is a separate component. Users must know to look
in the right place.

**Fix:** Add a "+ New Transition" button below the transition dropdown in
AnimationStudioPanel. This can either open an inline form (like
TransitionPanel's `isAddOpen` state) or navigate/scroll to the
TransitionPanel.

---

## Phase 2 — Navigation & Discoverability

Issues that cause confusion about where features are or how to reach them.

### UX-2.1 — Project cards require double-click with no single-click affordance

**Severity:** Medium
**Location:** `components/explorer/ExplorerShell.tsx:498` (`onDoubleClick`)
**Heuristic:** Consistency, recognition over recall

Project cards in the workspace view respond to `onDoubleClick` but not to a
single click. This is unusual for web apps (double-click is a desktop OS
pattern). There is no visual hint (e.g., "Double-click to open" tooltip or
an "Open" button overlay on hover) telling users how to enter a project.

**Fix:** Either:
- Change to single-click navigation (more web-standard), or
- Add a visible "Open" button on card hover, or
- Add an `onClick` handler that selects the project and shows a details
  panel, with a clear "Open" affordance.

---

### UX-2.2 — Editor ↔ Explorer navigation is inconsistent

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx:69-74` (back button labeled
"library"), `components/explorer/ExplorerShell.tsx:338-356` (breadcrumb)
**Heuristic:** Consistency

- The editor has a small "library" link button in the CurrentDocumentPanel.
- The explorer has a breadcrumb navigation in the header.
- There is no unified navigation model. The editor does not have breadcrumbs.
- The "library" button text is lowercase and doesn't match the explorer's
  "Coniva Workspace" label.

**Fix:** Implement consistent breadcrumb navigation across both surfaces:
`Workspace > Project > Icon` in the editor, matching the explorer's
breadcrumb style.

---

### UX-2.3 — Context menus use `prompt()` dialogs instead of proper UI

**Severity:** Medium
**Location:** `components/explorer/ExplorerShell.tsx:294-314`
(handleIconSetContext, handleCollectionContext)
**Heuristic:** Aesthetic and minimalist design, match between system and
real world

Right-clicking a project card shows `prompt('Type "rename" or "delete"')`.
This is a placeholder UX that forces users to type action names. Collections
use the same pattern. This breaks user expectations of right-click context
menus.

**Fix:** Replace `prompt()` calls with a proper `ContextMenu` or
`DropdownMenu` component from the UI library. On desktop, wire up
`showNativeContextMenu()` (already used for icon context menus).

---

### UX-2.4 — Toolbar has too many export buttons without hierarchy

**Severity:** Medium
**Location:** `components/editor/Toolbar.tsx:250-254`
**Heuristic:** Aesthetic design, recognition over recall

The toolbar shows 4 separate export buttons in a row: "Export SVG",
"Export SVG Package", "Export Runtime JSON", "Export React Library". All use
the same Download icon. This is visually cluttered and hard to distinguish.

**Fix:** Consolidate into a single "Export" dropdown menu with labeled items
and optional keyboard shortcuts. Group by format type (SVG, Runtime, Code).

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

---

## Phase 3 — Empty States & Onboarding

Issues where the app fails to guide users when content is missing.

### UX-3.1 — Empty project view has no actionable guidance

**Severity:** Medium
**Location:** `components/explorer/ExplorerShell.tsx:749-755`
**Heuristic:** Empty-state guidance, visibility of system status

When a project has no icons, the empty state shows only "No icons in this
project" with a generic grid icon. It doesn't tell users what to do next.
The Import button in the header is small and not visually connected to the
empty state.

**Fix:** Redesign the empty state to include:
- A prominent "Import SVGs" button (primary action)
- A "Create New Icon" button (secondary action)
- Brief instructional text explaining the workflow

---

### UX-3.2 — Editor shows "No icon selected" with no recovery path

**Severity:** Medium
**Location:** `components/editor/EditorShell.tsx:51-56`
(CurrentDocumentPanel shows "No icon selected")
**Heuristic:** Error recovery, visibility

If a user navigates to `/editor` without a valid icon ID, they see "No icon
selected" and "select an icon" in small text. The canvas is empty. There are
no actionable buttons or instructions on how to select an icon.

**Fix:** Show a full-screen empty state in the editor when no icon is
selected, with options to:
- Go back to the library
- Import an SVG directly
- Create a new blank icon

---

### UX-3.3 — Animation Studio shows "No transitions available" with no creation path

**Severity:** Low
**Location:** `components/editor/AnimationStudioPanel.tsx:147-148`
**Heuristic:** Empty-state guidance

When an icon has no transitions, the timeline section says "No transitions
available for timeline editing." but doesn't guide users to create one.

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
drag-and-drop onto the icon grid. The editor Canvas may support drop
(not verified), but the explorer doesn't.

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

Collections exist in the sidebar but adding icons to collections requires
knowledge of the right-click menu. There's no drag-and-drop from the icon
grid to a collection in the sidebar, and no "Add to collection" button in
the icon hover actions.

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

### UX-6.2 — Icon grid items lack proper ARIA roles and labels

**Severity:** Medium
**Location:** `components/explorer/ExplorerShell.tsx:772-843`
**Heuristic:** Accessibility

Icon grid items are `<article>` elements containing `<Link>` elements.
They don't have `role="listitem"` and the parent grid doesn't have
`role="list"`. Screen readers won't announce the collection structure.

**Fix:** Add `role="list"` to the grid container and `role="listitem"` to
each icon article. Ensure icon names are announced as the accessible label
for each item.

---

### UX-6.3 — `dangerouslySetInnerHTML` for SVG thumbnails blocks accessibility

**Severity:** Low
**Location:** `components/explorer/ExplorerShell.tsx:547,832`
**Heuristic:** Accessibility

SVG thumbnails are rendered via `dangerouslySetInnerHTML`, which means the
SVGs lack `aria-hidden="true"` or `role="img"` attributes. Screen readers
may attempt to traverse SVG internals.

**Fix:** Add `aria-hidden="true"` to the wrapper div containing the
injected SVG, since the icon name text serves as the accessible label.

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

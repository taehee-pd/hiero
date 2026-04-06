# Contour Layout Revamp — Sanity Studio-Style Single Screen

**Created:** 2026-04-03
**Reference:** [Sanity Studio](https://github.com/sanity-io/sanity) structure tool pane pattern

---

## 1. Current Architecture (Problems)

The app currently uses **two separate full-screen routes**:

```
/ (ExplorerShell)  ←→  /editor/[iconId] (EditorShell)
     ↑                        ↑
  fixed inset-0           fixed inset-0
  flex-col                flex-col + CSS grid
```

**Pain points:**
- Full-page navigation between Explorer and Editor (Next.js route transition)
- Editor and Explorer are independent fixed-fullscreen layouts
- No spatial context — opening an icon loses the project/list view entirely
- Going "back to library" requires a full route change
- Toolbar mixes global actions (save, new project) with editor-specific ones (zoom, undo)
- The editor left sidebar (Layers/Variants) and the explorer are separate worlds

---

## 2. Target Architecture (Sanity Studio Pattern)

Sanity Studio uses a **horizontal pane-stacking model** within a single screen:

```
┌─────────────────────────────────────────────────────────┐
│  Navbar (project name, global actions, search)          │
├────────┬──────────────┬─────────────────────────────────┤
│ Nav    │  List Pane   │  Detail Pane                    │
│ Pane   │              │                                 │
│        │  (icons in   │  (canvas + inspector)           │
│ (proj  │   project)   │                                 │
│  list) │              │                                 │
│        │              │                                 │
└────────┴──────────────┴─────────────────────────────────┘
  ~200px    ~260px            flex-1
```

**Key principles from Sanity:**
1. **Single SPA screen** — no full-page route transitions
2. **Panes stack horizontally** — clicking a project shows its icons, clicking an icon opens the editor
3. **Parent panes stay visible** — user always has navigation context
4. **URL reflects pane state** — for bookmarkability, but navigation is state-driven
5. **Resizable pane borders** — users can adjust widths
6. **Collapsible panes** — on narrow screens, panes collapse to icons or hide

---

## 3. Proposed Layout

### 3.1 Component Hierarchy

```
app/page.tsx (single route — all content here)
└── StudioLayout
    ├── Navbar (h-10, full width)
    │   ├── Logo/title
    │   ├── Search (Cmd+K)
    │   ├── Save indicator
    │   └── Global actions (export, import, settings)
    │
    └── PaneContainer (flex-1, horizontal flex)
        ├── NavPane (~56px collapsed / ~200px expanded)
        │   └── Project list (workspace icon sets)
        │
        ├── ListPane (~260px, shown when project selected)
        │   ├── Header (project name, icon count)
        │   ├── Search/filter
        │   └── Icon grid/list
        │
        └── DetailPane (flex-1, shown when icon selected)
            ├── EditorToolbar (zoom, undo, export — inline)
            ├── Grid [layers-sidebar | canvas | inspector-sidebar]
            │   ├── LayersSidebar (~220px)
            │   ├── Canvas (flex-1)
            │   └── InspectorSidebar (~304px)
            └── BottomDock (timeline, optional)
```

### 3.2 CSS Layout

```
StudioLayout:     fixed inset-0, flex flex-col
  Navbar:         h-10 shrink-0
  PaneContainer:  flex-1 flex flex-row min-h-0 overflow-hidden

  NavPane:        w-14 (collapsed) / w-[200px] (expanded), shrink-0, border-r
  ListPane:       w-[260px], shrink-0, border-r (hidden when no project)
  DetailPane:     flex-1, min-w-0
    EditorGrid:   grid grid-cols-[220px_1fr_304px] (same as current)
```

### 3.3 Pane State Model

```typescript
type PaneState = {
  // Which project (icon set) is selected in NavPane
  activeProjectId: string | null;
  // Which icon is selected in ListPane (opens DetailPane)
  activeIconId: string | null;
  // Whether NavPane is expanded or collapsed to icons
  navExpanded: boolean;
  // Whether ListPane is visible
  listVisible: boolean;
};
```

This state drives which panes are visible. URL syncs to it:
- `/` → no project, no icon (NavPane only)
- `/?project=icon-set-1` → project selected, ListPane shows icons
- `/?project=icon-set-1&icon=icon-home` → icon selected, DetailPane opens

---

## 4. Complete Capability Mapping

Every existing feature must land in a specific pane. Nothing is dropped.

### 4.1 Navbar (always visible)

Extracted from current `Toolbar.tsx` global actions + `ExplorerShell.tsx` header:

| Feature | Current Location | New Location |
|---------|-----------------|--------------|
| Project/workspace name | Toolbar.tsx (projectName) | Navbar left |
| Unsaved changes badge | Toolbar.tsx (isDirty/savedAgoLabel) | Navbar left, next to title |
| New Project | Toolbar.tsx file menu dropdown | Navbar file menu |
| Open Project (from file) | Toolbar.tsx file menu dropdown | Navbar file menu |
| Import Icon dialog | Toolbar.tsx file menu dropdown | Navbar file menu |
| Save (Cmd+S) | Toolbar.tsx save button | Navbar action |
| Search / Cmd+K | EditorShell CommandDialog | Navbar search trigger |
| Keyboard shortcuts (?) | Toolbar.tsx shortcut dialog | Navbar help menu |

### 4.2 NavPane (project sidebar, ~56px collapsed / ~200px expanded)

Extracted from `ExplorerShell.tsx` workspace view:

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| Project list (icon sets) | ExplorerShell workspace view | Collapsed: icon thumbnails. Expanded: name + icon count |
| Create new project (inline) | ExplorerShell inlineNewProject | "+" button at bottom of list |
| Rename project | ExplorerShell renameDialog | DropdownMenu on right-click/hover |
| Delete project (with confirm) | ExplorerShell deleteProjectTarget AlertDialog | DropdownMenu → AlertDialog (existing dialog reused) |
| Recent projects (IndexedDB) | ExplorerShell useProjectList | Shown as entries in project list |
| Active project indicator | ExplorerShell view.level === 'project' | Visual highlight on selected item |

### 4.3 ListPane (icon list, ~260px, visible when project selected)

Extracted from `ExplorerShell.tsx` project detail view:

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| Icon grid with thumbnails | ExplorerShell ProjectDetailView | Compact vertical list or small grid |
| Icon search/filter | ExplorerShell query state | Search input at top of pane |
| Category filter sidebar | ExplorerShell activeFilter | Collapsible categories section or dropdown |
| Collections management | ExplorerShell collections | Collection tabs/pills in pane header |
| Create new collection (inline) | ExplorerShell inlineNewCollection | Inline form inside collections area |
| Favorites filter | ExplorerShell favorites | Toggle filter button |
| Batch icon selection | ExplorerShell selection state | Shift/Cmd+click multi-select |
| Export selected to ZIP | ExplorerShell exportIconsToZip | Batch action bar (appears when selection > 0) |
| Export all to ZIP | ExplorerShell exportIconsToZip | Pane header dropdown action |
| Create blank icon | ExplorerShell createBlankIcon | "+" button in pane header |
| SVG file import (drag/drop) | ExplorerShell importRef + file input | Drop zone on pane |
| Icon context menu | IconGridItem ContextMenu | Favorite, Duplicate, Delete |
| SyncPrPanel (Git PR sync) | ExplorerShell SyncPrPanel | Move to: Navbar distribution menu or ListPane footer |
| SyncTargetPanel | ExplorerShell SyncTargetPanelContent | Move to: Navbar distribution menu or settings sheet |

### 4.4 DetailPane (editor, flex-1, visible when icon selected)

The current `EditorShell.tsx` grid, adapted to live inside PaneContainer:

#### 4.4.1 EditorToolbar (inline header, replaces current Toolbar)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| Current icon name + slug | Toolbar.tsx currentIconName | Inline in DetailPane header |
| Undo / Redo | Toolbar.tsx undo/redo buttons | Inline buttons |
| Zoom controls (%, +, -, fit) | Toolbar.tsx zoom group | Inline buttons |
| Export SVG (single icon) | Toolbar.tsx export dropdown | Export dropdown menu |
| Export SVG Package | Toolbar.tsx export button | Export dropdown menu |
| Export React Library | Toolbar.tsx export button | Export dropdown menu |
| Export Runtime JSON | Toolbar.tsx export dropdown | Export dropdown menu |
| Export Lottie JSON (sheet) | Toolbar.tsx lottie sheet | Export dropdown → LottieExportPanel sheet |
| Distribution sheet | Toolbar.tsx distribution sheet | Export dropdown → SyncTargetPanelContent sheet |
| New Icon | Toolbar.tsx file menu | Move to Navbar file menu (already there) |
| Selection count | Toolbar.tsx selectionCount | Optional: show in status bar or inline |

#### 4.4.2 Left Sidebar (Layers + Variants + States, ~220px)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| EditorSidebarTabs (Layers / Variants) | EditorShell LeftSidebar | Unchanged |
| LayerPanel (full layer tree) | LayerPanel.tsx | Unchanged |
| — Layer visibility toggle | LayerPanel eye/eyeOff buttons | Unchanged |
| — Layer selection + keyboard nav | LayerPanel role="listbox" | Unchanged |
| — Layer rename (F2 / double-click) | LayerPanel renamingLayerId | Unchanged |
| — Layer context menu (rename/hide/delete) | LayerPanel ContextMenu | Unchanged |
| — Clip mask indicator + component badges | LayerPanel isMask/componentKind | Unchanged |
| — Variable-value visibility indicator | LayerPanel variableValueResults | Unchanged |
| Variant list | EditorShell variants map | Unchanged |
| — Create variant (size input) | EditorShell newVariantSize + Add | Unchanged |
| — Derived variant badge | EditorShell isDerived check | Unchanged |
| — Delete variant (AlertDialog) | EditorShell pendingDelete | Unchanged |
| States section | EditorShell StatesSection | Unchanged |
| — Create/rename/duplicate/delete state | StatesSection CRUD | Unchanged |
| — State delete confirmation | StatesSection AlertDialog | Unchanged |

#### 4.4.3 Canvas Area (flex-1)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| SVG icon rendering | Canvas.tsx SVG element | Unchanged |
| Path editing (points, handles, curves) | Canvas.tsx interaction root | Unchanged |
| Tool system (select, direct-select, pen, shape) | Canvas.tsx + keyboard.ts | Unchanged |
| Viewport pan (space+drag, scroll) | Canvas.tsx pan handlers | Unchanged |
| Viewport zoom (pinch, scroll, buttons) | Canvas.tsx zoom handlers | Unchanged |
| Drag-and-drop SVG import | Canvas.tsx drag handlers | Unchanged |
| Rulers (top + left) | Rulers.tsx component | Unchanged |
| Selection handles + marquee | Canvas.tsx selection rendering | Unchanged |
| Snap guides overlay | Canvas.tsx activeSnapGuides | Unchanged |
| Point transform label | Canvas.tsx pointTransformLabel | Unchanged |
| Transition preview rendering | Canvas.tsx transitionPreview | Unchanged |
| Canvas context menu (zoom in/out/fit) | Canvas.tsx ContextMenu | Unchanged |
| Import error alert (aria-live) | Canvas.tsx importError | Unchanged |
| CanvasDock (bottom-left tools) | EditorShell CanvasDock | Unchanged |
| — Tool selector buttons | CanvasDock TOOL_ITEMS | Unchanged |
| — Shape sub-tool selector | CanvasDock shape dropdown | Unchanged |
| — Zoom display + controls | CanvasDock zoom section | Unchanged |
| — Guides/Snap toggles | CanvasDock toggles | Unchanged |
| — Guide masters indicator | CanvasDock guide master section | Unchanged |
| Derived variants re-derive banner | EditorShell derivedSpecs check | Unchanged |
| Empty state (no icon selected) | EditorShell empty state | Show when no icon selected in DetailPane |

#### 4.4.4 Right Sidebar (Inspect + Animation, ~304px)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| EditorSidebarTabs (Inspect / Animation) | EditorShell RightSidebar | Unchanged |
| **Inspect tab:** | | |
| — Fill mode + color picker | InspectorPanel fill controls | Unchanged |
| — Stroke mode + color picker | InspectorPanel stroke controls | Unchanged |
| — Opacity sliders | InspectorPanel opacity | Unchanged |
| — Stroke width input | InspectorPanel strokeWidth | Unchanged |
| — Transform (position, rotation, scale) | InspectorPanel transform | Unchanged |
| — Blend mode selector | InspectorPanel blendMode | Unchanged |
| — Clip mask toggle | InspectorPanel masking | Unchanged |
| — Path/geometry stats | InspectorPanel path info | Unchanged |
| — Role/name input | InspectorPanel role field | Unchanged |
| — Rendering mode selector | EditorShell RENDERING_MODE_OPTIONS | Unchanged |
| — Variant size editor | EditorShell VariantEditorPatch | Unchanged |
| — Morph readiness indicator | MorphReadinessIndicator.tsx | Unchanged |
| — Geometry change warning | GeometryChangeWarning.tsx | Unchanged |
| — Guide master panel | GuideMasterPanel.tsx | Unchanged |
| **Animation tab:** | | |
| — Preset cards grid | AnimationStudioPanel PRESET_CARDS | Unchanged |
| — Playback controls (play/pause/loop) | AnimationStudioPanel toolbar | Unchanged |
| — Speed controls (0.25x-2x) | AnimationStudioPanel speed buttons | Unchanged |
| — Transitions section + dropdown | AnimationStudioPanel transitions | Unchanged |
| — Create Transition button | AnimationStudioPanel button | Unchanged |
| — Easing picker | EasingPicker.tsx | Unchanged |
| — Saved effects list + CRUD | AnimationStudioPanel savedEffects | Unchanged |
| — Effect palette editor | AnimationStudioPanel palette | Unchanged |
| — Color picker for effects | ColorPickerPopover.tsx | Unchanged |

#### 4.4.5 Bottom Dock (optional, shown when timeline active)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| TransitionPanel | TransitionPanel.tsx | Unchanged |
| TimelineEditor | TimelineEditor.tsx | Unchanged |
| — Playback transport (skip/play/pause) | TimelineEditor toolbar | Unchanged |
| — Timeline tracks with keyframes | TimelineEditor tracks | Unchanged |
| — Keyframe drag, right-click, inline edit | TimelineEditor interactions | Unchanged |
| — Track suggestions dropdown | TimelineEditor add-track | Unchanged |
| — Trim preview (SVG) | TimelineEditor trim preview | Unchanged |
| — Bezier curve editor | BezierCurveEditor.tsx | Unchanged |

#### 4.4.6 Dialogs & Sheets (global overlays, unchanged)

| Feature | Current Location | Notes |
|---------|-----------------|-------|
| Import icon dialog (7 sources) | ImportIconDialog.tsx | Global dialog, unchanged |
| Lottie export sheet | LottieExportPanel.tsx in Sheet | Triggered from export menu |
| Distribution sheet | SyncTargetPanelContent in Sheet | Triggered from export/navbar menu |
| New project confirmation | EditorShell AlertDialog | Unchanged |
| Delete variant/state confirmation | EditorShell AlertDialogs | Unchanged |
| Keyboard shortcuts dialog | Toolbar Dialog | Triggered from Navbar help |
| Command palette (Cmd+K) | EditorShell CommandDialog | Global, triggered from Navbar |
| Custom effect builder | CustomEffectBuilder.tsx | Unchanged |
| Trigger editor | TriggerEditor.tsx | Unchanged |
| Weight curve editor | WeightCurveEditor.tsx | Unchanged |

### 4.5 Capabilities NOT moved (stay in current components)

These components are internal to their parent and don't need explicit pane placement:

- `EasingPicker` — inline in AnimationStudioPanel / TimelineEditor
- `ColorPickerPopover` — inline in InspectorPanel / AnimationStudioPanel
- `BezierCurveEditor` — dialog from EasingPicker
- `MorphReadinessIndicator` — inline in InspectorPanel
- `GeometryChangeWarning` — inline in canvas area
- `Rulers` — overlay on canvas
- `SyncConflictPanel` — inline in SyncPrPanel

---

## 5. Implementation Steps

### Step 1 — Create StudioLayout shell component

**New file:** `components/studio/StudioLayout.tsx`

- Single fixed-fullscreen container
- Navbar + PaneContainer (horizontal flex)
- Reads pane state from Zustand store
- Renders NavPane, ListPane, DetailPane conditionally

### Step 2 — Extract Navbar from Toolbar

**Modify:** Current `Toolbar.tsx` has both global actions (save, new project, import) and editor-specific actions (zoom, undo, export). Split into:

- `components/studio/Navbar.tsx` — always visible: project name, save indicator, search (Cmd+K), import, new project/open project, keyboard shortcuts
- `components/editor/EditorToolbar.tsx` — shown in DetailPane only: icon name, zoom, undo/redo, export menu, distribution

### Step 3 — Create NavPane (project sidebar)

**New file:** `components/studio/NavPane.tsx`

- Collapsed: 56px with icon-only buttons for each project
- Expanded: 200px with project names, icon counts, create/import buttons
- Sourced from `workspace.iconSets` in the store
- Click project → sets `activeProjectId`, shows ListPane
- Right-click/hover: rename, delete (reuse existing AlertDialog)
- Bottom: "New Project" button, Recent projects section

### Step 4 — Create ListPane (icon list)

**New file:** `components/studio/ListPane.tsx`

- Extracted from the `ProjectDetailView` section of `ExplorerShell.tsx`
- Shows icons for the selected project as compact vertical list or small grid
- Header: project name, icon count, "+" (create blank icon) button
- Search/filter input
- Category pills or collapsible groups
- Collections tabs
- Favorites filter toggle
- Batch selection (shift+click) with action bar (export ZIP, delete)
- Icon context menu: Favorite, Duplicate, Delete (from IconGridItem)
- SVG drag-drop import zone
- SyncPrPanel + SyncTargetPanel access (via footer or overflow menu)
- Click icon → sets `activeIconId`, shows DetailPane
- Always visible when a project is selected (navigation context)

### Step 5 — Adapt DetailPane from EditorShell

**Modify:** `components/editor/EditorShell.tsx`

- Remove the `fixed inset-0` positioning (becomes flex child)
- Remove the Toolbar import (split into Navbar + EditorToolbar)
- Remove project navigation / back-to-library links (handled by panes)
- Keep the existing grid layout: `grid-cols-[220px_1fr_304px]`
- Accept `iconId` as prop instead of reading from URL params
- Keep all existing functionality: CanvasDock, LeftSidebar, RightSidebar, Canvas, overlays
- Empty state when no icon selected → shows guidance + quick import

### Step 6 — Add pane state to Zustand store

**Modify:** `lib/editor-store/store.ts`

```typescript
// Add to EditorState
navExpanded: boolean;
listPaneVisible: boolean;

// Add to EditorActions
toggleNavExpanded(): void;
setListPaneVisible(visible: boolean): void;
```

### Step 7 — Update routing

**Modify:** `app/page.tsx`

- Render `<StudioLayout />` instead of `<ExplorerShell />`
- Remove `app/editor/page.tsx` and `app/editor/[iconId]/page.tsx` (optional — keep as redirects)
- URL updates via `window.history.replaceState` (no Next.js router needed for pane nav)

### Step 8 — Add resizable pane borders

**New file:** `components/studio/PaneResizeHandle.tsx`

- Draggable divider between NavPane↔ListPane and ListPane↔DetailPane
- Persist widths to localStorage
- Use pointer events for drag handling
- Min/max width constraints per pane

### Step 9 — Responsive behavior

- `< 768px`: NavPane collapsed to icons, ListPane hidden (overlay), DetailPane fills screen
- `768px – 1024px`: NavPane collapsed, ListPane visible, DetailPane flex-1
- `> 1024px`: All three panes visible, NavPane expandable

### Step 10 — Remove ExplorerShell

Once all explorer functionality lives in NavPane + ListPane, delete `components/explorer/ExplorerShell.tsx` and related route files.

---

## 6. Migration Strategy

**Phase A (non-breaking):** Build StudioLayout, NavPane, ListPane as new components alongside existing Explorer/Editor. Wire them up at `/` route with a feature flag or environment variable.

**Phase B (switch):** Once the new layout works, swap out the old Explorer/Editor route structure. Keep `/editor/[iconId]` as a redirect to `/?icon=...` for backward compatibility.

**Phase C (cleanup):** Remove ExplorerShell, old Editor routes, and the feature flag.

---

## 7. Files Impact Summary

| Action | Files |
|--------|-------|
| **Create** | `components/studio/StudioLayout.tsx`, `components/studio/Navbar.tsx`, `components/studio/NavPane.tsx`, `components/studio/ListPane.tsx`, `components/studio/PaneResizeHandle.tsx`, `components/editor/EditorToolbar.tsx` |
| **Heavy modify** | `components/editor/EditorShell.tsx` (remove fullscreen + toolbar), `components/editor/Toolbar.tsx` (split into Navbar + EditorToolbar), `app/page.tsx` (render StudioLayout) |
| **Light modify** | `lib/editor-store/store.ts` (pane state), `lib/editor-store/hooks.ts` (expose new actions) |
| **Eventually delete** | `components/explorer/ExplorerShell.tsx`, `components/explorer/IconGridItem.tsx` (moved into ListPane), `app/editor/page.tsx`, `app/editor/[iconId]/page.tsx` |
| **Unchanged** | All `components/editor/` subcomponents (Canvas, LayerPanel, InspectorPanel, AnimationStudioPanel, TimelineEditor, TransitionPanel, etc.), all `components/export/` panels, all `lib/` modules |

---

## 8. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing approach | URL query params (`?project=...&icon=...`) | Single page, no Next.js route transitions, bookmarkable |
| Pane management | Zustand state, not React Router | Consistent with existing state management, no new deps |
| Resizable panes | Custom pointer-event drag handler | Avoid adding a dependency; pattern is simple |
| NavPane default | Collapsed (56px icons) | Maximizes canvas space, matches Sanity narrow-screen behavior |
| ListPane visibility | Always visible when project selected | Maintains navigation context (core Sanity pattern) |
| Sync/Distribution panels | Navbar overflow menu + sheet overlays | Not pane-specific; global actions accessible from anywhere |
| Keyboard shortcuts | Preserved exactly as-is | All shortcuts (V/A/P/U tools, Cmd+Z undo, etc.) stay in keyboard.ts |
| IndexedDB persistence | Unchanged | AutoSaveProvider stays at root layout, works regardless of pane state |
| Accessibility | All existing ARIA attributes preserved | Panes get `role="region"` + `aria-label`; focus management unchanged |

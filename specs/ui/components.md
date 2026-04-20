# UI Components

**Status:** Specification (complete component inventory for Figma design system)
**Dependencies:** `specs/ui/screens.md` (screen definitions)

---

## Overview

This spec catalogs every UI component needed to build all screens defined in
`screens.md`. Components are organized by category: layout shells, navigation,
canvas, panels, property editors, dialogs, and shared primitives. Each component
lists its props/variants to ensure the Figma design system covers all states.

---

## 1. Layout Shells

### StudioLayout *(Primary)*

Single-screen workspace combining navigation, icon list, and embedded editor (Sanity Studio-style). This is the main layout rendered at `/`.

| Prop/State | Variants |
|------------|----------|
| navPaneExpanded | `true` · `false` |
| listPaneExpanded | `true` · `false` |
| hasActiveIcon | `true` (shows embedded editor) · `false` (shows empty state) |
| breakpoint | `mobile` (hamburger drawer) · `tablet` · `desktop` (all panes) |

Components: `components/studio/StudioLayout.tsx`

#### Navbar

Top navigation bar with project name, save status, breadcrumbs, and action buttons.

| Prop/State | Variants |
|------------|----------|
| projectName | string |
| saveStatus | `saved` · `saving` · `unsaved` |
| theme | `light` · `dark` |

Components: `components/studio/Navbar.tsx`

#### NavPane

Workspace/project sidebar (~200px).

| Prop/State | Variants |
|------------|----------|
| expanded | `true` · `false` |
| projects | list of icon sets |

Components: `components/studio/NavPane.tsx`

#### ListPane

Icon grid/list view (~260px) for current project.

| Prop/State | Variants |
|------------|----------|
| expanded | `true` · `false` |
| searchActive | `true` · `false` |
| selectionCount | `0` · `1+` |
| viewMode | `grid` · `list` |

Components: `components/studio/ListPane.tsx`

### ExplorerShell *(Legacy — superseded by StudioLayout)*

Top-level explorer layout with header, optional sidebar, content area, optional right panel.

| Prop/State | Variants |
|------------|----------|
| view | `workspace` · `project` |
| rightPanelOpen | `true` · `false` |
| searchActive | `true` · `false` |
| selectionCount | `0` · `1+` (shows bulk action bar) |

### EditorShell

Top-level editor layout with title bar, toolbar, left sidebar, canvas, right sidebar, dock.

| Prop/State | Variants |
|------------|----------|
| leftTab | `layers` · `variants` |
| rightTab | `inspect` · `animation` |
| tool | `select` · `direct-select` · `pen` · `shape` |
| isDirty | `true` · `false` |
| hasSelection | `none` · `single-layer` · `multi-layer` · `points` |

---

## 2. Navigation & Chrome

### TitleTabBar

| Prop/State | Variants |
|------------|----------|
| platform | `web` (slim) |
| tabs | Array of `{ id, label, isDirty, isActive }` |
| explorerTab | Always present |

Design: Each tab shows icon name, close button, dirty indicator (dot).

### Toolbar

| Prop/State | Variants |
|------------|----------|
| projectName | string (editable inline) |
| isDirty | `true` (shows `*`) · `false` |
| saveStatus | `"Saved 2m ago"` · `"Saving..."` · `"Never saved"` |
| canUndo / canRedo | enables/disables buttons |
| selectionCount | badge on toolbar |
| zoomLevel | percentage display |

**Buttons:** Menu, Undo, Redo, Import, Export dropdown, Help.

### CanvasDock

| Element | Variants |
|---------|----------|
| ToolButton (Select) | `active` · `inactive` |
| ToolButton (Pen) | `active` · `inactive` |
| ToolButton (Shape) | `active` · `inactive` + sub-tool dropdown |
| ZoomControl | Popover with input + presets |

### ShapeSubToolDropdown

| Option | Icon |
|--------|------|
| Rectangle | rect outline |
| Ellipse | circle outline |
| Polygon | pentagon outline |
| Star | star outline |
| Line | diagonal line |

---

## 3. Explorer Components

### IconSetCard

| Prop/State | Variants |
|------------|----------|
| default | 6-icon preview grid, name, count, timestamp |
| synced | Shows sync label (owner/repo) |
| empty | Placeholder grid |
| hover | Elevated shadow |
| context-menu | Rename / Delete options |

### IconGridItem

| Prop/State | Variants |
|------------|----------|
| default | Icon preview + name |
| selected | Blue border/ring |
| favorited | Star indicator |
| hover | Subtle highlight |

### FilterSidebar

| Section | Content |
|---------|---------|
| Quick filters | All · Favorites tabs |
| Categories | Expandable list with counts |
| Collections | Expandable list with add/rename/delete |

### BulkActionBar

Floating bar when items are multi-selected.

| Element | Action |
|---------|--------|
| Count label | "3 selected" |
| Categorize button | Opens category picker |
| Export button | Triggers export |
| Delete button | Triggers confirm dialog |

### RecentProjectItem

| Prop/State | Variants |
|------------|----------|
| default | Name, relative time, Load + Delete buttons |
| loading | Spinner replacing Load button |

---

## 4. Left Sidebar Components

### LayerTreeItem

| Prop/State | Variants |
|------------|----------|
| depth | 0, 1, 2, 3+ (12px indent per level) |
| selected | `true` · `false` (highlight) |
| visible | `true` · `false` (eye icon state) |
| isClipMask | Shows "mask" badge |
| isGroup | Expandable chevron |
| isDerivedComponent | Shows component kind badge (fill/slash/circle/badge) |
| isBeingDragged | Drag preview state |

### VariantSizePill

| Prop/State | Variants |
|------------|----------|
| default | Size label (e.g., "24") |
| active | Highlighted/filled |
| derived | "derived" sub-badge |

### StatePill

| Prop/State | Variants |
|------------|----------|
| default | State name |
| active | Highlighted/filled |
| transitionCount | Badge with count (e.g., "(2)") |

### AddSizeForm

Inline: number input + "Add" button.

### AddStateForm

Inline: text input + "Duplicate" button + "Blank" button.

---

## 5. Canvas Components

### Canvas

The SVG editing surface. Figma should show representative states:

| State | What to show |
|-------|-------------|
| Empty | Grid + guides, no icon |
| Icon loaded | Rendered SVG paths |
| Layer selected | Blue selection handles on layer bounds |
| Point editing | Anchor points (filled ●) + control handles (hollow ○ with lines) |
| Marquee active | Dashed rectangle overlay |
| Snap guides | Cyan alignment lines |
| Transition preview | Semi-transparent morph overlay |

### Rulers

| Element | Description |
|---------|-------------|
| Top ruler | Horizontal with pixel marks + guide markers |
| Left ruler | Vertical with pixel marks + guide markers |
| Corner | Intersection square (click to toggle units) |

### StatusHUD

| Field | Example |
|-------|---------|
| Zoom | "100%" |
| Cursor position | "(24, 36)" |
| Point count | "3 pts" |
| Snap status | "Snap: on" |

### SelectionHandles

| Handle type | Visual |
|-------------|--------|
| Corner resize | Filled blue squares |
| Edge resize | Filled blue rectangles |
| Rotation | Offset circle above top-center |

### BezierPointHandle

| Point type | Visual |
|------------|--------|
| Anchor (corner) | Filled blue circle |
| Anchor (smooth) | Filled blue circle |
| Control handle | Hollow blue circle + connecting line |
| Static/corner | Filled blue square (no handles) |

---

## 6. Right Sidebar — Inspect Components

### DocumentInspector

Shown when no layer is selected.

| Field | Component | Notes |
|-------|-----------|-------|
| Icon name | TextInput | Editable |
| State | Select | Dropdown of state IDs |
| Size | NumericInput | With "px" unit |
| Rendering mode | Select | 4 options (Monochrome · Hierarchical · Palette · Multicolor) |
| Guide master | ReadOnlyLabel | Name + on/off |
| Delete state | DestructiveButton | With confirm |
| Delete variant | DestructiveButton | With confirm |

### LayerInspector

Shown when a layer is selected.

| Field | Component | Variants |
|-------|-----------|----------|
| Layer name | ReadOnlyLabel | Layer ID |
| Role | TextInput | Free-form ("primary", "secondary", etc.) |
| Fill mode | SegmentedControl | None · Fixed · CurrentColor |
| Fill color | ColorSwatch + ColorPickerPopover | When mode=Fixed |
| Fill opacity | Slider + NumericInput | 0–100% |
| VV indicator | ReadOnlyBadge | Effective opacity + threshold text |
| Stroke mode | SegmentedControl | None · Fixed · CurrentColor |
| Stroke color | ColorSwatch + ColorPickerPopover | When mode=Fixed |
| Stroke width | NumericInput | px |
| Stroke opacity | Slider + NumericInput | 0–100% |
| Position X | NumericInput | |
| Position Y | NumericInput | |
| Rotation | NumericInput | Degrees with ° |
| Topology status | CollapsibleSection | Lock badge + subpath list |
| Strategy badge | BadgePill | morph(green) / trim(yellow) / crossfade(red) / mixed |
| Auto-gradient | GradientSwatch | Read-only preview bar |

### MultiLayerInspector

Shown when multiple layers are selected.

| Section | Content |
|---------|---------|
| Selection count | "3 layers selected" |
| Boolean ops | Unite · Subtract · Intersect · Exclude buttons |
| Clip mask | Make Mask · Release Mask buttons |
| Alignment | 6 align buttons + 2 distribute buttons |
| Style | Same as LayerInspector (applies to first selected) |

---

## 7. Right Sidebar — Animation Components

### TransitionRow

| Prop/State | Variants |
|------------|----------|
| collapsed | Header only: ID + compatibility badge + delete |
| expanded | Header + layer bindings + timeline tracks |
| compatibility | `compatible` (green) · `best-guess` (yellow) · `incompatible` (red) |

### LayerBindingRow

| Prop/State | Variants |
|------------|----------|
| morph | From → To with morph score |
| trim | From → To with "open" indicator |
| crossfade | From → To with "crossfade" label |
| added | Target only, "new" badge |
| removed | Source only, "removed" badge |

### TrackEditor

Per-property editor within a binding.

| Track type | Editor component | Notes |
|------------|-----------------|-------|
| opacity | NumericInput + Slider | 0–1 range |
| rotate | NumericInput | Degrees |
| translateX/Y | NumericInput | Pixels |
| scale | NumericInput | 0–N multiplier |
| pathLength | NumericInput + Slider | 0–1 range |
| trimStart | NumericInput + Slider | 0–1 range |
| trimEnd | NumericInput + Slider | 0–1 range |
| trimOffset | NumericInput + Slider | 0–1 range |
| strokeWidth | NumericInput | px |
| fillOpacity | NumericInput + Slider | 0–1 |
| strokeOpacity | NumericInput + Slider | 0–1 |
| fill (color) | ColorSwatch + Picker | Hex + alpha |
| stroke (color) | ColorSwatch + Picker | Hex + alpha |

### TimelineEditor

| Element | Description |
|---------|-------------|
| Playhead | Vertical line at current time |
| Track row | Layer name + property name + keyframe bar |
| Keyframe | Diamond (◆) at start/end of track |
| Duration label | "300ms" at end |

### LivePreviewCanvas

| Element | Description |
|---------|-------------|
| Preview SVG | 320×320 animated preview |
| Play/Pause | Toggle button |
| Scrubber | Horizontal slider 0–100% |
| Speed | Dropdown: 0.25× · 0.5× · 1× · 2× |
| Reset | Button to return to frame 0 |

### AddTransitionForm

| Field | Component | Variants |
|-------|-----------|----------|
| Mode | SegmentedControl | Intra-variant · Cross-icon |
| From state | Select | State IDs |
| To state | Select | State IDs |
| Source icon/variant/state | 3× Select | Cross-icon mode only |
| Target icon/variant/state | 3× Select | Cross-icon mode only |
| Strategy | Select | auto · strictMorph · bestGuessMorph · crossIconMorph · lineAnimation · replace |
| Duration | NumericInput | ms |
| Easing | Select + EasingPickerPopover | Preset + custom |
| Direction | Select | automatic · downUp · upUp · offUp |

---

## 8. Import Components

### ImportTabBar

7 tabs: Raw SVG · Plugin · Figma · Lucide · Heroicons · Phosphor · Material Symbols

### RawSvgImportForm

| Field | Component | Notes |
|-------|-----------|-------|
| Sub-tab toggle | SegmentedControl | Paste SVG · Upload SVG |
| SVG source (paste) | Textarea (monospace, code-style) | Placeholder: `<svg ...>...</svg>` |
| File input (upload) | FileInput | accept: `.svg,image/svg+xml` |
| Validate button | Button | "Validate & Import", disabled when empty |
| Error | InlineMessage (red) | Shows on invalid SVG |

### PluginImportForm

| Field | Component | Notes |
|-------|-----------|-------|
| Sub-tab toggle | SegmentedControl | Paste JSON · Upload JSON |
| JSON source (paste) | Textarea (monospace) | Placeholder: `{"version":"1","source":"hiero-figma-plugin",...}` |
| Help text | ReadOnlyLabel | "Export from the Figma plugin, then paste the JSON payload here" |
| File input (upload) | FileInput | accept: `.json,application/json` |
| Import button | Button | "Import Plugin Payload" or "Upload & Import" |
| Batch progress | InlineLabel | "Importing {done}/{total}..." on button |
| Summary | InlineMessage | "Imported X of Y from [fileName]", "skipped Z" |

### FigmaImportForm

Two-state component: pre-connected and post-connected.

**Pre-connected state:**

| Field | Component | Notes |
|-------|-----------|-------|
| Figma file URL | TextInput | Placeholder: `https://figma.com/design/ABC123/My-Icons`, validated with `parseFigmaUrl()` |
| Personal access token | PasswordInput | Placeholder: `figd_...` |
| Help text | ReadOnlyLabel (muted) | "Generate at figma.com > Settings > Personal access tokens. Token is sent per-request and never stored." |
| Error | InlineMessage (red, role="alert") | On connection failure |
| Connect button | Button + Loader2 spinner | "Connect" with Link2 icon |

**Post-connected state:**

| Field | Component | Notes |
|-------|-----------|-------|
| Status bar | InlineBanner (blue) | "Connected as {userName}" |
| Component count | BadgePill | "{N} components" |
| Disconnect button | TextButton (destructive) | Resets to pre-connected |
| Component search | TextInput + SearchIcon | Placeholder: "Search components..." |
| Component grid | ScrollArea (h-64) + 2-col grid | Each item: thumbnail (size-10) + name + frame label |
| Empty state | InlineMessage (muted) | "No components match your search." or "No components found in this file." |
| Per-item spinner | Loader2 | Shows while importing individual component |

**Component grid item data:**

```typescript
{ key: string; name: string; nodeId: string; thumbnailUrl: string; frame: string | null }
```

### LibraryImportForm

Shared by Lucide, Heroicons, Phosphor, Material Symbols.

| Field | Component | Notes |
|-------|-----------|-------|
| Icon name input | TextInput | Placeholder: `e.g. arrow-right` |
| Validate button | Button | "Validate & Import" |
| Batch disclosure | CollapsibleSection (`<details>`) | Summary: "Batch import (comma-separated names, max 50)" |
| Batch textarea | Textarea | Placeholder: `arrow-right, arrow-left, check, x` |
| Import All button | Button | Text changes to "Importing {done}/{total}..." during batch |
| Batch limit | Enforced at 50 | Silently truncates |

### BatchImportProgress

| Element | Variants |
|---------|----------|
| Button label | "Importing {done}/{total}..." (replaces normal button text) |
| Button state | Disabled during batch |
| Summary (post-import) | "Imported X of Y from [source]", "skipped Z" |
| Skip/Retry | Buttons per failed icon |
| Summary | "Imported 22 of 24 icons" |

---

## 9. Export & Sync Components

### ExportFormatRadio

| Option | Description |
|--------|-------------|
| SVG | Single icon SVG |
| SVG Package | All icons as ZIP |
| Runtime JSON | `.hiero.json` with animation data |
| React Library | npm-ready TypeScript package |
| Lottie JSON | Lottie 5.x with downgrade warnings |

### LottieExportPanel

| Element | Description |
|---------|-------------|
| Preview | Animated Lottie preview |
| Diagnostics list | Per-feature compatibility (✓/⚠/✗) |
| Download button | Exports `.json` file |

### SyncTargetCard

| Target type | Fields |
|-------------|--------|
| Local Directory | Path input, exclude patterns, Sync button |
| GitHub PR | Owner/repo input, branch input, Create PR + Dry Run buttons |
| npm Registry | Package name, version, bump selector, auto-publish toggle, token, Publish + Dry Run buttons, version history list |

### VersionHistoryItem

| Field | Description |
|-------|-------------|
| Version | Semver string |
| Timestamp | Relative time |
| Icon count | Number of icons in that version |

---

## 10. Dialog Components

### ConfirmDialog

| Prop/State | Variants |
|------------|----------|
| simple | Message + Cancel/Confirm buttons |
| exact-name | Message + text input that must match name + Cancel/Delete buttons |
| destructive | Red-styled confirm button |
| three-button | Don't Save / Cancel / Save (unsaved changes) |

### RenameDialog

| Element | Description |
|---------|-------------|
| Label | "Rename [entity type]" |
| Input | Pre-filled with current name |
| Buttons | Cancel · Save |

---

## 11. Shared Primitives (Design System Atoms)

These are the base components that compose into all higher-level components.
Most already exist as shadcn/ui or kibo-ui components.

### Form Controls

| Component | Variants | Usage count |
|-----------|----------|-------------|
| TextInput | default · error · disabled · with-unit | 15+ |
| NumericInput | default · with-unit("px","ms","°","%") · with-slider · min/max constrained | 25+ |
| Select | default · with-icon · disabled | 20+ |
| SegmentedControl | 2-segment · 3-segment · with-icons | 8 |
| Slider | default · with-numeric-input · range | 12+ |
| Switch | on · off | 3 |
| Checkbox | checked · unchecked · indeterminate | 5 |
| Textarea | default · monospace (code) | 2 |
| PasswordInput | masked · revealed | 1 |
| FileDropzone | empty · file-loaded · error | 2 |

### Buttons

| Component | Variants |
|-----------|----------|
| Button | primary · secondary · ghost · destructive · icon-only |
| IconButton | default · active · disabled · with-tooltip |
| ToolButton | active · inactive (for canvas tools) |

### Display

| Component | Variants | Usage |
|-----------|----------|-------|
| BadgePill | green · yellow · red · blue · gray · with-icon | Strategy, compatibility, derived |
| LicenseBadge | MIT · Apache-2.0 | Import dialog |
| ReadOnlyLabel | default · muted | Inspector read-only fields |
| ReadOnlyBadge | info · warning · muted | VV indicator, topology |
| GradientSwatch | horizontal bar (CSS gradient) | Auto-gradient preview |
| ColorSwatch | square with color fill + checkerboard for alpha | Fill/stroke preview |
| ProgressBar | determinate (0–100%) | Batch import |
| Tooltip | text · rich (multi-line) | Everywhere |
| Toast | success · error · warning · info | Import/export/sync feedback |

### Layout

| Component | Description |
|-----------|-------------|
| ScrollArea | Scrollable panel content |
| CollapsibleSection | Header + chevron + collapsible body |
| Accordion | Multiple collapsible sections (single expand) |
| Tabs / TabsList / TabContent | Tab navigation |
| Sheet | Slide-in panel from edge |
| Popover | Positioned floating content |
| Dialog / AlertDialog | Modal overlay |
| Separator | Horizontal or vertical divider |

### Specialized

| Component | Description | Variants |
|-----------|-------------|----------|
| ColorPickerPopover | Full color picker | Solid only · with-alpha |
| EasingPickerPopover | Cubic bezier curve editor | Presets list + custom drag |
| CubicBezierCanvas | Interactive curve with 2 control points | Default presets + custom |

---

## Property Editor Variation Matrix

The inspect panel has the most variant combinations. This matrix ensures the
Figma design system covers every permutation.

### Fill/Stroke Mode × Value

| Mode | Value editor | Additional |
|------|-------------|------------|
| None | — (hidden) | — |
| Fixed | ColorSwatch + ColorPickerPopover | Opacity slider |
| CurrentColor | "currentColor" label | Opacity slider |

### Numeric Input Contexts

| Context | Unit | Range | Step | Has slider |
|---------|------|-------|------|------------|
| Position X/Y | — | -∞ to +∞ | 0.5 | No |
| Rotation | ° | 0–360 | 1 | No |
| Size (variant) | px | 1–1024 | 1 | No |
| Stroke width | px | 0–100 | 0.5 | No |
| Opacity | % | 0–100 | 1 | Yes |
| Duration | ms | 0–10000 | 50 | No |
| Zoom | % | 10–800 | 1 | No |
| Trim start/end/offset | — | 0–1 | 0.01 | Yes |
| Scale | × | 0–10 | 0.1 | No |
| Polygon sides | — | 3–12 | 1 | No |
| Star points | — | 3–12 | 1 | No |
| Path length | — | 0–1 | 0.01 | Yes |
| Fill/Stroke opacity | — | 0–1 | 0.01 | Yes |

### Select Dropdown Contexts

| Context | Options |
|---------|---------|
| Rendering mode | Monochrome · Hierarchical · Palette · Multicolor |
| Transition strategy | auto · strictMorph · bestGuessMorph · crossIconMorph · lineAnimation · replace |
| Transition direction | automatic · downUp · upUp · offUp |
| Playback speed | 0.25× · 0.5× · 1× · 2× |
| Semver bump | patch · minor · major |
| Shape sub-tool | Rectangle · Ellipse · Polygon · Star · Line |
| Phosphor weight | thin · light · regular · bold · fill · duotone |
| Zoom preset | 50% · 75% · 100% · 200% · 400% |
| Easing preset | ease · ease-in · ease-out · ease-in-out · linear · spring |

### Badge Pill Contexts

| Context | Colors | Labels |
|---------|--------|--------|
| Compatibility | green · yellow · red | Compatible · Best Guess · Incompatible |
| Strategy | green · yellow · red · blue · gray | Morph · Trim · Crossfade · Preserved · Mixed · Replace |
| Layer status | gray | Added · Removed · Unbound |
| Variant kind | blue | derived |
| Layer kind | purple | mask |
| Component kind | teal | fill · slash · circle · square · badge |
| Topology | blue | Locked |

---

## Responsive Considerations

| Breakpoint | Behavior |
|------------|----------|
| Desktop (>1280px) | Full layout: left sidebar (200px) + canvas + right sidebar (280px) |
| Tablet (768–1280px) | Collapsible sidebars, one visible at a time |
| Minimum (768px) | Below this, tool is not designed to function |

---

## Dark/Light Mode

All components must support both themes via CSS variables:
- Background layers: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Borders: `--border-default`, `--border-focus`
- Accent: `--accent-primary` (blue), `--accent-destructive` (red)
- Canvas: Always dark background (`#1a1a1a`) regardless of theme

---

## Figma Page Structure (Recommended)

```
Page 1: Screens
├── 1A Explorer — Workspace
├── 1B Explorer — Project View
├── 1C Explorer — Sync Panel
├── 2A Editor — Full Layout
├── 2B Editor — Layers Tab
├── 2C Editor — Variants Tab
├── 2D Editor — Canvas States (select/pen/shape)
├── 2E Editor — Inspect (no selection)
├── 2F Editor — Inspect (layer selected)
├── 2G Editor — Animation Tab
├── 3  Import Dialog (all 7 tab states)
├── 4  Export Sheet
├── 5  Add Transition Dialog
├── 6  Easing Editor
├── 7  Color Picker
├── 8  Keyboard Shortcuts
├── 9  Sync Target Config
└── 10 Confirmation Dialogs

Page 2: Component Library
├── Atoms (buttons, inputs, badges, etc.)
├── Molecules (form groups, cards, list items)
├── Organisms (panels, toolbars, sidebars)
└── Templates (full screen layouts)

Page 3: Design Tokens
├── Colors (light + dark)
├── Typography
├── Spacing
├── Shadows
├── Border radius
└── Icons (tool icons, UI icons)
```

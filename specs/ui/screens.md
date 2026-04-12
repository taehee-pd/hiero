# UI Screens

**Status:** Specification (complete screen inventory for Figma design & implementation)
**Primary files:** `components/studio/StudioLayout.tsx`, `components/editor/EditorShell.tsx`

---

## Overview

Contour uses a single-screen StudioLayout (similar to Sanity Studio) as the
primary workspace at `/`. The StudioLayout combines a navigation sidebar, icon
list pane, and embedded editor into one unified screen. The legacy Explorer shell
and the standalone Editor route (`/editor/[iconId]`) still exist as alternative
entry points but are no longer the default UI. Modal/sheet overlays handle
import, export, and sync operations. This spec documents every screen, sub-view,
panel state, and dialog required for a complete Figma design file, ensuring no
user flows are missing.

---

## Screen 0: Studio Workspace (`/`) — Primary

The single-screen workspace that combines navigation, icon list, and embedded
editor. This is the default landing experience, modelled after tools like Sanity
Studio where the entire workflow lives in one layout.

**Primary files:** `components/studio/StudioLayout.tsx`, `components/studio/NavPane.tsx`, `components/studio/ListPane.tsx`, `components/studio/Navbar.tsx`

### 0A. Full Studio Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Navbar: [project-name] · Saved 2m ago        [Import] [Export] [?] │
├───────────┬──────────────┬───────────────────────────────────────────┤
│ NavPane   │ ListPane     │  Embedded EditorShell                     │
│ ~200px    │ ~260px       │  (full editor when icon selected)         │
│           │              │                                           │
│ Workspace │ [🔍 Search]  │  ┌─ Canvas ──────────────────────────┐   │
│           │              │  │                                    │   │
│ Projects  │ ┌────┐┌────┐│  │     ┌────────────────┐            │   │
│ ├ My Icons│ │ ◻  ││ ◻  ││  │     │   Icon Canvas  │            │   │
│ ├ Arrows  │ │home││gear││  │     │   (SVG)        │            │   │
│ ├ Nav Set │ └────┘└────┘│  │     └────────────────┘            │   │
│           │ ┌────┐┌────┐│  │                                    │   │
│ Settings  │ │ ◻  ││ ◻  ││  └────────────────────────────────────┘   │
│           │ │star││bell││                                           │
│           │ └────┘└────┘│  ┌─ Right Sidebar (Inspect/Animation) ┐   │
│           │              │  │  (same as Screen 2 panels)         │   │
│           │              │  └────────────────────────────────────┘   │
├───────────┴──────────────┴───────────────────────────────────────────┤
│  Status Bar (optional)                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Width | Purpose |
|-----------|-------|---------|
| **Navbar** | full width | Top bar — project name, save status, global actions |
| **NavPane** | ~200px | Workspace/project sidebar — switch between icon sets, settings |
| **ListPane** | ~260px | Icon grid with search, filter, multi-select |
| **EditorShell** | remaining | Embedded editor — appears when an icon is selected |

**States:**
- No icon selected — EditorShell shows empty/welcome state
- Icon selected — full editor with canvas, left sidebar (layers/variants), right sidebar (inspect/animation)
- Multiple icons selected in ListPane — bulk action bar visible
- NavPane collapsed — more room for ListPane + Editor

---

## Screen 1: Explorer (`/explorer`) — Legacy (superseded by StudioLayout)

> **Legacy:** This screen has been superseded by Screen 0 (StudioLayout) as the
> primary UI. It remains available at `/explorer` for standalone project
> management workflows.

The workspace-level project management screen.

### 1A. Workspace View (default)

The landing view showing all icon sets in a grid.

```
┌─────────────────────────────────────────────────────────────┐
│  [← Workspace]  [🔍 Search...              ]  [Import ▾] [+ New Set]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ◻ ◻ ◻        │  │ ◻ ◻ ◻        │  │ ◻ ◻ ◻        │      │
│  │ ◻ ◻ ◻        │  │ ◻ ◻ ◻        │  │ ◻ ◻ ◻        │      │
│  │ My Icons (24) │  │ Arrows (12)  │  │ Nav Set (8)  │      │
│  │ Updated 2h    │  │ synced: org  │  │ Updated 1d   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─ Recent Projects ──────────────────────────────────────┐ │
│  │  project-a.contour  ·  3 days ago  [Load] [×]           │ │
│  │  project-b.contour  ·  1 week ago  [Load] [×]           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**States:**
- Empty workspace (no icon sets) — show "Create your first icon set" CTA
- Search active — filtered icon set cards
- Icon set context menu — rename / delete

### 1B. Project View (inside an icon set)

Entered by clicking an icon set card.

```
┌─────────────────────────────────────────────────────────────┐
│  [← Workspace]  [🔍 Search...              ]  [Import ▾] [+ Icon]  │
├────────────┬────────────────────────────────────────────────┤
│  Filters   │  Icon Grid                                     │
│            │                                                │
│  [All]     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  [★ Fav]   │  │ ◻  │ │ ◻  │ │ ◻  │ │ ◻  │ │ ◻  │ │ ◻  │  │
│  Categories│  │home│ │gear│ │star│ │bell│ │user│ │plus│  │
│  ├ UI      │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘  │
│  ├ Nav     │                                                │
│  ├ Status  │  ┌────┐ ┌────┐ ┌────┐                         │
│  Collections  │ ◻  │ │ ◻  │ │ ◻  │                         │
│  ├ Header  │  │chev│ │menu│ │lock│                         │
│  ├ Footer  │  └────┘ └────┘ └────┘                         │
│            │                                                │
│            │  ┌─ Bulk Actions (when selected) ────────────┐ │
│            │  │ 3 selected  [Categorize] [Export] [Delete] │ │
│            │  └───────────────────────────────────────────┘ │
└────────────┴────────────────────────────────────────────────┘
```

**States:**
- Empty set — "Import or create your first icon" CTA
- Filter active (category / collection / favorites)
- Multi-select mode with bulk action bar
- Search active within set

### 1C. Explorer Right Panel (Publish & Export)

> **Changed:** Sync targets have been replaced by repo-native distribution.
> This panel shows the publish status from `contour.config.ts` and export options.

Appears as a collapsible right panel or sheet.

```
┌─ Distribution ──────────────────────┐
│                                      │
│  ┌─ Repo Publish ────────────────┐  │
│  │  Config: contour.config.ts ✓   │  │
│  │                               │  │
│  │  Host: react                  │  │
│  │    → src/components/icons/    │  │
│  │    24 icons (3 changed)       │  │
│  │    [Publish Changed] [All]    │  │
│  │                               │  │
│  │  Release: npm                 │  │
│  │    @scope/icons  v1.2.3       │  │
│  │    [Release] [Dry Run]        │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌─ Export ──────────────────────┐  │
│  │  [SVG Zip]  [React Package]   │  │
│  │  [Lottie]   [Runtime JSON]    │  │
│  └───────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Screen 2: Editor (`/editor/[iconId]`)

> **Note:** The editor is primarily accessed as the embedded panel inside
> StudioLayout (Screen 0). The standalone route at `/editor/[iconId]` still
> exists as an alternative focused editing mode without the NavPane/ListPane
> chrome.

The core icon authoring screen.

### 2A. Full Editor Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  TitleTabBar: [Explorer] [home ×] [gear ×] [star ×]    — □ ×        │
├──────────────────────────────────────────────────────────────────────┤
│  Toolbar: [≡] project-name* · Saved 2m ago  [↩ ↪]  [Import] [Export ▾] [?] │
├────────────┬─────────────────────────────────────────┬───────────────┤
│ Left       │  Canvas                                  │ Right         │
│ Sidebar    │                                          │ Sidebar       │
│ 200px      │  ┌─ Rulers ─────────────────────────┐   │ 280px         │
│            │  │                                    │   │               │
│ [Layers]   │  │     ┌────────────────┐            │   │ [Inspect]     │
│ [Variants] │  │     │                │            │   │ [Animation]   │
│            │  │     │   Icon Canvas  │            │   │               │
│ ┌────────┐ │  │     │   (SVG)        │            │   │ ┌───────────┐ │
│ │Layer   │ │  │     │                │            │   │ │Panel      │ │
│ │Tree    │ │  │     │   ● ● ●        │            │   │ │Content    │ │
│ │        │ │  │     │   ○   ○        │            │   │ │(varies by │ │
│ │        │ │  │     └────────────────┘            │   │ │tab &      │ │
│ │        │ │  │                                    │   │ │selection) │ │
│ │        │ │  │  ┌─ Status HUD ──┐                │   │ │           │ │
│ │        │ │  │  │ 100% · (24,36)│                │   │ │           │ │
│ └────────┘ │  │  └───────────────┘                │   │ └───────────┘ │
│            │  └────────────────────────────────────┘   │               │
│            │  ┌─ Canvas Dock ─────────────────────┐   │               │
│            │  │ [▷ Select] [✎ Pen] [◻ Shape ▾]   │   │               │
│            │  │                     [Zoom: 100%]  │   │               │
│            │  └───────────────────────────────────┘   │               │
├────────────┴─────────────────────────────────────────┴───────────────┤
│  Status Bar (optional)                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### 2B. Left Sidebar — Layers Tab

```
┌─ Layers ──────────────────┐
│  Variant: 24px             │
│                            │
│  ▾ bg-circle               │
│    ├ chevron         👁    │
│    ├ dot        mask 👁    │
│    └ ring            👁    │
│  ▾ arrow                   │
│    └ stem            👁    │
│  ▸ group-a                 │
│                            │
│  [+ Layer]                 │
└────────────────────────────┘
```

**States:**
- No layers — empty state
- Layer selected — highlight row
- Multi-select — multiple highlighted
- Layer dragging (reorder)
- Nested groups (indented)

### 2C. Left Sidebar — Variants Tab

```
┌─ Variants ───────────────┐
│                            │
│  Sizes (intrinsic)         │
│  [16] [20] [24●] [32] [48]│
│  ┌──────┐                  │
│  │ 64   │ [Add]            │
│  └──────┘                  │
│                            │
│  Styles                    │
│  [outline●] [solid] [duo]  │
│                            │
│  Derived                   │
│  [fill] [slash] [circle]   │
│                            │
│  Weight (Phase O)          │
│  9 stops · 4 populated     │
│  [Edit Control Points]     │
└────────────────────────────┘
```

**States:**
- Single variant — minimal view
- Multiple variants with derived badges
- Weight control point editor (Phase O)

> **Note:** Per-icon authored states (`default`, `hover`, `pressed`, etc.)
> have been removed from the product model. Animation is now a runtime
> icon-to-icon transition concern, not authored per-icon state graphs.

### 2D. Canvas — Tool Modes

**Select Tool:**
- Layer bounding box with resize handles
- Drag to move layer
- Marquee rectangle selection

**Pen Tool:**
- Point editing: anchor points (filled circles), control handles (hollow circles + lines)
- Add point — click on segment
- Delete point — Alt+click
- Drag for Bezier handles

**Shape Tool:**
- Shape sub-tool dropdown: Rectangle / Ellipse / Polygon / Star / Line
- Draw preview (dashed outline while dragging)
- Polygon sides / Star points input (in toolbar or dock)

**Canvas Overlays:**
- Snap guides (cyan lines)
- Grid (subtle dots/lines)
- Transition preview (semi-transparent morphing overlay)
- Rulers (top + left with scale + guide markers)

### 2E. Right Sidebar — Inspect Tab (No Selection)

```
┌─ Inspect ─────────────────┐
│                            │
│  Document                  │
│  Name  [home-icon     ]    │
│  State [default   ▾]      │
│  Size  [24] px             │
│  Mode  [Monochrome    ▾]   │
│                            │
│  Guides                    │
│  Master: SF-24   On       │
│                            │
│  Actions                   │
│  [Delete State]            │
│  [Delete Variant]          │
└────────────────────────────┘
```

### 2F. Right Sidebar — Inspect Tab (Layer Selected)

```
┌─ Inspect ─────────────────┐
│                            │
│  Layer: chevron            │
│  Role  [secondary    ]     │
│                            │
│  Fill                      │
│  [None ▾] [Fixed ▾] [CC●] │
│  ┌────┐ #3B82F6  100%     │
│  │ ■  │ [color picker]     │
│  └────┘                    │
│  VV: 0.45 → eff 45%       │
│  "visible at 33–66%"       │
│                            │
│  Stroke                    │
│  [None●] [Fixed] [CC]     │
│  Width [2] px              │
│                            │
│  Transform                 │
│  X [12.5]  Y [8.0]        │
│  R [45°]                   │
│                            │
│  Topology     🔒 Locked    │
│  3 subpaths (2 closed)     │
│  ├ MLCCCZ  [morph]        │
│  ├ MLCCCZ  [morph]        │
│  └ MLC     [trim]         │
│                            │
│  Strategy: [Mixed ⓘ]      │
└────────────────────────────┘
```

### 2G. Right Sidebar — Animation Tab (Transition Preview)

> **Changed:** Animation is now runtime icon-to-icon transitions, not
> per-icon authored state graphs. This panel previews how the runtime
> will transition between two icons.

```
┌─ Transition Preview ─────┐
│                            │
│  Source                    │
│  Icon    [home        ▾]  │
│  Variant [24px        ▾]  │
│                            │
│  Target                    │
│  Icon    [menu        ▾]  │
│  Variant [24px        ▾]  │
│                            │
│  ┌─ Strategy Analysis ──┐ │
│  │  Strategy: bestGuess  │ │
│  │  ● bg:   morph  0.94 │ │
│  │  ● chev: trim   draw │ │
│  │  ● dot:  replace fade│ │
│  └───────────────────────┘ │
│                            │
│  ┌─ Timeline ──────────┐  │
│  │ ▶ ━━━━━━━━━━━ 300ms │  │
│  │ bg-circle            │  │
│  │  morph   ◆━━━━━━◆   │  │
│  │ chevron             │  │
│  │  trimSt  ◆━━━━━━◆   │  │
│  │  trimEn  ◆━━━━━━◆   │  │
│  └─────────────────────┘  │
│                            │
│  ┌─ Preview ───────────┐  │
│  │  ┌──────────────┐   │  │
│  │  │   Source →    │   │  │
│  │  │   Target     │   │  │
│  │  │   Preview    │   │  │
│  │  └──────────────┘   │  │
│  │  [▶] ━━━━━━━━ [1×▾] │  │
│  └─────────────────────┘  │
│                            │
│  Strategy: [auto ▾]        │
│  Duration: [300] ms        │
│  Easing:   [ease-out ▾]    │
└────────────────────────────┘
```

**Strategies** (runtime-resolved):
- `strictMorph` — command signatures match exactly (green badge)
- `bestGuessMorph` — geometry close after normalization (yellow badge)
- `lineAnimation` — trim/draw reveal (orange badge)
- `replace` — fallback: crossfade, scale, directional (red badge)

---

## Screen 3: Import Dialog (Modal)

Accessible from both Explorer and Editor. Each tab has distinct UI structure.

```
┌─ Import Icons ────────────────────────────────────────────┐
│                                                            │
│  [SVG] [Plugin] [Figma] [Lucide] [Hero] [Phosphor] [Mat]  │
│                                                            │
│  ┌─ Tab: Raw SVG ─────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [Paste SVG | Upload SVG]  (sub-tab toggle)         │   │
│  │                                                     │   │
│  │  Paste mode:                                        │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ <svg xmlns="..." viewBox="0 0 24 24">       │   │   │
│  │  │   <path d="M12 2L2 7l10 5 10-5-10-5z"/>    │   │   │
│  │  │ </svg>                                       │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  [Validate & Import]                                │   │
│  │                                                     │   │
│  │  Upload mode:                                       │   │
│  │  [Choose .svg file]                                 │   │
│  │  [Validate & Import]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Tab: Plugin ──────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [Paste JSON | Upload JSON]  (sub-tab toggle)       │   │
│  │                                                     │   │
│  │  Paste mode:                                        │   │
│  │  Plugin payload JSON                                │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ {"version":"1","source":"contour-figma-       │   │   │
│  │  │  plugin","icons":[...]}                      │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  "Export from the Figma plugin, then paste here."   │   │
│  │  [Import Plugin Payload]                            │   │
│  │                                                     │   │
│  │  Upload mode:                                       │   │
│  │  [Choose .json file]                                │   │
│  │  [Upload & Import]                                  │   │
│  │                                                     │   │
│  │  Progress: "Imported 22 of 24 from file.json"       │   │
│  │            "skipped 2"                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Tab: Figma ───────────────────────────────────────┐   │
│  │                                                     │   │
│  │  == Pre-connected ==                                │   │
│  │  Figma file URL                                     │   │
│  │  [https://figma.com/design/ABC123/My-Icons      ]   │   │
│  │  Personal access token                              │   │
│  │  [figd_•••••••••                                ]   │   │
│  │  "Generate at figma.com > Settings > Personal       │   │
│  │   access tokens. Never stored."                     │   │
│  │  [Connect]                                          │   │
│  │                                                     │   │
│  │  == Post-connected ==                               │   │
│  │  ┌ Connected as taehee  [124 components] [Discon]┐  │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  [Search components...                         ]    │   │
│  │  ┌────────────┐ ┌────────────┐                      │   │
│  │  │ [thumb]    │ │ [thumb]    │                      │   │
│  │  │ icon/home  │ │ icon/gear  │                      │   │
│  │  │ Icons      │ │ Icons      │                      │   │
│  │  └────────────┘ └────────────┘                      │   │
│  │  (2-col grid with thumbnail, name, frame label)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Tab: Library (Lucide/Hero/Phosphor/Material) ─────┐   │
│  │                                                     │   │
│  │  {Library} icon name                                │   │
│  │  [e.g. arrow-right          ] [Validate & Import]   │   │
│  │                                                     │   │
│  │  ▸ Batch import (comma-separated, max 50)           │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ arrow-right, arrow-left, check, x, home      │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  │  [Import All]  "Importing 3/6..."                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  [Cancel]                            [Import Selected]     │
└────────────────────────────────────────────────────────────┘
```

**States per tab:**
- **Raw SVG:** Empty, SVG pasted (with preview), error (invalid SVG)
- **Plugin:** No file, file loaded (batch preview), importing (progress), done
- **Figma:** No URL, loading file tree, browsing components, selected, importing
- **Libraries:** Initial (empty search), results grid, selection, importing (batch progress)

---

## Screen 4: Export Sheet

```
┌─ Export ───────────────────────────────────────────────────┐
│                                                            │
│  Format                                                    │
│  ○ SVG (single icon)                                       │
│  ○ SVG Package (all icons, ZIP)                            │
│  ○ Runtime JSON (.contour.json)                             │
│  ○ React Library (npm-ready TypeScript)                    │
│  ○ Lottie JSON                                             │
│                                                            │
│  ┌─ Lottie Options (if selected) ─────────────────────┐   │
│  │  Preview: [icon preview]                            │   │
│  │                                                     │   │
│  │  Diagnostics:                                       │   │
│  │  ⚠ 2 layers use trim paths (approximated)          │   │
│  │  ⚠ Cross-icon transition omitted                    │   │
│  │  ✓ 4 layers fully compatible                        │   │
│  │                                                     │   │
│  │  [Download Lottie JSON]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  [Cancel]                              [Export]            │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 5: Add Transition Dialog

> **Changed:** Intra-variant state transitions have been removed. Transitions are
> now exclusively icon-to-icon, driven by the runtime. This dialog sets up a
> transition pair for preview and optional hint storage.

```
┌─ Add Transition ──────────────────────────────────────────┐
│                                                            │
│  Source                                                     │
│    Icon    [home        ▾]                                  │
│    Variant [24px        ▾]                                  │
│  Target                                                     │
│    Icon    [menu        ▾]                                  │
│    Variant [24px        ▾]                                  │
│                                                            │
│  ── Strategy (runtime-resolved) ──                         │
│  Override  [auto ▾]  (strictMorph / bestGuessMorph /       │
│                       lineAnimation / replace)             │
│  Duration  [300] ms                                         │
│  Easing    [ease-out ▾] [⌒ Edit]                           │
│                                                            │
│  ── Compatibility Check ──                                 │
│  Source layers: 4    Target layers: 3                       │
│  Matched: 3  Unmatched: 1                                  │
│  Predicted strategy: bestGuessMorph                        │
│                                                            │
│  [Cancel]                        [Create Transition]       │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 6: Easing Curve Editor (Popover)

```
┌─ Easing ──────────────────┐
│                            │
│  ┌────────────────────┐   │
│  │        ●            │   │
│  │       /             │   │
│  │      /              │   │
│  │     /               │   │
│  │  ●/                 │   │
│  └────────────────────┘   │
│  cubic-bezier(            │
│    0.25, 0.1, 0.25, 1.0)  │
│                            │
│  Presets:                  │
│  [ease] [ease-in]          │
│  [ease-out] [ease-in-out]  │
│  [linear] [spring]         │
└────────────────────────────┘
```

---

## Screen 7: Color Picker (Popover)

```
┌─ Color ───────────────────┐
│  ┌────────────────────┐   │
│  │                    │   │
│  │  Saturation/       │   │
│  │  Brightness        │   │
│  │  Gradient          │   │
│  │          ●         │   │
│  └────────────────────┘   │
│  ━━━━━━━●━━━━━━━━━ Hue   │
│  ━━━━●━━━━━━━━━━━ Alpha   │
│                            │
│  Hex  [#3B82F6]  A [100%] │
│                            │
│  Swatches:                 │
│  [■][■][■][■][■][■][■][■] │
│  [■][■][■][■][■][■][■][■] │
└────────────────────────────┘
```

---

## Screen 8: Keyboard Shortcuts Dialog

```
┌─ Keyboard Shortcuts ──────────────────────────────────────┐
│                                                            │
│  Tools                      Selection                      │
│  V   Select                 ⌘A  Select all                │
│  P   Pen                    ⌘⇧A Deselect all              │
│  R   Rectangle              Del Delete selected            │
│  O   Ellipse                                               │
│  U   Polygon                Canvas                         │
│                              ⌘+  Zoom in                   │
│  Edit                        ⌘-  Zoom out                  │
│  ⌘Z  Undo                   ⌘0  Fit to screen             │
│  ⌘⇧Z Redo                   Space+drag  Pan               │
│  ⌘C  Copy                                                  │
│  ⌘V  Paste                  Path                           │
│  ⌘D  Duplicate              ⌘⇧U Unite                     │
│                              ⌘⇧S Subtract                  │
│  File                        ⌘⇧I Intersect                 │
│  ⌘S  Save                   ⌘⇧E Exclude                   │
│  ⌘N  New                                                   │
│  ⌘O  Open                                                  │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 9: Install & Publish Configuration

> **Changed:** Per-target sync (local / GitHub PR / npm) has been replaced by
> repo-native distribution configured via `contour.config.ts` at the repo root.
> The UI shows the current config status and provides publish actions.

### 9A. Host Targets (Live Dev)

```
┌─ Host Targets (from contour.config.ts) ────────────────────┐
│                                                            │
│  Source Dir   src/icons/source                             │
│  Out Dir      src/icons/generated                          │
│                                                            │
│  Host Target: react                                        │
│  Framework    React                                        │
│  Output       src/components/icons/                        │
│  Status       ● Watching  (12 icons, 3 changed)            │
│                                                            │
│  [Publish Changed]  [Publish All]  [Dry Run]               │
└────────────────────────────────────────────────────────────┘
```

### 9B. Release Targets

```
┌─ Release Targets ─────────────────────────────────────────┐
│                                                            │
│  npm                                                       │
│  Package    @scope/icons                                   │
│  Version    1.2.3                                          │
│  Bump       [patch ▾]                                      │
│                                                            │
│  History                                                   │
│  1.2.3  ·  2h ago  ·  24 icons                             │
│  1.2.2  ·  3d ago  ·  22 icons                             │
│                                                            │
│  [Release]  [Dry Run]                                      │
└────────────────────────────────────────────────────────────┘
```

### 9C. Config Status

```
┌─ Config ──────────────────────────────────────────────────┐
│                                                            │
│  Config File   contour.config.ts  ✓ Found                   │
│  Source Dir    src/icons/source   ✓ 24 icons                │
│  Last Publish  2h ago (changed-only, 3 icons)              │
│                                                            │
│  [Open Config File]  [Validate Config]                     │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 10: Confirmation Dialogs

### 10A. Delete Confirmation (exact name)

```
┌─ Delete "Arrow Set" ──────────────────────────────────────┐
│                                                            │
│  This will permanently delete "Arrow Set" and all 12       │
│  icons it contains. This action cannot be undone.          │
│                                                            │
│  Type "Arrow Set" to confirm:                              │
│  [                              ]                          │
│                                                            │
│  [Cancel]                              [Delete]            │
└────────────────────────────────────────────────────────────┘
```

### 10B. Unsaved Changes

```
┌─ Unsaved Changes ─────────────────────────────────────────┐
│                                                            │
│  You have unsaved changes. Do you want to save before      │
│  continuing?                                               │
│                                                            │
│  [Don't Save]      [Cancel]            [Save]              │
└────────────────────────────────────────────────────────────┘
```

### 10C. Simple Confirmation

```
┌─ Delete Transition ───────────────────────────────────────┐
│                                                            │
│  Remove transition "home → menu"? This cannot be undone.   │
│                                                            │
│  [Cancel]                              [Delete]            │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 11: Runtime Demo (`/runtime-demo`, `/demo/runtime`)

Standalone demo pages that render icons using the Contour runtime outside of
the editor context. Useful for testing runtime transitions, embedding previews,
and validating compiled icon output.

- `/runtime-demo` — primary runtime demo route
- `/demo/runtime` — alternative path (alias)

---

## User Flow Coverage Matrix

| Flow | Screen(s) | Entry Point |
|------|-----------|-------------|
| First launch (studio) | 0A (empty) | App start (`/`) |
| Browse projects (studio) | 0A NavPane | NavPane sidebar |
| Select icon (studio) | 0A ListPane → Editor | Click icon in ListPane |
| Search icons (studio) | 0A ListPane | ListPane search bar |
| Runtime demo | 11 | `/runtime-demo` or `/demo/runtime` |
| First launch (legacy explorer) | 1A (empty) | `/explorer` |
| Create icon set | 1A → dialog | "+ New Set" button |
| Browse icon sets | 1A | Default view |
| Enter icon set | 1A → 1B | Click set card |
| Search icons | 1B | Search bar |
| Filter by category | 1B | Sidebar filter |
| Filter by collection | 1B | Sidebar filter |
| Filter by favorites | 1B | Sidebar filter |
| Bulk select & categorize | 1B | Multi-select + action bar |
| Bulk export | 1B | Multi-select + action bar |
| Bulk delete | 1B → 10A | Multi-select + action bar |
| Import SVG (raw) | 3 (SVG tab) | Import menu |
| Import from Figma | 3 (Figma tab) | Import menu |
| Import from library | 3 (library tab) | Import menu |
| Import from plugin | 3 (Plugin tab) | Import menu |
| Create blank icon | 2A | Toolbar or Explorer |
| Open project file | 1A / 2A | Toolbar |
| Save project | 2A | Toolbar / ⌘S |
| Edit icon path (pen) | 2D | Tool dock |
| Draw shape | 2D | Tool dock |
| Select & move layers | 2D | Tool dock |
| Edit layer styles | 2F | Right sidebar |
| Change fill/stroke | 2F → 7 | Inspect tab |
| Set layer role | 2F | Inspect tab |
| View topology | 2F | Inspect tab |
| Add variant size | 2C | Left sidebar |
| Generate derived variant | 2C | Left sidebar |
| Create icon-to-icon transition | 2G → 5 | Animation tab |
| Preview icon-to-icon transition | 2G | Animation tab |
| View strategy analysis | 2G | Animation tab |
| Edit transition timing | 2G | Animation tab |
| Edit easing curve | 6 | Transition form |
| Pick color | 7 | Fill/stroke editor |
| Export SVG | 4 | Export menu |
| Export Lottie | 4 | Export menu |
| Export React library | 4 | Export menu |
| Publish changed icons (host) | 9A | Publish panel |
| Release to npm | 9B | Publish panel |
| View config status | 9C | Publish panel |
| View keyboard shortcuts | 8 | Help menu |
| Switch between icons (tabs) | 2A | Title tab bar |
| Undo / redo | 2A | Toolbar / ⌘Z |
| Zoom / pan canvas | 2D | Dock / scroll / keys |

---

## Types

### Screen Identifiers

```typescript
type ScreenId =
  | 'studio-workspace'        // 0A (primary)
  | 'explorer-workspace'      // 1A (legacy)
  | 'explorer-project'        // 1B (legacy)
  | 'explorer-publish'        // 1C (legacy)
  | 'editor-full'             // 2A
  | 'editor-layers-tab'       // 2B
  | 'editor-variants-tab'     // 2C
  | 'editor-canvas-select'    // 2D select mode
  | 'editor-canvas-pen'       // 2D pen mode
  | 'editor-canvas-shape'     // 2D shape mode
  | 'editor-inspect-none'     // 2E
  | 'editor-inspect-layer'    // 2F
  | 'editor-animation'        // 2G
  | 'import-dialog'           // 3
  | 'export-sheet'            // 4
  | 'add-transition-dialog'   // 5
  | 'easing-editor'           // 6
  | 'color-picker'            // 7
  | 'shortcuts-dialog'        // 8
  | 'install-config'          // 9
  | 'confirm-dialog'          // 10
  | 'runtime-demo';           // 11
```

### Panel Visibility Rules

```typescript
type PanelVisibility = {
  // Studio-level panels (Screen 0)
  navPane: boolean;      // workspace/project sidebar (~200px)
  listPane: boolean;     // icon grid with search (~260px)
  navbar: boolean;       // top bar — always visible in studio

  // Editor-level panels (embedded in Screen 0 or standalone Screen 2)
  leftSidebar: 'layers' | 'variants';
  rightSidebar: 'inspect' | 'animation';
  inspectContent:
    | 'document'         // no selection
    | 'layer'            // single layer selected
    | 'multi-layer';     // multiple layers selected
  canvasDock: boolean;   // always visible in editor
  bulkActionBar: boolean; // visible when multi-selected in list pane or explorer
  statusHud: boolean;    // visible in editor
};
```

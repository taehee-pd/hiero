# UI Screens

**Status:** Specification (complete screen inventory for Figma design & implementation)
**Primary files:** `components/explorer/ExplorerShell.tsx`, `components/editor/EditorShell.tsx`

---

## Overview

Coniva has two primary screens (Explorer and Editor) and a set of modal/sheet
overlays for import, export, and sync operations. This spec documents every
screen, sub-view, panel state, and dialog required for a complete Figma design
file, ensuring no user flows are missing.

---

## Screen 1: Explorer (`/`)

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
│  │  project-a.coniva  ·  3 days ago  [Load] [×]           │ │
│  │  project-b.coniva  ·  1 week ago  [Load] [×]           │ │
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

### 1C. Explorer Right Panel (Sync & Export)

Appears as a collapsible right panel or sheet.

```
┌─ Distribution ──────────────────────┐
│                                      │
│  ┌─ Sync Targets ────────────────┐  │
│  │  ○ Local Directory            │  │
│  │    /path/to/output  [Sync]    │  │
│  │                               │  │
│  │  ○ GitHub PR                  │  │
│  │    org/repo  [Create PR]      │  │
│  │                               │  │
│  │  ○ npm Registry               │  │
│  │    @scope/pkg  v1.2.3         │  │
│  │    [patch ▾] [Publish] [Dry]  │  │
│  │                               │  │
│  │  [+ Add Target]               │  │
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
┌─ Variants & States ───────┐
│                            │
│  Sizes                     │
│  [16] [20] [24●] [32] [48]│
│  ┌──────┐                  │
│  │ 64   │ [Add]            │
│  └──────┘                  │
│                            │
│  Derived                   │
│  [fill] [slash] [circle]   │
│                            │
│  States                    │
│  [default●] [hover (2)]   │
│  [pressed (1)] [disabled]  │
│  ┌────────────┐            │
│  │ focused    │ [Dup][New] │
│  └────────────┘            │
└────────────────────────────┘
```

**States:**
- Single variant — minimal view
- Multiple variants with derived badges
- States with transition count badges

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

### 2G. Right Sidebar — Animation Tab

```
┌─ Animation ───────────────┐
│                            │
│  [Transitions] [Effects]   │
│  [Variable Value]          │
│                            │
│  ┌─ default → hover ──┐   │
│  │  ✓ Compatible       │   │
│  │  ▸ bg: morph  0.94  │   │
│  │  ▸ chev: trim  open │   │
│  │  ▸ dot: fade   new  │   │
│  │  [×]                │   │
│  └─────────────────────┘   │
│                            │
│  ┌─ Timeline ──────────┐  │
│  │ ▶ ━━━━━━━━━━━ 300ms │  │
│  │ bg-circle            │  │
│  │  opacity ◆━━━━━━◆   │  │
│  │  morph   ◆━━━━━━◆   │  │
│  │ chevron             │  │
│  │  trimSt  ◆━━━━━━◆   │  │
│  │  trimEn  ◆━━━━━━◆   │  │
│  └─────────────────────┘  │
│                            │
│  ┌─ Preview ───────────┐  │
│  │  ┌──────────────┐   │  │
│  │  │              │   │  │
│  │  │   Preview    │   │  │
│  │  │   Canvas     │   │  │
│  │  │              │   │  │
│  │  └──────────────┘   │  │
│  │  [▶] ━━━━━━━━ [1×▾] │  │
│  └─────────────────────┘  │
│                            │
│  [+ Add Transition]       │
└────────────────────────────┘
```

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
│  │  │ {"version":"1","source":"coniva-figma-       │   │   │
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
│  ○ Runtime JSON (.coniva.json)                             │
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

```
┌─ Add Transition ──────────────────────────────────────────┐
│                                                            │
│  Mode                                                      │
│  [Intra-variant●] [Cross-icon]                             │
│                                                            │
│  === Intra-variant ===                                     │
│  From  [default     ▾]                                     │
│  To    [hover       ▾]                                     │
│                                                            │
│  === Cross-icon ===                                        │
│  Source                                                     │
│    Icon    [home        ▾]                                  │
│    Variant [24px        ▾]                                  │
│    State   [default     ▾]                                  │
│  Target                                                     │
│    Icon    [gear        ▾]                                  │
│    Variant [24px        ▾]                                  │
│    State   [default     ▾]                                  │
│                                                            │
│  Strategy  [Best Guess Morph ▾]                             │
│  Duration  [300] ms                                         │
│  Easing    [ease-out ▾] [⌒ Edit]                           │
│  Direction [automatic ▾]                                    │
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

## Screen 9: Sync Target Configuration

### 9A. Local Directory Target

```
┌─ Local Directory ─────────────────────────────────────────┐
│  Path     [/Users/me/output/icons       ] [Browse]        │
│  Exclude  [*.test.* , *.map             ]                 │
│  [Sync Now]                                                │
└────────────────────────────────────────────────────────────┘
```

### 9B. GitHub PR Target

```
┌─ GitHub PR ───────────────────────────────────────────────┐
│  Owner/Repo  [org/icon-library          ]                 │
│  Branch      [update-icons              ] (optional)      │
│  [Create PR]  [Dry Run]                                    │
└────────────────────────────────────────────────────────────┘
```

### 9C. npm Registry Target

```
┌─ npm Registry ────────────────────────────────────────────┐
│  Package    [@scope/icons               ]                 │
│  Version    1.2.3                                          │
│  Bump       [patch ▾]                                      │
│  Auto-pub   [on/off]  Countdown: 30s                       │
│                                                            │
│  Token      [••••••••] (stored in keychain)                │
│                                                            │
│  History                                                   │
│  1.2.3  ·  2h ago  ·  24 icons                             │
│  1.2.2  ·  3d ago  ·  22 icons                             │
│                                                            │
│  [Publish]  [Dry Run]                                      │
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
┌─ Delete State ────────────────────────────────────────────┐
│                                                            │
│  Delete state "hover"? This will also remove 2             │
│  transitions that reference this state.                    │
│                                                            │
│  [Cancel]                              [Delete]            │
└────────────────────────────────────────────────────────────┘
```

---

## User Flow Coverage Matrix

| Flow | Screen(s) | Entry Point |
|------|-----------|-------------|
| First launch (empty workspace) | 1A (empty) | App start |
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
| Add state | 2C | Left sidebar |
| Rename state | 2E / 2F | Inspect tab |
| Delete state | 2F → 10C | Inspect tab |
| Create transition | 2G → 5 | Animation tab |
| Edit transition bindings | 2G | Animation tab |
| Edit track properties | 2G | Animation tab |
| Preview transition | 2G | Animation tab |
| Edit easing curve | 6 | Transition/track form |
| Pick color | 7 | Fill/stroke editor |
| Export SVG | 4 | Export menu |
| Export Lottie | 4 | Export menu |
| Export React library | 4 | Export menu |
| Sync to local dir | 9A | Sync panel |
| Create GitHub PR | 9B | Sync panel |
| Publish to npm | 9C | Sync panel |
| View keyboard shortcuts | 8 | Help menu |
| Switch between icons (tabs) | 2A | Title tab bar |
| Undo / redo | 2A | Toolbar / ⌘Z |
| Zoom / pan canvas | 2D | Dock / scroll / keys |

---

## Types

### Screen Identifiers

```typescript
type ScreenId =
  | 'explorer-workspace'      // 1A
  | 'explorer-project'        // 1B
  | 'explorer-sync'           // 1C
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
  | 'sync-config'             // 9
  | 'confirm-dialog';         // 10
```

### Panel Visibility Rules

```typescript
type PanelVisibility = {
  leftSidebar: 'layers' | 'variants';
  rightSidebar: 'inspect' | 'animation';
  inspectContent:
    | 'document'         // no selection
    | 'layer'            // single layer selected
    | 'multi-layer';     // multiple layers selected
  canvasDock: boolean;   // always visible in editor
  bulkActionBar: boolean; // visible when multi-selected in explorer
  statusHud: boolean;    // visible in editor
};
```

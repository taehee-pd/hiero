# Hiero UI Icons — Inventory

Status: complete (Phase 0.5)

## Headline numbers

- **63 distinct Lucide icons** imported across `components/` and `app/`.
- **42 files** import from `lucide-react`.
- **0 files** import from `@radix-ui/react-icons`.
- **12 files** in `components/editor/` contain inline `<svg>` — all are
  canvas drawings (path editor, rulers, timeline, morph indicator), not
  icons. Excluded from migration scope.
- **1 primitive** (`components/ui/spinner.tsx`) wraps `Loader2Icon` — will
  be migrated as part of Phase 4 (animated spinner).

## Icon list (alphabetized)

```
AlertTriangle       CheckIcon           ChevronUpIcon       Copy
AlignCenter         CheckSquare         Circle              Download
AlignLeft           CheckCircle2        CircleIcon          Eye
AlignRight          ChevronDown         Bold                EyeOff
ArrowDownToLine     ChevronDownIcon     FileJson            FolderInput
ArrowRight          ChevronLeft         FolderOpen          GitBranch
Grid3X3             ChevronRight        GripVerticalIcon    Heart
Info                ChevronRightIcon    Italic              Link2
Loader2             Loader2Icon         Magnet              MoreHorizontal
MousePointerSquareDashed                Package             PanelLeftIcon
Pause               Pencil              Play                Plus
Redo2               RefreshCw           RotateCcw           Ruler
Save                Search              SearchIcon          Server
Settings            Shapes              SkipBack            SkipForward
Square              Trash2              TriangleAlert       Underline
Undo2               Upload              X                   XIcon
```

`*Icon`-suffixed names (`CheckIcon`, `ChevronDownIcon`, etc.) are the
Lucide v1 aliases — same icons as the short names. The importer should
deduplicate.

After deduplication: **~55 unique Lucide glyphs.** The registry key map
in Phase 3 codegen must cover both long and short names.

## Size usage (class frequency)

| Tailwind class | Pixel size | Uses | Notes |
|---|---|---|---|
| `size-4`  | 16 | 172 | Dominant — toolbar / menu baseline |
| `size-3.5` | 14 | 69 | Compact toolbars, tags |
| `size-3`  | 12 | 35 | Inline hints, dense UI |
| `size-8`  | 32 | 8  | Empty-state, avatars |
| `size-6`  | 24 | 8  | Section headers |
| `size-5`  | 20 | 7  | |
| `size-10` | 40 | 7  | |
| `size-7`  | 28 | 6  | |
| `size-2`  | 8  | 4  | Very small dots |
| `size-9`  | 36 | 3  | |
| `size-2.5` | 10 | 3  | |
| `size-1.5` | 6 | 3  | |
| `size-32` | 128 | 1  | Hero / placeholder |

**Decision revision (D1):** authoring at canonical sizes `16` and `24`
with `sizeFallback: 'scale'` in the runtime. 12px/14px icons scale down
from 16px; 20px/28px/32px scale up from 24px. Stroke-width fractional
error at 14/16 = ~0.125px, visually acceptable. Authoring at every
Tailwind size (5+ sizes × 63 icons = 315 units) is too much work for v1.
Revisit if specific icons look wrong at 12px or 14px — add a 12px
variant to those few icons, not all.

## Icon prop usage (what must the wrapper support)

Grepped from all call sites:

- `className="size-N*"` — size control. Wrapper should accept `size` prop
  mapping to explicit pixels. `className` pass-through also supported for
  edge cases (e.g., `text-muted-foreground`, `shrink-0`, `opacity-0
  transition-opacity group-hover:opacity-100`).
- `strokeWidth={...}` — **not used** on any Lucide callsite. All inline
  `stroke-width` references are canvas / snap-editor internal, unrelated.
- `fill="currentColor"` — **one use:** `<Magnet className="size-4"
  fill="currentColor" />` in the toolbar. Signals a filled glyph. The
  importer should preserve fill mode.
- `onClick`, `aria-label`, `role` — standard SVG props. Wrapper must
  forward to underlying SVG element.

**Wrapper API (final):**

```tsx
<Icon
  name: IconName
  size?: number               // defaults to 16; nearest authored variant chosen
  state?: IconState<name>     // when transitions are authored
  className?: string
  aria-label?: string
  onClick?: React.MouseEventHandler
/>
```

## RTL mirroring candidates

Per D10 (opt-in flag). These icons have directional meaning that flips
in RTL:

| Icon | Uses | Mirror decision |
|---|---|---|
| `ChevronLeft` | 4 | Mirror |
| `ChevronRight` | 5 | Mirror |
| `ArrowRight` | 1 | Mirror |
| `ArrowDownToLine` | 3 | **No** (vertical; not directional in RTL) |
| `Undo2` | 5 | **No** (curved arrows are conventional both directions) |
| `Redo2` | 3 | **No** (same as Undo2) |
| `SkipForward` | 1 | Mirror (forward = end of reading direction) |
| `SkipBack` | 1 | Mirror |
| `PanelLeftIcon` | 1 | Mirror (left panel = start panel in RTL) |
| `FolderInput` | 1 | Mirror (arrow-into-folder) |

Icons gaining `mirrorInRTL: true` in metadata: `ChevronLeft`,
`ChevronRight`, `ArrowRight`, `SkipForward`, `SkipBack`,
`PanelLeftIcon`, `FolderInput` — **7 icons.**

## Animated UI icon candidates (Phase 4)

Confirmed by call-site analysis:

- `Menu` ↔ `X` — mobile/collapsed nav toggle pattern.
- `ChevronDown` ↔ `ChevronUp` (or rotate) — disclosure widgets. Found in
  `components/ds/icon-button.tsx`, `components/studio/Navbar.tsx`,
  dropdown menus.
- `Copy` ↔ `Check` — clipboard feedback (no current callsite shows
  state animation; candidate for new delightful pattern).
- `Play` ↔ `Pause` — playback controls.
- `Eye` ↔ `EyeOff` — visibility toggle (used in `LayerPanel`,
  password fields).
- `Loader2` — continuous rotation spinner (currently via CSS
  animation in `components/ui/spinner.tsx`; Hiero can own the motion).

## Inline SVG files (NOT migrated)

All 12 files in `components/editor/`, confirmed canvas drawings:

```
BezierCurveEditor.tsx    WeightCurveEditor.tsx
Canvas.tsx               Rulers.tsx
EasingPicker.tsx         ToolPanel.tsx
EditorShell.tsx          ImportIconDialog.tsx
LayerPanel.tsx           MorphReadinessIndicator.tsx
TimelineEditor.tsx
components/explorer/icon-grid-item.stories.tsx  (Storybook harness)
```

Leave as-is. These are domain UI (curve editors, rulers, timeline), not
icons.

## Open questions for Phase 4 authoring

- Should `Loader2` use Hiero's transition system or remain CSS-rotated
  for now? Recommendation: CSS for v1 (same outcome, zero new risk);
  Hiero-animated spinner in a follow-up.
- Which icons from the 55 need filled variants (beyond `Magnet`)?
  Answer unknown until authoring begins. Track as they come up.

---
status: in-progress
owner: taehee-pd
parent: specs/design-system-storybook.plan.md
created: 2026-04-15
branch: feat/design-system-phase-5
---

# Phase 5 — DS extractions

Plan §6 Phase 5 is the "components/ds extraction" phase. Per the plan's
instructions: **order by risk, not by call-site count.** Start with the
smallest behavioral surface; end with the hardest (`IconButton`, which
may be abandoned if the single-contract doesn't survive the first
migration batch).

## Sub-phases (order of operations)

### 5.1 — `StatusBadge` (smallest behavioral surface)

**Scope:** pill-shaped status indicator for save state, sync state,
publish state. Visual contract is trivial (badge with variant color +
text); behavioral contract is just the variant axis.

**Call sites found in audit:**
1. `components/studio/Navbar.tsx:365` — save status (Unsaved / Saved / Saved {ago})
2. `components/export/PublishPanel.tsx:250` — `ConnectionBadge` (connected / disconnected / idle)
3. `components/export/SyncTargetPanel.tsx:211–258` — target status badges (platform, delivery mode, auto-publish, dry-run, pending, server token)

**Extraction target:** `components/ds/status-badge.tsx`.

**API:**
```ts
type StatusBadgeVariant =
  | 'neutral'   // default muted pill
  | 'success'   // emerald (connected, saved, server token)
  | 'warning'   // amber (unsaved, disconnected, pending, dry-run)
  | 'danger'    // red (error, failed)
  | 'info';     // blue (auto-publish, primary accent)

export interface StatusBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'className'> {
  variant?: StatusBadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}
```

Built on top of `components/ui/badge.tsx` (shadcn primitive) — this is
NOT a new visual layer, it's a semantic wrapper that maps variants to
the existing `status-*-surface` CSS classes in `app/globals.css`.

**Migration parity:** the Navbar save status has a "Saved {ago}" child
and animated time updates. The StatusBadge API must accept any children
(current code passes dynamic strings). No surprises.

**Tests:** one story file + one `renderHook`-free unit render test
covering all 5 variants.

### 5.2 — `KbdHint` (smallest visual surface)

**Scope:** platform-aware keyboard shortcut hint rendered inside
tooltips and menu items. Current code uses free-form strings like
`"Cmd/Ctrl+Z"` and `"⌘S"` that drift across sites.

**Call sites found in audit:**
1. `components/editor/Toolbar.tsx:404–521` — `ToolbarButton` props `shortcut?: string` → rendered as `{label} ({shortcut})` in TooltipContent
2. `components/editor/Toolbar.tsx:596–603` — `ShortcutRow` helper in the keyboard shortcut dialog
3. `components/studio/Navbar.tsx:281` — `<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>` style shortcuts on the menu
4. `components/editor/Canvas.tsx:1042, 1072–1123` — various `<ContextMenuShortcut>⌘C</ContextMenuShortcut>` instances
5. `components/editor/EditorShell.tsx:1025, 1035, 1044` — same pattern for context menu rows

**Extraction target:** `components/ds/kbd-hint.tsx` — built on the
existing `components/ui/kbd.tsx` primitive (Kbd + KbdGroup).

**API:**
```ts
export interface KbdHintProps {
  /**
   * Platform-neutral shortcut spec, e.g. "mod+s", "mod+shift+z",
   * "mod+alt+up". Resolves to ⌘ on macOS and Ctrl elsewhere at
   * render time. Accepts "shift", "alt", "up", "down", "left",
   * "right", "enter", single letters and digits.
   */
  keys: string;
  className?: string;
}
```

`mod` is the canonical token — renders as `⌘` on Mac, `Ctrl` elsewhere.
This replaces the free-form `"Cmd/Ctrl+X"` pattern (which always reads
wrong on macOS) with a single source of truth.

**Migration scope:** narrow. Plan says the "real duplication is the
prop bundle". Migrate only the Toolbar `ShortcutRow` and `ToolbarButton`
shortcut renderings — those are the only sites where the hint's visual
style matters. Leave `DropdownMenuShortcut` / `ContextMenuShortcut` as
bare string children (the primitives already render them with the right
font-mono styles). Expanding later is cheap.

**Tests:** one story file with Mac vs non-Mac rendering.

### 5.3 — `ColorField` (consolidation)

**Scope:** pill-shaped trigger button showing a color swatch + hex
input + optional opacity input. Opens a `ColorPicker` popover on click.

**Current state:** `components/editor/ColorPickerPopover.tsx` already
implements the full contract and already consumes `components/ds/
color-picker`. The "consolidation" the plan describes is just a rename
+ move + rehome under `components/ds/`.

**Call sites found in audit:**
1. `components/editor/InspectorPanel.tsx:2549, 2624` — fill + stroke color
2. `components/editor/AnimationStudioPanel.tsx:405` — animation color edits

**Extraction target:** `components/ds/color-field.tsx` (literal move
of ColorPickerPopover under a new name). The file gains no new
behavior in Phase 5 — it just changes address and name.

**API:** identical to `ColorPickerPopoverProps` today:
```ts
export interface ColorFieldProps {
  value: string;                           // hex like '#1e293b'
  onChange: (hex: string) => void;
  opacity?: number;                        // 0..1
  onOpacityChange?: (opacity: number) => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
}
```

**Migration:** 3 import rewrites in InspectorPanel + AnimationStudioPanel.
The old `components/editor/ColorPickerPopover.tsx` re-exports the new
component under the old name for one release cycle to make the
migration trivially revertable. Remove the shim in Phase 6.

**Tests:** one story file + the existing `color-picker` story coverage
already covers the inner ColorPicker — this adds the popover wrapper
as a separate story.

### 5.4 — `IconButton` (last, hardest — the plan warns this may abandon)

**Scope:** the §4b Props contract from the plan. icon + aria-label +
tooltip + loading + disabled + optional kbd. Size `sm|md|lg` mapping
to 24/28/32px frames with 12/14/16px icons per DESIGN.md §9. Radius
`toolbar|panel|pill` mapping to 8px/14px/9999px per DESIGN.md §4.

**Call sites found in audit:**
- **10 `h-7 w-7 rounded-lg` icon buttons** — exact DESIGN.md §9 spec
  (28px frame, 14px icons). These are the high-confidence migration
  targets the plan calls for.
- 46 total icon buttons across the editor/studio/explorer/export tree
  — most of the 36 remaining are either sized differently (h-8, h-5,
  size-5 for inner controls) or already use `size="icon"` with a
  different chrome.

**Sites to migrate (phase 5.4 batch):**
The grep found 10 sites using `h-7 w-7 rounded-lg`. These live in:
1–N. TBD — enumerated when the migration starts. Each migration
replaces:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Save" onClick={...}>
      <Save className="size-3.5" />
    </Button>
  </TooltipTrigger>
  <TooltipContent side="bottom">Save (Cmd/Ctrl+S)</TooltipContent>
</Tooltip>
```
with:
```tsx
<IconButton
  icon={<Save />}
  aria-label="Save"
  tooltip="Save"
  kbd="mod+s"
  onClick={...}
/>
```

**Abandon criteria (from plan):** if the single contract cannot absorb
the first 10 sites cleanly, Phase 5.4 is abandoned and `Button + icon`
stays the baseline. The plan explicitly allows this outcome.

**Tests:** story file covering every variant + size + radius combo,
plus interaction tests for (a) click fires handler, (b) loading
replaces icon with spinner, (c) disabled blocks click, (d) tooltip
renders, (e) negative test asserting caller cannot set icon size via
`size={20}` inline.

### 5.5 — `EditorSidebarTabs` → bare `ToggleGroup`

**Scope:** retire the component + its `wire-tab-*` CSS classes. Plan
§4 is explicit: "Migration target, not new DS component — just move
EditorSidebarTabs to ToggleGroup and retire the CSS."

**Files touched:**
1. `components/editor/EditorShell.tsx:1329` — only call site
2. `components/editor/EditorSidebarTabs.tsx` — deleted
3. `app/globals.css:1408–1438` — `wire-tab-row`, `wire-tabs`,
   `wire-tab-button`, `wire-tab-button[data-active='true']` rules
   deleted (4 rules)

**Migration shape:**
```tsx
<ToggleGroup
  type="single"
  value={rightTab}
  onValueChange={(v) => v && onRightTabChange(v)}
  aria-label="Right sidebar"
>
  <ToggleGroupItem value="inspect">Inspect</ToggleGroupItem>
  <ToggleGroupItem value="animation">Animation</ToggleGroupItem>
</ToggleGroup>
```

ToggleGroup's default styling already closely matches the existing
wire-tab look (border, active state, hover). Visual drift is minor;
if it bites, wrap in a small layout div.

**Tests:** existing EditorShell smoke coverage + one `ToggleGroup`
primitive story already exists.

### 5.6 — `NumericField` (explicitly out of scope)

Plan says `NumericField` stays editor-local in
`components/editor/ui/NumericField.tsx` — not a DS extraction target.
No action in Phase 5.

## Gate (after each sub-phase + final)

1. `pnpm exec tsc --noEmit --incremental false` — 0 errors
2. `pnpm lint` — 0 errors, no new warnings
3. `pnpm build` — passes
4. `pnpm run test:core` — no regressions
5. `pnpm run test:dom` — new stories pass play functions
6. `pnpm storybook:build` + `pnpm storybook:test --run`
7. `bun install --frozen-lockfile` (no dep churn expected)

## Plan deviation watchlist

- **IconButton abandon** — if the contract fails on the first 10 sites,
  abandon 5.4 and document why. Leave the characterization comments so
  future attempts have context.
- **ColorField shim** — keep the `ColorPickerPopover.tsx` re-export
  until Phase 6 so the migration can be reverted from one file.
- **KbdHint platform detection** — `navigator.platform` is deprecated.
  Use `navigator.userAgentData.platform` with a fallback to
  `navigator.platform` so SSR doesn't crash (hooks only run in client
  components).
- **StatusBadge** — the Navbar save status updates via a `setInterval`
  in the parent (`savedAgoLabel` state). The DS StatusBadge must not
  leak that timer into its own lifecycle — it receives the label as a
  child and re-renders when the parent changes.

## Out of scope for Phase 5 (explicit)

- Phase 6: feature-leaf stories + container smoke stories
- Phase 7: semantic size tokens in `app/globals.css`
- Phase 8: CI gating
- Additional icon button migrations beyond the first 10 h-7 w-7 batch
- Removal of the `ColorPickerPopover` shim (Phase 6 cleanup)

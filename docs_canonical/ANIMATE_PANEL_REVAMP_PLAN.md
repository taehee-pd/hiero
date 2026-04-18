# Animate Panel Revamp + npm Deploy Plan

**Created:** 2026-04-13
**Branch:** `claude/improve-animate-morphing-CmPkM`
**Owner:** taehee-pd
**Scope:** (1) Eliminate morphing-strategy confusion and warnings from the Animate panel; (2) Reorganize the panel around the SF Symbols 7 layout patterns from [WWDC 2025 session 337](https://developer.apple.com/videos/play/wwdc2025/337/); (3) Prepare `@cuneiform/cli` for its first npm publish.

---

## 1. Problem Statement

### 1.1 Morphing strategy UX is confusing

The Animate panel currently exposes **6 equal-weight morph strategies** in a dropdown
(`components/editor/TransitionPanel.tsx:66-73`):

```
auto · strictMorph · bestGuessMorph · crossIconMorph · lineAnimation · replace
```

Users have to understand the difference between *intrinsic strict*, *fuzzy topology
matching*, *arc-length uniform sampling*, and *trim keyframes* just to preview a
transition. The hint text
(`components/editor/TransitionPanel.tsx:57-64`) uses engineering vocabulary
("identical path topology", "arc-length uniform sampling") that is meaningless to an
icon designer.

On top of that, every time the user picks a strategy a **topology warning** may fire
from `MorphReadinessIndicator` (`components/editor/MorphReadinessIndicator.tsx:198-227`)
— "subpath-count-mismatch", "closed-open-mismatch", "fill-mode-change",
"stroke-to-fill-change", "path-type-mismatch"
(`lib/runtime-core/topology-detection.ts:24-28`). The readiness card then offers three
escape hatches ("Auto-fix bindings", "Switch to crossfade", "Try best-guess morph
instead") (`components/editor/MorphReadinessIndicator.tsx:114-167`) — decisions the
user should never have to make.

### 1.2 The best strategy is already computable

`lib/runtime-core/auto-morph.ts:42-104` already implements a 5-level cascade:

1. **identity** — paths identical
2. **intrinsicStrict** — identical command signatures (Sederberg 1993)
3. **bestGuess** — same topology, different segments
4. **pointSampled** — arc-length sampling across unrelated topologies
5. **fallback** — incompatible, use crossfade

This is the correct behavior. The 6-way strategy dropdown is vestigial — a leftover
from when each algorithm was a separate feature. **We do not need users to pick.**

### 1.3 The panel layout doesn't match designer mental models

SF Symbols 7 organizes animation authoring as **Preset → Playback Mode → Preview**
(WWDC 2025 session 337). Our `TransitionPanel` organizes it as **Endpoints → Strategy
→ Timing → Compatibility → Bindings → Preview** — a flow centered on the engine
rather than the output.

---

## 2. Revamp Design

### 2.1 Information architecture — mirror SF Symbols 7

Reorganize `components/editor/TransitionPanel.tsx` (and merge its sibling
`components/editor/AnimationStudioPanel.tsx`) into a **single unified Animate panel**
with this hierarchy:

```
Animate Panel
├── 1. Animation                       (what kind of animation)
│     ├── Transition (icon → icon)     ← current TransitionPanel behavior
│     ├── Draw On / Draw Off           ← current drawReveal / drawErase presets
│     ├── Magic Replace                ← directional crossfade
│     ├── Appear / Disappear           ← future
│     ├── Bounce · Pulse · Wiggle      ← current effect presets
│     └── Variable Color               ← current effect preset
│
├── 2. Playback Mode                   (how it plays)
│     ├── By Layer       (staggered, default)
│     ├── Whole Symbol   (all at once)
│     └── Individually   (one layer at a time, sequential)
│
├── 3. Timing                          (duration · easing · direction · reverse)
│
├── 4. Preview                         (play · pause · scrub · speed · replay)
│
└── 5. Advanced ▸ (collapsed by default)
      └── Manual strategy override for power users / debugging
```

This directly mirrors the WWDC 337 cascade (Preset → Playback Mode → Preview)
and removes the cognitive load of choosing a morph algorithm.

### 2.2 Strategy selection → fully automatic

**Delete from the primary UI:**

- `STRATEGY_LABELS` / `STRATEGY_HINTS` / `STRATEGY_OPTIONS` dropdown
  (`components/editor/TransitionPanel.tsx:47-73`)
- `formStrategy` state and the `Select` it drives
- `compatibility` badge (`components/editor/TransitionPanel.tsx:182-186, 1070+`)
- `MorphReadinessIndicator` visible-by-default mount
- All topology warning surfaces from
  `components/editor/MorphReadinessIndicator.tsx:198-227`

**Replace with:**

- Always call `autoMorph()` per binding (`lib/runtime-core/auto-morph.ts:42`). The
  resolver already selects `identity → intrinsicStrict → bestGuess → pointSampled →
  fallback` internally. This is the **single source of truth** for transition behavior.
- When `autoMorph()` returns `null` (truly incompatible), silently fall back to
  directional crossfade — no warning, no decision.
- Under the hood, keep the 6 strategy values in the schema
  (`lib/schema/types.ts:271`) unchanged so existing projects load, and keep the
  resolver capable of honoring an explicit override when present. But **`'auto'` is
  the only value the UI writes**, and `'auto'` is the default for any new transition.

### 2.3 The "Advanced" escape hatch

Some users (and Claude sessions debugging transitions) will still want to force a
specific algorithm. Expose it in an `Advanced ▸` disclosure that is:

- **Collapsed by default**
- **Never shown on first-run** — we only unfurl it if the user explicitly opens it
- Contains the current strategy `Select` + a read-only pill showing *"Engine chose:
  intrinsicStrict"* so power users can see what `autoMorph` picked

No warnings, no readiness scores, no color-coded badges in this area either. If
someone forces `strictMorph` on incompatible paths, we still fall back silently and
surface the actual chosen strategy in the "Engine chose" pill.

### 2.4 Replace readiness warnings with passive telemetry

The information currently exposed as user-facing warnings
(`MorphReadinessIndicator.tsx:114-167`) is still valuable — but for **us**, not the
user.

- Keep `computeReadiness()` and `analyzeTopologyCompatibility()` in
  `lib/runtime-core/` — they remain the backbone of `autoMorph()`.
- Stop rendering `MorphReadinessIndicator` in `TransitionPanel`.
- Add a single dev-only badge behind `process.env.NEXT_PUBLIC_CUNEIFORM_DEBUG === '1'`
  that shows the chosen strategy + readiness score in the bottom-right of the
  preview, so we can still diagnose regressions locally.
- Emit the topology-mismatch signals through the existing sync-ui analytics hook
  (`lib/sync-ui/`) so we can measure how often `autoMorph` falls through to
  `pointSampled` / `fallback` in the field — useful for prioritizing future work
  without bothering users.

### 2.5 Playback Mode (`byLayer` / `wholeSymbol` / `individually`)

SF Symbols' three playback modes map cleanly to the existing
`TransitionStagger['mode']` (`components/editor/TransitionPanel.tsx:37`), which
already supports `'linear' | 'from-center' | 'from-edges' | 'random' |
'individually'`. The revamp collapses these to three pills matching Apple's model:

| WWDC mode       | Cuneiform stagger mode        | Default duration offset |
|-----------------|-----------------------------|-------------------------|
| By Layer        | `linear` (staggered)        | 40ms between layers     |
| Whole Symbol    | (new) `simultaneous`        | 0                       |
| Individually    | `individually` (sequential) | full duration per layer |

Add `'simultaneous'` to the stagger union in `lib/schema/types.ts` and resolve it in
`lib/runtime-core/transition-resolver.ts`. Keep `from-center` / `from-edges` /
`random` available only in the Advanced disclosure.

### 2.6 Component & file changes

| File                                               | Change                                                                        |
|----------------------------------------------------|-------------------------------------------------------------------------------|
| `components/editor/TransitionPanel.tsx`            | Strip strategy dropdown, compatibility badge, readiness indicator. Restructure body into Animation / Playback Mode / Timing / Preview / Advanced sections. |
| `components/editor/AnimationStudioPanel.tsx`       | Merge preset grid into the new unified panel's "Animation" section.           |
| `components/editor/MorphReadinessIndicator.tsx`    | Delete or reduce to a dev-only floating pill.                                 |
| `components/editor/AnimatePanel.tsx` **(new)**     | Top-level container that hosts Animation / Playback / Timing / Preview / Advanced. |
| `lib/schema/types.ts`                              | Add `'simultaneous'` to `TransitionStagger['mode']`. Default new transitions to `strategy: 'auto'`. |
| `lib/runtime-core/transition-resolver.ts`          | Honor `'simultaneous'` stagger mode.                                          |
| `lib/runtime-core/auto-morph.ts`                   | **No changes.** Already the right abstraction.                                |
| `specs/editor/animation-tab.md`                    | Rewrite to describe the new three-tier hierarchy.                             |
| `specs/editor/cross-icon-transitions.md`           | Remove user-facing CompatibilityStatus tones section; keep the runtime model. |
| `tests/transition-panel.test.tsx` **(new)**        | Regression: verify the panel never renders "Strategy" label, never shows any `[role="alert"]`, and always sets `strategy: 'auto'` on save. |

### 2.7 Acceptance criteria

1. **No warnings ever appear in the Animate panel.** Grep for
   `role="alert"`, `"warning"`, `"incompatible"`, `"topology"`, `"mismatch"` inside
   `components/editor/` after the change — zero user-facing matches.
2. Opening the Animate panel on any icon pair produces a working preview in one
   click, with no decisions required.
3. The panel's top-level hierarchy is **Animation → Playback Mode → Timing →
   Preview**, matching WWDC 337.
4. `bun test` passes, including a new `transition-panel.test.tsx` that asserts the
   strategy dropdown is gone.
5. Saving a transition writes `strategy: 'auto'` to the schema; the resolver routes
   through `autoMorph()`.
6. `pnpm build`, `bun run lint`, `bun run format:check`, and `npx tsc --noEmit` all
   pass.

---

## 3. npm Deploy Preparation (`@cuneiform/cli`)

`packages/cuneiform-cli/package.json` ships a `@cuneiform/cli` stub at `0.1.0` but has
never been published. The existing `icons-package-release.yml` workflow publishes
*generated icon packages* (`npm publish ./dist/icons-package --access public`,
`.github/workflows/icons-package-release.yml:103`) — not the CLI itself.

### 3.1 Pre-publish checklist

- [ ] **Rename check.** The package is named `@cuneiform/cli` but lives under
  `packages/cuneiform-cli/`. Decide on final scope (`@cuneiform/cli` or `@cuneiform/cli`)
  before first publish — the name is immutable for the first 72h on npm.
- [ ] **Reserve the scope.** Verify the `@cuneiform` org exists on npmjs.com (or
  create it) and that `taehee-pd` has publish rights.
- [ ] **Fill in `package.json` metadata** required for a clean npm listing:
  - `author`, `repository.url`, `bugs.url`, `homepage`
  - `README.md` referenced in `files`
  - `publishConfig.access: "public"` (since it's a scoped package)
- [ ] **Pin Node engine.** `engines.node: ">=18"` is fine; drop the `bun` engine
  claim — Bun is a dev dependency, not a runtime requirement.
- [ ] **Smoke-test the built binary.**
  ```bash
  cd packages/cuneiform-cli
  bun run build
  node dist/bin.js --help
  npm pack --dry-run     # verify only dist/ ships
  ```
- [ ] **`npm pack` audit.** Confirm only `dist/` + `package.json` + `README.md` are
  in the tarball — no source, no tests, no node_modules.
- [ ] **Verify no secrets.** `npm publish --dry-run` to confirm no `.env`,
  `.npmrc`, or token files are bundled.

### 3.2 New release workflow

Add `.github/workflows/cli-release.yml`, mirroring the existing
`icons-package-release.yml` pattern:

```yaml
on:
  push:
    tags: ['cli-v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write        # for npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: cd packages/cuneiform-cli && bun install --frozen-lockfile
      - run: cd packages/cuneiform-cli && bun run build
      - run: cd packages/cuneiform-cli && npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Use **OIDC provenance** (`--provenance`) so the published tarball links back to the
exact commit — no more "trust us, this is the right code" story.

### 3.3 Versioning & cadence

- Use standalone `cli-vX.Y.Z` tags so CLI releases are decoupled from the web app.
- First publish: bump to `0.2.0` (not `1.0.0`) to signal that the CLI surface is
  still evolving.
- Document in `packages/cuneiform-cli/README.md`:
  - `npm install -g @cuneiform/cli`
  - Minimum Node version
  - Known limitations (what the CLI does *not* yet do)

### 3.4 Release gating

Before the first `cli-v0.2.0` tag is pushed:

1. All Animate panel revamp tests pass on `main`.
2. `bun install --frozen-lockfile` passes from a clean checkout.
3. A maintainer has run `npm publish --dry-run` locally and eyeballed the tarball
   contents.
4. The `@cuneiform` npm org has at least two owners to avoid bus-factor-of-one.

---

## 4. Execution Order

The two tracks are independent but should land in this order to keep the
changelog coherent:

1. **Animate panel revamp** (this plan §2)
   - Branch: `claude/improve-animate-morphing-CmPkM` (current)
   - Lands the UX fix + removes user-facing warnings
2. **npm deploy prep** (this plan §3)
   - Separate PR off `main` after §2 lands
   - First publish: tag `cli-v0.2.0`

---

## 5. Out of Scope

- Changing the runtime morph algorithms themselves. `autoMorph()` is already
  correct; this plan only changes how it is surfaced.
- Redesigning the Effects library (`lib/animation/presets.ts`) — presets keep their
  current names; they are simply re-grouped in the UI.
- Publishing the web app itself to npm or any registry. Cuneiform remains a
  Next.js-hosted product per
  `docs_canonical/NEXT_PHASES.md:3-5`.
- Figma plugin publishing — tracked separately under `figma-plugin/`.

---

## 6. Resolved Questions

1. **Final scope name** — ship as **`@cuneiform/cli`**. The product is Cuneiform, so the
   manifest name wins. The package directory stays `packages/cuneiform-cli/` for now
   (renaming the directory is a separate, non-blocking cleanup tracked out of band).
2. **Merge TransitionPanel + AnimationStudioPanel, or keep two tabs?** — **Merge
   them.** WWDC 337 endorses a single unified Animate surface. `AnimationStudioPanel`
   collapses into the new `AnimatePanel`'s "Animation" section per §2.6.
3. **Dev-debug overlay opt-in** — **Retain the current
   `NEXT_PUBLIC_CUNEIFORM_DEBUG` env-var gate.** A rebuild to toggle is acceptable
   for a diagnostics-only surface, and the env var keeps the overlay out of the
   production bundle entirely.

---

## 7. Design Audit — Full-Workspace Findings

This section records the end-to-end walkthrough audit of the Studio workspace and
the fixes that land alongside the Animate panel revamp. Items are grouped by the
same regions the audit walked (Far-Left Strip → Left Sidebar → Middle Panel →
Canvas → Right Panel). Severity is preserved from the audit.

### 7.0 Global — Remove all-caps styling from the entire app

**Severity:** High. **Scope:** app-wide, not panel-local.

The audit repeatedly flagged all-caps eyebrow/label styling as a hierarchy
problem: section headers, field labels, and group labels all use the same
`font-semibold uppercase tracking-tight text-muted-foreground` recipe, which
collapses three different hierarchy levels into one visual style and also
shouts at the user. The fix is blanket: **delete all-caps styling from the app
entirely.**

Actions:

- Remove `text-transform: uppercase` from every rule in `app/globals.css` —
  specifically the `.studio-kicker`, `.studio-chip`, `.workspace-kicker`,
  `.editor-eyebrow`, `.editor-field-label`, `.wire-section-header`, and
  `.wire-label` classes. (`app/globals.css:665, 682, 718, 964, 974, 1458, 1786`)
- Strip every `uppercase` Tailwind utility from `components/editor/**`,
  `components/explorer/**`, and `components/export/**`. Replace with plain
  sentence-case labels — the existing `font-medium tracking-tight
  text-muted-foreground` recipe is enough hierarchy without shouting.
- Rewrite literal `ALL-CAPS` strings in the UI to sentence case: "CUNEIFORM" →
  "Cuneiform", "SIZES" → "Sizes", "STATES" → "States", "SAVED EFFECTS" → "Saved
  effects", "24PX" → "24 px", "LAYER" / "POSITION" / "DOCUMENT" / "SOURCE ICON"
  / "VARIANT" / "STRATEGY" / "EASING" → sentence-case equivalents. Keep unit
  suffixes lowercase (`px`, `deg`, `ms`).
- Add a repo-level lint guard: a Bun test that greps `components/` and
  `app/globals.css` for `text-transform:\s*uppercase` and
  `className="[^"]*\buppercase\b"` and fails if any match is found. This
  prevents regressions from PRs that copy-paste the old recipe.

Acceptance: `grep -rn "uppercase" components/ app/globals.css` returns zero
matches outside of (a) semantic uppercase in user data such as hex color inputs
and (b) code comments explaining why we removed it.

### 7.1 Far-Left Strip — Project Navigation

| Finding | Sev | Fix |
| --- | --- | --- |
| No tooltip / aria-label on the collapse/expand arrow | Med | Wrap the collapse button in `<Tooltip>` from `components/ui/tooltip.tsx` with dynamic copy (`"Open projects"` / `"Close projects"`) and set `aria-label` / `aria-expanded`. |

### 7.2 Left Sidebar — Icon Grid

| Finding | Sev | Fix |
| --- | --- | --- |
| Double-click on icon tiles has no defined behavior | High | Bind double-click to inline rename (Figma/Finder parity). Single-click continues to open the icon. |
| Checkmark shows in both selected and unselected states | Med | Fix the checkbox component so the unselected state renders no glyph. Reuse the shadcn `Checkbox` primitive. |
| Search bar has no clear (X) button; no zero-results empty state | Med | Add an X clear button inside the `Input` and render "No icons match {query}" when the filtered list is empty. |
| ZIP download button triggers a silent instant download | Crit | Route through a new export dialog (or at minimum a toast confirming the download started). Offer format/size options and style the ZIP button distinctly from non-destructive icon-only buttons. |
| Relationship between sidebar ZIP and the Cuneiform menu Export submenu is unexplained | Med | Consolidate all export actions under a single "Export" entry point. If both exist, label them unambiguously ("Quick ZIP" vs "Full Export Options"). |

### 7.3 Middle Panel — Layers & Variants

**Structural change:** merge the Layers and Variants tabs into a single pane
with a draggable divider — Variants at the top, Layers at the bottom. This
resolves three separate audit findings about hierarchy and tab redundancy.

**Layers tab**

| Finding | Sev | Fix |
| --- | --- | --- |
| Layer rows lack a shape-type glyph | Med | Prepend a small type icon (path / rect / group / etc.) to each layer row. |
| Layer order can't be dragged | High | Add drag-to-reorder with a blue insertion-line drop indicator. Keyboard: `⌘↑` / `⌘↓` move one step; `⌘⌥↑` / `⌘⌥↓` move to top/bottom. |
| "24PX" group label is static, not collapsible | Med | Resolved by the variants/layers merge above. |
| No right-click context menu on layers | High | Right-click menu: Rename, Duplicate, Delete, Move to Group. |
| Row height ~22 px is too tight | Med | Bump to 28 px with ≥2 px vertical padding. |

**Variants tab**

| Finding | Sev | Fix |
| --- | --- | --- |
| Sizes input pre-filled "32" is ambiguous | Med | Empty value with placeholder `"32"` and a visible label "New size (px)". |
| "24px" chip has no remove affordance | High | Right-click menu on size chips: Resize, Duplicate, Delete. |
| "default" state label appears twice | Med | Replace the redundant badge with a lock icon to signal the baseline is non-removable. List user states below with a remove button. |
| "SIZES"/"STATES" headers have no hierarchy from group labels | Med | Resolved by the variants/layers merge and by 7.0 (no more all-caps). |

### 7.4 Canvas

| Finding | Sev | Fix |
| --- | --- | --- |
| 2217% default zoom label is disorienting | High | Show the semantic label `Fill` instead of the raw percent for the default fit. |
| Right-click menu has only Zoom In / Out / Fit to View | High | Expand contextually: with selection → Copy, Paste, Duplicate, Delete, Send to Back/Front; empty → Select All, Paste. |
| No keyboard shortcuts shown in context menu | Med | Render shortcut hints on each item (e.g., `Zoom In  ⌘+`, `Fit to View  ⌘0`). |
| Floating toolbar has no tooltips | High | Add `<Tooltip>` to every toolbar button: name, function, shortcut. |
| Snap/Guides toggles have faint on/off indicators | High | Higher-contrast active state — filled background, not just tint. |
| Zoom has no +/− buttons | Low | Flank the zoom percent display with +/− buttons. |

### 7.5 Right Panel — Inspect & Animation

**Inspect tab**

| Finding | Sev | Fix |
| --- | --- | --- |
| Fill/Stroke dropdowns have unequal widths | Low | Both dropdowns 50%. |
| Hex + opacity inputs are visually indistinguishable | High | Prefix hex with `#`, suffix opacity with `%`, add a thin vertical divider. |
| "Guides: On" is plain text | Med | Replace with a visible toggle switch; move primary control into the canvas toolbar. |
| No separator between LAYER and POSITION sections | Med | Insert a 1 px horizontal rule; also resolved by 7.0 dropping all-caps headers. |
| "Role" field is free text | High | Dropdown with defined options (primary / secondary / decorative / none) + a `(?)` tooltip. |
| Fill/Stroke "Fixed"/"Current" terminology is opaque | High | Convert to a segmented control with clearer labels ("Static" / "Inherited"). |
| Stroke width has no unit; "Rot" is non-standard | Med | Add `px` suffix to stroke width. Rename "Rot" to "Rotation" with a `°` suffix. |
| Number spinners have `valuemin=valuemax=0` | Crit | Fix ARIA: X/Y `-9999..9999`, Rotation `0..360`, Stroke `0..100`. Verify keyboard arrow increment works. |
| "Size" input narrower than "Name"/"Rendering" | Low | Full panel width for single-column fields. |
| "Delete size" has no destructive styling or confirmation | Crit | Apply danger styling; show a confirm dialog before executing. |
| "Rendering" dropdown lacks a tooltip | Med | `(?)` tooltip explaining Monochrome vs Multicolor at export. Convert to a segmented control. |
| "Master" field "None" has no affordance | Low | Either make editable (dropdown) or mute + add tooltip; delete outright if unused. |

**Animation tab** — Merged into the Animate panel revamp from §2. Specific audit
items folded in:

| Finding | Sev | Fix |
| --- | --- | --- |
| Inconsistent header hierarchy for "SAVED EFFECTS" | Med | Promote to a peer section in the new AnimatePanel or fold under "Effects". |
| Playback controls read as links, not buttons | Med | Add glyphs (play/pause/loop/save) and wrap in visible button borders. |
| Speed selector row merges visually with playback row | Med | 12–16 px gap, or group them explicitly in a single labeled row. |
| Preset grid has no categorical grouping | Med | Group presets under Attention / Visibility / Draw sub-headers. |
| "Draw Slide" orphan in last row | Low | Left-justify; naturally resolved by grouping. |
| No hover preview of presets | High | Animated thumbnail on hover. |
| "Draw Reveal"/"Draw Erase" visually muted | Med | Restore full contrast (they are active). |
| Transition Preview field labels use the same style as section headers | High | Resolved by 7.0 (no more all-caps); field labels become sentence-case 10 px. |
| "VARIANT" label used twice in Transition Preview | High | Relabel "Source variant" / "Target variant" with a directional `→` between them. Use a structured two-column layout. |
| "Easing: ease-in-out" is plain text | Med | Dropdown with an arrow indicator (editable) or muted + tooltip (read-only). |
| "SAVED EFFECTS" empty state wastes vertical space | Low | Auto-hide or collapse to a single muted line. |

### 7.6 Execution notes

- **All-caps removal (§7.0) lands first as an independent commit** on
  `claude/remove-caps-styling-cqhVp`. It is purely visual and has no runtime
  risk, so shipping it before the larger Animate panel revamp avoids entangling
  blast radii.
- **Regression guard:** the new Bun test that fails on any `uppercase` utility
  or `text-transform: uppercase` is added in the same commit as the removal, so
  the lint wall is up before the next PR lands.
- Remaining §7.1–§7.5 items are carved into follow-up branches (one per region)
  and are not gated on the all-caps cleanup.

---

## 8. References

- Full-workspace design audit (2026-04-13 walkthrough) — inlined as §7
- WWDC 2025 session 337 — *What's new in SF Symbols 7*
  (https://developer.apple.com/videos/play/wwdc2025/337/)
- `lib/runtime-core/auto-morph.ts:42-104` — existing automatic cascade
- `components/editor/TransitionPanel.tsx:47-73` — strategy dropdown to remove
- `components/editor/MorphReadinessIndicator.tsx:198-227` — warning surface to remove
- `lib/runtime-core/topology-detection.ts:24-28` — warning message sources
- `specs/editor/animation-tab.md` — current spec (to be rewritten)
- `specs/editor/cross-icon-transitions.md` — current spec (to be trimmed)
- `packages/cuneiform-cli/package.json` — CLI manifest to finalize
- `.github/workflows/icons-package-release.yml:81-103` — existing npm publish
  pattern to mirror

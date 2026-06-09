---
target: studio editor
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-06-07T12-31-36Z
slug: components-editor-editorshell-tsx
---
# Critique: Hiero Studio Editor

Target: studio editor (`components/editor/EditorShell.tsx` + Navbar/NavPane/ListPane + Canvas/Toolbar/Inspector/TimelineEditor/TransitionPanel). Reviewed live at localhost:3000 (1440×900, dark theme) with the sample "Hiero Starter" project, plus source read.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Save-state badge + relative time, zoom %, import/error overlays, selection count. Publish has no visible in-flight surface. |
| 2 | Match System / Real World | 3 | Strong icon-domain vocab; "By Layer / Whole Symbol / Individually" leans on inherited SF-Symbols jargon. |
| 3 | User Control & Freedom | 3 | Undo/redo everywhere, delete is undoable; Esc/rename-cancel inconsistent across the two layer-list implementations. |
| 4 | Consistency & Standards | 2 | Core weakness: two top chromes (Toolbar vs Navbar), dead off-brand serif/teal theme, dead LayerPanel, raw sky/slate colors outside the token ramp. |
| 5 | Error Prevention | 3 | New-project guards unsaved changes; delete dialogs explain consequences; destructive ⌫ has no friction (acceptable, undoable). |
| 6 | Recognition Rather Than Recall | 4 | Tooltips-with-shortcuts on nearly every control, KbdHint, inline empty-state hints, command palette. |
| 7 | Flexibility & Efficiency | 4 | Cmd+K palette, full shortcut coverage, split-button tools, marquee multi-select, context menus. |
| 8 | Aesthetic & Minimalist | 3 | Restrained and token-driven; toolbar carries always-on export buttons + a disabled "Soon" tool competing for primacy. |
| 9 | Error Recovery | 3 | aria-live error toasts replace alerts; auto-dismiss at 3s with no recall; copy is generic ("Failed to parse JSON file."). |
| 10 | Help & Documentation | 3 | Keyboard cheat-sheet, empty-state CTAs, some inline captions in Animate; no first-run/contextual help for Morph/Trim concepts. |
| **Total** | | **32/40** | **Good** (high end; held out of Excellent by consistency/dead-code debt, all fixable without redesign) |

## Anti-Patterns Verdict

**LLM assessment:** Not sloppy. Token architecture, dark theme, reserved lilac accent, and 50ms motion discipline read as deliberate, not generated. The tells are *internal divergence*, not surface decoration: two top chromes implement the same actions in two visual vocabularies; a complete serif (Iowan Old Style) + teal (#068ea0) `editor-lab` theme sits dead in globals.css (932-1319) — both a serif display font and an off-brand accent are explicit design DON'Ts; `LayerPanel.tsx` is dead (used only by its story); the canvas drop-zone uses raw `sky-400/500/100` that exists nowhere in the token system.

**Deterministic scan:** detect.mjs over components/editor + components/studio returned 2 `bounce-easing` warnings (BezierCurveEditor.tsx:20, EasingPicker.tsx:41). Both are FALSE POSITIVES — those cubic-beziers are user-selectable easing PRESETS for authored icon animations, not UI chrome motion. No other anti-patterns detected. Runtime console is clean (no warns/errors).

**Browser-measured evidence (WCAG):** "Autosaved locally" status text = **4.18:1 (FAILS AA**, needs 4.5). Inspector sub-labels (Document/Rendering/Master/Visible) = 4.66:1 at 10px/450 — passing but thin. Drop-zone `text-sky-100` on `bg-sky-500/10` is low-contrast (code-confirmed; only appears on drag). Primary labels, tabs, values all 16-21:1 (excellent). Ruler text uses raw slate `rgba(148,163,184,.92)` at 9px (canvas chrome, non-token).

## Overall Impression

A genuinely well-built, restrained editor that a Figma/Linear-fluent user would trust on sight. It is NOT held back by decoration or AI slop — it's held back by **accumulated internal divergence**: duplicate chrome, two dead off-brand vocabularies lying in wait, and a handful of raw colors that escaped the token system. The single biggest opportunity is consolidation: one chrome, one layer list, delete the dead theme, and the score jumps toward Excellent with no visual redesign.

## What's Working

1. **Token architecture + accent discipline** (globals.css 73-104, 815-825). Lilac is truly reserved for selection/focus/active (active rows use `primary 22%` + inset ring). No one-sided accent borders, no gradients, real sub-0.1-opacity multi-layer shadows. This is the backbone of the "earned familiarity" goal and it holds.
2. **Status-visibility loop** (Toolbar 106-134, Navbar 256-272). `deriveSaveState` + live relative-time + semantic StatusBadge is the always-on reassurance Linear/Figma users expect, and the peak-end note ("Autosaved 12s ago") means users always leave knowing work is safe.
3. **Recognition-over-recall coverage.** Tooltips-with-shortcuts on essentially every control, inline shortcut hints in empty states, command palette. A keyboard-fluent user operates this without memorizing anything.

## Priority Issues

**[P1] Consistency debt: duplicate chrome + dead off-brand assets + raw colors.**
- Why it matters: `Toolbar.tsx` (840 lines, standalone editor route) and `Navbar.tsx` (877 lines, embedded studio) both render project name + save badge + save/undo/redo + export + shortcuts dialog + new-project guard, with ~400 lines of duplicated handlers and *different* button styling and two separately-authored, differently-formatted shortcut dialogs. Every future change must be made twice and will drift. Meanwhile the dead `editor-lab` serif/teal theme and dead `LayerPanel.tsx` are landmines that violate the design language the moment anyone wires them, and `sky-*` colors (Canvas 1049, 1193) have already escaped the ramp.
- Fix: Pick one chrome (the Navbar's DS-component approach is canonical — port zoom/fit in and retire Toolbar, or make the embedded path render a trimmed Navbar). Delete `editor-lab` (globals.css 932-1319) and dead `LayerPanel.tsx`. Replace `sky-*` with `--primary` or an existing highlight token.
- Command: **distill** (chrome) + **audit** (dead code / token escapes)

**[P1] Accessibility gaps vs the stated WCAG-AA commitment.**
- Why it matters: PRODUCT.md targets AA. The shipped inline layer list puts `tabIndex={0}` on *every* row (EditorShell ~1242), so a keyboard user tabs through every layer instead of arrow-navigating one composite listbox — the dead `LayerPanel` actually does this correctly (`role="listbox"` + `tabIndex={-1}` + arrow handler), so the worse pattern shipped. Separately, "Autosaved locally" fails AA at 4.18:1, the drop-zone text is low-contrast, and inspector sub-labels are marginal at 10px.
- Fix: Composite-widget keyboard model for the layer list (container `role="listbox"`, roving tabindex, arrow keys). Bump the save-status and inspector sub-label colors one step toward ink; recolor the drop-zone to the lilac/highlight token.
- Command: **audit**

**[P2] Publish ships a blank changes summary.**
- Why it matters: Publish is the highest-stakes action (Navbar, lilac CTA, Cmd+Shift+P) but Navbar:188 passes `{added:[], modified:[], removed:[]}` (acknowledged deferred). The user ships without seeing what changed — unreassuring at exactly the wrong moment.
- Fix: Compute the diff against the last snapshot (`diffWorkspaces`, per the code comment) before the dialog confirms.
- Command: **harden**

**[P2] Animate "advanced" exceeds the choice budget; deep concepts lack inline meaning.**
- Why it matters: The default Transition view is well-scaffolded (it has captions: "Hiero automatically picks the best morph", "Soft: ease in and out. Snappy: lands faster"), so this is milder than a first read suggests. But the advanced strategy override (`STRATEGY_OVERRIDE_OPTIONS`, TransitionPanel 138-145) exposes 6 forced-morph options at one decision point, and concepts like Morph tiers / Trim / "Engine chose" have no inline explanation — this is the steepest learning surface and the emotional valley.
- Fix: Keep the 3-tier Transition→Playback→Timing hierarchy; add a one-line "what this does" per primary control; keep strategy overrides collapsed under a clearly-labeled "Force strategy (advanced)".
- Command: **clarify**

**[P3] Toolbar real-estate and scattered export.**
- Why it matters: Always-on "SVG Package" / "React Library" buttons (Toolbar 570-583) plus a disabled "Soon" Guide tool occupy primary chrome most sessions don't use, pushing frequent actions into a wrapping flex row. Export is reachable from 4 surfaces (toolbar buttons + dropdown + Navbar submenu + palette) with non-identical subsets.
- Fix: Demote the two export buttons into the existing export menu; hide the disabled tool until shipped; converge export to one canonical surface + palette.
- Command: **layout**

## Persona Red Flags

**Sam (accessibility / keyboard-only):** The shipped layer list tabs through every row (no composite listbox + arrow nav); "Autosaved locally" fails AA (4.18:1); drop-zone text is low-contrast; error toasts auto-dismiss at 3s with no recall (a screen-reader user may miss the announcement). Wins: focus-visible rings use the accent at proper offset; canvas status/errors use correct aria-live.

**Alex (impatient power user):** Export scattered across 4 surfaces with non-identical subsets and no export shortcut; two always-on export buttons burn primary toolbar space. Wins: Cmd+K, full shortcut coverage, marquee select, split tool buttons.

**Riley (stress tester):** Autosave every 500ms makes refresh-mid-edit a non-issue (strength); empty states are thoroughly handled (LayerPanel, Canvas, NavPane all have real CTAs); long layer names truncate with ellipsis. The "renders row.layer.id" concern is largely theoretical — live data shows readable names ("roof"/"house").

## Minor Observations

- ToolPanel snap button shows the same `magnet` icon for on/off (371-375); only the tint + label differ. A magnet/magnet-off swap reads faster.
- Two verbatim copies of the relative-time `savedAgoLabel` in Toolbar and Navbar — extract to a hook.
- Navbar logo cache-busts `/hiero.svg?v=5` with a query string in source — a code smell.
- Error-toast copy is generic ("Failed to parse JSON file.") — name the file and the parse position.

## Questions to Consider

1. `editor-lab` is a fully-built serif/teal theme nobody uses — abandoned exploration? Dead alternate themes are how design systems rot; what's stopping its deletion?
2. Why does the editor own a `Toolbar` at all when `Navbar` already owns save/undo/export/publish? Should the embedded case render a trimmed Navbar instead of a second chrome?
3. "Whole Symbol / By Layer / Individually" mirrors SF Symbols 7 — is that *your* users' vocabulary, or inherited?
4. Publishing without a diff silently optimizes for "one less step" over "don't ship the wrong thing." Is that the trade you meant to make?

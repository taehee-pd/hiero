# Animation Tab

**Status:** Implemented — revamped per `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` §2
**Files:** `components/editor/AnimationStudioPanel.tsx`, `components/editor/TransitionPanel.tsx`, `components/editor/TimelineEditor.tsx`

## Overview

The Animation tab is the workspace surface for previewing Cuneiform's runtime
animation model. It mirrors the SF Symbols 7 information architecture
(WWDC 2025 session 337) so designers think in terms of *what plays* and *how
it plays*, not in terms of which morphing algorithm to choose.

## Three-tier hierarchy

The panel reads top to bottom as **Animation → Playback Mode → Timing →
Preview → Advanced**:

```text
Animation Tab
  1. Animation              (what kind of animation)
       Transition           (icon → icon, currently the dominant flow)
       Effects              (Bounce / Pulse / Wiggle / Variable Color / Draw…)
  2. Playback Mode          (how it plays)
       By Layer             (staggered, default — 40 ms between layers)
       Whole Symbol         (every layer at t=0)
       Individually         (one layer at a time, full duration each)
  3. Timing                 (duration · easing · direction)
  4. Preview                (Play / Pause / scrub / speed / replay)
  5. Advanced ▸             (collapsed by default)
       Engine chose: …      (read-only pill with autoMorph()'s tier)
       Strategy override    (auto / strictMorph / bestGuessMorph / …)
       Stagger override     (from-center / from-edges / random)
```

The morph algorithm is **always `auto`**. `lib/runtime-core/auto-morph.ts`
internally cascades through `identity → intrinsicStrict → bestGuess →
pointSampled → fallback` and the panel never asks the user to pick. Forced
overrides exist for power users and Claude debugging sessions but live in the
collapsed Advanced disclosure and still fall back silently if the requested
algorithm can't run.

## Playback Mode mapping

| Mode label   | `TransitionStagger['mode']` | Default `perLayerMs` |
|--------------|-----------------------------|----------------------|
| By Layer     | `linear`                    | 40                   |
| Whole Symbol | `simultaneous`              | 0                    |
| Individually | `individually`              | 0 (full layer dur)   |

`from-center`, `from-edges`, and `random` remain valid stagger modes in the
schema but are surfaced only inside the Advanced disclosure. Existing projects
that already use them load and replay correctly.

## Effects

Effects (`Bounce`, `Pulse`, `Wiggle`, `Rotate`, `Breathe`, `Appear`,
`Disappear`, `Variable Color`, `Draw On`, `Draw Off`, `Draw Reveal`,
`Draw Erase`, `Draw Slide`) live in `AnimationStudioPanel`'s preset grid,
grouped under **Attention / Visibility / Draw / Color** sub-headers with
animated CSS hover previews. Disabled draw presets (those that need open
stroked paths) explain themselves via tooltip; everything else renders at
full contrast.

## Acceptance criteria — §2.7

1. **No warnings ever appear in the Animate panel.** A grep for `role="alert"`
   inside `components/editor/TransitionPanel.tsx` returns zero matches.
2. Opening the panel on any icon pair produces a working preview in one
   click. No strategy decisions are required.
3. The hierarchy is **Animation → Playback Mode → Timing → Preview**, with
   Advanced collapsed by default.
4. `tests/transition-panel.test.tsx` asserts the strategy dropdown is gone,
   the Advanced disclosure is collapsed by default, and the Playback Mode
   labels render.
5. New transitions persist `strategy: 'auto'`. The resolver routes through
   `autoMorph()`.
6. `bun run lint`, `bun test`, `npx tsc --noEmit`, and `pnpm build` all pass.

## Removed (do not reintroduce)

- The 6-way `STRATEGY_OPTIONS` dropdown in `TransitionPanel`.
- `STRATEGY_LABELS`, `STRATEGY_HINTS`, `STRATEGY_OPTIONS` constants.
- `CompatibilityBadge` and the green/yellow/orange/red `CompatibilityStatus`
  tones.
- `BindingStrategyDisplay`, `ReadOnlyLayerBindingList`, `computeBindingStrategy`,
  and the per-binding readiness percentage display.
- `MorphReadinessIndicator` mounted by default. It can still exist for
  debugging but never as a default surface.
- Source-state / target-state pickers and any UI copy that implies a single
  icon contains interaction states.

## Dev-only debug overlay (§2.4)

When the build env defines `NEXT_PUBLIC_CUNEIFORM_DEBUG=1`, a small monospaced
pill renders inside the panel showing:

```
debug · engine: <tier> · playback: <mode> · override: <strategy?>
```

This is a developer affordance only — it never appears in production builds.
The same information is also exposed (without rendering anything) through the
existing analytics hook so we can measure how often `autoMorph()` falls
through to `pointSampled` / `fallback` in the field.

## Related Specs

- [Cross-icon transitions](./cross-icon-transitions.md) — runtime model for
  icon → icon morph
- [Editor Store](./editor-store.md)
- [Transition Resolver](../runtime/transition-resolver.md)
- [`docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`](../../docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md)
  — design rationale (§1) and the full implementation plan (§2)

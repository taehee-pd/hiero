# Animate Panel Revamp + npm Deploy Plan

**Created:** 2026-04-13
**Branch:** `claude/improve-animate-morphing-CmPkM`
**Owner:** taehee-pd
**Scope:** (1) Eliminate morphing-strategy confusion and warnings from the Animate panel; (2) Reorganize the panel around the SF Symbols 7 layout patterns from [WWDC 2025 session 337](https://developer.apple.com/videos/play/wwdc2025/337/); (3) Prepare `@contour/cli` for its first npm publish.

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
- Add a single dev-only badge behind `process.env.NEXT_PUBLIC_CONTOUR_DEBUG === '1'`
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

| WWDC mode       | Contour stagger mode        | Default duration offset |
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

## 3. npm Deploy Preparation (`@contour/cli`)

`packages/coniva-cli/package.json` ships a `@contour/cli` stub at `0.1.0` but has
never been published. The existing `icons-package-release.yml` workflow publishes
*generated icon packages* (`npm publish ./dist/icons-package --access public`,
`.github/workflows/icons-package-release.yml:103`) — not the CLI itself.

### 3.1 Pre-publish checklist

- [ ] **Rename check.** The package is named `@contour/cli` but lives under
  `packages/coniva-cli/`. Decide on final scope (`@contour/cli` or `@coniva/cli`)
  before first publish — the name is immutable for the first 72h on npm.
- [ ] **Reserve the scope.** Verify the `@contour` org exists on npmjs.com (or
  create it) and that `taehee-pd` has publish rights.
- [ ] **Fill in `package.json` metadata** required for a clean npm listing:
  - `author`, `repository.url`, `bugs.url`, `homepage`
  - `README.md` referenced in `files`
  - `publishConfig.access: "public"` (since it's a scoped package)
- [ ] **Pin Node engine.** `engines.node: ">=18"` is fine; drop the `bun` engine
  claim — Bun is a dev dependency, not a runtime requirement.
- [ ] **Smoke-test the built binary.**
  ```bash
  cd packages/coniva-cli
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
      - run: cd packages/coniva-cli && bun install --frozen-lockfile
      - run: cd packages/coniva-cli && bun run build
      - run: cd packages/coniva-cli && npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Use **OIDC provenance** (`--provenance`) so the published tarball links back to the
exact commit — no more "trust us, this is the right code" story.

### 3.3 Versioning & cadence

- Use standalone `cli-vX.Y.Z` tags so CLI releases are decoupled from the web app.
- First publish: bump to `0.2.0` (not `1.0.0`) to signal that the CLI surface is
  still evolving.
- Document in `packages/coniva-cli/README.md`:
  - `npm install -g @contour/cli`
  - Minimum Node version
  - Known limitations (what the CLI does *not* yet do)

### 3.4 Release gating

Before the first `cli-v0.2.0` tag is pushed:

1. All Animate panel revamp tests pass on `main`.
2. `bun install --frozen-lockfile` passes from a clean checkout.
3. A maintainer has run `npm publish --dry-run` locally and eyeballed the tarball
   contents.
4. The `@contour` npm org has at least two owners to avoid bus-factor-of-one.

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
- Publishing the web app itself to npm or any registry. Contour remains a
  Next.js-hosted product per
  `docs_canonical/NEXT_PHASES.md:3-5`.
- Figma plugin publishing — tracked separately under `figma-plugin/`.

---

## 6. Open Questions

1. **Final scope name** — `@contour/cli` vs `@coniva/cli`? The package directory
   name (`coniva-cli`) and the manifest name (`@contour/cli`) currently disagree.
2. **Merge TransitionPanel + AnimationStudioPanel, or keep two tabs?** WWDC 337
   suggests one unified surface. Confirm with the designer before deleting
   `AnimationStudioPanel.tsx`.
3. **Dev-debug overlay opt-in** — env var, query param, or a hidden keyboard
   shortcut? `NEXT_PUBLIC_CONTOUR_DEBUG` is the least-magic option but requires a
   rebuild to toggle.

---

## 7. References

- WWDC 2025 session 337 — *What's new in SF Symbols 7*
  (https://developer.apple.com/videos/play/wwdc2025/337/)
- `lib/runtime-core/auto-morph.ts:42-104` — existing automatic cascade
- `components/editor/TransitionPanel.tsx:47-73` — strategy dropdown to remove
- `components/editor/MorphReadinessIndicator.tsx:198-227` — warning surface to remove
- `lib/runtime-core/topology-detection.ts:24-28` — warning message sources
- `specs/editor/animation-tab.md` — current spec (to be rewritten)
- `specs/editor/cross-icon-transitions.md` — current spec (to be trimmed)
- `packages/coniva-cli/package.json` — CLI manifest to finalize
- `.github/workflows/icons-package-release.yml:81-103` — existing npm publish
  pattern to mirror

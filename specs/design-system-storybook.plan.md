---
status: draft-plan (v3, post codex + eng review)
owner: taehee-pd
created: 2026-04-15
updated: 2026-04-15 (v2 → v3: /plan-eng-review applied, DESIGN.md + STYLEGUIDE.md reflected)
related:
  - DESIGN.md                        # visual system SSOT (root)
  - docs_canonical/STYLEGUIDE.md     # code conventions SSOT
  - docs_canonical/DESIGN.md         # project SSOT (architecture, phases)
  - specs/ui/components.md
  - specs/ui/screens.md
---

> **Authoritative sources.** This plan is subordinate to three existing
> documents. Any visual value, color, size, shadow, timing, or code
> convention comes from these, never invented in a story or component:
>
> - **Visual system:** `/DESIGN.md` (root) — typography scale, color
>   semantic map, Level 0–3 shadow system, concrete dimensions, motion
>   timings, focus ring, button variants, do/don't guardrails.
> - **Code conventions:** `docs_canonical/STYLEGUIDE.md` — Prettier
>   config, ESLint rules (`no-explicit-any` + `exhaustive-deps` as
>   errors), PascalCase feature / lowercase ui file naming, named
>   exports preferred, `@/` path alias, all-caps ban, component
>   organization principles.
> - **Project:** `docs_canonical/DESIGN.md` — architectural SSOT,
>   shipped phases, canonical doc index.
>
> When this plan and these docs conflict, the docs win. When they are
> silent, this plan fills the gap — and the gap gets pushed back into
> the docs in Phase 8.

# Plan — Component Systemization, Single Source of Truth, Storybook

## 1. Goals

1. **Discoverability** — every presentational UI primitive and every truly
   shared pattern is findable through one Storybook and one barrel.
2. **Consistency** — eliminate the dead `kibo-ui` facade, fix the broken toast
   path, delete unused primitives, and remove a small set of genuinely
   duplicated patterns.
3. **Documentation** — Storybook replaces tribal knowledge. Tokens rendered
   live from CSS vars, not hand-maintained.
4. **Regression safety** — interaction + a11y tests on primitives and any
   extracted shared components. Visual regression is a later concern.
5. **No feature regressions** — migration is incremental and each phase is a
   single PR that leaves the app green.

Non-goals: rewriting editor panels, adopting a different primitive library,
producing a standalone NPM DS package, or a full token redesign.

---

## 2. Current state (audit 2026-04-15, verified against repo)

> **Honesty note:** v1 of this plan had factual slop in this section. Counts
> and claims below have been re-verified by direct file reads and grep. Any
> claim not directly verified is marked `[unverified]`.

**Counts (verified)**
- `components/ui/` — **57 files** (shadcn/Radix primitives). ~12 are imported
  nowhere in the app code.
- `components/kibo-ui/` — **11 entries**: 10 pass-through `.tsx` re-exports
  (`button`, `input`, `label`, `select`, `slider`, `switch`, `tooltip`,
  `scroll-area`, `separator`, `resizable`) + 1 real composed component
  (`color-picker/`).
- `components/editor/` — **24 files** (container-heavy).
- `components/studio/` — 4 files.
- `components/explorer/` — 2 files.
- `components/export/` — 8 files.
- Providers / runtime / persistence — 3 files.
- **Total:** ~109 UI files.

**Framework versions (verified from package.json)**
- Next 16.1.6
- React 19.2.4
- Tailwind present; shadcn/Radix primitives fully integrated.
- Root config: `next.config.mjs` (no `.ts`).

**Tokens — verified**
- `app/globals.css` defines the color/typography/spacing/shadow/timing stack
  plus ~80 `wire-*` classes. The healthy parts are real.
- Classes actually referenced in app code: `wire-sidebar`, `wire-tab-row`,
  `wire-tab-button`, `wire-tabs`, `wire-section`, `wire-section-header`,
  `wire-icon-button`, `wire-project-pill`, `wire-title`.
- `wire-toolbar` and `wire-stage` are **defined in CSS but unused** — any
  plan component that claims to wrap them must be treated as speculative.
  (v1 of this plan proposed `WireSurface variant="toolbar|stage"` — this
  was a hallucination and is now deleted.)

**Icons — verified.** `lucide-react` imported in ~44 files. No abstraction.

**Storybook — verified absent.** No `.storybook/`, no `*.stories.tsx`.

**Toast situation — worse than v1 claimed**
- App callers import from `@/components/ui/use-toast` (Radix-style API).
- `components/ui/toaster.tsx` imports `@/hooks/use-toast` — a **different
  path**. Two near-identical hook files exist at
  `components/ui/use-toast.ts` and `hooks/use-toast.ts`.
- `app/layout.tsx` mounts **no toaster at all**. `Sonner` exists in
  `components/ui/sonner.tsx` and is unused.
- Net effect: `toast()` calls in the app currently push to a renderer that
  isn't mounted. This is a latent bug, not a cleanup task.

**Theme — correction from v1**
- `app/layout.tsx` uses `next-themes` `ThemeProvider` with
  `attribute="class"` — themes are toggled via a CSS class on `<html>`,
  not `data-theme`. Storybook preview decorators must match that, or
  primitives will render in the wrong palette.

**Unused shadcn primitives (verified via grep)** — zero imports for:
`navigation-menu`, `menubar`, `carousel`, `chart`, `table`, `hover-card`,
`pagination`, `avatar`, `breadcrumb`, `aspect-ratio`, `calendar`,
`input-otp`. `components/ui/form.tsx` (react-hook-form) also has zero
imports.

**Hardcoded sizing — confirmed**
- Action-icon buttons use `h-7 w-7 rounded-lg` directly in
  `components/studio/Navbar.tsx:384`, `components/studio/ListPane.tsx:314`,
  `components/editor/ToolPanel.tsx:192`, and elsewhere.
- No `--button-icon-size` / `--pill-height` / `--panel-section-padding-y`
  semantic tokens exist yet.
- **Implication:** extracting icon-button components without first adding
  a handful of semantic size tokens just fossilizes magic numbers behind a
  nicer import path. See §10.

**Repeated patterns — re-audited**
1. `kibo-ui` pass-throughs: noise, no value — delete.
2. `wire-tab-row`/`wire-tab-button` pattern: used in
   `EditorSidebarTabs` + `EditorShell:641`. Other parts of the editor
   already use `ToggleGroup` directly (`TransitionPanel:568`,
   `EditorShell:1378`). **Migration target, not new DS component** —
   just move `EditorSidebarTabs` to `ToggleGroup` and retire the CSS.
3. Icon-button-with-tooltip clusters: ~30+ usages already calling the
   shadcn `Button` + `Tooltip` pair. v1 called this "raw `<button>`" —
   that was wrong; they already use `Button`. Real duplication is the
   **prop bundle** (icon, tooltip, aria-label, sometimes kbd hint).
4. Inline-rename state machines: duplicated in
   `components/explorer/IconGridItem.tsx:78`,
   `components/editor/LayerPanel.tsx:118`,
   `components/studio/Navbar.tsx:80`, and `EditorShell`. Worth extracting
   as a **hook**, not a component.
5. Marquee multi-select: duplicated in
   `components/studio/ListPane.tsx:167` and
   `components/editor/LayerPanel.tsx:135`. Worth extracting as a **hook**.
6. Inspector numeric fields (opacity, scale, angle, etc.) — repeated
   input+unit+slider bundles in `InspectorPanel`. Genuine component
   candidate.
7. Color UI has three points of truth: `kibo-ui/color-picker`,
   `components/editor/ColorPickerPopover`, inline swatches. Consolidate.
8. `Field`/`FieldGroup` is the de-facto form layer; `ui/form.tsx`
   (react-hook-form) is dead — delete it.

---

## 3. Target architecture — three layers, narrow admission

```
┌──────────────────────────────────────────────────────────┐
│ 3. Feature / Domain                                      │  editor/, studio/,
│    Feature-local presentational leaves live beside their │  explorer/, export/
│    containers (components/editor/ui/…, etc.)            │
├──────────────────────────────────────────────────────────┤
│ 2. Hiero DS (components/ds)                            │  NARROW, by admission
│    Only cross-feature components with a stable semantic │
│    contract AND at least two consumers outside one      │
│    feature family.                                       │
├──────────────────────────────────────────────────────────┤
│ 1. Primitives (components/ui — shadcn/Radix)             │  unchanged
└──────────────────────────────────────────────────────────┘
```

**Admission criteria for `components/ds` (all five required):**
1. **Same semantics** — component name describes a concept, not a style.
2. **Same a11y contract** — aria, roles, keyboard model are identical
   across call sites.
3. **Same behavior** — hover/focus/disabled/loading/error are identical.
4. **Same change axis** — the thing actually moves together when redesigned.
5. **DESIGN.md fidelity** — every visual value (color, size, radius,
   shadow, motion timing, font weight) is looked up from `/DESIGN.md`
   or the tokens it specifies. No invented values. The first time a
   new value is needed, it goes into `/DESIGN.md` AND `app/globals.css`
   BEFORE the component uses it.

**Plus one of:**
- Cross-feature: used by ≥2 consumers from different top-level feature
  folders, OR
- System-level concern (status, color, toast, keyboard) that deserves
  canonical form.

**Hard rule:** if a candidate fails any admission criterion, it stays
inline or lives in its feature folder (e.g.
`components/editor/ui/PanelSection.tsx`). Feature folders are allowed to
grow their own small `ui/` directories. The doctrine is "don't over-share,"
not "everything DS."

`components/ds` imports `components/ui`, never the other way. Feature
folders import `components/ds` and `components/ui` freely. **Enforced via
ESLint `no-restricted-imports`** (added in Phase 2). Concrete rule:

```js
// .eslintrc / eslint.config
{
  files: ["components/ui/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/components/ds/*", "@/components/editor/*",
                  "@/components/studio/*", "@/components/explorer/*",
                  "@/components/export/*"],
          message: "components/ui is primitives-only; no DS or feature imports." }
      ]
    }]
  }
},
{
  files: ["components/ds/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/components/editor/*", "@/components/studio/*",
                  "@/components/explorer/*", "@/components/export/*"],
          message: "components/ds cannot import from feature folders." }
      ]
    }]
  }
}
```

Barrel: `components/ds/index.ts`.

---

## 4. Components to extract — shortlist

v1 listed 17. Codex was right that most were style presets masquerading as
components. Shortlist below, with admission test for each:

| Component | Cross-feature? | Stable contract? | Status |
|---|---|---|---|
| `IconButton` | yes (editor, studio, export) | if we commit to single contract | **candidate — Phase 4** |
| `ColorField` | yes (editor inspector + export) | yes (value → color) | **in** |
| `StatusBadge` | yes (navbar save status, release panel, sync) | yes | **in** |
| `KbdHint` | yes (toolbar + tooltips + menus) | yes, trivially | **in** |
| `SegmentedControl` | only if we commit to repo-wide adoption | unclear | **defer** — first migrate `EditorSidebarTabs` to bare `ToggleGroup`; reconsider only if a pattern actually emerges |
| `NumericField` | maybe — inspector-only today | yes (value+unit+step) | **editor-local**: `components/editor/ui/NumericField.tsx` |
| `ColorSwatch` | internal to `ColorField` | yes | in, not exported standalone |

**Dropped from v1** (style presets, not components):
`PanelHeader`, `PanelSection`, `WireSurface`, `FormPanel`, `HelpTooltip`,
`SidebarSection`, `ToolbarContainer`, `ListRow`, `EmptyStateCard`,
`ToolbarButton`. These are CSS/layout conventions. If they keep recurring,
they become Tailwind component classes or tiny local wrappers — not DS
exports.

### 4a. Interaction utilities track (higher value than most of the dropped list)

These are **hooks**, not components:

| Hook | Call sites |
|---|---|
| `useMarqueeSelection` | `ListPane:167`, `LayerPanel:135` |
| `useInlineRename` | `IconGridItem:78`, `LayerPanel:118`, `Navbar:80`, `EditorShell` |
| `useResizableHandle` | `Rulers:471`, `Canvas:455` (editor-local) |

Extracted as `lib/editor-hooks/` or `components/ds/hooks/` depending on
cross-feature reach. This is a separate, opt-in track from component
extraction and lands before Phase 4 extractions begin, because the hooks
reduce the surface that Phase 4 components need to handle.

### 4b. `IconButton` Props contract (proposal)

Agreed before Phase 5.4 begins, not during. If this contract can't absorb
the first 10 migration sites cleanly, Phase 5.4 is abandoned and
`Button + icon + Tooltip` stays the baseline.

**Every value in this contract is sourced from `/DESIGN.md`, not invented.**

```ts
// components/ds/icon-button.tsx   (lowercase per STYLEGUIDE.md)
import type { ButtonProps } from "@/components/ui/button";

export interface IconButtonProps
  extends Omit<ButtonProps, "children" | "size"> {
  /** Icon element; size is controlled by this component, not the caller. */
  icon: React.ReactElement;
  /** Required for a11y — never inferred from an icon name. */
  "aria-label": string;
  /** Shown in Tooltip. Defaults to aria-label. */
  tooltip?: React.ReactNode;
  /** Optional Kbd hint rendered in Tooltip content (platform-aware). */
  kbd?: KbdHintProps["keys"];
  /**
   * Button frame size. Maps directly to DESIGN.md §5 + §9.
   *   sm → 24px frame, 12px icon
   *   md → 28px frame, 14px icon  (DESIGN.md: "ghost icon buttons at
   *                                 28px with 14px icons")
   *   lg → 32px frame, 16px icon
   * Resolved via CSS vars --button-icon-size-{sm,md,lg} and
   * --icon-inner-size-{sm,md,lg} added in Phase 7.
   */
  size?: "sm" | "md" | "lg";
  /**
   * Corner radius. Maps to DESIGN.md §4 "Ghost button":
   *   "toolbar" → 0.5rem  (8px) — toolbar actions
   *   "panel"   → 0.875rem (14px) — panel navigation
   *   "pill"    → 9999px — badge / CTA anchors (rare for IconButton)
   */
  radius?: "toolbar" | "panel" | "pill";
  /** Visual variant — sourced from DESIGN.md §4 button variants. */
  variant?: "ghost" | "secondary" | "primary-soft";
  /** Replaces icon with Spinner; sets aria-busy; keeps tooltip text. */
  loading?: boolean;
  /** Radix slot pattern for DropdownMenu.Trigger / Popover.Trigger. */
  asChild?: boolean;
}
```

**Behavioral contract:**
- Always wraps Radix `Tooltip` (skips render if `tooltip === false`).
- **Focus ring is DESIGN.md §7:**
  `0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)` —
  implemented on the shadcn Button; IconButton does not override it.
- **Hover transition is DESIGN.md §7:** 120ms ease.
- `loading` swaps icon for Spinner, sets `aria-busy="true"`, keeps
  tooltip text, keeps keyboard focus.
- Keyboard: inherits shadcn `Button`. No custom key handlers inside.
- Icon sized by CSS var only. Callers **cannot** set `size={20}`
  inline; story includes a negative test asserting this.
- `asChild` pattern: when `true`, render as Radix Slot; Tooltip still
  wraps correctly — story verifies with a `DropdownMenu.Trigger`
  example.
- **All-caps ban:** tooltip / aria-label strings are sentence case per
  `docs_canonical/STYLEGUIDE.md`.
- **Named export only** (`export { IconButton }`) per STYLEGUIDE.md.

**Default values:** `size="md"`, `radius="toolbar"`, `variant="ghost"` —
matches the ~30 navbar/toolbar usages this is replacing first.

**Sites explicitly deferred** (not migrated in the first batch): any
`Button + icon` with meaningful non-icon children, any site whose icon
is decorative-only with no tooltip, any site using `radius="pill"`
(badge anchors) until a second wave.

---

## 5. Storybook setup — spike first, then commit

### Stack
- **Storybook 9** with `@storybook/nextjs-vite`.
- **React 19 + Next 16 support is advertised but RSC support is explicitly
  experimental.** Known caveats (verified against Storybook docs):
  - `next/font` only partially supported.
  - `next/navigation` stories require `parameters.nextjs.appDirectory = true`.
  - Server-only imports inside story trees can crash the Vite build.
  - React 19 support is tracked but not guaranteed friction-free.
- **Testing: use `@storybook/addon-vitest` (Vitest addon).** The old
  `@storybook/test-runner` is documented as superseded by the Vitest
  addon for Vite builders. This matches the repo's `bun test` runner
  better than Playwright-based test-runner.

### Phase 1 is a spike with explicit kill criteria
Storybook viability cannot be asserted ahead of time for this stack. Phase
1 is a timeboxed spike (1 working day). It **must** render all of:
1. `Button` (primitive, trivial).
2. A component importing `next/navigation` (e.g. a story for
   `components/studio/NavPane`) with `parameters.nextjs.appDirectory = true`.
3. Theme switcher actually toggling the `class` attribute on `<html>`
   (matching `next-themes` `attribute="class"` in `app/layout.tsx:54`).
4. A component consuming CSS vars from `app/globals.css` (rendering in
   correct palette light + dark).
5. A Radix toast firing from a story action via `useToast()` (per §9 #1).
6. Vitest-addon test running against one `.stories.tsx` interaction.

**Exit criteria (graduated, not binary):**
- **6/6 render cleanly** → commit to Storybook, proceed to Phase 2.
- **5/6 render + 1 works with a documented workaround** (≤20 lines of
  config) → commit to Storybook; log the workaround in `.storybook/README.md`.
- **4/6 render + 2 unresolved** → extend the spike by 0.5 day to chase
  the remaining two, then re-evaluate.
- **≤3/6 render**, or the Vitest addon blocks on React 19 → abandon
  Storybook, fall back to **Ladle** for a component catalog only (no QA
  gate). Drop §5.Testing from scope. A Ladle-only path means Phase 3
  interaction tests move back to bun-native with a small jsdom shim,
  and Phase 8 CI gating covers build only, not interactions.

Histoire is not a fallback — its React support is listed as "alternative,"
not supported.

### Config (on commit)
- `.storybook/main.ts` — stories glob: `components/**/*.stories.@(tsx|mdx)`.
- `.storybook/preview.tsx` decorators:
  1. `ThemeProvider` with `attribute="class"` (matches app).
  2. `TooltipProvider` (Radix).
  3. Tailwind global import — **including `app/globals.css`**, so every
     story gets `/DESIGN.md` tokens automatically.
  4. Radix `<Toaster />` from `components/ui/toaster.tsx` mounted at
     decorator root (per §9 #1 decision — shadcn Radix path, not Sonner).
  5. Spline Sans + Spline Sans Mono font loaders (matches app layout),
     since `/DESIGN.md` specifies Spline Sans 450 as display and Spline
     Sans Mono for code.
- `parameters.nextjs.appDirectory = true` global.
- `parameters.backgrounds` loaded from DESIGN.md §2 background colors
  (white / #0A0A0A), not arbitrary Storybook defaults.
- Tailwind & `@/` alias via Vite config mirroring `tsconfig.json`.
- **Code conventions** (`docs_canonical/STYLEGUIDE.md`):
  - All `.storybook/*.ts` and `*.stories.tsx` files follow Prettier
    (`semi: true, singleQuote: true, trailingComma: "all", printWidth: 100`).
  - No `any` — ESLint `@typescript-eslint/no-explicit-any` as error
    applies to stories. Use `Meta<typeof Component>` and
    `StoryObj<typeof Component>` strict generics.
  - Named exports for story objects, default export for `meta` (story
    conventions), matching STYLEGUIDE.md's "named exports preferred
    where framework does not force default."
  - Filenames: lowercase for DS + primitive stories
    (`icon-button.stories.tsx`), matching STYLEGUIDE.md's lowercase
    shadcn-style convention for shared UI.
  - All copy in stories is sentence case (all-caps ban per
    STYLEGUIDE.md §"All-caps styling ban").

### Story coverage strategy
- **Primitives used in the app** (~42 of 57): one story file each, with
  Default + AllVariants + AllSizes + Disabled + WithIcon as applicable.
- **DS components (post-Phase 4):** one story per component, one
  UsageExample, at least one Vitest-addon interaction assertion.
- **Feature leaves** (`IconGridItem`, `SyncDiffPreview`, `BezierCurveEditor`,
  `EasingPicker`, `WeightCurveEditor`, `MorphReadinessIndicator`, `Rulers`):
  stories.
- **Container panels** (`InspectorPanel`, `LayerPanel`, `Canvas`,
  `TimelineEditor`): one mounted smoke story each, seeded from a fixture
  store factory. Not per-state.

### Token MDX pages (contents sourced from `/DESIGN.md`, not invented)

Each MDX page renders live from CSS vars, with the `/DESIGN.md` section
that authorizes it cited inline. If a token isn't in DESIGN.md, it
doesn't go in the page — it goes to DESIGN.md first.

| MDX page | Contents | DESIGN.md ref |
|---|---|---|
| **Colors** | Background, panel surface, surface-warm, foreground (primary/secondary/tertiary), border, border-subtle, primary, primary-soft, success/warning/danger — light + dark side-by-side | §2 "Color Palette & Roles", §9 Quick color reference |
| **Typography** | Display hero 48px/450, Section heading 24px/450, Body large 15px/450, Body 13px/450, Label 11px/550, Caption 9px/550 — with the exact letter-spacing values | §3 concrete scale |
| **Spacing** | `--panel-padding: 12px`, `--panel-gap: 8px`, `--section-gap: 12px`, 4-pt scale `--space-{1..8}` | §5 concrete dimensions |
| **Dimensions** | Navbar 40px, Toolbar 38px, NavPane 200/56px, ListPane 260px, Inspector 260px, IconButton 24/28/32px with 12/14/16px inner icons | §5 + §9 navbar component example |
| **Shadows** | Level 0 flat, Level 0.5 inset edge, Level 1 outline ring, Level 2 elevated, Level 3 feature lift — all with the exact CSS vars for light + dark | §6 Depth & Elevation |
| **Motion** | Button hover 120ms, Panel shift 160ms, NavPane 200ms, Dialog enter 150ms, Toast enter 200ms — with demo animations | §7 Motion & Interaction Feedback |
| **Radii** | Toolbar action 8px, Panel nav 14px, Pill 9999px, Input 8px, Search 10px | §4 button variants + §9 examples |
| **Focus** | One interactive "focus me" story rendering the DESIGN.md ring exactly: `0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)` | §7 + §9 item 4 |
| **Do/Don't** | Lift DESIGN.md §8 guardrails into a visual reference page — paired examples of each | §8 Do / Don't Guardrails |

**No `WireSurfaces` MDX page.** v2 listed one; the `wire-*` classes are
implementation details of specific panels (sidebar, section), not a
documented token system. If a specific wire class survives Phase 2 it
is documented inline in the component that uses it, not in the DS
token docs.

### Build & CI
- `pnpm storybook` / `pnpm storybook:build` / `pnpm storybook:test-vitest`.
- CI: Phase 1 adds a non-blocking build job. Blocking after Phase 7.
- PR preview: Vercel project separate from the app. Link from PRs.

---

## 6. Phased rollout (reordered after review)

Eight PRs. Green after every phase.

### Phase 0 — Audit sign-off (this doc)
- Commit this plan. Alignment on §3 admission criteria and §4 shortlist.
- Explicit decisions for each open question in §9.

### Phase 1 — Storybook spike (1 day, timeboxed)
- Exit criteria above. If killed, skip to Ladle plan in §5.
- No story authoring beyond the six spike smoke stories.

### Phase 2 — Kill kibo-ui + fix toast + delete dead primitives (1–1.5 days)
**Happens BEFORE primitive stories.** Stories authored on a moving import
target is churn. Settle the surface first.

One PR, but split into **atomic commits** so any one can be reverted
without reverting the others:

1. **Commit A — `components/ds` scaffold + kibo-ui removal**
   - `git mv components/kibo-ui/color-picker components/ds/color-picker`.
   - Delete the 10 pass-through `kibo-ui/*.tsx` files.
   - Codemod `@/components/kibo-ui/<prim>` → `@/components/ui/<prim>`
     via jscodeshift (or a focused regex script) — one file at a time,
     typecheck between runs. Record the codemod in
     `scripts/codemod/kibo-to-ds.ts` so it is reproducible.
   - Add `components/ds/index.ts` barrel.
   - Add ESLint `no-restricted-imports` rule from §3.
   - Gate: `pnpm build && bun test && pnpm lint` green.

2. **Commit B — Toast architecture fix (latent bug)**

   Decision (§9 #1): **Keep Radix-style shadcn toast**, not Sonner.
   The fix is to repair the broken plumbing, not swap libraries.

   - **Keep:** `components/ui/toast.tsx` (Radix primitive),
     `components/ui/toaster.tsx` (the `<Toaster />` renderer).
   - **Canonical hook:** pick **one** of the two duplicate
     `use-toast.ts` files. Plan picks `components/ui/use-toast.ts`
     since that is the path app callers already import. Delete
     `hooks/use-toast.ts`.
   - **Fix the divergence:** update `components/ui/toaster.tsx:3` to
     import from `@/components/ui/use-toast` (currently imports from
     `@/hooks/use-toast`, the about-to-be-deleted path).
   - **Mount the renderer:** add `<Toaster />` to `app/layout.tsx`
     inside `<ThemeProvider>`, after `{children}`. This is the fix
     for the latent bug — `toast()` calls currently render to nothing.
   - **Delete unused alternative:** `components/ui/sonner.tsx` is now
     unused and gets deleted (it was installed for the not-chosen
     Sonner path).
   - **Verification test** (`tests/toast-smoke.test.tsx`) — render
     `<Toaster />` in a happy-dom harness, call `toast({ title: "x" })`
     from `@/components/ui/use-toast`, assert the Radix toast viewport
     contains "x". Without this, the whole "latent bug fixed" claim
     is unverified.
   - Gate: verification test passes + manual `pnpm dev` smoke.

3. **Commit C — Dead-code deletion**
   - Delete `components/ui/form.tsx`.
   - Delete the 12 unused shadcn primitives
     (`navigation-menu`, `menubar`, `carousel`, `chart`, `table`,
     `hover-card`, `pagination`, `avatar`, `breadcrumb`, `aspect-ratio`,
     `calendar`, `input-otp`).
   - Gate: `pnpm build && bun test` green.

4. **Commit D — Docs sync**
   - Update `docs_canonical/STYLEGUIDE.md` line 21 — remove the
     `components/kibo-ui/` reference and replace with
     `components/ds/` (same lowercase-file convention).
   - Add a one-line pointer in `docs_canonical/DESIGN.md` Canonical
     Documentation Index table for this spec file + the soon-to-exist
     Storybook.
   - Gate: prettier + lint green.

If Commit B's verification test cannot be written (no test infra for
React yet — see Phase 4 below), Commit B is split into its own follow-up
PR that lands after Phase 4's test infra is in place. Do not ship the
toast fix without a test.

### Phase 3 — Primitive stories + token MDX (1.5 days)
- One story file per primitive in the kept set (~42 files).
- Token MDX pages rendered live from CSS vars.
- **Enumerated interaction tests** (via Vitest addon if spike passed,
  otherwise deferred — see §5 Ladle fallback). Each test is a `play`
  function in the `.stories.tsx`:
  - `Button.stories.tsx` — click fires handler, `loading` sets
    `aria-busy`, `disabled` blocks click.
  - `Dialog.stories.tsx` — Escape closes, focus trap, overlay click
    dismisses, `aria-labelledby` wired.
  - `Tabs.stories.tsx` — Arrow-Left/Right moves active, Home/End jump,
    `role="tablist"` present.
  - `Select.stories.tsx` — keyboard open (Space), typeahead selects
    correct option, Escape closes without change.
  - `DropdownMenu.stories.tsx` — Arrow navigation, Enter activates,
    submenu opens on ArrowRight.
- **A11y:** Storybook a11y addon on by default; stories that fail axe
  checks break the build (Phase 8 makes it blocking).

### Phase 4 — Interaction-hook track (1–1.5 days; up from 0.5)

> **Engineering note:** the repo currently has **zero React component
> tests** — `tests/` contains schema/logic tests only. No
> `@testing-library/react`, no DOM env for bun test. This plan cannot
> extract hooks and claim they are tested without first adding React
> test infrastructure. Scope bumped from 0.5 day to 1–1.5 days to absorb
> this setup cost.

**Commit 1 — React test infra (shared dependency for Phase 4, 5, 6)**
- Add `@testing-library/react`, `@testing-library/user-event`,
  `happy-dom` as dev dependencies.
- Configure `bunfig.toml` (or equivalent) to preload a DOM env for
  tests matching `tests/**/*.test.tsx`.
- Add `tests/setup/react.ts` setup file.
- Validate with a trivial `<Button />` render test.
- **Do not** use `@testing-library/react-hooks` — that package is
  deprecated since RTL 13. Use `renderHook` exported directly from
  `@testing-library/react`.

**Commit 2 — Characterization tests (before extraction)**
- Write **per-site** characterization tests that capture the current
  behavior of inline rename and marquee-select on each call site:
  - `tests/char-inline-rename-iconGridItem.test.tsx`
  - `tests/char-inline-rename-layerPanel.test.tsx`
  - `tests/char-inline-rename-navbar.test.tsx`
  - `tests/char-inline-rename-editorShell.test.tsx`
  - `tests/char-marquee-listPane.test.tsx`
  - `tests/char-marquee-layerPanel.test.tsx`
- Each test asserts: start condition, Enter commits, Escape cancels,
  Blur commits (or cancels, whichever the site does today — this IS the
  behavior to preserve), empty string handling, duplicate-name handling.
- Tests must pass against current un-extracted code. If any fails to
  pass, the inline implementation has a bug and that bug is documented
  in the test name (e.g. `cancels_on_blur_WHICH_IS_BUG_TODO`).
- **No hook extraction happens until characterization is green.**

**Commit 3 — Extract and migrate**
- Extract `useInlineRename` and `useMarqueeSelection` into
  `lib/editor-hooks/`. Cross-feature use is not yet proven, so
  editor-hooks not `components/ds/hooks` to start.
- Migrate call sites one at a time. After each migration, re-run that
  site's characterization test. It must still pass — unchanged — or the
  extraction silently changed behavior.
- Hook unit tests via `renderHook` covering the combined state machine.

- Why first: shrinks the surface that Phase 5 components need to cover,
  AND establishes the test infrastructure every subsequent phase
  depends on.

### Phase 5 — DS extractions (1.5–2 days)
Order by risk, **not** by call-site count.

1. **`StatusBadge`** — smallest behavioral surface. Migrate Navbar save
   status, ReleasePanel, sync state. Single PR.
2. **`KbdHint`** — smallest visual surface. Migrate tooltip content +
   toolbar hints. Single PR.
3. **`ColorField`** — consolidates three color UIs. Ships with migration
   of `ColorPickerPopover` + Inspector color usage. Single PR.
4. **`IconButton`** — last, not first. Single contract proposed before
   PR: icon + aria-label + tooltip + loading + disabled + optional kbd.
   Ship with migration of ~10 high-confidence sites; leave the rest as
   `Button + icon` until follow-up. If the single-contract design can't
   survive the first batch of sites, **abandon it** and keep `Button`.
5. **`EditorSidebarTabs` → bare `ToggleGroup` migration.** Not a DS
   component. Same PR retires `wire-tab-*` CSS classes and their CSS
   definitions.
6. **`NumericField`** stays editor-local in
   `components/editor/ui/NumericField.tsx`. Not DS.

### Phase 6 — Feature-leaf + container smoke stories (1 day)
- Presentational leaves listed in §5.
- Container smoke stories with seeded fixtures.

### Phase 7 — Semantic size tokens (0.5 day)

All values sourced from `/DESIGN.md` §5 + §9. Any token not already in
`app/globals.css` gets added there AND back-referenced into DESIGN.md §5
(so DESIGN.md stays the SSOT).

```css
/* app/globals.css — add or verify */
--navbar-height: 40px;             /* DESIGN.md §5 */

/* Toolbar height: decision §9 #9 — KEEP the responsive clamp, expose
   min/max as explicit tokens, back-port the range into DESIGN.md §5. */
--toolbar-height-min: 36px;        /* DESIGN.md §5 (new, back-ported) */
--toolbar-height:     clamp(var(--toolbar-height-min), 2.375rem, var(--toolbar-height-max));
--toolbar-height-max: 40px;        /* DESIGN.md §5 (new, back-ported) */
--navpane-width-expanded: 200px;   /* DESIGN.md §5 */
--navpane-width-collapsed: 56px;   /* DESIGN.md §5 */
--listpane-width: 260px;           /* DESIGN.md §5 */
--inspector-width: 260px;          /* DESIGN.md §5 */
--panel-padding: 12px;             /* DESIGN.md §5 */
--panel-gap: 8px;                  /* DESIGN.md §5 */
--section-gap: 12px;               /* DESIGN.md §5 */

/* IconButton frame + inner icon sizes — DESIGN.md §9 navbar example:
   "ghost icon buttons at 28px with 14px icons" */
--button-icon-size-sm: 24px;
--button-icon-size-md: 28px;
--button-icon-size-lg: 32px;
--icon-inner-size-sm: 12px;
--icon-inner-size-md: 14px;
--icon-inner-size-lg: 16px;

/* Pill / field heights — used by StatusBadge + NumericField */
--pill-height-sm: 20px;
--pill-height-md: 24px;
--field-height-sm: 28px;
--field-height-md: 32px;
--field-height-lg: 36px;

/* Radii — DESIGN.md §4 */
--radius-toolbar-action: 0.5rem;    /* 8px */
--radius-panel-nav: 0.875rem;       /* 14px */
--radius-pill: 9999px;
--radius-input: 0.5rem;             /* 8px */
--radius-search: 0.625rem;          /* 10px */
```

Migrate hardcoded `h-7 w-7 rounded-lg` action buttons (found in
`components/studio/Navbar.tsx:384`, `components/studio/ListPane.tsx:314`,
`components/editor/ToolPanel.tsx:192` per the eng-review audit) to the
new tokens via CSS vars and Tailwind arbitrary values where needed.

**Reconciliation resolved (§9 #9):** the existing
`app/globals.css` clamp is kept — the responsive behavior is
intentional. Phase 7 exposes the bounds as named tokens
(`--toolbar-height-min`, `--toolbar-height-max`) and back-ports the
range pattern into `/DESIGN.md` §5 so the SSOT documents it. This
becomes the precedent for any future responsive token (the first
range-token pattern in DESIGN.md).

- Scoped — not a full token redesign.
- This unblocks DS components from being magic-number fossils.

### Phase 8 — CI gating + handoff doc
- Flip Storybook build + Vitest-addon tests (and bun React tests) to
  blocking in CI.
- Lint script: any export from `components/ds/*` must have a matching
  `.stories.tsx` AND a matching `.test.tsx`.
- Update `CLAUDE.md`, `README.md`, and the PR template.
- **PR template additions** (DS admission cannot be ESLint-enforced,
  so reviewer convention):
  - `[ ] If this PR adds a component to components/ds, all four
    admission criteria in DESIGN-SYSTEM.md §3 are met.`
  - `[ ] If this PR adds a component to components/ds, at least two
    consumers outside a single feature folder exist in the same PR.`
  - `[ ] If this PR touches components/ds, a Storybook preview URL is
    included.`

### Phase 9 — Optional: visual regression (defer)
- Revisit if visual regressions start biting. Chromatic default.

**Total estimate:** 7–10 working days, 9 PRs.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Storybook 9 + Next 16 + React 19 + RSC incompat** | Phase 1 is a spike with hard kill criteria (§5). Fall-back is Ladle + no QA gate. |
| **Theme class mismatch** (app uses `attribute="class"`, not `data-theme`) | Preview decorator uses `attribute="class"`. Spike story #3 gates this. |
| **Toast rendering path broken** in the app RIGHT NOW (no `Toaster` mounted) | Phase 2 Commit B mounts the Radix `<Toaster />` from `components/ui/toaster.tsx`, fixes its broken import path (`toaster.tsx:3`), deletes the duplicate `hooks/use-toast.ts`, and deletes the unused `components/ui/sonner.tsx`. Treat it as a latent bug fix, not cleanup. |
| **`next/navigation` stories crash** without `appDirectory` parameter | Set as global preview parameter. Spike story #2 gates this. |
| **Server-component imports inside stories** crash Vite build | Story policy: no stories for RSC-only files. Enforce via glob exclusion. |
| **Vitest-addon maturity** | It is the Storybook-recommended path for Vite; if it blocks in Phase 1, fall back to plain `bun test` + manual story review. |
| **Import codemod churn** breaks Next 16 RSC boundaries | jscodeshift for the codemod; `pnpm build` + `bun test` gate Phase 2. |
| **IconButton single-contract doesn't fit reality** | Ship with 10 sites; abandon if it fails; keep `Button + icon` as the baseline. |
| **Extracting DS components freezes hardcoded sizes as magic numbers** | Phase 7 adds semantic size tokens scoped to the migrated sites. |
| **Abstraction creep** — plan invents components for classes that don't exist (`WireSurface`) | v1 had this bug. Admission criteria in §3 make it harder to repeat. |
| **`wire-*` CSS debt after `EditorSidebarTabs` migration** | Retire `wire-tab-*` CSS in the same PR. Keep `wire-sidebar` / `wire-section` since they're load-bearing. |
| **Storybook becomes write-only (nobody reads it)** | Link from `README.md`, `CLAUDE.md`, PR template. Require story URL in PR descriptions touching DS. |
| **Disposition of the 12 unused shadcn primitives** | Phase 2 deletes. Git is the backup. |
| **Two `use-toast.ts` files, no mounted toaster** (latent) | See Phase 2. |
| **Repo has zero React component tests today** — hook extraction cannot be validated without new test infra | Phase 4 Commit 1 adds `@testing-library/react` + `happy-dom`. All React tests blocked until this lands. |
| **Hook extraction silently changes behavior across 4+ sites** | Phase 4 Commit 2 adds per-site characterization tests. Extraction is blocked until characterization is green. Each migrated site re-runs its characterization test — parity is asserted. |
| **Radix `<Toaster />` mount regression goes undetected** | Phase 2 Commit B requires a `tests/toast-smoke.test.tsx` integration test. If test infra isn't ready, toast fix is deferred to a follow-up PR after Phase 4 Commit 1. |
| **IconButton contract leaks caller-sized icons** (`size={20}` inline) | Phase 5.4 contract forbids `size` on the icon — size comes from the button via CSS var. Story includes a negative test asserting this. |
| **DS admission criteria cannot be ESLint-enforced** — "cross-feature usage" is not a lint check | Phase 8 PR template adds a reviewer checklist. No automated enforcement; relies on code review. |
| **Spike exit criteria were v1-binary — no graceful path for 5/6** | §5 now specifies graduated exits (6/6, 5/6, 4/6, ≤3/6). |
| **Stories invent new visual values** (colors, sizes, radii, timings) instead of sourcing from `/DESIGN.md` | §3 admission criterion #5 requires DESIGN.md fidelity. CI check: `scripts/check-hardcoded-values.ts` greps DS components + stories for hex colors, pixel literals outside the DESIGN.md-allowed set. Blocks CI in Phase 8. |
| **STYLEGUIDE.md references `components/kibo-ui/` after Phase 2 kills it** — stale docs | Phase 2 Commit D updates `docs_canonical/STYLEGUIDE.md` line 21 in the same PR. |
| **`--toolbar-height` clamp vs DESIGN.md's flat 38px** (resolved §9 #9) | Decision: keep the existing clamp, expose `--toolbar-height-min: 36px` and `--toolbar-height-max: 40px` as named tokens, and back-port the range-token pattern into DESIGN.md §5. Precedent for future responsive tokens. |
| **ESLint `no-explicit-any` breaks stories** — common story patterns use `any` for `args` typing | Use `Meta<typeof Component>` / `StoryObj<typeof Component>` generics from CSF3. Verified in Phase 1 spike story #1 (`Button`). |

---

## 8. Success metrics

- **100%** of `components/ds/*` components: one story + one interaction
  test + one `.test.tsx` file under `tests/ds/`.
- **Zero** `@/components/kibo-ui` import paths (folder gone).
- **Zero** `wire-tab-*` references in components (`EditorSidebarTabs`
  migrated).
- **One** mounted toaster in `app/layout.tsx`. Zero dead toast files.
  **One** integration test asserting `toast()` renders into the Radix
  toast viewport.
- **One** import path (`@/components/ds`) for all shared, cross-feature UI.
- **React test infrastructure exists** (`@testing-library/react`,
  `happy-dom`, setup file) — verifiable by a non-zero React test count.
- **Per-site characterization tests** exist for every hook extraction
  target AND pass before AND after migration.
- Storybook build < **30s** in CI (measured during Phase 1 spike, not
  assumed).
- Dev-server startup unchanged.
- Semantic size tokens for icon buttons, pills, panel sections, fields
  — **all traceable to `/DESIGN.md` sections**.
- **Zero invented visual values in `components/ds/*`** — enforced by
  `scripts/check-hardcoded-values.ts` in CI (Phase 8).
- **`docs_canonical/STYLEGUIDE.md` contains no `kibo-ui` reference**
  after Phase 2.
- **`docs_canonical/DESIGN.md` Canonical Documentation Index** lists
  this plan and the Storybook location after Phase 2.

---

## 9. Open questions — RESOLVED (2026-04-15)

All 10 answered via `AskUserQuestion` during `/plan-eng-review`.
Decisions are binding for Phase 0 sign-off forward. Where the user
diverged from the plan's recommendation, the deviation is flagged.

1. **Toast library → Radix-style shadcn toast** (plan recommended
   Sonner; user chose Radix). Fix plumbing in place: keep
   `components/ui/toast.tsx` + `toaster.tsx`, pick
   `components/ui/use-toast.ts` as canonical, delete
   `hooks/use-toast.ts`, fix `toaster.tsx:3` import, mount
   `<Toaster />` in `app/layout.tsx`, delete unused
   `components/ui/sonner.tsx`. See Phase 2 Commit B.
2. **Delete all 13 dead files → yes** (12 unused shadcn primitives +
   `components/ui/form.tsx`). Git is the backup. See Phase 2 Commit C.
3. **Folder name → rename to `components/ds`**. Phase 2 Commit A
   handles move + codemod + ESLint rule. Commit D updates
   `docs_canonical/STYLEGUIDE.md` line 21.
4. **IconButton contract → sign off on §4b BEFORE Phase 5.4**.
   Contract frozen at Phase 0 approval. Phase 5.4 PR migrates the
   first 10 sites. If the contract cannot absorb them cleanly, Phase
   5.4 is abandoned and `Button + icon + Tooltip` stays inline.
5. **Ladle fallback → yes, acceptable** if Storybook spike fails
   (≤3/6 smoke stories render on Next 16 + React 19). Catalog-only,
   no QA gate for interactions. Phase 3 primitive interaction tests
   move back to bun-native + happy-dom in that scenario.
6. **Feature-local `ui/` subfolders → yes, allowed**. Editor-local
   patterns like `components/editor/ui/NumericField.tsx` stay close
   to the feature. `components/ds` is reserved for the §3 admission
   criteria.
7. **React test infrastructure → add
   `@testing-library/react` + `@testing-library/user-event` +
   `happy-dom`** as new devDeps in Phase 4 Commit 1. ~15KB gzipped.
   Gates hook extraction, toast verification, every DS test.
8. **Toast Commit B PR ordering → decide at Phase 2 start**. If
   Phase 4 Commit 1 has landed or is in-flight, bundle the toast fix
   into Phase 2 with the verification test. Otherwise defer to a
   follow-up PR after Phase 4 Commit 1 merges.
9. **`--toolbar-height` reconciliation → keep the existing clamp,
   back-port min/max into DESIGN.md** (plan recommended flat 38px;
   user chose preserve clamp). Phase 7 exposes
   `--toolbar-height-min: 36px` and `--toolbar-height-max: 40px` as
   named tokens, wires them into the existing `clamp()`, and adds a
   new range-token pattern entry to DESIGN.md §5. This becomes the
   precedent for future responsive tokens.
10. **DESIGN.md authorship lock → yes**. From Phase 2 onward, any new
    semantic token added to `app/globals.css` must also land in
    `/DESIGN.md` in the same commit. PR template enforces (Phase 8).
    DESIGN.md becomes a living contract, not a snapshot.

---

## 10. Out of scope — explicit

- Full token redesign.
- Figma token sync.
- Mobile layout work for `StudioLayout`.
- Rewriting editor panels, Canvas, or timeline.
- Extracting DS to a separate NPM package.
- Migration to a different primitive library.

**Brought back in scope (from v1 out-of-scope list):**
- **Semantic size tokens for extracted DS components** (Phase 7). Without
  these, DS components fossilize magic numbers and the exercise is net
  negative.

---

## Appendix A — Skills consulted

`/find-skills "design system storybook"`:
- `dalestudy/skills@storybook` — 476 installs
- `thebushidocollective/han@storybook-story-writing` — 396
- `thebushidocollective/han@atomic-design-fundamentals` — 281
- `storybookjs/react-native@writing-react-native-storybook-stories` — 211
- `mindrally/skills@storybook` — 177
- `daffy0208/ai-dev-standards@design system architect` — 130
- `ankish8/storybook-npm@design system validator` — 20

Install counts are modest; none are authoritative. Not installing by
default. Revisit if a phase hits an unknown.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex consult` | Independent 2nd opinion | 1 | issues_found | 8/8 questions answered; 3 factual errors in v1 §2, 8 over-abstracted components dropped, phasing reordered, Storybook test runner swapped, theme config corrected, toast bug surfaced |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 9 eng issues + DESIGN.md/STYLEGUIDE.md reflection; 13 fixes applied to plan, 2 critical gaps closed (React test infra, hook characterization), visual system SSOT explicitly bound |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**CODEX:** v1 review — 8 factual/architectural findings, all
incorporated into v2. See earlier entry.

**ENG REVIEW (v2 → v3):**

Findings and fixes applied to this file:

1. **[P1 9/10] `IconButton` Props contract was undefined** — Phase 5.4
   would start under pressure with no interface. Fixed: added §4b with
   concrete `IconButtonProps` signature, behavioral contract, and
   deferral criteria. Must be agreed before Phase 5.4.

2. **[P1 9/10] Zero React component tests in the repo today** —
   `tests/` contains schema/logic only. No `@testing-library/react`, no
   DOM env, no precedent. v2's Phase 4 assumed infra that doesn't
   exist. Fixed: Phase 4 bumped from 0.5 day to 1–1.5 days with an
   explicit Commit 1 adding `@testing-library/react` + `happy-dom` +
   setup file. Also swapped deprecated `@testing-library/react-hooks`
   → `renderHook` from RTL.

3. **[P1 9/10] Toast bug fix had no verification test** — v2's whole
   premise is that `toast()` calls currently go to a ghost renderer.
   After the Radix `<Toaster />` is mounted, "it works" must be
   asserted. Fixed: Phase 2 Commit B requires `tests/toast-smoke.test.tsx`.
   If test infra isn't ready when Phase 2 runs, Commit B is deferred
   to a follow-up PR after Phase 4 Commit 1.

4. **[P2 8/10] Phase 2 bundled 4 independent ops in one PR** — revert
   surface was dangerous. Fixed: Phase 2 now structured as three atomic
   commits (kibo-ui/ESLint, toast, dead-code) in one PR with explicit
   gates between, each independently revertable.

5. **[P2 8/10] ESLint `no-restricted-imports` was handwaved** — v2 said
   "enforced via ESLint" without a rule config. Fixed: §3 now has the
   concrete rule block for both `components/ui` and `components/ds`.

6. **[P2 7/10] Characterization tests missing for hook extraction** —
   pulling `useInlineRename` out of 4 sites and `useMarqueeSelection`
   out of 2 with no parity net was a silent-regression trap. Fixed:
   Phase 4 Commit 2 now requires per-site characterization tests before
   extraction, re-run after each migrated site.

7. **[P2 7/10] DS admission criteria not PR-enforceable** — ESLint
   can't check "cross-feature usage." Fixed: Phase 8 PR template adds
   three reviewer checklist items.

8. **[P3 6/10] Binary spike exit criteria too rigid** — v2 said "all 6
   must render OR abandon." Fixed: §5 now specifies graduated outcomes
   (6/6, 5/6 with workaround, 4/6 extend, ≤3/6 fallback).

9. **[P3 6/10] Phase 3 primitive interaction tests were vague** — "real
   keyboard behavior" without enumeration is aspirational. Fixed: Phase
   3 now enumerates the five primitive tests with specific assertions
   per primitive + a11y addon gating.

**DESIGN.md + STYLEGUIDE.md reflection (post-review, user-requested):**

10. **Plan was untethered from the project's visual SSOT.** v2 had
    `related: docs_canonical/DESIGN.md` in the frontmatter but never
    cited it. The root `/DESIGN.md` (324 lines) is the actual visual
    system — concrete typography (13px/450 body, 11px/550 label,
    9px/550 caption), color roles (`--primary-soft`, `--surface-warm`,
    `--border-subtle`), Level 0–3 shadow system, navbar/toolbar/pane
    dimensions, IconButton spec ("ghost icon buttons at 28px with 14px
    icons"), motion timings (120/160/200ms), focus ring formula,
    button variants (primary pill / secondary pill / accent soft /
    ghost). Fixed: plan now has an authoritative-sources preamble,
    §3 admission criterion #5 requires DESIGN.md fidelity, §4b
    IconButton contract is entirely sourced from DESIGN.md §4/§5/§7/§9,
    §5 adds a Token MDX contents table citing DESIGN.md sections per
    page, §6 Phase 7 lists concrete CSS var names tied to DESIGN.md
    values, Phase 8 adds `scripts/check-hardcoded-values.ts` CI check,
    and §9 #10 proposes a DESIGN.md authorship lock.

11. **STYLEGUIDE.md had a live reference to `components/kibo-ui/`**
    (line 21) that this plan's Phase 2 is about to invalidate. Fixed:
    Phase 2 Commit D updates STYLEGUIDE.md in the same PR, plus adds
    this plan to `docs_canonical/DESIGN.md`'s Canonical Documentation
    Index.

12. **STYLEGUIDE.md code conventions were not wired into Storybook
    config.** Plan said "Prettier + ESLint" in passing but didn't
    assert story files follow them. Fixed: §5 Config now explicitly
    binds `.storybook/*.ts` and `*.stories.tsx` to Prettier
    (`semi/singleQuote/trailingComma/printWidth: 100`), ESLint
    `no-explicit-any` (use `Meta<typeof Component>` generics), named
    exports, lowercase filenames for DS stories, sentence case copy
    (all-caps ban), and `@/` path alias.

13. **`--toolbar-height` contradiction** between `app/globals.css`
    (`clamp(36px, 2.375rem, 40px)`) and DESIGN.md §5 (flat `38px`).
    Fixed: flagged as open question §9 #9; Phase 7 picks DESIGN.md's
    flat value unless the clamp is re-approved.

**TEST COVERAGE DIAGRAM**

```
PLAN TESTING COVERAGE (post v3 fixes)
======================================
[+] Phase 2 — kibo-ui consolidation + toast fix
    ├── Commit A: [★★ gated] codemod correctness via build+test
    ├── Commit A: [★★ NEW]   ESLint rule fires on forbidden import (fixture)
    ├── Commit B: [★★★ NEW] tests/toast-smoke.test.tsx — Radix toast viewport render
    └── Commit C: [★★ gated] dead-code deletion via build+test

[+] Phase 3 — primitive stories
    ├── [★★★ NEW] Enumerated: Button/Dialog/Tabs/Select/DropdownMenu
    ├── [★★★ NEW] a11y addon gates axe violations
    └── [★★ NEW]  Theme switching story test

[+] Phase 4 — React test infra + hook extraction
    ├── Commit 1: [★★★ CRITICAL] React test infra setup (new infra)
    ├── Commit 2: [★★★ CRITICAL] 6 characterization tests (before extract)
    ├── Commit 3: [★★★] renderHook unit tests (after extract)
    └── Commit 3: [★★★] Re-run characterization per migrated site

[+] Phase 5 — DS extractions
    ├── StatusBadge: [★★] variants + migration smoke
    ├── KbdHint:     [★★] Mac/Win modifier resolution
    ├── ColorField:  [★★] controlled/uncontrolled + popover a11y
    ├── IconButton:  [★★] contract parity across 10 sites +
    │                      [★★] negative test: caller cannot set icon size
    └── SidebarTabs: [★★] keyboard nav equivalence (pre/post migration)

[+] Phase 7 — semantic size tokens
    └── [★] MDX rendering (no unit test needed)

COVERAGE DELTA v2 → v3:
  v2 had ~3/17 specified test paths
  v3 has ~16/17 specified test paths
  Critical gaps closed: toast verification, characterization tests,
  IconButton contract parity, React test infra

REMAINING GAP: Phase 6 container smoke stories are handwaved.
  Acceptable — they are smoke tests by design, not assertions.
```

**CRITICAL FAILURE MODES** (added to §7 Risks):
- Repo has no React test infra today — Phase 4 Commit 1 is the gate.
- Hook extraction without characterization silently changes behavior.
- Toast "fix" without a verification test repeats the latent-bug
  class we're trying to fix.

**NOT IN SCOPE** (explicitly, after eng review):
- Visual regression (Chromatic/Loki) — Phase 9, deferred.
- Figma token sync — unchanged from v2.
- Full token redesign — unchanged from v2.
- Rewriting editor panels — unchanged from v2.
- Adding Playwright/Cypress E2E — all new tests use bun test + RTL
  or Vitest addon; no browser automation.
- Migrating existing schema/logic tests — they already work, leave
  them alone.

**WHAT ALREADY EXISTS** (before any work):
- `bun test` runner and ~20 schema/logic test files — reused as-is.
- shadcn/ui primitives (57) — reused as-is.
- next-themes `ThemeProvider` — reused as-is.
- Radix Toast primitive (`components/ui/toast.tsx`) + `toaster.tsx` renderer already exist — reused for toast (§9 #1 decision; Sonner deleted in Phase 2).
- Tailwind + CSS var token layer — reused as-is.
- `@/` path alias in `tsconfig.json` — reused, mirrored to Storybook
  Vite config.

**PARALLELIZATION**

| Phase | Modules touched | Depends on |
|---|---|---|
| Phase 1 (spike) | .storybook/, package.json | — |
| Phase 2 (kibo-ui/toast/dead-code) | components/ui, components/ds, components/kibo-ui, app/layout.tsx, .eslintrc | Phase 1 decision |
| Phase 3 (primitive stories) | components/ui/*.stories.tsx | Phase 2 |
| Phase 4 (hooks + test infra) | lib/editor-hooks/, tests/, package.json | Phase 1 decision |
| Phase 5 (DS extractions) | components/ds/, feature migrations | Phase 2, Phase 4 |
| Phase 6 (feature leaves) | components/editor/*.stories.tsx, etc. | Phase 3 |
| Phase 7 (size tokens) | app/globals.css, touched DS components | Phase 5 |
| Phase 8 (CI gating) | .github/, PR template | Phase 7 |

**Parallel lanes:**
- Lane A: Phase 1 (spike) → Phase 2 → Phase 3 → Phase 6 (stories track)
- Lane B: Phase 4 (hooks + test infra) — can start in parallel with
  Phase 2 if Phase 1 has passed, since Phase 4 Commit 1 is independent
  of kibo-ui churn.
- Merge point: Phase 5 (needs both A and B).
- Then: Phase 7 → Phase 8.

**Conflict flag:** Phase 2 Commit B (toast) and Phase 4 Commit 1
(React test infra) both touch `package.json` dev deps — serialize
these two commits regardless of worktree.

**CROSS-MODEL:** Codex v1 review + Claude eng review v2 agree on major
architecture decisions (three-layer, narrow DS admission, Phase 2
before primitive stories, Storybook over Histoire). Codex recommended
Sonner for toast; user explicitly chose Radix-style shadcn at sign-off
(§9 #1) because the Radix plumbing is already in place and the fix is
"mount the missing renderer," not "swap libraries." No unresolved
cross-model tension.

**UNRESOLVED → RESOLVED 2026-04-15:** all 10 §9 questions answered via
`AskUserQuestion` during this eng review session. Two decisions diverged
from the plan's recommendation:
- **Q1 toast:** user chose Radix-style shadcn, not Sonner. Plan rewritten
  to fix Radix plumbing in place; `components/ui/sonner.tsx` is now
  marked for deletion.
- **Q9 toolbar height:** user chose to keep the existing
  `clamp(36px, 2.375rem, 40px)` and back-port `--toolbar-height-min`
  and `--toolbar-height-max` into DESIGN.md §5 as a new range-token
  pattern. Plan's Phase 7 updated accordingly.

Other eight decisions matched recommendations and are now binding for
Phase 0 sign-off.

**VERDICT:** ENG CLEARED (with 2 critical gaps surfaced and fixed into
the plan). CEO review not required — this is internal architecture,
not product scope. Design review not required — this is infrastructure
work, not visual design. Ready to implement Phase 0 sign-off, then
Phase 1 spike.

**Outside voice:** `/codex consult` already ran on v1. Not re-running
on v3 — the v2→v3 delta is all plan-file polish and does not introduce
new strategic claims that need a second opinion. Re-run only if Phase 1
spike surfaces unexpected Storybook 9 + React 19 compat issues.

# Hiero UI Icons — Decisions

Status: accepted (Phase 0)
Branch: `claude/hiero-icon-design-research-HuZCl`

Goal: replace `lucide-react` in the Hiero UI with icons authored in Hiero and
rendered by the Hiero runtime. Dogfood the authoring stack.

## Scope

In:

- Replace all 63 `lucide-react` imports across 42 files.
- CSS-variable theming (multi-color icons via design tokens).
- Animated UI icons for a targeted subset (hamburger↔close, chevron, copy↔check,
  play↔pause, eye↔eye-off, spinner).
- RSC / SSR-streaming path so static icons ship zero JS.
- RTL mirroring per-icon via metadata.
- npm package split: `packages/hiero-ui-icons` consumed via pnpm workspaces.
- Migrate inline SVGs only where they are icons (canvas drawings excluded).
- Feature flag for gradual cutover.

Out:

- Marketing-site icons.
- Automatic animation triggers based on route or scroll.
- Runtime theme-switching across icons mid-session (theme is bound at render).

## Decisions

### D1 — Canonical sizes (revised after inventory)

Authoring at `16` and `24`. Runtime uses `sizeFallback: 'scale'` for all
other requested sizes. Inventory shows Tailwind `size-3` through
`size-10` in active use (12–40 px); authoring all 13 sizes × 63 icons
is not cost-effective for v1.

Add a per-icon 12 px variant only when stroke-scaling looks visibly
wrong. Revisit after the first dogfood pass.

### D2 — Set name + types

Icon set id: `hiero-ui-icons`. Types catalog: `['default']`. Filled variants
added later if a specific icon needs them.

### D3 — Color contract

- Default: `currentColor` for both stroke and fill.
- Multi-color: `PaintRef.mode: 'token'` with the new optional
  `fallback: string` (Phase 2). Runtime emits `var(--token, fallback)`.
- Token names: `--hiero-icon-accent`, `--hiero-icon-muted`,
  `--hiero-icon-danger`. Declared in `docs_canonical/DESIGN.md` and
  `app/globals.css`.

### D4 — Source of truth

`packages/hiero-ui-icons/source/icons.json` is the single source of truth.
IndexedDB inside the editor is a working copy. Publishing from the editor
writes back to `source/icons.json` via an explicit `pnpm icons:export` or
a UI action; never automatic.

### D5 — Feature flag

`NEXT_PUBLIC_USE_HIERO_ICONS`. When false (default until Phase 8 passes), the
`Icon()` wrapper falls back to `lucide-react`. When true, the wrapper resolves
from the Hiero registry. `lucide-react` is only dropped from `package.json`
after Phase 8 validation passes.

### D6 — Registry shape

Per-icon named exports (`export { plus } from './icons/plus'`) plus a
generated `Icon({name})` wrapper that uses a `switch` over the `IconName`
union. Bundlers tree-shake named imports. Monolithic `Record` rejected on
bundle-size grounds.

### D7 — Registry location

In-repo under `packages/hiero-ui-icons/` as a pnpm workspace. This requires
enabling pnpm workspaces at the root (no `pnpm-workspace.yaml` exists today;
`packages/hiero-cli/` is published standalone). Workspace enablement is a
Phase 7 prerequisite — validate that `@hiero/cli` still resolves after the
root manifest changes.

### D8 — Animation trigger API

```tsx
<Icon name="menu" state={isOpen ? 'close' : 'menu'} />
```

`state` is typed per icon based on the transitions authored for it. When
`state` is omitted, the icon renders static. When supplied, `HieroIcon`
renders with `animate={true}` and resolves the transition from the
registry. Respects `prefers-reduced-motion` via the existing
`reduceMotion` prop.

### D9 — RSC / SSR path

Split the runtime, don't rewrite:

- `lib/runtime-react/HieroIcon.tsx` stays `'use client'` for the animated
  path.
- New `lib/runtime-react/HieroIconServer.tsx` — no `'use client'`,
  synchronous, emits static SVG by calling a new
  `lib/runtime-core/svg-serialize.ts` pure-string serializer.
- `Icon()` wrapper dispatches on presence of `animate` / `state`.
- Shared svg-serialization helper covers both paths; one test asserts byte
  identity for static icons.

Rationale: the DOM renderer at `lib/runtime-dom/renderer.ts` is DOM-required
(uses `createElementNS`). A pure serializer is new code but strictly bounded.

### D10 — RTL mirroring

Per-icon `mirrorInRTL?: true` in the icon metadata. The `Icon()` wrapper
reads document direction (client: `document.documentElement.dir`; server:
Next.js routing). Applies `transform: scaleX(-1)` to the wrapper `<span>`
when the flag is set and `dir === 'rtl'`. Default is `false`. Opt-in only
to prevent logos / brand marks from flipping.

### D11 — Authoring source

Importer seeds from the `lucide-static` npm package (deterministic, pinned,
offline). One-at-a-time UI import via `lib/import/adapters/lucide-adapter.ts`
is not scaled for 63-icon batches.

### D12 — Determinism gate

CI runs `pnpm icons:build` and fails if `git diff --quiet` reports changes.
Codegen output is byte-equal across runs. A dedicated test asserts this
locally (`tests/hiero-ui-icons/determinism.test.ts`).

### D13 — Bundle budget

After migration: +15KB gzipped maximum over the pre-migration baseline
(measured against `lucide-react` tree-shaken build). CI fails on regressions
beyond the budget.

### D14 — Validation gates (Phase 8 exit criteria)

All required to pass before removing `lucide-react` in Phase 9:

- Storybook visual regression (snapshot diff against Lucide baseline).
- Playwright SSR smoke test (server-rendered HTML contains `<svg>`).
- RTL render test covering mirrored icons.
- Bundle-size delta within D13 budget.
- Reduced-motion test.
- `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check` green.
- Manual dogfood pass across editor, studio, explorer, export panels.

## Phase outcomes (post-execution)

**Phase 9 revised: `lucide-react` stays as a data-source dependency.**
Zero UI code imports from `lucide-react` after the Phase 8 codemod —
that's the dogfood win. The package remains a runtime dependency of
`lib/import/adapters/lucide-source.ts`, which reads Lucide's bundled
icon data to populate the editor's "Import from Lucide" flow. That is
a separate concern from UI icon rendering and is not a dogfood gap.

## Non-decisions (deferred)

- External package publishing cadence / semver discipline — internal-only
  until external demand appears.
- Icon search UI inside the editor for authoring — out of scope, can be
  added later without blocking the dogfood goal.
- Figma round-trip for UI icons — out of scope for v1.

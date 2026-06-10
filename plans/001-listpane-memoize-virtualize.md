# Plan 001: Memoize and virtualize the ListPane icon browser

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4ffd061..HEAD -- components/studio/ListPane.tsx components/editor/IconListPanel.tsx lib/editor-core/use-virtual-rows.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `4ffd061`, 2026-06-10

## Why this matters

`ListPane` is the **primary** icon browser mounted in the studio
(`components/studio/StudioLayout.tsx:140` renders `<ListPane />`). On every
render it maps over all icons and, for each, calls `exportSvgString(...)` —
full path serialization + style/token resolution — with no memoization, and it
renders every row with no windowing. A 200-icon project re-serializes 200 SVGs
on every unrelated state change (search keystroke, selection, favorite toggle),
which is seconds of avoidable work per interaction on mid-range hardware.

Note: a sibling component, `components/editor/IconListPanel.tsx`, was already
virtualized (see `lib/editor-core/use-virtual-rows.ts`), but it is the
*embedded-editor* list, not the one mounted in `StudioLayout`. This plan brings
the same treatment to the component users actually see, plus per-row SVG
memoization which `IconListPanel` did not need (it renders no SVG previews).

## Current state

- `components/studio/ListPane.tsx` — the studio icon grid. Relevant code:
  - `:89-94` builds the `icons` array via `useMemo` over `project.icons` (good).
  - `:345-376` — the render loop. Today (excerpt):
    ```tsx
    filtered.map((icon) => {
      const iconDef = project?.icons[icon.id];
      const firstVariantId = iconDef ? Object.keys(iconDef.variants)[0] : null;
      const svg =
        iconDef && firstVariantId
          ? exportSvgString(iconDef, firstVariantId, firstVariantId, project?.tokenSet?.colors)
          : '';
      return (
        <IconGridItem key={icon.id} iconId={icon.id} iconName={icon.name} svg={svg} ... />
      );
    })
    ```
    `exportSvgString` runs unconditionally per icon, per render. `IconGridItem`
    is not memoized.
- `lib/editor-core/use-virtual-rows.ts` — existing dependency-free windowing
  hook. API: `useVirtualRows({ count, rowHeight, overscan? })` returns
  `{ containerRef, onScroll, start, end, totalHeight, offsetY }`. Read it; reuse
  it. Note: `ListPane` is a **grid**, not a single column — windowing a grid
  requires computing rows from items-per-row, OR scope this plan to memoization
  only (see Step 3 decision gate).
- Exemplar to match for windowing usage: `components/editor/IconListPanel.tsx`
  (the `virtualize` branch added in a prior change) — read its
  `useVirtualRows` wiring and mirror the structure.
- Convention: this repo uses `React.memo` sparingly and `useMemo` for derived
  values; selectors come from `@/lib/editor-store/hooks`. Match existing import
  style (`@/` alias).

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`           | exit 0              |
| Typecheck | `npx tsc --noEmit`                        | exit 0, no errors   |
| Tests     | `pnpm test`                               | all pass            |
| Lint      | `bun run lint`                            | exit 0              |
| Build     | `pnpm build`                              | exit 0              |

## Scope

**In scope:**
- `components/studio/ListPane.tsx`
- `components/studio/ListPane.tsx` may need a small new child or hook — keep it
  in the same file or a sibling `components/studio/use-icon-svg-cache.ts`.
- `tests/listpane-perf.test.tsx` (create)

**Out of scope (do NOT touch):**
- `components/editor/IconListPanel.tsx` — already virtualized; different surface.
- `lib/editor-core/use-virtual-rows.ts` — reuse as-is; do not modify its API.
- `lib/export/export-svg.ts` (`exportSvgString`) — do not change the exporter;
  only change how often it is called.
- The `IconGridItem` public prop shape if it is consumed elsewhere — check
  `grep -rn "IconGridItem" components/` first; if it has other call sites,
  memoize without changing props.

## Git workflow

- Branch: `advisor/001-listpane-perf` (or the active feature branch if the
  operator says to stay on it).
- Commit style: conventional, authored `taehee-pd <j.taehee@icloud.com>` with a
  `Co-Authored-By: Claude` trailer (match `git log`).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Memoize the per-row SVG generation

Replace the inline `exportSvgString` call with a cache keyed by
`icon.id` + the first variant id + a token-set identity. Simplest correct
approach: a `useMemo`-built `Map<string, string>` recomputed only when
`project.icons` or `project.tokenSet` changes, populated lazily or eagerly for
the `filtered` set. Do NOT key on render-transient values (selection, query).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Memoize `IconGridItem`

Wrap `IconGridItem` in `React.memo` (custom equality that ignores inline event
handlers is acceptable, or stabilize the handlers with `useCallback`). Confirm
no other call site relies on it re-rendering on parent state.

**Verify**: `grep -rn "IconGridItem" components/` → only `ListPane.tsx` (and its
own definition); `npx tsc --noEmit` → exit 0.

### Step 3: Decision gate — windowing

If `ListPane` renders a simple scroll container you can compute rows for,
add windowing via `useVirtualRows` above a threshold (mirror the
`IconListPanel` virtualize branch; compute `itemsPerRow` from container width
and pass `count = ceil(filtered.length / itemsPerRow)`). **If the grid layout
(CSS grid / flex-wrap / marquee selection via `gridRef`) makes correct
windowing risky**, STOP windowing here and ship Steps 1–2 only — per-row SVG
memoization is the larger win. Record the decision in the PR description.

**Verify**: `pnpm test` → all pass (marquee-selection tests must still pass:
`pnpm test 2>&1 | grep -i marquee`).

### Step 4: Add a perf-characterization test

Create `tests/listpane-perf.test.tsx` (model after
`tests/icon-list-virtualization.test.tsx`): load a project with 200 generated
icons, render `<ListPane />`, and assert `exportSvgString` is called at most
once per icon across two renders (spy/mock it), proving memoization holds.

**Verify**: `pnpm test 2>&1 | grep -i listpane` → new tests pass.

## Test plan

- New file `tests/listpane-perf.test.tsx`, structural pattern from
  `tests/icon-list-virtualization.test.tsx` (happy-dom + `@testing-library/react`,
  uses `editorStore.getState().loadProject(...)`).
- Cases: (1) 200 icons render without error; (2) `exportSvgString` (mocked) is
  not re-invoked for unchanged icons on a second render triggered by a
  selection change; (3) if windowing shipped, fewer than N rows mount.
- Verification: `pnpm test` → all pass including the new file.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `bun run lint` exits 0
- [ ] `pnpm test` passes; `tests/listpane-perf.test.tsx` exists and passes
- [ ] `pnpm build` exits 0
- [ ] `exportSvgString` no longer appears inside a `.map(` callback in
      `ListPane.tsx` (`grep -n "exportSvgString" components/studio/ListPane.tsx`
      shows it inside a memo/cache, not the render loop)
- [ ] Marquee-selection tests still pass
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report (do not improvise) if:
- The "Current state" excerpt at `ListPane.tsx:345-376` no longer matches the
  live code (drift).
- `IconGridItem` has call sites outside `ListPane.tsx` that depend on
  re-rendering — memoization could regress them.
- Windowing breaks marquee selection (`gridRef`/`data-icon-id` queries) and a
  reasonable fix isn't obvious — ship Steps 1–2 only and report.

## Maintenance notes

- If `IconGridItem` later shows live-animated previews (not static SVG), the
  SVG cache key must include whatever drives the animation.
- A reviewer should confirm the cache invalidates on icon edit (the key must
  change when `project.icons[id]` changes identity).
- Deferred: applying the same treatment to any future large list surfaces.

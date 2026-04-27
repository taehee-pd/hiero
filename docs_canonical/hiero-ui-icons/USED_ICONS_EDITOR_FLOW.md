# Used Icons — In-Editor Flow

**Created:** 2026-04-27
**Owner:** Hiero core
**Status:** shipped (internal build)
**Pairs with:** `MIGRATION_PUBLISH_PLAN.md` (PR #162) — this doc covers
the editor UX that operationalizes Phase A inventory + the same-day
publish loop in code.

The migration plan calls for "100% of UI icon usage in app surfaces
resolves through `@hiero/ui-icons`" and a same-day edit/publish loop.
This document covers the in-editor half of that loop: the menu items,
the build-time inventory, and the CI gate that keeps the two halves
in sync.

## What the user sees (internal build only)

`File →` menu in both `components/studio/Navbar.tsx` and
`components/editor/Toolbar.tsx`:

| Item                          | Action                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open Hiero UI Icon Set**    | Loads the full `packages/hiero-ui-icons/source/icons.json` into the editor. (Existing.)                                                                             |
| **Save Hiero UI Icon Set**    | Saves the full canonical set back to `icons.json`. (Existing.)                                                                                                      |
| **Import Used Icons**         | Loads the icons referenced in app code (currently 84) as a filtered Project named `hiero-ui-icons (used)`. (New.)                                                   |
| **Save Used Icons (Merge)**   | Serializes the edited subset, _merging_ it back into the full canonical `icons.json` so canonical-but-unused icons survive untouched. (New.)                        |

All four entries are gated by the env-var literal
`process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal'` so Webpack
constant-folds and DCE strips them from public bundles. The bundle
isolation gate (`scripts/check-public-bundle.ts`) catches regressions.

## Why a "used" view at all

The canonical `icons.json` ships a superset of what Hiero's own UI
references — alignment variants, draft glyphs, and icons authored
ahead of consumption. A maintainer who is auditing the icons that
actually appear in product surfaces wants the focused view; paging
through a 100-icon catalog buries the signal.

This is also the safe entry point for the same-day publish loop in
`MIGRATION_PUBLISH_PLAN.md` § "Authoring flow":

1. **Import Used Icons** in Hiero (internal build).
2. Edit geometry / states / transitions.
3. **Save Used Icons (Merge)** → writes `icons.json` non-destructively.
4. `pnpm icons:build`
5. `pnpm icons:verify`
6. Commit source + generated artifacts together.

## How the inventory stays fresh

The list of "used" icons is generated, not maintained by hand.

```
scripts/find-used-icons.ts          ← greps app/ + components/
  └─ writes lib/integrations/used-icons.generated.ts
       └─ consumed by:
            • lib/integrations/hiero-ui-icons-source.ts
              (openUsedHieroUiIconsInEditor filter)
            • scripts/check-used-icons.ts
              (CI gate)
```

Two npm scripts:

- `pnpm icons:find-used` — regenerate the inventory locally.
- `pnpm icons:check-used` — refresh + verify every used name exists in
  `icons.json`. CI fails if a used reference can't resolve, satisfying
  the "every used icon resolves through `@hiero/ui-icons`" success
  criterion in the migration plan.

The grep pattern is deliberately narrow: the JSX form `<*Icon name="literal"`.
Dynamic `name={expr}` references are skipped on purpose — the inventory
catches statically resolvable references and falls back to visual QA
for the rest.

## Save semantics — why merge, not replace

`serializeMergedHieroUiIconSet` (in
`lib/integrations/hiero-ui-icons-source.ts`) loads the bundled
canonical `icons.json` at save time and overlays the editor's edited
subset onto it. Two guards:

1. **Used-view-only.** Refuses to save unless the maintainer opened
   the subset via "Import Used Icons" (the editor's
   `currentProjectPath` matches `HIERO_UI_ICONS_USED_VIEW_PATH`,
   which deliberately differs from `HIERO_UI_ICONS_SOURCE_FILENAME`).
   Without this, the existing "Save Hiero UI Icon Set" action would
   happily overwrite `icons.json` with the 84-icon subset and silently
   delete the 22 canonical-but-unused glyphs.

2. **Byte-stable on no-op merges.** `meta.updatedAt` is only refreshed
   when `editorStore.isDirty === true`. A no-op import-then-save keeps
   the original timestamp so `pnpm icons:verify` stays green.

Tests live in:

- `tests/hiero-ui-icons-used.test.ts` — filter, round-trip, byte
  stability, and the "edited used + preserved unused" merge property.
- `tests/check-used-icons-script.test.ts` — CI gate sanity + failure
  mode.

## File map

```
scripts/find-used-icons.ts              ← inventory
scripts/check-used-icons.ts             ← CI gate
lib/integrations/used-icons.generated.ts ← generated inventory output
lib/integrations/hiero-ui-icons-source.ts ← editor helpers (extended)
components/studio/Navbar.tsx            ← studio menu items
components/editor/Toolbar.tsx           ← editor toolbar menu items
tests/hiero-ui-icons-used.test.ts       ← helper tests
tests/check-used-icons-script.test.ts   ← gate tests
package.json                            ← icons:find-used + icons:check-used
```

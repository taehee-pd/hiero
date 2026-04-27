# Hiero UI Icons — Status

**Last verified:** 2026-04-27
**Source plan:** the migration + edit/publish plan checked in on 2026-04-27.

This file records what's actually shipped vs. what the plan still calls
forward-looking work, so future contributors don't re-execute completed
phases. Update when materially changed.

## Migration plan (Plan §1, Phases A–E) — **complete**

Every Phase A–E acceptance criterion already holds in main:

| Phase | Plan goal | Status | Where it lives |
|---|---|---|---|
| A | Inventory + naming-contract freeze | done | `docs_canonical/hiero-ui-icons/INVENTORY.md` enumerates 63 distinct Lucide icons across 42 files. |
| A | Alias mapping (`ChevronDownIcon` → `chevronDown`) | done | `scripts/migrate-lucide-to-hiero.ts` codemod ran in Phase 8; alias maintenance lives in `packages/hiero-ui-icons/src/registry.generated.ts`. |
| B | Manifest covers all used icons | done | `packages/hiero-ui-icons/source/manifest.json` declares 106 entries; the inventory's 63 are a subset. |
| B | Source seeded from manifest (`pnpm icons:import`) | done | Script at `scripts/import-ui-icons.ts`; output at `packages/hiero-ui-icons/source/icons.json` (106 icons authored). |
| B | Generated package outputs (`pnpm icons:build`) | done | Script at `scripts/build-ui-icons.ts`; output at `packages/hiero-ui-icons/generated/src/*.tsx` (107 files) + `packages/hiero-ui-icons/src/registry.generated.ts`. |
| C | App consumption through `Icon` wrapper / direct exports | done | 42 files import `@hiero/ui-icons`; 0 active files import `lucide-react`. (Stragglers in `design-system/_src/` are a frozen design-system snapshot, not active code.) |
| C | RTL parity (`mirrorInRTL`) preserved | done | 7 icons flagged in `manifest.json` per Plan §10 (INVENTORY.md). |
| C | No stray `lucide-react` imports in UI paths | done | Verified by `grep "from 'lucide-react'" components/ app/ lib/` → 0 hits. |
| D | Determinism gate | done | `pnpm icons:verify` (`scripts/build-ui-icons.ts && git diff --quiet`) — wired in `package.json:32`. |
| D | RTL + reduced-motion test coverage | done | `useResolvedDir` in `packages/hiero-ui-icons/src/index.tsx`; D14 gate criteria met before the Phase-9 cleanup that removed `NEXT_PUBLIC_USE_HIERO_ICONS`. |
| E | Feature flag retired | done | `NEXT_PUBLIC_USE_HIERO_ICONS` no longer referenced anywhere in `app/`, `components/`, `lib/`. |

The `lucide-react` package remains a runtime dependency *only* of
`lib/import/adapters/lucide-source.ts` (the editor's "Import from Lucide"
flow), as expected per DECISIONS.md §"Phase 9 revised."

## Edit + publish plan (Plan §2) — **partial**

The mechanism exists but the binding is loose. Inventory:

| Capability | Status | Notes |
|---|---|---|
| `icons.json` is a valid `Project` | done | Top-level keys `version, meta, icons, types`; loadable through the toolbar's existing Open Project flow. |
| Round-trip determinism (load → save = no-op) | **gated** | `tests/hiero-ui-icons-roundtrip.test.ts` (added 2026-04-27) loads icons.json through `loadProject` and asserts ids, viewBoxes, sizes, and per-layer path data round-trip cleanly across all 106 icons. Failure tells the contributor to run `pnpm icons:import`. |
| First-class "Open Hiero UI Icon Set" entry point in toolbar | done (internal builds only) | File menu item in both `components/editor/Toolbar.tsx` and `components/studio/Navbar.tsx`. Gated on `NEXT_PUBLIC_BUILD_CHANNEL=internal`; public builds don't render the menu item or bundle the icons.json data. See `lib/integrations/hiero-ui-icons-source.ts` and the `Build channels` section in `CLAUDE.md`. |
| Save-back action that targets `packages/hiero-ui-icons/source/icons.json` | done (internal builds only) | "Save Hiero UI Icon Set" sibling action serializes as Project (not Workspace) and defaults the filename to `icons.json`. |
| Bundle-isolation guarantee for the public channel | done | `scripts/check-public-bundle.ts` greps the public `.next/` output for fingerprints of `icons.json`. CI gates this on every PR via the `Build (public)` matrix step in `.github/workflows/web-app-ci.yml`. |
| `pnpm icons:build` automation post-save | not done | Designer drops to terminal. |
| Authoring-loop documentation in `CLAUDE.md` | added 2026-04-27 | "Common Commands" lists `pnpm icons:import`, `pnpm icons:build`, `pnpm icons:verify`. |

## Authoring loop (internal-build maintainers — same-day publish)

```
1. NEXT_PUBLIC_BUILD_CHANNEL=internal pnpm dev    # internal-channel editor
2. File → Open Hiero UI Icon Set                  # one-click open (locked source)
3. Edit in canvas
4. File → Save Hiero UI Icon Set                  # one-click save (Project shape, locked filename)
5. Move the downloaded icons.json into packages/hiero-ui-icons/source/
6. pnpm icons:build                               # regenerate generated/
7. pnpm icons:verify                              # determinism gate
8. pnpm test && pnpm build                        # app-level checks
9. git add packages/hiero-ui-icons/ && git commit
```

The "Open / Save Hiero UI Icon Set" menu items only render when
`NEXT_PUBLIC_BUILD_CHANNEL=internal`. Public-channel users see the
generic Open/Save Project actions and have no path to the canonical
icon set. See `CLAUDE.md` "Build channels" + `docs_canonical/DEPLOYMENT.md`.

## Authoring loop (public users / external contributors)

Without the dogfood entry points, the loop falls back to the generic
Open/Save Project flow against any user-chosen file. External
contributors authoring their own icon sets follow the same pattern,
just with their own JSON files instead of the Hiero canonical source.

## Next increments (priority order)

1. **In-editor `icons:build` integration** — a follow-up button (or a
   git pre-commit hook) that runs `bun scripts/build-ui-icons.ts` so
   the determinism gate passes without context-switching to the terminal.
2. **Direct save-without-download for the internal channel** — the
   current Save action triggers a Blob download that the maintainer
   manually moves into `packages/hiero-ui-icons/source/`. A Next.js
   API route `POST /api/hiero-ui-icons/save` (gated to internal channel
   + dev-mode only) could write the file directly. Removes one manual
   step from the loop.

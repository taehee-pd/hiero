# Contour — Next Phases Plan

**Created:** 2026-04-02
**Updated:** 2026-04-13
**Context:** Platform pivot — Contour targets server-side embedding (Storybook, Sanity, custom toolchains) rather than standalone desktop distribution.

---

## Shipped Phases

The following phases from the original plan have been implemented:

| Phase | Status | Summary |
|-------|--------|---------|
| **R1** — Desktop/Electrobun Removal | **SHIPPED** | Desktop shell removed; Contour is now a pure Next.js web application. `desktop/` retains build artifacts only. |
| **R2** — Web Persistence (IndexedDB) | **SHIPPED** | `lib/persistence/` uses IndexedDB as sole storage path. `AutoSaveProvider` mounted in layout. Workspace restoration works in both StudioLayout and ExplorerShell. |
| **R3** — State Management UI | **SHIPPED** | `EditorShell.tsx` wires add/remove/rename/duplicate state actions. `tests/state-crud.test.ts` verifies CRUD operations. |
| **R4** — Replace `prompt()` Dialogs | **SHIPPED** | No remaining `prompt()`/`confirm()` calls in app code. Explorer uses `Dialog`/`AlertDialog`. |
| **R5** — Accessibility Pass | **SHIPPED** | ARIA roles/labels, `focus-visible` treatment, `role="region"` on canvas, live regions on status areas. |

### Additional shipped work (not in original plan)

| Feature | Summary |
|---------|---------|
| Repo-Native Distribution | Lane 1 live-sync (`lib/live-sync/`), Lane 2 release, `@contour/cli` (`packages/coniva-cli/`), PublishPanel, ReleasePanel |
| Figma Plugin Import | `figma-plugin/export-to-coniva/`, `app/api/import/figma/route.ts`, import dialog in editor UI |
| Studio Layout Revamp | Sanity Studio-style single screen: `NavPane`, `ListPane`, embedded editor in `StudioLayout.tsx` |
| Stagger Ordering Fix | Transition resolver stagger ordering ranks corrected |
| Post-Review Bug Fixes | 13 bugs fixed from Codex adversarial review (rename key conflicts, duplicate command palette, layout issues) |
| Unified autoMorph + Draw Animation | `autoMorph()` with intrinsic interpolation (Sederberg 1993) replaces manual strategy selection. Draw animation effect (`kind: 'draw'`) with reveal/erase/slide modes for open stroked paths. 39 new tests. PR #100. |
| Remove all-caps styling | Stripped `text-transform: uppercase` + `uppercase` Tailwind utility app-wide. Sentence-case labels everywhere. PR #127. |
| Design audit §7.1–§7.5 | Every row of the full-workspace design audit (`docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` §7): tooltips, inline rename, resizable Layers+Variants, shape glyphs, drag reorder, right-click menus, canvas contextual menu, segmented controls, ARIA min/max on spinners, grouped animation presets. PR #128. |
| Animate Panel Revamp (plan §2) | Stripped strategy dropdown and compatibility tones; restructured into `Animation → Playback Mode → Timing → Preview → Advanced`; added `'simultaneous'` stagger mode, dev-only debug overlay, "Engine chose" pill. `autoMorph()` is the only public contract. PR #128. |
| `@contour/cli` deploy prep (plan §3) | Filled `packages/coniva-cli/package.json` metadata, added provenance `publishConfig`, new `.github/workflows/cli-release.yml` with OIDC publish, CLI README with usage + versioning + limitations. PR #128. |

---

## Remaining Phases

### Phase R6 — Navigation & Discoverability (mostly shipped, 2026-04-13)

**Status:** Mostly shipped in PR #128. UX-2.2 (breadcrumb) was intentionally
dropped after a design review.

| Sub-task | Status | Notes |
|----------|--------|-------|
| UX-2.2 — Workspace > Project > Icon breadcrumb | Dropped | Keep the current `project name + icon name` label in the Toolbar. The breadcrumb was built and reverted on request. |
| UX-2.5 — Shortcut hints + `?` cheat sheet | Shipped | Toolbar + Navbar buttons already showed shortcut hints in tooltips. `?` (and `Shift+/`) now dispatches `contour:open-shortcuts` via `handleEditorKeyDown`; both dialogs listen for the event. |
| UX-2.6 — `⌘K` command palette | Verified | Already wired via `EditorShell` — lists project-wide actions + every icon in the project. |
| UX-3.2 — Editor empty state | Shipped | Canvas's "No icon selected" card now has **New icon / Import existing SVG / Search icons (⌘K)** CTAs that dispatch `contour:new-icon`, `contour:import-svg`, and `contour:open-command`. |
| UX-3.3 — Transition panel empty state | Shipped | `TransitionPanel` renders an inline hint below the disabled Preview button pointing at `⌘K` when no target is picked. |
| UX-3.4 — Layer panel empty state | Shipped | The wire-layer empty note now shows "No layers yet", helper copy, and `<kbd>P</kbd>` / `<kbd>U</kbd>` hints plus "drag an SVG file onto the canvas". |

Regression test: `tests/r6-navigation.test.tsx` asserts that `?` outside an
input dispatches `contour:open-shortcuts`, that `Shift+/` has the same
effect, and that the binding is suppressed while typing in an input.

---

### Phase R7 — Server-Side Embedding Readiness

**Priority:** Medium — aligns with platform pivot
**Status:** Partially addressed by repo-native distribution work

#### Remaining work

1. **Storybook addon compatibility** — verify `ContourIcon` React component works in Storybook without editor dependencies; ensure tree-shaking separates runtime from editor
2. **Headless export API** — expose icon compilation as a programmatic API (`lib/export/`) that can run in Node.js without browser APIs
3. **CSP compatibility** — audit for `eval()`, inline styles via `style=` attribute, and other CSP-violating patterns; replace with Tailwind/CSS classes
4. **iframe embedding** — verify editor works in iframe with appropriate `postMessage` communication for host integration
5. **Configuration injection** — support reading config (theme, allowed tools, export targets) from host environment via props or env vars

---

## Execution Summary

| Phase | Scope | Status |
|-------|-------|--------|
| ~~R1~~ | Desktop/Electrobun removal | **SHIPPED** |
| ~~R2~~ | Web persistence completion | **SHIPPED** |
| ~~R3~~ | Critical UX flow gaps | **SHIPPED** |
| ~~R4~~ | Replace `prompt()` dialogs | **SHIPPED** |
| ~~R5~~ | Accessibility pass | **SHIPPED** |
| ~~R6~~ | Navigation & discoverability | **SHIPPED** (UX-2.2 breadcrumb dropped) |
| **R7** | Server-side embedding readiness | Partially addressed |

### CI Configuration

Active CI workflows:
- `web-app-ci.yml` — lint, test, build
- `icons-pr-validate.yml` — source export validation on PRs
- `icons-post-merge-build.yml` — post-merge compile
- `icons-package-release.yml` — package build + optional publish
- `cli-release.yml` — `@contour/cli` build + optional npm publish with OIDC provenance (triggers on `cli-v*` tag push or manual dispatch)

Gate: `bun install --frozen-lockfile && bun run lint && bun test && pnpm build`

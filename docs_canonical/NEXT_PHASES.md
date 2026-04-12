# Contour — Next Phases Plan

**Created:** 2026-04-02
**Updated:** 2026-04-04
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

---

## Remaining Phases

### Phase R6 — Navigation & Discoverability (UX Audit Phase 2 + 3)

**Priority:** Medium
**Status:** Not started

#### UX-2.2 — Consistent breadcrumb navigation

Implement unified breadcrumb: `Workspace > Project > Icon` across editor and explorer.

#### UX-2.5 — Keyboard shortcuts reference

Add shortcut hints to tooltips. `?` key opens shortcuts cheat sheet dialog.

#### UX-2.6 — Icon search in editor

Add `Cmd+K` command palette or searchable dropdown for switching between icons without returning to explorer.

#### UX-3.2 / UX-3.3 / UX-3.4 — Empty state guidance

- Editor empty state: add "Import existing SVG" CTA
- Animation Studio "No transitions": add inline guidance linking to state management
- Layer panel "No layers": add contextual tips ("Use Pen tool (P), Shape tool (R), or drag SVG")

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
| **R6** | Navigation & discoverability | Not started |
| **R7** | Server-side embedding readiness | Partially addressed |

### CI Configuration

Active CI workflows:
- `web-app-ci.yml` — lint, test, build
- `icons-pr-validate.yml` — source export validation on PRs
- `icons-post-merge-build.yml` — post-merge compile
- `icons-package-release.yml` — package build + optional publish

Gate: `bun install --frozen-lockfile && bun run lint && bun test && pnpm build`

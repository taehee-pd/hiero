# Coniva — Next Phases Plan

**Created:** 2026-04-02
**Context:** Platform pivot — Coniva targets server-side embedding (Storybook, Sanity, custom toolchains) rather than standalone desktop distribution.

---

## 0. Codex Recommendation Audit

The Codex review recommended five next steps. Here is the audit against actual codebase state:

| Codex Recommendation | Verdict | Rationale |
|---|---|---|
| G5 — Finish desktop distribution | **REJECTED** | Platform pivot eliminates desktop. Electrobun integration will be fully removed. |
| G7 — Accessibility pass | **ACCEPTED** | Correct — ~30 audit issues remain. Critical for enterprise embedding targets (Storybook, Sanity). |
| UX flow gaps (state/transition authoring) | **ACCEPTED** | UX-1.4 and UX-1.5 are real blockers — no way to create states or add transitions from the main authoring surfaces. |
| Replace `prompt()` dialogs | **ACCEPTED** | UX-2.3, UX-2.7, UX-4.3 all use browser `prompt()` for destructive actions. Must fix. |
| Release readiness / CI stabilization | **ACCEPTED with changes** | Still valid, but scope changes: remove desktop CI workflow, simplify to web-only verification. |

**Key gap the Codex review missed:** G1 (Web Persistence) is marked CRITICAL in `PLAN.md` — all work lost on page refresh. With desktop removed, this becomes the single most important gap since there is no longer a filesystem save path at all.

---

## Phase R1 — Electrobun / Desktop Removal (Clean)

**Priority:** Immediate (prerequisite for all other phases)
**Backward compatibility:** None required per product decision

### Scope

Remove all Electrobun, desktop shell, and native platform bridge code. Coniva becomes a pure Next.js web application deployable as a server-side tool.

### Files to delete

```
desktop/                               # Entire Electrobun app directory
  src/bun/index.ts                     # Main Electrobun process
  src/bun/context-menus.ts             # Native context menus
  src/bun/recent-projects.ts           # Filesystem recent projects
  src/mainview/index.ts                # Webview bridge setup
  src/shared/rpc-types.ts              # RPC schema
  src/shared/naming.ts                 # Desktop naming constants
  electrobun.config.ts                 # Electrobun build config
  package.json                         # Desktop-specific deps
  tsconfig.json
  pnpm-lock.yaml
  SIGNING.md
  scripts/                             # All desktop build/release scripts
  .generated/                          # Next.js static export
  .electrobun/                         # Build cache

components/platform/DesktopCommandBridge.tsx   # 713-line desktop integration
components/platform/TitleTabBar.tsx            # macOS-style title bar

lib/platform/bridge.ts                 # 586-line dual-mode platform bridge
lib/platform/keychain.ts               # OS keychain abstraction
lib/persistence/filesystem-adapter.ts  # Desktop filesystem adapter

tests/desktop-release-manifest.test.ts # Desktop release tests
tests/desktop-release-checks.test.ts

.github/workflows/desktop-ci.yml      # Desktop CI workflow
scripts/start-desktop-dev.sh           # Desktop dev launcher
```

### Files to modify

| File | Change |
|---|---|
| `app/layout.tsx` | Remove `<DesktopCommandBridge />` import and render |
| `lib/persistence/use-persistence.ts` | Remove `isDesktop()` check in `useAutoSave()` — always use IndexedDB path |
| `components/explorer/ExplorerShell.tsx` | Remove `isDesktop`, `showNativeContextMenu`, `TitleTabBar` imports; replace native context menus with Radix `ContextMenu` |
| `components/editor/EditorShell.tsx` | Remove `isDesktop`, `saveProject` (desktop path), `TitleTabBar`; keep web-only save/export logic |
| `components/editor/Toolbar.tsx` | Remove `openProject`, `saveProject` desktop imports; simplify to web-only export (Blob download) |
| `components/editor/Canvas.tsx` | Remove `showNativeContextMenu`; use Radix `ContextMenu` |
| `components/editor/LayerPanel.tsx` | Remove `showNativeContextMenu`; use Radix `ContextMenu` |
| `components/export/SyncTargetPanel.tsx` | Remove `isDesktop()` check and keychain dynamic import; npm token via server-side env only |
| `lib/editor-core/keyboard.ts` | Remove `isDesktop()` conditional that excludes native menu shortcuts |
| `package.json` | Remove `desktop:dev`, `desktop:build`, `desktop:dist` scripts; remove `desktop-ci.yml` from format targets |
| `biome.json` | Remove `desktop/` exclusion patterns |

### What replaces desktop-only features

| Desktop feature | Web replacement |
|---|---|
| File save/open (Electrobun RPC) | IndexedDB persistence (G1) + browser download for export |
| OS keychain (npm tokens) | Server-side env vars (`process.env.NPM_TOKEN`) — already supported via `/api/publish-npm` |
| Native context menus | Radix UI `ContextMenu` (already a dependency) |
| Window title sync | `document.title` update (trivial) |
| Auto-update | N/A — web app is always latest |
| File associations (`.coniva.json`) | N/A — import via UI |

### Validation

- `bun test` — all remaining tests pass (desktop tests deleted)
- `pnpm build` — production build succeeds
- `pnpm lint` — zero errors
- No remaining imports from `desktop/`, no references to `electrobun`, `__electrobunBunBridge`, or `isDesktop`

---

## Phase R2 — Web Persistence Completion (G1)

**Priority:** Critical — with desktop removal, zero persistence exists
**Status:** Partially implemented (IndexedDB adapter exists, auto-save hook exists)
**Dependency:** R1 (desktop removal simplifies persistence to single path)

### Current state

- `lib/persistence/adapter.ts` — interface exists
- `lib/persistence/indexeddb-adapter.ts` — implementation exists
- `lib/persistence/persistence-manager.ts` — manager exists
- `lib/persistence/use-persistence.ts` — auto-save hook exists but has desktop bypass
- `components/persistence/AutoSaveProvider.tsx` — mounted in layout

### Remaining work

1. **Remove desktop bypass** in `useAutoSave()` — after R1, `isDesktop()` is gone; IndexedDB is the only path
2. **Verify roundtrip** — create project, edit, refresh, confirm data persists
3. **Storage quota handling** — quota error toast already implemented; verify it fires correctly
4. **Explorer integration audit** — ensure `useProjectList()` correctly loads from IndexedDB on mount
5. **Test coverage** — add/verify `tests/persistence-adapter.test.ts` covers create/load/list/delete/rename

### Validation

- Create new project → add icons → refresh page → project still present
- Storage quota error → user sees toast with guidance
- Explorer shows all saved projects with correct timestamps

---

## Phase R3 — Critical UX Flow Gaps (UX Audit Phase 1 + 4)

**Priority:** High — blocks core authoring workflows
**Dependency:** None

### UX-1.4 — State management UI

**Problem:** Icons support multiple states (default, active, hover) but no UI to create/rename/duplicate/delete states from the editor.

**Solution:** Add "States" section to left panel in `EditorShell.tsx`:
- List current states with active indicator
- "+ New State" button (creates with default name, inline rename)
- Right-click context menu: Rename, Duplicate, Delete (with confirmation)
- Click to switch active editing state

### UX-1.5 — Transition creation from Animation Studio

**Problem:** Animation Studio dropdown shows existing transitions but has no "Add Transition" affordance.

**Solution:** Add "+ New Transition" button in `AnimationStudioPanel.tsx` below the transition dropdown. Opens inline form with source state, target state, and duration fields.

### UX-4.1 / UX-4.2 — Deletion confirmations

**Problem:** Variant and transition deletion happens with no confirmation.

**Solution:** Use Radix `AlertDialog` for both. Show item name and note about undo availability.

### UX-4.3 — Project deletion safety

**Problem:** Project deletion uses `prompt('Type "delete"')` with no safety checks.

**Solution:** Proper `AlertDialog` showing project name, icon count, and sync target info. For projects with >0 icons, require typing project name to confirm.

### Files to change

- `components/editor/EditorShell.tsx` — state management panel
- `components/editor/AnimationStudioPanel.tsx` — transition creation
- `components/explorer/ExplorerShell.tsx` — project deletion dialog
- `components/editor/TransitionPanel.tsx` — deletion confirmation

---

## Phase R4 — Replace `prompt()` Dialogs

**Priority:** Medium-high — polish and error prevention
**Dependency:** None (can parallel with R3)

### Scope

Replace all remaining `prompt()` and `confirm()` calls with proper Radix UI dialogs.

| Location | Current UX | Target UX |
|---|---|---|
| `ExplorerShell.tsx` — project context actions | `prompt("Type rename or delete")` | `DropdownMenu` with Rename (inline edit) and Delete (AlertDialog) |
| `ExplorerShell.tsx` — collection management | `prompt()` for rename | Inline editable text field |
| Timeline keyframe edits (UX-2.7) | `prompt()` for value input | Inline numeric field or popover with validation |

### Components to use

- `@radix-ui/react-dropdown-menu` (already installed)
- `@radix-ui/react-alert-dialog` (already installed)
- `@radix-ui/react-context-menu` (already installed)
- Inline editable text: controlled `<Input>` with Enter/Escape handling

---

## Phase R5 — Accessibility (G7)

**Priority:** High — blocks enterprise adoption (Storybook, Sanity environments have a11y requirements)
**Dependency:** Best after R3/R4 to avoid rework on changed UI

### Key issues from audit backlog

1. **Timeline editor** — add `role="toolbar"`, `aria-label` on transport controls and keyframe tracks
2. **Animation studio controls** — `aria-label` on all icon buttons, `aria-pressed` on toggles
3. **Focus management** — remove `all: 'unset'` CSS resets that kill focus rings; ensure `focus-visible:ring-2` on all interactive elements
4. **Warning/status regions** — replace inline styles with Tailwind, add `role="alert"` and `aria-live="polite"` where appropriate
5. **Layer panel** — keyboard navigation for layer reorder (already partially done)
6. **Canvas** — accessible name for the SVG canvas area

### Validation

- Tab through entire editor flow — all interactive elements reachable
- Screen reader announces all controls, states, and live regions
- No focus traps; Escape always closes modals/panels

---

## Phase R6 — Navigation & Discoverability (UX Audit Phase 2 + 3)

**Priority:** Medium
**Dependency:** R3 (state management UI should exist first)

### UX-2.2 — Consistent breadcrumb navigation

Implement unified breadcrumb: `Workspace > Project > Icon` across editor and explorer.

### UX-2.5 — Keyboard shortcuts reference

Add shortcut hints to tooltips. `?` key opens shortcuts cheat sheet dialog.

### UX-2.6 — Icon search in editor

Add `Cmd+K` command palette or searchable dropdown for switching between icons without returning to explorer.

### UX-3.2 / UX-3.3 / UX-3.4 — Empty state guidance

- Editor empty state: add "Import existing SVG" CTA
- Animation Studio "No transitions": add inline guidance linking to state management
- Layer panel "No layers": add contextual tips ("Use Pen tool (P), Shape tool (R), or drag SVG")

---

## Phase R7 — Server-Side Embedding Readiness

**Priority:** Medium — aligns with platform pivot
**Dependency:** R1 (desktop removal), R2 (web persistence)

### Scope

Ensure Coniva works cleanly when embedded in server-side tool environments.

### Work items

1. **Storybook addon compatibility** — verify `ConivaIcon` React component works in Storybook without editor dependencies; ensure tree-shaking separates runtime from editor
2. **Headless export API** — expose icon compilation as a programmatic API (`lib/export/`) that can run in Node.js without browser APIs
3. **CSP compatibility** — audit for `eval()`, inline styles via `style=` attribute, and other CSP-violating patterns; replace with Tailwind/CSS classes
4. **iframe embedding** — verify editor works in iframe with appropriate `postMessage` communication for host integration
5. **Configuration injection** — support reading config (theme, allowed tools, export targets) from host environment via props or env vars

### Validation

- `ConivaIcon` renders correctly in a fresh Storybook project
- `lib/export/` functions execute in Node.js without DOM dependencies
- Editor loads in an iframe without errors

---

## Execution Summary

| Phase | Scope | Est. Size | Dependency |
|---|---|---|---|
| **R1** | Desktop/Electrobun removal | Large (35+ files) | None |
| **R2** | Web persistence completion | Small (verify + test) | R1 |
| **R3** | Critical UX flow gaps | Medium | None |
| **R4** | Replace `prompt()` dialogs | Small-Medium | None |
| **R5** | Accessibility pass | Medium | R3, R4 |
| **R6** | Navigation & discoverability | Medium | R3 |
| **R7** | Server-side embedding readiness | Medium | R1, R2 |

### Recommended execution order

```
Week 1:  R1 (desktop removal) + R3 (UX flow gaps) — in parallel
Week 2:  R2 (persistence verify) + R4 (prompt replacement) — in parallel
Week 3:  R5 (accessibility) + R6 (navigation)
Week 4:  R7 (embedding readiness)
```

### CI changes after R1

- Delete `.github/workflows/desktop-ci.yml`
- Remove `desktop-ci.yml` from Prettier format targets in `package.json`
- Remaining CI: `web-app-ci.yml`, `icons-pr-validate.yml`, `icons-post-merge-build.yml`, `icons-package-release.yml`
- Gate: `bun install --frozen-lockfile && bun run lint && bun test && pnpm build`

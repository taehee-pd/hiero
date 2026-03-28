# Coniva — Production Readiness Plan

**Last updated:** 2026-03-28
**Standard:** "If you are coding for another project, would you recommend your team use this tool?"
**Focus:** Technical implementation — design deliverables listed in §7 IA for the designer.

---

## 1. Product Assessment

Coniva is an icon authoring tool with animation capabilities comparable to SF Symbols.
The **authoring engine is mature** — 23 shipped phases cover vector editing, 14 animation
track types, morph/trim/crossfade transitions, derived variants, weight interpolation,
and cross-icon morphing. The **export backend is complete** — Lottie, Runtime JSON, SVG,
React/Swift/Flutter adapters, and npm registry publishing all have working implementations.

**The product is not yet recommendable** because of these gaps:

| # | Gap | Why it blocks recommendation |
|---|-----|------------------------------|
| G5 | Desktop distribution not fully operationalized | Release path is hardened, but signed distribution still depends on credentials and release hosting |
| G7 | Accessibility debt | Import flow and touched surfaces improved, but the broader audit backlog remains |

### What IS working well (keep as strengths)

- Full vector path editor with pen, shape tools, snap engine, guide masters
- 14 animation track types with timeline editor, easing picker, keyframe editing
- Cross-icon morphing with 3-pass strategy selection (strict → bestGuess → crossIcon → fallback)
- Derived variant generation (fill/slash/circle/square/badge) via Paper.js booleans
- 4 import adapters (Lucide, Heroicons, Phosphor, Material Symbols) with batch import
- Export adapters for React, Swift, Flutter with downgrade rules
- Sync pipeline: Git PR connector with conflict detection, diff engine, CI validation
- NPM registry connector with dry-run, keychain token storage, web proxy
- 101 test files covering runtime, export, import, sync, editor, schema
- Desktop shell (Electrobun) with native menus, file I/O, keychain, RPC bridge
- CI/CD: 5 GitHub Actions workflows (web, desktop, icon validation, post-merge, package release)

---

## 2. Gap Analysis & Technical Plan

### G1 — Web Persistence (Critical)

**Problem:** The Zustand editor store is in-memory only. On page refresh, all work is lost.
Desktop users can save to disk via the Electrobun bridge, but web users have zero persistence.

**Why it matters:** No developer will recommend a tool where work disappears on refresh.

**Technical plan:**

**Step 1 — Persistence adapter interface** *(eng review decision: keep adapter for future-proofing)*
Create `lib/persistence/adapter.ts`:
```ts
interface PersistenceAdapter {
  list(): Promise<ProjectMeta[]>
  load(id: string): Promise<Project | Workspace>
  save(id: string, data: Project | Workspace): Promise<void>
  delete(id: string): Promise<void>
}
```
Implementations: `IndexedDBAdapter` (web), `FileSystemAdapter` (desktop via bridge).
Wire into `lib/editor-store/store.ts` — the store calls `adapter.save()` on commit.

**Step 2 — IndexedDB project storage**
Add `lib/persistence/indexeddb-adapter.ts`:
- Use `idb` (lightweight IndexedDB wrapper, ~1KB gzipped) or raw IndexedDB API
- Store schema: `{ id: string, name: string, data: Project | Workspace, updatedAt: number }`
- Auto-save on every `commit()` action (debounced 500ms)
- Load on app mount: check IndexedDB before showing empty state

**Step 3 — Explorer integration**
`ExplorerShell.tsx` reads from persistence adapter on mount.
Show "Recent Projects" with timestamps, rename, delete actions.
"Open Project" file picker for desktop; "New Project" creates in IndexedDB.

**Files to create:**
- `lib/persistence/adapter.ts` — interface
- `lib/persistence/indexeddb-adapter.ts` — web implementation
- `lib/persistence/filesystem-adapter.ts` — desktop wrapper (calls existing bridge)

**Files to change:**
- `lib/editor-store/store.ts` — add persistence adapter injection + auto-save
- `components/explorer/ExplorerShell.tsx` — load from adapter, show recent projects
- `app/page.tsx` — initialize persistence adapter on mount

**Dependencies:** None. Can be implemented independently.

**Tests:**
- `tests/persistence-adapter.test.ts` — adapter contract and workspace roundtrip coverage
- `tests/persistence-adapter.test.ts` — contract tests for adapter interface

---

### G2 — Export UI Wiring (Shipped)

Status: shipped 2026-03-28 — `LottieExportPanel` is mounted from the editor toolbar, `SyncTargetPanel` is mounted in the explorer project view, and export/publish entry points are available in the UI.

**Problem:** `LottieExportPanel.tsx` and `SyncTargetPanel.tsx` are fully built React
components sitting in `components/export/` but imported nowhere. Users cannot access
Lottie export or delivery target configuration.

**Why it matters:** The backend can export to Lottie and publish to npm, but users
can't trigger any of it from the UI.

**Technical plan:**

**Step 1 — Mount Lottie export as modal dialog from Toolbar** *(eng review: modal over sidebar tab)*
In `components/editor/Toolbar.tsx`:
- Add "Export Lottie JSON" to export dropdown menu (~line 414)
- On click: open `LottieExportPanel` in a `Sheet` dialog (ephemeral, focused UX)
- Enable `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED=true` in `.env.local`
- No sidebar tab needed — export is a point-in-time action, not persistent workspace

**Step 3 — Mount SyncTargetPanel in Explorer**
In `components/explorer/ExplorerShell.tsx`:
- Add "Delivery Targets" section in project view (below icon grid or in sidebar)
- Import and render `SyncTargetPanel` with project-level sync targets
- Wire `useEditorActions()` for CRUD operations

**Step 3 — Wire store actions for sync targets** *(eng review: extract to sync slice)*
Create `lib/editor-store/sync-store.ts` as a Zustand slice:
```ts
addSyncTarget(target: SyncTarget): void
updateSyncTarget(id: string, patch: Partial<SyncTarget>): void
removeSyncTarget(id: string): void
executeSyncTarget(id: string): Promise<void>
```
Compose with main store via Zustand slicing. Keeps sync/publish domain
separate from the 91-action editing store.

**Step 5 — Platform-specific form fields in SyncTargetPanel**
In `components/export/SyncTargetPanel.tsx`:
- Conditionally render fields based on `target.platform`:
  - `swift`: Min iOS version dropdown (15/16/17), SwiftUI vs UIKit toggle
  - `flutter`: Min Flutter SDK text, Dart package name text
  - `web-component`: Custom element prefix, Shadow DOM toggle
  - `react`: TypeScript toggle (existing runtime package field sufficient)

**Files to change:**
- `components/editor/EditorShell.tsx` — add Export tab, import LottieExportPanel
- `components/editor/Toolbar.tsx` — add Lottie menu item + Sheet trigger
- `components/explorer/ExplorerShell.tsx` — mount SyncTargetPanel
- `components/export/SyncTargetPanel.tsx` — platform-specific fields, wire actions
- `lib/editor-store/store.ts` — sync target CRUD + execute actions
- `.env.local` — enable Lottie preview flag

**Dependencies:** None. All components already exist.

---

### G3 — Figma Import (Shipped)

Status: shipped 2026-03-28 — Coniva now supports a local `Export to Coniva` Figma plugin workflow plus the existing Figma proxy route.

**Problem:** No Figma adapter exists. Most icon designers work in Figma, and the
import dialog offers Lucide/Heroicons/Phosphor/Material but not Figma.

**Why it matters:** Teams with Figma-based icon design workflows can't bring their
icons into Coniva without manual SVG export. This is the #1 friction point for adoption.

**Technical plan:**

**Step 1 — Create `figma-adapter.ts`**
File: `lib/import/adapters/figma-adapter.ts`

Implement `ExternalIconAdapter` interface (same pattern as heroicons-adapter):
```ts
export const figmaAdapter: ExternalIconAdapter = {
  descriptor: {
    id: 'figma',
    name: 'Figma',
    capabilities: { searchable: true, inputModes: ['search', 'url'] },
    sourceType: 'figma-file'
  },
  async search(query, options) {
    // GET /v1/files/:fileKey/components — filter by name
    // Return ExternalIconSearchResult[] with thumbnail URLs
  },
  async importById(id, options) {
    // GET /v1/images/:fileKey?ids=:nodeId&format=svg&svg_include_id=true
    // Return { intermediate: { kind: 'svg-source', svgContent }, provenance, warnings }
  }
}
```

**Step 2 — Figma API proxy route** *(eng review: per-user tokens, not server-side)*
File: `app/api/import/figma/route.ts`

Server-side proxy for Figma REST API. Unlike GitHub/npm (org-level tokens),
Figma PATs are per-user — each designer accesses their own files:
- Desktop: token stored in platform keychain via `lib/platform/keychain.ts`
- Web: token passed per-request from client (stored in session/localStorage)
- Proxy forwards token in `Authorization: Bearer` header to Figma API
- Endpoints: `GET /api/import/figma/components?fileKey=X&query=Y`
- Endpoints: `GET /api/import/figma/svg?fileKey=X&nodeId=Y`

**Step 3 — Figma connection UI in ImportIconDialog**
In `components/editor/ImportIconDialog.tsx`:
- Add "Figma" tab to source selector
- Connection card: File URL input + token input + Connect button
- Parse fileKey from URL: `figma.com/design/:fileKey/:fileName`
- Validate token by calling `GET /v1/me`
- Connected state: show file name, component count
- Search + filter by page/frame
- Multi-select icon picker grid with SVG thumbnails
- Import settings: size (24/32/48), naming (keep/kebab-case)

**Step 4 — Register adapter**
In `lib/import/adapters/index.ts`: add `figmaAdapter` to `registerBuiltinAdapters()`

**Files to create:**
- `lib/import/adapters/figma-adapter.ts`
- `lib/import/adapters/figma-source.ts` (Figma API client)
- `app/api/import/figma/route.ts`

**Files to change:**
- `lib/import/adapters/index.ts` — register figma adapter
- `components/editor/ImportIconDialog.tsx` — Figma tab + connection UI

**Tests:**
- `tests/adapter-figma.test.ts` — mock Figma API responses, verify SVG extraction

**Dependencies:** None. Adapter SDK interface is ready.

---

### G4 — NPM Publish UX Completion (Shipped)

Status: shipped 2026-03-28 — semver controls, preview publish, immediate manual publish, save-triggered countdown scheduling, cancellation, and published-version tracking are wired in the current UI/store flow.

**Problem:** `npm-connector.ts` works, but the editor has no version management UI
(Q3) and no auto-publish countdown/cancel UI (Q4).

**Why it matters:** Publishing broken icons to a public registry with no cancel
mechanism is dangerous. Without version controls, users can't bump semver intentionally.

**Technical plan:**

**Step 1 — Version management UI**
In `components/export/SyncTargetPanel.tsx`, for npm-registry targets:
- Show last published version from `target.npmRegistry.lastPublishedVersion`
- "Bump version" segmented control: Patch / Minor / Major
- Changelog textarea (optional, auto-populated from `diffCompiledIcons()`)
- "Publish now" button

**Step 2 — Auto-publish countdown state**
In `lib/editor-store/store.ts`:
```ts
pendingPublish: {
  targetId: string;
  scheduledAt: number;  // unix ms
  semver: 'patch' | 'minor';
} | null
cancelPendingPublish(): void
```
On save (when `autoPublish.on === 'save'`), set `pendingPublish`.
After countdown expires, call `npm-connector.push()`.
Wire `lib/sync-service/auto-publish.ts` to consume this state.

**Step 3 — Countdown badge**
In `components/explorer/ExplorerShell.tsx` header:
- When `pendingPublish` is set, render persistent badge
- "Publishing in 5:00 · Cancel" with live countdown
- Cancel calls `cancelPendingPublish()` in store

**Step 4 — npm token setup flow**
First-time: prompt for npm token, store via `lib/platform/keychain.ts`.
Show "Token stored ✓" / "No token" state in target card.
Desktop: OS keychain. Web: server-side env var.

**Files to change:**
- `components/export/SyncTargetPanel.tsx` — version section, token input
- `lib/editor-store/store.ts` — pendingPublish state + cancelPendingPublish
- `components/explorer/ExplorerShell.tsx` — countdown badge
- `lib/sync-service/auto-publish.ts` — consume pendingPublish state

**Dependencies:** G2 (SyncTargetPanel must be mounted first).

---

### G5 — Desktop Distribution (Partially shipped)

Status: partially shipped 2026-03-28 — signing prerequisites, release command ergonomics, and manifest/artifact checks are hardened in-repo, but producing a real signed installer still depends on external credentials and release hosting.

**Problem:** The desktop app builds successfully in dev mode
(`desktop/build/dev-macos-arm64/Coniva-dev.app`) but no signed, distributable
installer exists. Auto-update infrastructure is configured but untested.

**Why it matters:** Desktop is the only path to file-based persistence today.
Without a downloadable installer, users can't save their work.

**Technical plan:**

**Step 1 — Code signing setup**
- Obtain Apple Developer Team ID + certificate
- Configure `ELECTROBUN_BUILD_ENV=stable` for production builds
- Set signing identity in `desktop/electrobun.config.ts`
- Test notarization flow end-to-end

**Step 2 — Build production installer**
```bash
pnpm desktop:dist
```
- Verify `desktop/artifacts/latest.json` schema via `validate-latest-json.ts`
- Verify `.app` bundle launches clean on fresh macOS install
- Test file association (`.coniva.json` double-click opens app)

**Step 3 — Auto-update endpoint**
- Host `latest.json` at `CONIVA_RELEASE_BASE_URL`
- Verify Electrobun update check + download flow
- Test upgrade path from dev → stable

**Step 4 — Distribution channel**
- GitHub Releases (attach .dmg or .zip to release)
- Landing page download link
- `desktop/SIGNING.md` documents the full process

**Files to change:**
- `desktop/electrobun.config.ts` — signing identity
- `desktop/scripts/release.ts` — verify production flow
- CI: add release workflow for tagged builds

**Dependencies:** Apple Developer account required.

---

### G6 — Consumer Documentation (Shipped)

Status: shipped 2026-03-28 — React, Swift, Flutter, and Figma plugin workflow guides are now present in `docs/guides/`.

**Problem:** A developer installing the published icon package has no guide for
integrating `ConivaIcon` into their React/Swift/Flutter app.

**Why it matters:** Without integration docs, the published package is a black box.

**Technical plan:**

**Step 1 — React integration guide**
Create `docs/guides/react-integration.md`:
- Install: `npm install @your-scope/icons`
- Import: `import { ConivaIcon } from '@your-scope/icons/react'`
- Basic usage: `<ConivaIcon name="home" />`
- State transitions: `<ConivaIcon name="home" state="active" />`
- Animation control: `useIconState()`, `useAnimationProgress()` hooks
- Imperative API: `ref.current.setState('active')`
- Variable value: `<ConivaIcon name="wifi" variableValue={0.75} />`
- TypeScript: exported types, prop interfaces

**Step 2 — Swift integration guide**
Create `docs/guides/swift-integration.md`:
- SPM package, SwiftUI view, UIKit adapter
- State enum, animation triggers

**Step 3 — Flutter integration guide**
Create `docs/guides/flutter-integration.md`:
- pub.dev package, widget API, animation control

**Step 4 — Auto-generate README in published package**
In `lib/export/compile-pipeline.ts`:
- Generate `README.md` in compiled output with icon list + basic usage
- Include in `package.json` `files` array

**Files to create:**
- `docs/guides/react-integration.md`
- `docs/guides/swift-integration.md`
- `docs/guides/flutter-integration.md`

**Files to change:**
- `lib/export/compile-pipeline.ts` — generate README in package

**Dependencies:** None.

---

### G7 — Accessibility Debt (Ongoing)

Status: partially shipped 2026-03-28 — import-flow labels, status regions, alerts, and batch-import messaging were improved in this slice, but the full audit backlog is still open.

**Problem:** UX audit (see `UX_AUDIT_PHASE2.md`) found ~30 accessibility issues:
no ARIA landmarks on timeline editor, no accessible names on animation controls,
inline styles bypassing design system, missing focus rings.

**Why it matters:** Professional tools must be accessible. Blocks enterprise adoption.

**Technical plan:** Address in dedicated accessibility pass. Key areas:
1. Timeline editor: `role="toolbar"`, `aria-label` on transport + keyframes
2. Animation studio: `aria-label` on all buttons, `aria-pressed` on toggles
3. GeometryChangeWarning + MorphReadinessIndicator: replace inline styles with
   Tailwind classes, add `role="alert"`, `aria-live="polite"`
4. Focus management: remove `all: 'unset'` from buttons, ensure visible focus rings

**Reference:** `docs_canonical/UX_AUDIT_PHASE2.md` (full issue catalog with file locations)

**Dependencies:** None, but should be done after G2 (export UI wiring) to avoid rework.

---

## 3. Implementation Priority & Dependencies

```
                    ┌─────────┐
                    │   G1    │  Web Persistence
                    │Critical │  (IndexedDB + adapter)
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │   G2    │ │   G3    │ │   G5    │
         │ Export  │ │ Figma   │ │Desktop  │
         │ UI Wire│ │ Import  │ │ Distro  │
         └────┬────┘ └─────────┘ └─────────┘
              │
              ▼
         ┌─────────┐
         │   G4    │  NPM Publish UX
         │ Version │  (depends on G2 mount)
         │ + Auto  │
         └─────────┘

         ┌─────────┐  ┌─────────┐
         │   G6    │  │   G7    │  Independent
         │Consumer │  │  A11y   │  (any time)
         │  Docs   │  │  Fixes  │
         └─────────┘  └─────────┘
```

**Recommended order:**
1. **G5** (desktop distro) — finish signed distribution and hosted release path
2. **G7** (accessibility) — continue the broader audit-driven pass

---

## 4. What's Already Shipped (No Gaps)

These features are fully implemented and wired into the UI:

| Area | Status | Key Files |
|------|--------|-----------|
| Vector path editor (pen, shapes, snap, guides) | Complete | `lib/editor-core/`, `Canvas.tsx` |
| Layer management (reorder, visibility, lock, keyboard nav) | Complete | `LayerPanel.tsx` |
| State management (add, duplicate, rename, delete) | Complete | `store.ts` |
| Variant system (base + derived + weight) | Complete | `InspectorPanel.tsx` |
| Transition authoring (14 track types, timeline, easing) | Complete | `TimelineEditor.tsx` |
| Animation studio (presets, effects, speed, loop) | Complete | `AnimationStudioPanel.tsx` |
| Morph readiness + geometry warnings | Complete | `MorphReadinessIndicator.tsx` |
| Cross-icon transitions | Complete | `TransitionPanel.tsx` |
| Import from icon libraries (4 adapters) | Complete | `ImportIconDialog.tsx` |
| Git PR sync + conflict detection | Complete | `GitHubSyncPanel.tsx` |
| Runtime React component (`ConivaIcon`) | Complete | `lib/runtime-react/` |
| Lottie export engine | Complete | `lib/export/export-lottie.ts` |
| NPM publish backend | Complete | `lib/sync-service/connectors/npm-connector.ts` |
| CI/CD (5 workflows) | Complete | `.github/workflows/` |
| Desktop shell (dev mode) | Complete | `desktop/` |

---

## 5. Phase Status Reconciliation

This section reconciles TASKS.md phase statuses with actual codebase state:

| Phase | TASKS.md Says | Reality | Action |
|-------|--------------|---------|--------|
| M (Lottie) | Partially shipped | Engine and mounted export UI complete | None |
| N (Derived Variants) | Shipped | Fully shipped and wired | None |
| O (Weight Interp) | Shipped | Engine + 9-point editor + WeightCurveEditor are wired | None |
| P (Import Ecosystem) | Shipped with deviations | 4 adapters working, batch import works, Figma plugin handoff shipped | None |
| Q (NPM Registry) | Shipped | Backend and current UI flow are complete | None |
| I–L (Animation/Inspect) | Completed | Fully shipped and wired | None |

**Remaining open tasks from TASKS.md:**
- None. Forward-looking product work is now tracked as G5 and the remaining G7 accessibility backlog.

---

## 6. Technical Architecture for New Work

### Persistence Layer (G1)

```
┌─────────────────────┐
│   Editor Store      │
│   (Zustand)         │
│                     │
│   commit() ─────────┼──► PersistenceAdapter.save()
│   loadProject() ◄───┼──── PersistenceAdapter.load()
└─────────────────────┘
         │
         ├── IndexedDBAdapter (web)
         │     └── idb: projects table
         │         { id, name, data, updatedAt }
         │
         └── FileSystemAdapter (desktop)
               └── Electrobun bridge: readFile/writeFile
```

### Export UI Architecture (G2) *(eng review: modal dialog, not sidebar tab)*

```
Toolbar
├── Export Dropdown (existing)
│   ├── Download SVG (existing)
│   ├── "Export Lottie JSON" (NEW) → opens Sheet dialog
│   │   └── LottieExportPanel (existing component, just mount in Sheet)
│   ├── Export Runtime JSON (existing)
│   └── Copy React component (existing)
│
ExplorerShell
├── Project View
│   ├── Icon Grid (existing)
│   └── Delivery Targets section (NEW)
│       └── SyncTargetPanel (existing component, just mount)
```

### Figma Import Data Flow (G3)

```
User pastes Figma URL
  │
  ▼
ImportIconDialog → parse fileKey from URL
  │
  ▼
GET /api/import/figma/components?fileKey=X
  │ (proxy: per-user token from keychain/session → Figma REST API)
  ▼
Show component grid with SVG thumbnails
  │
  ▼
User selects icons → "Import"
  │
  ▼
GET /api/import/figma/svg?fileKey=X&nodeId=Y (per icon)
  │
  ▼
figmaAdapter.importById() → raw SVG
  │
  ▼
sanitizeSvg() → normalizeSvg() → convertNormalizedIconToIcon()
  │
  ▼
store.insertIcon(icon)
```

---

## 7. Information Architecture (Full Product)

This is the complete IA covering ALL screens — existing and new.
Items marked **[NEW]** need design. Items marked **[WIRE]** exist in code but need mounting.

```
Coniva App
│
├── Explorer Surface (/)
│   │
│   ├── Workspace Header
│   │   ├── Workspace name
│   │   ├── Settings gear
│   │   └── [NEW] Publish countdown badge (G4)
│   │
│   ├── Project List
│   │   ├── Project card (name, icon count, last edited, preview grid)
│   │   ├── [NEW] "Recent Projects" from IndexedDB/filesystem (G1)
│   │   └── Create / Open project CTAs
│   │
│   ├── Project View (after selecting project)
│   │   │
│   │   ├── Project Header
│   │   │   ├── Breadcrumb (Workspace > Project)
│   │   │   ├── Project name (editable)
│   │   │   └── [NEW] Publish countdown badge (G4)
│   │   │
│   │   ├── Icon Grid
│   │   │   ├── Icon card (preview, name, variant pill, state count)
│   │   │   ├── Click → open in Editor
│   │   │   └── Context menu (duplicate, rename, delete, favorite)
│   │   │
│   │   ├── Import Panel (existing in ImportIconDialog)
│   │   │   ├── Source tabs: Lucide, Heroicons, Phosphor, Material
│   │   │   ├── [NEW] Figma source tab (G3)
│   │   │   │   ├── [NEW] D-FIG-1: Connection card (URL + token + Connect)
│   │   │   │   ├── [NEW] D-FIG-2: Connected state (file info, component count)
│   │   │   │   ├── [NEW] D-FIG-3: Icon picker (search, page filter, grid, multi-select)
│   │   │   │   ├── [NEW] D-FIG-4: Import settings sheet (size, naming, mode)
│   │   │   │   └── [NEW] D-FIG-5: Import progress + result summary
│   │   │   ├── Raw SVG upload
│   │   │   ├── Search + filter
│   │   │   ├── Batch import (checkboxes, progress)
│   │   │   └── Capability badges per adapter
│   │   │
│   │   ├── [WIRE] Delivery Targets Panel (G2 — SyncTargetPanel exists)
│   │   │   ├── [WIRE] D-TAR-1: Target card list
│   │   │   │   ├── Platform badge (React / Swift / Flutter / WC)
│   │   │   │   ├── Delivery mode badge (Local / Git PR / npm)
│   │   │   │   ├── Status badge (Never synced / Syncing / Synced / Error)
│   │   │   │   ├── Last synced timestamp
│   │   │   │   ├── [NEW] D-TAR-2: npm version badge + last published (G4)
│   │   │   │   ├── "Sync Now" button
│   │   │   │   └── Remove / edit target
│   │   │   │
│   │   │   ├── [WIRE] D-TAR-3: Add Target Sheet (multi-step wizard)
│   │   │   │   ├── Step 1 — Platform + delivery mode selector
│   │   │   │   ├── Step 2 — General config (target name, runtime package)
│   │   │   │   ├── [NEW] Step 3 — Platform-specific config (G2)
│   │   │   │   │   ├── [React] TypeScript toggle
│   │   │   │   │   ├── [Swift] Min iOS (15/16/17), SwiftUI vs UIKit
│   │   │   │   │   ├── [Flutter] Min SDK, Dart package name
│   │   │   │   │   └── [WC] Element prefix, Shadow DOM toggle
│   │   │   │   ├── Step 4 — Delivery config
│   │   │   │   │   ├── [Local] Output path picker
│   │   │   │   │   ├── [Git PR] Owner, repo, branch, package path
│   │   │   │   │   └── [npm] Registry URL, scope, package name, token
│   │   │   │   └── [NEW] Step 5 — Auto-publish settings (npm only, G4)
│   │   │   │       ├── Trigger: On save / Manual
│   │   │   │       └── Semver bump: Patch / Minor
│   │   │   │
│   │   │   └── [NEW] D-TAR-4: Version management popover (npm, G4)
│   │   │       ├── Last published version display
│   │   │       ├── Bump selector (Patch / Minor / Major)
│   │   │       ├── Changelog textarea
│   │   │       └── "Publish now" button
│   │   │
│   │   └── GitHub Sync Panel (existing, wired)
│   │       ├── PR preview
│   │       ├── Diff viewer (SyncDiffPreview)
│   │       └── Conflict resolution (SyncConflictPanel)
│   │
│   └── Collections View (existing)
│       ├── Collection list
│       └── Collection icon grid
│
├── Editor Surface (/editor/[iconId])
│   │
│   ├── Toolbar (existing)
│   │   ├── Back to Explorer link
│   │   ├── Tool selector (select, pen, shapes, line)
│   │   ├── Shape sub-tools (rect, ellipse, polygon, star)
│   │   ├── Boolean operations (union, subtract, intersect, exclude)
│   │   ├── Export dropdown
│   │   │   ├── Download SVG
│   │   │   ├── [NEW] "Export Lottie JSON" → opens LottieExportPanel sheet (G2)
│   │   │   ├── Export Runtime JSON
│   │   │   └── Copy React component code
│   │   ├── Undo / Redo
│   │   ├── Zoom controls + animated zoom overlay
│   │   └── "Saved X ago" badge
│   │
│   ├── Left Sidebar
│   │   │
│   │   ├── Icon List Panel (tabs for open icons)
│   │   │
│   │   ├── Layer Panel
│   │   │   ├── Layer tree (drag reorder, visibility, lock)
│   │   │   ├── Keyboard nav (↑↓ select, F2 rename, Delete remove)
│   │   │   ├── Sticky header
│   │   │   ├── Clip mask controls
│   │   │   └── Variable value dim/bright indicators per layer
│   │   │
│   │   ├── State Panel (existing)
│   │   │   ├── State list (default, active, hover, custom...)
│   │   │   ├── Add / duplicate / rename / delete state
│   │   │   └── State switcher for editing
│   │   │
│   │   └── Variant Selector
│   │       ├── Base variant
│   │       ├── Derived variants (fill, slash, circle, square, badge)
│   │       │   └── Derived badge pill
│   │       └── Weight variants (100–900 with control points)
│   │
│   ├── Canvas (center)
│   │   ├── SVG rendering surface (editor-renderer-svg)
│   │   ├── Overlay canvas (selection, guides, snap, pen preview)
│   │   ├── Grid
│   │   ├── Rulers (horizontal + vertical)
│   │   ├── Guide masters (draggable guides)
│   │   ├── Point handles (bezier in/out tangents)
│   │   ├── Point marquee selection
│   │   ├── Transition preview (morph/trim/crossfade animation)
│   │   ├── Variable value preview (opacity per layer role)
│   │   ├── Weight interpolation preview (slider-driven)
│   │   ├── Re-derive warning banner (above canvas)
│   │   └── Geometry change warning banner
│   │
│   └── Right Sidebar
│       │
│       ├── Inspect Tab (existing, fully wired)
│       │   ├── Position / size fields
│       │   ├── Fill editor (solid, gradient) + color picker
│       │   ├── Stroke editor (color, width, cap, join)
│       │   ├── Opacity / rotation
│       │   ├── Layer role assignment (primary/secondary/tertiary)
│       │   ├── Topology status (subpath count, commands, closed/open)
│       │   ├── Topology lock toggle
│       │   ├── Variable value opacity indicator
│       │   ├── Animation strategy badge (morph/trim/crossfade/preserved)
│       │   ├── Weight control point editor (9 slots: ultralight → black)
│       │   ├── Weight preview slider (100–900)
│       │   ├── Auto-gradient swatch
│       │   ├── Derive Variant section
│       │   │   ├── Available modifier buttons (fill/slash/circle/square/badge)
│       │   │   ├── isDeriving spinner
│       │   │   └── Re-derive on base change warning
│       │   └── Symbol component manager (slash/enclosure/badge)
│       │
│       ├── Animation Tab (existing, fully wired)
│       │   ├── Transition selector + "Add Transition" CTA
│       │   ├── Transition config
│       │   │   ├── Strategy (track / morph / replace)
│       │   │   ├── Direction (down-up / up-up / off-up / automatic)
│       │   │   ├── Easing picker (bezier presets + custom editor)
│       │   │   ├── Duration slider
│       │   │   └── Stagger config (delay, mode: simultaneously/individually)
│       │   ├── Layer binding list
│       │   │   ├── Strategy badge per binding (color-coded)
│       │   │   ├── Morph readiness score breakdown
│       │   │   ├── Strategy override dropdown
│       │   │   ├── "Preserve" toggle (magic replace)
│       │   │   └── Per-subpath strategy breakdown (compound paths)
│       │   ├── Cross-icon mode toggle
│       │   │   ├── Source / target icon pickers (cascading)
│       │   │   └── Layer matching visualization (role/name/geometry)
│       │   ├── Timeline Editor
│       │   │   ├── Transport (play / pause / start / end)
│       │   │   ├── Playhead scrubber
│       │   │   ├── Keyframe diamonds per track
│       │   │   ├── Track rows (14 types)
│       │   │   │   ├── Transform: translateX/Y, rotate, scale, scaleX, scaleY
│       │   │   │   ├── Trim: trimStart, trimEnd, trimOffset
│       │   │   │   ├── Style: strokeWidth, fillOpacity, strokeOpacity
│       │   │   │   └── Color: fill, stroke (with color picker keyframes)
│       │   │   ├── Smart track suggestions (categorized dropdown)
│       │   │   ├── Compound trim mode selector
│       │   │   ├── Trim path visual preview (dasharray animation)
│       │   │   ├── Stagger delay visualization (offset indicators)
│       │   │   └── Context menu (add/remove/move keyframe)
│       │   ├── Animation Studio
│       │   │   ├── Preset cards (bounce, pulse, breathe, rotate, drawOn/Off)
│       │   │   ├── Speed selector (0.25x / 0.5x / 1x / 2x / 4x)
│       │   │   ├── Loop toggle
│       │   │   ├── Custom effect builder
│       │   │   ├── Effect list (with remove)
│       │   │   └── Palette editor
│       │   ├── Morph Readiness Indicator
│       │   │   ├── Compatibility scores
│       │   │   ├── Auto-fix suggestions
│       │   │   └── Strategy switch buttons
│       │   └── Geometry Change Warning
│       │       ├── Per-subpath break details
│       │       └── Confirm / dismiss actions
│       │
│       └── (No Export tab — exports use modal dialogs from Toolbar)
│
│   ├── [WIRE] Lottie Export Dialog (G2 — modal from Toolbar dropdown)
│   │   ├── D-EXP-1: Lottie Export Panel (Sheet/Dialog)
│   │   │   ├── Variant selector
│   │   │   ├── FPS selector (24 / 30 / 60)
│   │   │   ├── Morph quality selector (low / medium / high / max)
│   │   │   ├── Downgrade diagnostics list (warnings + errors)
│   │   │   ├── [NEW] D-EXP-2: Preview canvas (lottie-web, feature-flagged)
│   │   │   └── Download .json button
│
├── Desktop Shell (Electrobun)
│   ├── Title Tab Bar (existing)
│   │   ├── Document tabs
│   │   ├── Traffic light buttons (macOS)
│   │   └── [NEW] Publish countdown badge (G4, mirrors explorer badge)
│   ├── Native menus (File, Edit, View, Help)
│   ├── Recent projects (from filesystem)
│   └── File associations (.coniva.json, .icophone.json)
│
├── Runtime Demos (existing)
│   ├── /demo/runtime
│   └── /runtime-demo
│
└── API Routes (server-side, no UI)
    ├── /api/github-sync/pr (existing)
    ├── /api/publish-npm (existing)
    ├── /api/import/lucide (existing)
    ├── /api/import/heroicons (existing)
    ├── /api/import/phosphor (existing)
    ├── /api/import/material-symbols (existing)
    └── [NEW] /api/import/figma (G3)
```

---

## 8. Design Deliverables Summary

The following screens need design work. The technical implementation is
described in §2. The IA above shows exactly where each screen lives.

| ID | Screen | Gap | Notes |
|----|--------|-----|-------|
| **D-EXP-1** | Lottie Export Dialog (modal) | G2 | Sheet/Dialog from Toolbar dropdown; contains LottieExportPanel |
| **D-EXP-2** | Lottie preview canvas | G2 | 128×128 lottie-web canvas inside Export tab |
| **D-TAR-1** | Delivery Targets panel (Explorer) | G2 | Target card list in project view |
| **D-TAR-2** | npm version badge + publish state | G4 | Badge on target card, shows version + countdown |
| **D-TAR-3** | Add Target wizard (5-step sheet) | G2 | Platform → config → platform-specific → delivery → auto-publish |
| **D-TAR-4** | Version management popover | G4 | Bump Patch/Minor/Major, changelog, publish button |
| **D-FIG-1** | Figma connection card (empty) | G3 | URL input + token input + Connect button |
| **D-FIG-2** | Figma connection card (connected) | G3 | File name, component count, Disconnect |
| **D-FIG-3** | Figma icon picker | G3 | Search, page/frame filter, thumbnail grid, multi-select |
| **D-FIG-4** | Import settings sheet | G3 | Size, naming convention, rendering mode |
| **D-FIG-5** | Import progress indicator | G3 | Progress bar + result summary |
| **D-PERS-1** | Recent projects list (Explorer) | G1 | Project cards with timestamps, loaded from IndexedDB |
| **D-PUB-1** | Publish countdown badge | G4 | "Publishing in 5:00 · Cancel" in Explorer header / title bar |

**States per screen** (for design completeness):

- **D-EXP-1**: No icon selected (empty) / Icon selected, clean / Icon with downgrade warnings / Exporting (loading) / Export complete
- **D-TAR-1**: Empty (no targets) / Has targets (various states) / Syncing (spinner)
- **D-TAR-3**: Default form / Validation error / Connection loading / Connection error / Success
- **D-FIG-1**: Empty / Loading (validating) / Error (invalid token/file) / Connected
- **D-FIG-3**: Loading / Loaded grid / No results / N items selected
- **D-FIG-4**: Default / Conflict warning (name exists)
- **D-PERS-1**: Empty (first launch) / Has projects / Loading
- **D-PUB-1**: Countdown ticking / Cancelled (dismissed)

---

## 9. Test Plan for New Work *(eng review: expanded from 6 to 26 paths)*

| Gap | Test File | Coverage |
|-----|-----------|----------|
| G1 | `tests/persistence-indexeddb.test.ts` | Save/load/list/delete, debounce 500ms, quota exceeded, concurrent save race, schema migration |
| G1 | `tests/persistence-adapter.test.ts` | Contract tests for adapter interface (list/load/save/delete) |
| G1 | Integration | commit() triggers auto-save, loadProject() reads from adapter |
| G2 | `tests/export-ui.test.tsx` | Lottie dialog opens from toolbar, panel renders, format selector, download triggers |
| G2+G4 | `tests/sync-store.test.ts` | Sync target CRUD dispatch, pendingPublish set/cancel, countdown expiry triggers publish, executeSyncTarget calls connector |
| G3 | `tests/adapter-figma.test.ts` | search() with mock API, importById() SVG extraction, auth failure handling, malformed SVG, invalid fileKey, rate limiting |
| G3 | `tests/figma-route.test.ts` | Token forwarding, invalid fileKey error, Figma API error code mapping |
| G4 | `tests/auto-publish-ui.test.ts` | Countdown state lifecycle, cancel clears timer, save-during-countdown resets, version bump UI → connector |
| G6 | Manual | Verify docs render correctly, code examples compile |

---

## 10. Environment Variables (New)

| Variable | Gap | Location | Purpose |
|----------|-----|----------|---------|
| `FIGMA_ACCESS_TOKEN` | G3 | Server env | Figma REST API authentication |
| `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED` | G2 | `.env.local` | Enable Lottie preview canvas (already defined) |

Existing variables unchanged:
- `GITHUB_SYNC_TOKEN` — GitHub PR sync (server-side)
- `NPM_PUBLISH_TOKEN` — npm registry publish (server-side)
- `CONIVA_RELEASE_BASE_URL` — desktop auto-update endpoint
- `ELECTROBUN_BUILD_ENV` — desktop build mode (stable/dev)

---

## 11. Files Reference (All Changes)

| File | Gap(s) | Action |
|------|--------|--------|
| `lib/persistence/adapter.ts` | G1 | **Create** — persistence interface |
| `lib/persistence/indexeddb-adapter.ts` | G1 | **Create** — web persistence |
| `lib/persistence/filesystem-adapter.ts` | G1 | **Create** — desktop persistence |
| `lib/editor-store/store.ts` | G1 | **Modify** — add persistence adapter injection + auto-save |
| `lib/editor-store/sync-store.ts` | G2, G4 | **Create** — sync CRUD, pendingPublish, cancelPendingPublish |
| `components/explorer/ExplorerShell.tsx` | G1, G2, G4 | **Modify** — recent projects, mount SyncTargetPanel, countdown |
| `components/editor/Toolbar.tsx` | G2 | **Modify** — add Lottie menu item |
| `components/export/SyncTargetPanel.tsx` | G2, G4 | **Modify** — platform fields, version UI |
| `lib/import/adapters/figma-adapter.ts` | G3 | **Create** |
| `lib/import/adapters/figma-source.ts` | G3 | **Create** — Figma API client |
| `app/api/import/figma/route.ts` | G3 | **Create** — Figma API proxy |
| `lib/import/adapters/index.ts` | G3 | **Modify** — register Figma adapter |
| `components/editor/ImportIconDialog.tsx` | G3 | **Modify** — Figma tab |
| `lib/sync-service/auto-publish.ts` | G4 | **Modify** — consume pendingPublish |
| `docs/guides/react-integration.md` | G6 | **Create** |
| `docs/guides/swift-integration.md` | G6 | **Create** |
| `docs/guides/flutter-integration.md` | G6 | **Create** |
| `lib/export/compile-pipeline.ts` | G6 | **Modify** — generate README in package |
| `.env.local` | G2 | **Modify** — enable Lottie preview |

---

## 12. NOT in Scope

| Item | Why deferred |
|------|-------------|
| Multi-user authentication / teams | Architecture is single-user; auth is an ocean, not a lake |
| Cloud backend / cross-device sync | Requires infrastructure beyond this plan's scope |
| Real-time collaboration | Sync pipeline is designed for single-user-at-a-time |
| O5 Weight curve editor visualization | Visual polish, not blocking any user flow |
| Web Component adapter delivery UI | WC adapter exists but has lowest demand signal |
| Landing page / marketing site | Product concern, not engineering |

## 13. What Already Exists (Reused by This Plan)

| Existing code | Reused in | Notes |
|---------------|-----------|-------|
| `LottieExportPanel.tsx` | G2 | Full panel with FPS, morph quality, diagnostics — just mount |
| `SyncTargetPanel.tsx` | G2 | CRUD UI for sync targets — just mount + add platform fields |
| `adapter-sdk/` interface | G3 | `ExternalIconAdapter` ready for Figma implementation |
| 4 adapter patterns | G3 | Heroicons/Phosphor/Material/Lucide as reference implementations |
| `npm-connector.ts` | G4 | Full publish logic — just wire to UI |
| `auto-publish.ts` | G4 | Debounce/cancel logic — just wire to store state |
| `keychain.ts` | G3, G4 | Token storage abstraction — reuse for Figma PAT |
| `lib/platform/bridge.ts` | G1, G5 | Desktop file I/O — wrap as FileSystemAdapter |
| Electrobun release scripts | G5 | `release.ts`, `validate-latest-json.ts` — just execute |
| `diffCompiledIcons()` | G4 | Changelog generation — wire to version management UI |

## 14. Failure Modes

| Codepath | Failure | Test? | Error handling? | User sees? |
|----------|---------|-------|-----------------|------------|
| IndexedDB save | Storage quota exceeded | Planned | Needs implementation | **Silent** — CRITICAL GAP, must show toast |
| IndexedDB load | Corrupted data | No | Needs implementation | **Silent** — CRITICAL GAP, must show error + offer fresh start |
| Figma API proxy | Token expired mid-session | Planned | Needs implementation | Should show re-auth prompt |
| Figma SVG fetch | Malformed SVG from Figma | Planned | sanitizeSvg() handles | Warning toast (existing pattern) |
| Auto-publish countdown | App backgrounded during countdown | No | Timer continues | Badge may be stale on return — acceptable |
| npm publish | Registry unreachable | Existing | npm-connector handles | Error badge on target card |
| Lottie export | Icon uses unsupported features | Existing | lottie-downgrade.ts | Downgrade diagnostics shown in panel |

**Critical gaps:** IndexedDB quota + corruption must have explicit error handling and user-facing messages.

---

## Superseded Documents

This plan supersedes `docs_canonical/EXPORT_GAP_PLAN.md` (narrower scope, 4 gaps only).
UX audit findings remain in `UX_AUDIT_PHASE2.md` and `UX_AUDIT_TASKS.md` as reference
material for G7 (accessibility) work.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues, 0 critical arch gaps, 2 critical failure modes (IndexedDB error handling) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**ENG REVIEW DECISIONS:**
1. G1 Persistence: Adapter interface (user chose future-proofing over minimal)
2. G3 Figma auth: Per-user tokens in keychain (not server-side env var)
3. G2 Export UI: Modal dialog from Toolbar (not sidebar tab)
4. G2+G4 Store: Extract sync slice to `sync-store.ts` (not monolith store)
5. Tests: Full 4-file test suite covering 26 code paths

**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED — ready to implement. Run `/plan-design-review` for UI/UX feedback before building design deliverables.

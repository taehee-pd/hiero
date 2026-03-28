# Export Gap Plan — Missing Parts & IA

**Scope:** Four confirmed gaps that block recommending Coniva as a sustainable icon library platform.
**Author:** Engineering
**Status:** Draft — awaiting design

---

## 1. Gap Summary

| # | Gap | Root Cause | Severity |
|---|-----|-----------|----------|
| 1 | Lottie export inaccessible from UI | `LottieExportPanel` built but never mounted | High |
| 2 | Swift / Flutter / Web Component delivery missing UI | `SyncTargetPanel` built but not mounted; no platform-specific form fields | High |
| 3 | NPM Registry delivery incomplete | Version management (Q3) and auto-publish (Q4) store state missing | Medium |
| 4 | Figma import does not exist | No adapter, no UI; `adapter-sdk` interface is ready | Medium |

---

## 2. Gap 1 — Lottie Export UI

### What's built
- `components/export/LottieExportPanel.tsx` — full panel with FPS selector, morph quality, downgrade diagnostics, download button
- `lib/export/export-lottie.ts` — complete export function
- Feature flag: `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED` for in-panel preview canvas

### What's missing
- Panel not imported or mounted anywhere
- No entry point in Toolbar dropdown or editor sidebar

### Technical plan

**Step 1 — Mount in Toolbar dropdown** (`components/editor/Toolbar.tsx`)
Add "Export Lottie JSON" item to the existing export dropdown menu (line ~414). On click, open `LottieExportPanel` in a `Sheet` or `Dialog`.

**Step 2 — Add Export tab to EditorShell right sidebar** (`components/editor/EditorShell.tsx`)
Extend `RightTab` union from `'inspect' | 'animation'` to `'inspect' | 'animation' | 'export'`.
Render `LottieExportPanel` (and other format panels) inside the new tab content region.

**Step 3 — Enable preview canvas**
Set `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED=true` in `.env.local` (already feature-flagged).

**Files to change:**
- `components/editor/Toolbar.tsx` — add menu item + sheet trigger
- `components/editor/EditorShell.tsx` — add `'export'` right tab, import + render `LottieExportPanel`
- `.env.local` — enable preview flag (optional)

---

## 3. Gap 2 — Swift / Flutter / Web Component Delivery

### What's built
- `components/export/SyncTargetPanel.tsx` — CRUD UI for sync targets; platform dropdown (react / swift / flutter / web-component), delivery mode dropdown (local-directory / git-pr / npm-registry)
- `lib/export/adapters/swift-adapter.ts` — full code generator
- `lib/export/adapters/flutter-adapter.ts` — full code generator
- `lib/schema/types.ts` — `SyncTarget` type fully defined

### What's missing
1. `SyncTargetPanel` not mounted anywhere in the UI
2. Platform-specific form fields missing — all platforms show the same generic "Runtime Package" + "Output Dir" fields; Swift/Flutter need additional options
3. Store actions for sync target CRUD (`updateSyncTargets`, `executeSync`) not wired
4. `actions._` prefix on `useEditorActions()` in `SyncTargetPanel` — imported but unused

### Technical plan

**Step 1 — Add "Delivery Targets" section to ExplorerShell**
Mount `SyncTargetPanel` in the project settings area of `ExplorerShell`. This is the correct home because sync targets are project-level, not per-icon.

**Step 2 — Add platform-specific form sections in `SyncTargetPanel`**
Conditionally render platform fields based on selected platform:

| Platform | Extra fields |
|----------|-------------|
| `swift` | Minimum iOS version (dropdown: 15 / 16 / 17), output as SwiftUI vs UIKit (toggle) |
| `flutter` | Minimum Flutter SDK (text), Dart package name (text) |
| `web-component` | Custom element prefix (text), shadow DOM (toggle) |
| `react` | TypeScript (toggle) — already has runtime package |

**Step 3 — Wire store actions**
Add to `lib/editor-store/store.ts`:
```ts
addSyncTarget(target: SyncTarget): void
updateSyncTarget(id: string, patch: Partial<SyncTarget>): void
removeSyncTarget(id: string): void
executeSyncTarget(id: string): Promise<void>
```

**Step 4 — Wire "Sync Now" button per target**
Each target card in `SyncTargetPanel` needs a "Sync Now" button that calls `executeSyncTarget(id)`. Show last-synced timestamp and status badge.

**Files to change:**
- `components/explorer/ExplorerShell.tsx` — import + mount `SyncTargetPanel`
- `components/export/SyncTargetPanel.tsx` — add platform-specific form fields, wire `useEditorActions()`
- `lib/editor-store/store.ts` — add sync target CRUD + execute actions

---

## 4. Gap 3 — NPM Registry Delivery (Q3 / Q4)

### What's built
- `lib/sync-service/connectors/npm-connector.ts` — publish logic
- `SyncTarget.npmRegistry` schema — registry, scope, packageName, tokenStored, lastPublishedVersion
- `SyncTarget.autoPublish` schema — trigger (save / manual), semver bump (patch / minor)

### What's missing
- No version management UI (bump patch / minor / major, changelog entry)
- No auto-publish countdown UI ("Publishing in 5:00 — Cancel")
- No store state for pending publish queue
- Token storage flow not exposed in UI

### Technical plan

**Step 1 — Version management UI in `SyncTargetPanel`**
For npm-registry targets, show:
- Last published version (from `target.npmRegistry.lastPublishedVersion`)
- "Bump version" segmented control: Patch / Minor / Major
- Changelog text area (optional)
- "Publish now" button

**Step 2 — Auto-publish countdown state in store**
Add to `lib/editor-store/store.ts`:
```ts
pendingPublish: {
  targetId: string;
  scheduledAt: number;  // unix ms
  semver: 'patch' | 'minor';
} | null
cancelPendingPublish(): void
```
On save (when `autoPublish.on === 'save'`), set `pendingPublish`. After countdown expires, call `npm-connector.publish()`.

**Step 3 — Countdown badge in ExplorerShell / Toolbar**
When `pendingPublish` is set, show a persistent badge: "Publishing in 5:00 · Cancel".

**Step 4 — npm token setup flow**
First-time setup: prompt for npm token, store in platform keychain via `lib/platform/`. Show "Token stored" state in target card.

**Files to change:**
- `components/export/SyncTargetPanel.tsx` — version management section, npm token input
- `lib/editor-store/store.ts` — `pendingPublish` state + `cancelPendingPublish`
- `components/explorer/ExplorerShell.tsx` or `components/editor/Toolbar.tsx` — countdown badge
- `lib/sync-service/auto-publish.ts` — consume `pendingPublish` state

---

## 5. Gap 4 — Figma Import

### What's built
- `lib/import/adapter-sdk/index.ts` — `ExternalIconAdapter<T>` interface; just needs implementation
- 4 working adapters (Heroicons, Phosphor, Material Symbols, Lucide) to reference as patterns
- `.codex/skills/figma-use/SKILL.md` — Figma Plugin API reference

### What's missing
- `lib/import/adapters/figma-adapter.ts` — does not exist
- Import UI for Figma — does not exist
- Figma auth flow (personal access token or OAuth)

### Technical plan

**Step 1 — Create `figma-adapter.ts`**
Implement `ExternalIconAdapter`:
```ts
export const figmaAdapter: ExternalIconAdapter = {
  id: 'figma',
  name: 'Figma',
  search(query) {
    // GET /v1/files/:fileKey/components — filter by name match
    // Returns: ExternalIconSearchResult[]
  },
  importById(id) {
    // GET /v1/images/:fileKey?ids=:nodeId&format=svg
    // Parse SVG → ExternalIconIntermediateRepresentation
    // Then raw-svg-adapter handles path normalization
  }
};
```
Auth: personal access token stored in `lib/platform/` (same pattern as npm token).

**Step 2 — Figma file connection UI**
Users must provide a Figma file URL and token. Design a connection card:
- Figma file URL input (paste from browser)
- Personal access token input (link to Figma settings)
- "Connect" button → validates token + fetches file metadata
- Connected state: shows file name, frame/component count

**Step 3 — Import picker UI**
After connecting, show a searchable grid of Figma components:
- Search by name
- Filter by page / frame
- Multi-select with checkbox
- Preview SVG thumbnail
- "Import selected" button → calls `figmaAdapter.importById()` for each, ingests into project

**Step 4 — Import settings**
Before import:
- Default icon size assignment (24 / 32 / 48)
- Rendering mode hint (monochrome / multicolor)
- Naming convention (keep Figma name / convert to kebab-case)

**Files to create:**
- `lib/import/adapters/figma-adapter.ts`

**Files to change:**
- Import registry (wherever heroicons/phosphor adapters are registered — check `lib/import/`)
- Import UI component (create or extend existing import panel in explorer)

---

## 6. Information Architecture (IA)

This section defines every screen needed to support the four gaps above.
Scope: **design deliverables only** — not counting screens that already exist.

---

### 6.1 IA Tree

```
App
├── Editor
│   ├── Toolbar (existing)
│   │   └── Export Dropdown (existing, extend)
│   │       └── [NEW] "Export Lottie JSON" item → opens Lottie Sheet
│   └── Right Sidebar (existing)
│       ├── Inspect tab (existing)
│       ├── Animation tab (existing)
│       └── [NEW] Export tab
│           ├── Lottie Export Panel
│           │   ├── Variant selector
│           │   ├── FPS selector
│           │   ├── Morph quality selector
│           │   ├── Downgrade diagnostics list
│           │   ├── Preview canvas (feature-flagged)
│           │   └── Download button
│           ├── SVG Export Panel (existing, surface here)
│           └── Runtime JSON Panel (existing, surface here)
│
└── Explorer
    ├── Project Header (existing)
    │   └── [NEW] Publish countdown badge ("Publishing in 5:00 · Cancel")
    ├── Icon Grid (existing)
    ├── [NEW] Import Source Panel
    │   ├── Source list (Heroicons, Phosphor, Material, Lucide, Figma)
    │   └── Figma source (new)
    │       ├── Connection card
    │       │   ├── File URL input
    │       │   ├── Token input
    │       │   └── Connect / Disconnect button
    │       ├── Connected state
    │       │   ├── File info (name, component count)
    │       │   ├── Search input
    │       │   ├── Page / frame filter
    │       │   ├── Icon grid (thumbnails + checkboxes)
    │       │   └── Import settings sheet
    │       │       ├── Size assignment
    │       │       ├── Rendering mode hint
    │       │       └── Naming convention
    │       └── Import button + progress indicator
    └── [NEW] Delivery Targets Panel
        ├── Target list (cards)
        │   └── Target card
        │       ├── Platform badge (React / Swift / Flutter / Web Component)
        │       ├── Delivery mode badge (Local / Git PR / npm)
        │       ├── Last synced timestamp
        │       ├── Status badge (Synced / Error / Pending)
        │       ├── [NEW for npm] Version badge + last published
        │       ├── "Sync Now" button
        │       └── Remove button
        └── Add Target Sheet
            ├── Step 1 — Platform & delivery mode
            │   ├── Platform selector (React / Swift / Flutter / Web Component)
            │   └── Delivery mode selector (Local directory / Git PR / npm Registry)
            ├── Step 2 — General config
            │   ├── Target name
            │   └── Runtime package (all platforms)
            ├── Step 3 — Platform-specific config
            │   ├── [React] TypeScript toggle
            │   ├── [Swift] Min iOS version, SwiftUI vs UIKit toggle
            │   ├── [Flutter] Min Flutter SDK, Dart package name
            │   └── [Web Component] Custom element prefix, Shadow DOM toggle
            ├── Step 4 — Delivery config
            │   ├── [Local directory] Output path picker
            │   ├── [Git PR] Owner, repo, base branch, package path
            │   └── [npm Registry]
            │       ├── Registry URL (default: registry.npmjs.org)
            │       ├── Scope input
            │       ├── Package name input
            │       └── Token input (linked to platform keychain)
            └── Step 5 — Auto-publish settings [npm only]
                ├── Trigger: On save / Manual
                ├── Semver bump: Patch / Minor
                └── Save button
```

---

### 6.2 Screen Inventory (Design Deliverables)

| ID | Screen | Location | Trigger |
|----|--------|----------|---------|
| E1 | Export tab (right sidebar) | Editor → Right sidebar | Tab click |
| E2 | Lottie Export Panel | Inside E1 | Auto-shown when icon selected |
| E3 | Lottie preview canvas | Inside E2 | Feature flag or toggle |
| D1 | Delivery Targets Panel | Explorer → sidebar or dedicated section | Nav item or tab |
| D2 | Add Target Sheet — Step 1 (platform + mode) | Inside D1 | "Add Target" click |
| D3 | Add Target Sheet — Step 2 (general config) | Inside D2 | Next |
| D4 | Add Target Sheet — Step 3 (platform-specific) | Inside D2 | Next (conditional) |
| D5 | Add Target Sheet — Step 4 (delivery config) | Inside D2 | Next |
| D6 | Add Target Sheet — Step 5 (auto-publish, npm only) | Inside D2 | Next (conditional) |
| D7 | Target card — Synced state | Inside D1 | — |
| D8 | Target card — Error state | Inside D1 | — |
| D9 | Target card — Pending publish state | Inside D1 | After save (autoPublish) |
| D10 | Publish countdown badge | Explorer header | On auto-publish trigger |
| D11 | Version management popover (npm) | Target card | "Bump version" click |
| F1 | Import Source Panel | Explorer → sidebar | Nav item |
| F2 | Figma connection card (empty) | Inside F1 | Select Figma source |
| F3 | Figma connection card (connected) | Inside F1 | After token valid |
| F4 | Figma icon picker | Inside F1 | After connected |
| F5 | Import settings sheet | Inside F4 | "Import selected" click |
| F6 | Import progress indicator | Inside F1 | During import |

---

### 6.3 States Per Screen (for design completeness)

**E2 — Lottie Export Panel**
- No icon selected (empty state)
- Icon selected, no downgrades (clean)
- Icon selected, with downgrade warnings (warning list visible)
- Icon selected, with downgrade errors (error + explanation)
- Exporting (loading)
- Export complete (success toast or inline feedback)

**D2–D6 — Add Target Sheet (multi-step)**
- Default (empty form)
- Validation error (inline field errors)
- Loading (on "Connect" for git-pr)
- Connection error (git / npm token invalid)
- Success (confirmation before close)

**D7–D9 — Target card states**
- Never synced
- Syncing (spinner)
- Synced (timestamp)
- Error (message + retry)
- Pending publish with countdown

**F2 — Figma connection card**
- Empty (URL + token inputs)
- Loading (validating token)
- Error (invalid token or file not found)
- Connected (file name + component count)

**F4 — Figma icon picker**
- Loading (fetching components)
- Loaded (grid)
- No results (search returned nothing)
- Selected (N items checked)

**F5 — Import settings sheet**
- Default settings
- Conflict warning (icon name already exists in project)

---

## 7. Implementation Order

| Priority | Gap | Why first |
|----------|-----|-----------|
| 1 | Lottie Export UI (Gap 1) | Smallest change, most requested, fully built in code |
| 2 | Delivery Targets Panel (Gap 2) | Unblocks Swift/Flutter users; `SyncTargetPanel` already exists |
| 3 | NPM Registry completion (Gap 3) | Extends Gap 2 work; same panel |
| 4 | Figma Import (Gap 4) | Largest new code surface; adapter must be built from scratch |

---

## 8. Files Reference

| File | Gap | Status |
|------|-----|--------|
| `components/export/LottieExportPanel.tsx` | 1 | Built, unmounted |
| `components/export/SyncTargetPanel.tsx` | 2, 3 | Built, unmounted + incomplete |
| `components/editor/EditorShell.tsx` | 1 | Mount point for Export tab |
| `components/editor/Toolbar.tsx` | 1 | Mount point for Lottie menu item |
| `components/explorer/ExplorerShell.tsx` | 2, 3, 4 | Mount point for all explorer panels |
| `lib/editor-store/store.ts` | 2, 3 | Add sync target CRUD + pendingPublish state |
| `lib/import/adapters/figma-adapter.ts` | 4 | Does not exist — create |
| `lib/sync-service/auto-publish.ts` | 3 | Exists — wire to store state |
| `lib/sync-service/connectors/npm-connector.ts` | 3 | Exists — wire to version UI |

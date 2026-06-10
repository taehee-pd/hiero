# Hiero — Improvement Backlog (Path to a Deliverable Tool)

**Created:** 2026-06-10
**Source:** Full product + design + engineering audit (docs_canonical, specs/, code-level survey)
**How to read this:** Items are grouped into four workstreams and tagged
P0–P3. P0 = blocks user trust in the tool today. Effort is S (≤1 day),
M (2–4 days), L (1–2 weeks). Each item has acceptance criteria so it can
be picked up as a standalone task/PR.

Status legend: `[ ]` open · `[x]` done

---

## Workstream A — Reliability & Trust (P0)

The tool's persistence story is local IndexedDB; any crash or silent
failure costs real user work. Nothing else matters until these land.

### A1. Editor error boundary + crash recovery screen — **P0 · M**
- [ ] Add a React error boundary wrapping the editor surface (around
      `StudioLayout` / `EditorShell` in `app/layout.tsx:53-91` or the
      nearest route-level layout).
- [ ] Recovery UI: "Something went wrong — your work is auto-saved"
      with a Reload action and a copyable error digest for bug reports
      (include `window.__HIERO_BUILD__` info).
- [ ] Log boundary catches to console with component stack.
- **Accept:** Throwing inside any editor panel in dev shows the recovery
  screen instead of a white page; reload restores the workspace from
  IndexedDB. Test: a `tests/` dom test that renders the boundary with a
  throwing child.

### A2. IndexedDB integrity check + degraded mode — **P0 · M**
- [ ] On adapter open (`lib/persistence/indexeddb-adapter.ts`), detect
      corruption/unavailability (open failure, version error, quota) and
      fall back to an in-memory session store instead of failing silently.
- [ ] Surface a persistent (non-toast) banner when running in degraded
      mode: "Changes won't survive this tab — export your work."
- [ ] Warn *before* the first edit when storage is unavailable, not after
      a failed save (`lib/persistence/use-persistence.ts:28-39`).
- **Accept:** With IndexedDB blocked (private-mode simulation / mocked
  adapter), the editor still works for the session and the banner shows.

### A3. Export failures must toast, never console-only — **P0 · S**
- [ ] Audit every export handler in `components/editor/EditorShell.tsx`
      (SVG, runtime JSON, Lottie, React codegen, compiled): on throw,
      show a destructive toast with the format name + error message.
- [ ] Same for publish/release flows in `components/export/`.
- **Accept:** Forcing an exporter to throw produces a visible toast;
  grep shows no export path whose only failure channel is `console.*`.

### A4. Import network resilience (timeout / retry / error states) — **P0 · M**
- [ ] Add `AbortSignal.timeout(30_000)` (or equivalent) to all fetches in
      `components/editor/ImportIconDialog.tsx` (token validation
      :105-114, component search :139-149, library import :324-337) and
      `lib/import/adapters/figma-source.ts:71`.
- [ ] Every async import flow gets an inline error state with a Retry
      button — no infinite spinners.
- [ ] `app/api/import/figma/route.ts:90-92`: return structured error
      codes (`auth_invalid` / `rate_limited` / `upstream_error`) so the
      client can distinguish "fix your token" from "try again".
- **Accept:** Killing the network mid-import shows an actionable error
  within 30s in every import path.

### A5. Checkpoint before destructive geometry operations — **P1 · M**
- [ ] Boolean ops, compound merges, and morph rebinds snapshot store
      state first and roll back on throw (today
      `components/editor/InspectorPanel.tsx:319-325` catches but leaves
      partial state).
- [ ] Reuse the existing undo-history mechanism in
      `lib/editor-store/store.ts` — a failed op should be a no-op, not a
      half-applied edit.
- **Accept:** A boolean op that throws mid-way leaves geometry identical
  to pre-op state; covered by a store-level test.

---

## Workstream B — First-Run Experience & UX (P1)

Capability is not the gap; a new user can't discover it. These convert
the blank-canvas first session into a guided one.

### B1. Starter content: bundled example icons — **P1 · M**
- [ ] Ship 5–10 remixable sample icons that demonstrate the
      differentiators: a play↔pause morph transition, a draw-on
      checkmark (reveal mode), a multi-layer stagger, a weight-variant
      icon, a state-machine icon (default/active).
- [ ] "Start from an example" entry point in the editor empty state and
      in the new-project flow (alongside the existing New icon / Import
      SVG / ⌘K CTAs in `components/editor/Canvas.tsx:1148-1190`).
- [ ] Examples load as a normal editable project (teaching by remixing),
      not a read-only gallery.
- **Accept:** A first-time user can open an example, scrub its
  transition, and export it without reading docs.

### B2. Guided first-run walkthrough — **P1 · M**
- [ ] One-time, dismissible 3–4 step tour of the core loop:
      import/create → animate (Animate panel) → preview → publish.
- [ ] Honor `prefers-reduced-motion`; fully keyboard-navigable;
      never auto-replays (persist dismissal in IndexedDB).
- **Accept:** Fresh profile sees the tour once; `Esc` dismisses;
  reduced-motion users get no animated coach marks.

### B3. Link user docs from inside the app — **P1 · S**
- [ ] `docs/user-guide/` content is unreachable from the UI. Add a Help
      menu entry (and ⌘K command) linking to the guide + framework
      integration docs.
- [ ] Add a "Help & docs" row to the shortcuts cheat-sheet dialog.
- **Accept:** Docs reachable in ≤2 clicks from the editor.

### B4. Visible undo/redo affordance — **P1 · S**
- [ ] Toolbar undo/redo buttons (disabled-state aware) wired to the
      existing history in `lib/editor-store/store.ts`, with ⌘Z/⇧⌘Z hints
      via `KbdHint`.
- [ ] List undo/redo in the `?` shortcuts cheat sheet and ⌘K palette.
- **Accept:** Undo/redo discoverable without prior knowledge; buttons
  reflect history depth (enabled/disabled).

### B5. Keyboard path: canvas as a first-class tab stop — **P1 · L**
- [ ] Make the canvas focusable (`tabIndex=0`) with a visible focus ring
      and a documented keyboard model: arrow-key nudge for selected
      points/layers, Tab/cycling through anchor points, Enter to edit.
      (Handlers exist in `lib/editor-core/keyboard.ts`; the canvas itself
      is not reachable by keyboard.)
- [ ] ARIA pass on editor chrome beyond the current ~6 call sites:
      toolbar buttons, layer rows, canvas overlays get `aria-label`/roles.
- **Accept:** WCAG 2.1.1 — every editor action reachable
  keyboard-only; axe scan of the editor shell reports no critical
  violations.

### B6. Reduced motion in the editor shell, not just previews — **P1 · S**
- [ ] `getMotionPreference()` currently gates preview playback only.
      Extend to editor pan/zoom/drag easing and panel transitions
      (`components/editor/Canvas.tsx:146-195`).
- **Accept:** With `prefers-reduced-motion: reduce`, viewport changes
  snap instead of animating.

### B7. `/history` route Navbar chrome — **P1 · S**
- [ ] Finish the P0 follow-up already flagged in the version-history
      spec: `/history` renders the canonical Navbar/shell like every
      other route.
- **Accept:** `pnpm test:e2e` route-shell spec passes for `/history`
  with the shell assertion enabled.

---

## Workstream C — Product Surface (P2)

### C1. Shareable read-only preview links — **P2 · L**
- [ ] Serialize icon + transition into a shareable URL (compressed
      payload in the fragment, or a minimal blob endpoint) rendering a
      read-only preview page with playback controls.
- [ ] "Copy preview link" action in the editor toolbar + ⌘K.
- [ ] Cheapest possible collaboration feature; do this **before** any
      real-time collab work.
- **Accept:** A recipient with no account/profile can open the link and
  play the transition on any device.

### C2. Runtime/consumer documentation site — **P2 · L**
- [ ] Publish an API reference for the runtime (`HieroIcon` props,
      imperative driver API, effects, gestures) — today only
      `docs/guides/` prose exists and isn't versioned or published.
- [ ] Decide and document the runtime packaging story (embedded-only
      vs. versioned `@hiero/runtime` npm package) — consumers currently
      discover the API from generated types.
- **Accept:** A developer who has never opened the Studio can integrate
  a compiled icon from the docs alone.

### C3. Bulk operations for design-system-scale libraries — **P2 · L**
- [ ] Bulk export (multi-select → export all in a chosen format).
- [ ] Bulk rename with pattern support (prefix/suffix/find-replace).
- [ ] "Apply transition/effect preset to selected icons" — generalize
      the Phase N derived-variants machinery.
- **Accept:** A 100-icon library can be renamed and exported in one
  interaction each, not 100.

### C4. CLI parity: watch mode first — **P2 · M**
- [ ] `hiero build --watch` (the README's own top known-limitation).
- [ ] Then evaluate: transition validation in CLI, PR sync from CLI.
- **Accept:** Editing a source icon re-builds automatically in <2s in a
  sample project.

### C5. Write down positioning & sustainability — **P2 · S**
- [ ] Add a section to PRODUCT.md: who pays / why it persists (OSS +
      hosted tier? internal tool? sponsorware?). This decision gates
      whether team workspaces, auth, and collab ever get built.
- **Accept:** PRODUCT.md answers "why will this exist in 2 years" in one
  paragraph, and the open product bets (collab, teams, sharing) each
  reference it.

---

## Workstream D — Engineering Health (P2–P3)

### D1. Decompose the three monoliths — **P2 · L (incremental)**
- [ ] `components/editor/EditorShell.tsx` (3,140 lines): extract export
      actions, dialog cluster, and keyboard/shortcut wiring into modules;
      target <800 lines for the shell itself.
- [ ] `components/editor/InspectorPanel.tsx` (2,883 lines): split into
      per-section panels (geometry, style, variants, topology).
- [ ] `lib/editor-store/store.ts` (4,136 lines): split actions into
      domain slices (icons, layers, selection, transitions, history)
      behind the existing `useEditorStore`/`useEditorActions` facade —
      no call-site churn.
- **Accept:** No behavior change (full `pnpm test` green); each new
  module independently importable; line counts hit targets.
- **Note:** Do A-items first — refactoring is safer once editor
  interactions have test coverage (D2).

### D2. Test the editor surfaces users actually touch — **P2 · L (incremental)**
- [ ] Canvas: render, SVG drag-drop import, zoom/pan, selection
      (currently zero tests).
- [ ] EditorShell: keyboard shortcuts, undo/redo round-trip, export
      action dispatch.
- [ ] InspectorPanel: property edits, validation, boolean-op rollback
      (pairs with A5).
- [ ] One end-to-end Playwright flow: import SVG → edit a layer → add a
      transition → export React component → assert artifact compiles.
- **Accept:** The e2e flow runs in CI; editor dom-test count goes from
  ~2 files to covering the four surfaces above.

### D3. Virtualize the icon list — **P2 · S**
- [ ] `components/editor/IconListPanel.tsx:84` renders all icons
      unconditionally; add windowing (e.g. `@tanstack/react-virtual`)
      for lists >100 items. Remember the dual-lockfile rule when adding
      the dependency.
- **Accept:** 1,000-icon workspace scrolls at 60fps; keyboard
  navigation and inline rename still work.

### D4. Canvas render efficiency — **P3 · M**
- [ ] Replace the clear-and-rebuild render (`svg.innerHTML = ''`,
      `components/editor/Canvas.tsx:286`) with keyed/diffed node updates,
      or at minimum scope rebuilds to the changed layer.
- [ ] Narrow Canvas's store subscriptions (19+ properties at
      `Canvas.tsx:88-133`) — derive a single memoized selector per
      concern so point-drag doesn't re-render unrelated chrome.
- **Accept:** Dragging a point on a 20-layer icon doesn't rebuild the
  full SVG tree (verify via DOM mutation count in a test or profile).

### D5. Persistence write-path hardening — **P3 · M**
- [ ] Versioned snapshot writes: keep last-known-good payload so a
      corrupted write never strands the workspace (pairs with A2).
- **Accept:** Simulated mid-write failure recovers the previous snapshot
  on next load.

### D6. Pay down flagged debt — **P3 · S**
- [ ] Finish the GitHubSyncPanel migration to `lib/sync-service/`
      (`components/export/GitHubSyncPanel.tsx:10` TODO).
- [ ] Resolve or excise the `_template.ts` adapter TODOs
      (`lib/import/adapters/_template.ts`) before inviting third-party
      adapter contributions.
- **Accept:** `grep -rn "TODO(deprecation)"` returns nothing; template
  adapter compiles with no placeholder TODOs.

---

## Suggested sequencing

| Sprint | Items | Theme |
|--------|-------|-------|
| 1 | A1, A2, A3, A4 | Stop losing user work / silent failures |
| 2 | B1, B3, B4, B7 | First-run + discoverability quick wins |
| 3 | A5, B6, D3, B2 | Hardening + onboarding completion |
| 4 | C1, D2 (start) | Sharing loop + editor test scaffold |
| 5+ | D1, B5, C2, C3, C4 | Structural refactor, a11y depth, consumer story |

C5 (positioning) is a writing task — slot it anywhere; it unblocks
future prioritization more than any single feature.

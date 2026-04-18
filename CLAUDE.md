# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Product:** Cuneiform — an Cuneiform with SF Symbols-grade animation capabilities
**Stack:** Next.js 16 + React 19 + TypeScript + Custom Store (`useSyncExternalStore`) + Tailwind CSS + Radix UI
**Package Manager:** pnpm (with Bun test runner)
**Dev Server:** `pnpm dev` (runs on port 3000)

## Common Commands

```bash
pnpm dev           # Start dev server
pnpm build         # Production build (output: .next/)
pnpm lint          # ESLint check
pnpm format:check  # Prettier check
pnpm test          # Run all tests (splits into test:core + test:dom)
npx tsc --noEmit   # Type-check without emitting
```

> **Do not run `bun test` directly.** Use `pnpm test`. The test suite is
> split into two bun invocations (`test:core` for `.test.ts` and
> `test:dom` for React `.test.tsx` files) so happy-dom's DOMParser
> can't contaminate the svg-sanitizer / import-svg tests that run in
> the same bun process. See `bunfig.toml` for the full explanation.

## CI Emulation (run before every push)

CI uses `bun install --frozen-lockfile`, which **fails if `bun.lock` is out of sync**
with `package.json`. After adding/removing any dependency, always run:

```bash
bun install                     # Regenerate bun.lock
bun install --frozen-lockfile   # Emulate CI — must pass before pushing
bun run format:check            # Prettier check (CI runs this on pnpm-lock.yaml too)
bun run lint                    # ESLint — 0 errors required
pnpm test                       # test:core + test:dom (see note above)
pnpm build                      # Verify production build
```

**Why both lockfiles?** The project uses `pnpm` as the primary package manager but CI
and the test runner use `bun`. Both `pnpm-lock.yaml` and `bun.lock` must stay in sync.
When adding a dependency via `pnpm add <pkg>`, always follow up with `bun install` to
regenerate `bun.lock`. Commit both lockfiles together.

## Design Documentation

- **SSOT (Single Source of Truth):** `docs_canonical/DESIGN.md` — master design document
  covering product vision, architecture, all phases, and security posture
- **Task backlog:** `docs_canonical/TASKS.md` — engineering phases with task checklists
- **Per-branch design docs:** `~/.gstack/projects/taehee-pd-cuneiform/` — created
  by `/office-hours` during gstack review pipeline
- **Spec-kit specs:** `specs/` — structured markdown specs for all major systems

## Project Structure

```
lib/
├── schema/             # Icon, Variant, IconType, Layer, Transition types
├── runtime-core/       # autoMorph (unified automatic morph), intrinsic interpolation,
│                       # morph, topology, transition resolver, draw executor,
│                       # hybrid compositor, open-path guard, cubic weight interpolation
├── runtime-dom/        # DOM renderer, IconDriver
├── runtime-react/      # CuneiformIcon React component, hooks
├── runtime-sdk/        # Compiled icon rendering primitives
├── editor-core/        # Path editor, snap engine, keyboard, topology, boolean ops
├── editor-store/       # Custom store (state, actions, undo/redo via useSyncExternalStore)
├── import/             # SVG import, adapter SDK, built-in adapters (Figma, Heroicons, etc.)
├── export/             # Runtime JSON, Lottie, compiled icons, React codegen, adapters
├── persistence/        # IndexedDB adapter, persistence manager, auto-save
├── live-sync/          # Real-time publish transport
├── sync-service/       # GitHub PR sync + connectors (local-dir, adapter-pr, npm)
├── sync-ui/            # UI layer for sync operations (state, hooks, analytics)
├── integrations/       # GitHub API client and icon sync orchestration
├── install-config/     # Installation configuration for icon packages
├── rendering/          # Layer style resolution, auto-gradient
├── platform/           # Web platform bridge and route helpers
├── compiler-contracts/ # Export format types and validators
└── animation/          # Effect player and built-in presets

components/
├── editor/           # EditorShell, Canvas, LayerPanel, TransitionPanel, TimelineEditor
├── explorer/         # ExplorerShell, project management
├── studio/           # StudioLayout, NavPane, ListPane, Navbar (single-screen workspace)
├── export/           # PublishPanel, ReleasePanel, export formats
├── persistence/      # AutoSaveProvider
├── runtime/          # Runtime preview
├── ds/               # Cuneiform Design System (StatusBadge, KbdHint, ColorField, IconButton, Tag, ColorPicker)
├── ui/               # shadcn/ui primitives (Radix-based)
└── kibo-ui/          # (deleted — migrated to ds/ in Phase 2)

packages/cuneiform-cli/   # @cuneiform/cli command-line tool
figma-plugin/         # Figma plugin for exporting to Cuneiform
specs/                # Spec-kit documentation (21 specs)
docs_canonical/       # Canonical reference docs (TASKS, ARCHITECTURE, DESIGN, etc.)
tests/                # Bun test files (1400+ tests)
tests/ds/             # DS component tests (StatusBadge, KbdHint, ColorField, IconButton, Tag, ColorPicker)
```

## Key Conventions

- **Imports:** Use `@/` alias for all imports (resolves to project root)
- **UI Components:** Use `components/ds/*` for shared cross-feature UI, `components/ui/*` (shadcn/Radix) for primitives — never raw `<select>`, `<input type="range">`, etc.
- **CSS:** Use Tailwind utilities + `wire-*` CSS classes for editor panels (defined in `app/globals.css`)
- **State:** Custom store in `lib/editor-store/store.ts` — use `useEditorStore()` and `useEditorActions()` (built on `useSyncExternalStore`)
- **Testing:** `pnpm test` — all tests must pass before committing (splits into core + dom; see bunfig.toml)
- **Commits:** Author as `taehee-pd <j.taehee@icloud.com>` with Co-Authored-By Claude

## Design System (components/ds/)

Import shared cross-feature UI from `@/components/ds`:

- **StatusBadge** — semantic status indicators (saved/unsaved, connected, error)
- **Tag** — classification/metadata labels (platforms, versions, change kinds)
- **KbdHint** — platform-aware keyboard shortcut display
- **ColorField** — color swatch + hex input + optional opacity
- **IconButton** — icon-only action button with auto Tooltip + kbd hints
- **ColorPicker** — composition-based color picker (HSL, eye dropper, format switching)

**Admission criteria** (all five required to add a new DS component):
1. Same semantics across call sites
2. Same a11y contract
3. Same behavior (hover/focus/disabled/loading/error)
4. Same change axis — moves together when redesigned
5. DESIGN.md fidelity — no invented values

Every DS component must have a `.stories.tsx` and a `tests/ds/*.test.tsx`.
CI enforces this via `scripts/check-ds-exports.ts`.

## Storybook

```bash
pnpm storybook          # Dev server on port 6006
pnpm storybook:build    # Production build
pnpm storybook:test     # Vitest addon (Chromium, headless)
```

Stories live alongside components: `components/**/*.stories.tsx`.
Token documentation lives in `components/**/*.mdx`.

## Specs & Documentation

- **Spec-kit specs:** `/specs/` — structured markdown specs for all major systems
- **Task backlog:** `/docs_canonical/TASKS.md` — engineering phases with task checklists
- **Shipped phases:** All 23 engineering phases (1–8, C–Q) + R1–R5 + repo-native distribution + Figma import + Studio layout revamp
- **Open phases:** R6 (Navigation & Discoverability), R7 (Server-Side Embedding Readiness)

## Project-Local Skills

- Repo-local Codex skills live under `.codex/skills/`.
- `figma-use`: `.codex/skills/figma-use/SKILL.md`
  Use this before any Figma Plugin API / `use_figma` write action or
  unique JS-based Figma file inspection flow.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__Claude_in_Chrome__*` tools.

### Installing gstack

```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

### Available Skills

| Skill | Purpose |
|-------|---------|
| `/office-hours` | Brainstorm and ideate |
| `/plan-ceo-review` | Strategy review |
| `/plan-eng-review` | Architecture / engineering review |
| `/plan-design-review` | Design review planning |
| `/design-consultation` | Design feedback |
| `/review` | Code review |
| `/ship` | Ship changes |
| `/land-and-deploy` | Land and deploy |
| `/canary` | Canary deployment |
| `/benchmark` | Performance benchmarking |
| `/browse` | Headless browser for QA and dogfooding |
| `/qa` | Quality assurance |
| `/qa-only` | QA only (no fixes) |
| `/design-review` | Visual audit |
| `/setup-browser-cookies` | Browser cookie setup |
| `/setup-deploy` | Deploy setup |
| `/retro` | Retrospective |
| `/investigate` | Debug investigation |
| `/document-release` | Release documentation |
| `/codex` | Second opinion |
| `/cso` | Chief Security Officer review |
| `/autoplan` | Auto-review and plan |
| `/careful` | Extra careful mode |
| `/freeze` | Scope freeze |
| `/guard` | Production safety guard |
| `/unfreeze` | Unfreeze scope |
| `/gstack-upgrade` | Upgrade gstack |

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**Product:** Coniva — an icon authoring tool with SF Symbols-grade animation capabilities
**Stack:** Next.js 16 + React 19 + TypeScript + Zustand + Tailwind CSS + Radix UI
**Package Manager:** pnpm (with Bun test runner)
**Dev Server:** `pnpm dev` (runs on port 3000)

## Common Commands

```bash
pnpm dev           # Start dev server
pnpm build         # Production build (output: .next/)
pnpm lint          # ESLint check
pnpm format:check  # Prettier check
bun test           # Run all tests
npx tsc --noEmit   # Type-check without emitting
```

## CI Emulation (run before every push)

CI uses `bun install --frozen-lockfile`, which **fails if `bun.lock` is out of sync**
with `package.json`. After adding/removing any dependency, always run:

```bash
bun install                     # Regenerate bun.lock
bun install --frozen-lockfile   # Emulate CI — must pass before pushing
bun test                        # Run tests
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
- **Per-branch design docs:** `~/.gstack/projects/taehee-pd-icon-authoring-tool/` — created
  by `/office-hours` during gstack review pipeline
- **Spec-kit specs:** `specs/` — structured markdown specs for all major systems

## Project Structure

```
lib/
├── schema/           # Icon, Variant, State, Layer, Transition types
├── runtime-core/     # Morph, topology, transition resolver, draw executor, hybrid compositor
├── runtime-dom/      # DOM renderer, IconDriver
├── runtime-react/    # ConivaIcon React component
├── editor-core/      # Path editor, snap engine, keyboard, topology
├── editor-store/     # Zustand store (state, actions, undo/redo)
├── rendering/        # Layer style resolution, auto-gradient
├── export/           # Runtime JSON, compiled icons, adapters
├── platform/         # Desktop/web bridge
└── compiler-contracts/ # Export format types and validators

components/
├── editor/           # EditorShell, Canvas, LayerPanel, TransitionPanel, TimelineEditor
├── explorer/         # ExplorerShell, project management
├── platform/         # DesktopCommandBridge, TitleTabBar
├── ui/               # shadcn/ui components (54 files)
└── kibo-ui/          # kibo-ui re-exports + color-picker

specs/                # Spec-kit documentation (11 specs)
docs_canonical/       # TASKS.md (engineering backlog)
tests/                # Bun test files
```

## Key Conventions

- **Imports:** Use `@/` alias for all imports (resolves to project root)
- **UI Components:** Always use shadcn/ui or kibo-ui — never raw `<select>`, `<input type="range">`, etc.
- **CSS:** Use Tailwind utilities + `wire-*` CSS classes for editor panels (defined in `app/globals.css`)
- **State:** Zustand store in `lib/editor-store/store.ts` — use `useEditorStore()` and `useEditorActions()`
- **Testing:** `bun test` — all tests must pass before committing
- **Commits:** Author as `taehee-pd <j.taehee@icloud.com>` with Co-Authored-By Claude

## Specs & Documentation

- **Spec-kit specs:** `/specs/` — structured markdown specs for all major systems
- **Task backlog:** `/docs_canonical/TASKS.md` — engineering phases with task checklists
- **Shipped phases:** Q (NPM Registry, #73), M (Lottie Export, #74)
- **Open phases:** N (Derived Variants), P (Import Ecosystem), O (Cubic Weight Interpolation)

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

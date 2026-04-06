# Style Guide

## Status

This repository uses Prettier as its formatter, configured via `.prettierrc.json` and `.prettierignore` at the root. The `format` and `format:check` scripts enforce formatting in CI (Phase 4B.1). ESLint (`eslint.config.mjs`) enforces `@typescript-eslint/no-explicit-any` as error (4B.2) and `react-hooks/exhaustive-deps` as error (4B.3).

When in doubt, match the surrounding file rather than imposing a new house style.

## Language and File Conventions

- Primary source languages are TypeScript and TSX.
- Next.js route files in `app/` use framework-required default exports.
- Most reusable library and component modules use named exports.
- Path aliases use the `@/` prefix for repository-internal imports.

## Naming Conventions

Observed naming patterns:

- React feature components in `components/editor/`, `components/explorer/`, and `components/export/` use PascalCase file names and component names.
- Shared UI modules in `components/ui/` and `components/kibo-ui/` use lowercase file names, following shadcn-style conventions.
- Library modules in `lib/` generally use lowercase or kebab-case file names with camelCase exports.
- Tests use `*.test.ts` and `*.test.tsx`.

## Code Organization Principles

- Keep route files thin. Product logic belongs in `components/` and `lib/`, not in `app/` page modules.
- Keep canonical data shapes in `lib/schema/`.
- Keep editor state changes in `lib/editor-store/`.
- Keep geometry, parsing, snapping, and editing mechanics in `lib/editor-core/`.
- Keep output generation in `lib/export/`.
- Keep runtime rendering logic in the `lib/runtime-*` packages.
- Keep desktop-native behavior behind the platform bridge and desktop RPC boundary.

## UI and Styling Conventions

- Utility-class styling is used heavily in TSX components.
- Shared UI composition follows the shadcn-style component layout in `components/ui/`.
- Global theme and design tokens are applied through `app/globals.css`, theme provider wiring, and utility helpers such as `cn()`.

## Formatting Guidance

The repository uses Prettier with the configuration in `.prettierrc.json`. Run `corepack pnpm format` to format, or `corepack pnpm format:check` to verify. The Prettier rollout is scoped primarily to CI/tooling and new runtime files; some legacy files may not yet be fully formatted.

## Import and Export Preferences

- Prefer named exports for reusable functions, components, and utilities.
- Use default exports where the framework requires them, such as App Router page/layout modules.
- Prefer internal alias imports such as `@/lib/...` and `@/components/...` over long relative chains when the file already follows that pattern.

## Known Conflicts / Notes

- A root-level ESLint flat config (`eslint.config.mjs`) exists with `no-explicit-any` and `exhaustive-deps` errors enabled.
- Prettier is committed at the root (`.prettierrc.json`, `.prettierignore`) and enforced in CI via `format:check`.
- Product naming uses `Contour` as the canonical name. Legacy `icophone` identifiers remain only in compatibility surfaces (project files, update env vars).

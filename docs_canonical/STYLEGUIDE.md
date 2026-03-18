# Style Guide

## Status

This repository does not currently contain a fully formalized code style policy or formatter configuration. The guidance below is derived from the existing codebase and should be treated as the safest observed conventions.

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

Observed formatting is mostly consistent with:

- semicolon-terminated TypeScript in most modules
- single quotes in many source files
- multiline JSX props when readability benefits

There is some variation across files. Because no canonical formatter config is committed, preserve local consistency in edited files.

## Import and Export Preferences

- Prefer named exports for reusable functions, components, and utilities.
- Use default exports where the framework requires them, such as App Router page/layout modules.
- Prefer internal alias imports such as `@/lib/...` and `@/components/...` over long relative chains when the file already follows that pattern.

## Known Conflicts / Notes

- A root-level ESLint flat config (`eslint.config.mjs`) exists and currently scopes linting to repository JavaScript/config files.
- There is still no repository-wide Prettier, Biome, or `.editorconfig` policy committed at the root.
- Product naming is not standardized across source and docs. Do not infer a new naming standard from this file alone.

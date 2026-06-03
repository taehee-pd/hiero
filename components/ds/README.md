# Hiero Design System Components

`components/ds` is the cross-feature design-system layer. It sits between
shadcn/Radix primitives in `components/ui` and product surfaces such as
`components/studio`, `components/editor`, and `components/export`.

## Layering

```text
features    components/studio, components/editor, components/export
ds          components/ds
primitives  components/ui
tokens      tokens/*.json -> app/_generated/component-tokens.css
```

Rules:

- `components/ds` may import `components/ui` and other `components/ds` modules.
- `components/ds` must not import feature folders.
- Features may import from `@/components/ds` and `@/components/ui`.
- Use the `@/components/ds` barrel for shared DS imports.

## Redesign Workflow

Start with tokens:

1. Edit `tokens/component.tokens.json` for the classic design.
2. Edit or add `tokens/themes/<theme>.tokens.json` for alternate visual directions.
3. Run `pnpm tokens:build`.
4. Verify Storybook and touched product screens.

Change a DS component only when its behavior, accessibility contract, semantic
API, or composition model needs to change. Do not edit a DS component just to
change radius, color, spacing, or shadows; those belong in tokens.

## Admission Criteria

A component belongs in `components/ds` only when all five are true:

1. Same semantics across call sites.
2. Same accessibility contract.
3. Same behavior for hover, focus, disabled, loading, and error states.
4. Same redesign axis; it should move together when the system changes.
5. Fidelity to `DESIGN.md`; no invented visual values.

It also needs either two or more consumers outside one feature family, or a
system-level concern such as status, color, keyboard shortcuts, toast, or theme.

## Required Files

Every DS export must have:

- component source in `components/ds`
- story in `components/ds/*.stories.tsx`
- test in `tests/ds/*.test.tsx`
- named export in `components/ds/index.ts`

Run:

```bash
bun scripts/check-ds-exports.ts
```

## Current Components

- `IconButton` — icon-only action button with Tooltip and optional shortcut hint.
- `StatusBadge` — semantic state indicator, such as saved, unsaved, connected, or error.
- `Tag` — metadata/classification label, not system state.
- `KbdHint` — platform-aware shortcut glyph display.
- `ShortcutRow` — labeled shortcut row for help surfaces.
- `ColorField` — color swatch, hex input, and optional opacity input.
- `ColorPicker` — composable color picker primitives.

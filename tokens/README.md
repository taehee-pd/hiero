# Design Tokens

This folder is the redesign entry point for Hiero's shared component chrome.
Token changes compile into CSS variables consumed by `components/ds`.

## Files

| Path | Purpose |
|------|---------|
| `component.tokens.json` | Classic component tokens for DS components. |
| `semantic.tokens.json` | Pointer tokens that resolve to semantic CSS vars from `app/globals.css`. |
| `themes/*.tokens.json` | Theme overrides for alternate visual directions. |
| `style-dictionary.config.mjs` | Builds generated CSS and TypeScript token-name helpers. |

Generated outputs:

| Path | Purpose |
|------|---------|
| `app/_generated/component-tokens.css` | `:root` and `[data-theme]` CSS variable blocks. |
| `lib/_generated/component-tokens.ts` | Token-name map for autocomplete and refactor-safe references. |

Do not edit generated files by hand.

## Edit Flow

```bash
pnpm tokens:build
```

Use this flow for redesigns:

1. Change `tokens/component.tokens.json` for the default `classic` design.
2. Change or add a file under `tokens/themes/` for an alternate theme.
3. Add new theme ids to `THEMES` in `tokens/style-dictionary.config.mjs`.
4. Add the same ids to `THEMES` in `lib/theme/index.ts`.
5. Run `pnpm tokens:build`.
6. Verify DS stories and touched app screens.

## Boundaries

- Semantic product roles live in `app/globals.css`: foreground, background,
  border, primary, success, warning, danger, shadows, text sizes.
- Component-specific knobs live here: badge radius, tag padding, field border,
  keyboard hint shape, shortcut row shadow, icon-button hover.
- Feature layout and workflow-specific spacing stay in feature code unless the
  same value appears across DS components.

If a redesign can be expressed by changing tokens, do that before changing TSX.

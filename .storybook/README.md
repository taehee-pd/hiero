# Storybook — Phase 1 spike report

> Source of truth for this work: `specs/design-system-storybook.plan.md`.
> This file records the spike decision and the config tradeoffs the spike
> locked in. Update it whenever the preview config changes.

## Decision: **commit to Storybook** (6/6 gates, 1 workaround)

The plan's §5 exit criteria for Phase 1:

| Gate | What | Result |
|---|---|---|
| 1 | `Button` primitive renders | ✅ `01-button.stories.tsx`, 2 tests pass |
| 2 | `next/navigation` with `appDirectory: true` | ✅ `02-next-navigation.stories.tsx`, `usePathname`/`useRouter` both resolve |
| 3 | Theme switcher toggles `class` on `<html>` | ✅ `03-theme-switch.stories.tsx`, play function asserts `light`/`dark` classes |
| 4 | CSS vars from `app/globals.css` | ✅ `04-css-vars.stories.tsx`, token swatches render live |
| 5 | Radix toast firing from a story action via `useToast()` | ✅ `05-radix-toast.stories.tsx`, play function clicks the trigger and asserts the Radix toast viewport contains `Spike toast` |
| 6 | Vitest addon runs a play function against React 19 + Next 16 | ✅ `06-vitest-play.stories.tsx`, `storybook/test` + `storybook (chromium)` project executes headlessly |

`pnpm storybook:build` completes in ~6s; `pnpm storybook:test --run` executes
all 8 play assertions in ~3.3s wall time. `pnpm storybook` dev server boots
in ~5s.

Per plan §5: 6/6 with a single documented workaround → **commit to
Storybook, proceed to Phase 2**.

## Versions

- `storybook`, `@storybook/nextjs-vite`, `@storybook/addon-docs`,
  `@storybook/addon-a11y`, `@storybook/addon-themes`, `@storybook/addon-vitest`
  — all `10.3.5`.
- `vitest` 3.2.4, `@vitest/browser` 3.2.4, `playwright` 1.59.1.
- Runs against `react` 19.2.4 + `next` 16.1.6.

Plan §5 called out Storybook 9. Storybook 10 shipped with stronger
React 19 / Next 16 support so the spike pinned 10.

## Workaround #1 — historical: `next/font` loader in the Vite preview

Earlier phases used `next/font/local` (via the `geist` wrapper) and later
`next/font/google`. Both paths crashed `@storybook/nextjs-vite` because
its shim for `next/font` is incomplete. The current app loads fonts via
`@fontsource-variable/instrument-sans` + `@fontsource-variable/geist-mono`
— plain CSS `@font-face` packages — which Vite handles natively, so the
preview imports the same CSS as the app and Storybook now sees real
Instrument Sans with no shim required. Kept here for history in case a
future phase reintroduces `next/font`.

## Workaround #2 — `setProjectAnnotations` warning is a lie

**Observed.** Storybook 10.3 logs:

> Found a setup file with "setProjectAnnotations". Skipping automatic
> provisioning of preview annotations … You can safely remove the
> "setProjectAnnotations" call from your setup file.

**Reality.** Removing the call (as suggested) immediately breaks every
play function with `SB_PREVIEW_API_0014 (NoRenderFunctionError): No render
function available`. The auto-apply path shipped in 10.3 does not pick up
decorators or the Radix `<Toaster />` mount in `preview.tsx`.

**Fix.** Ignore the warning. Keep `setProjectAnnotations([previewAnnotations])`
in `.storybook/vitest.setup.ts`. Revisit when SB bumps and the warning
stops firing.

## Workaround #3 — `unable to find package.json for radix-ui`

A cosmetic warning at dev-server boot from SB's dependency detection. No
effect on build, test, or runtime. Ignore.

## Config shape locked in by the spike

- **`.storybook/main.ts`** — framework `@storybook/nextjs-vite`, stories
  glob `../components/**/*.stories.@(tsx|mdx)` (present even though empty
  today — Phase 3 fills it) plus `../.storybook/spike/**/*.stories.@(tsx|mdx)`
  for this spike's smoke stories. `experimentalRSC: true`. `@/` alias wired
  via `viteFinal`.
- **`.storybook/preview.tsx`** — decorator wraps every story in
  `ThemeProvider attribute="class" forcedTheme=<toolbar>`, `TooltipProvider`,
  and mounts `<Toaster />`. Imports `../app/globals.css` and the local
  `preview.css` shim. Sets `parameters.nextjs.appDirectory = true` globally.
  `globalTypes.theme` exposes light/dark in the toolbar.
- **`vitest.config.ts`** — `name: 'storybook'`, `browser.enabled: true`,
  `provider: 'playwright'`, chromium instance. Delegates story discovery
  to `@storybook/addon-vitest` (`test.include` removed per SB 10 guidance).
- **Scripts** — `pnpm storybook`, `pnpm storybook:build`,
  `pnpm storybook:test`.

## What this spike does *not* prove

- **MDX Docs pages.** `.storybook/main.ts` globs for `*.mdx` stories but
  the repo has zero MDX files today. Phase 3 will add the token MDX
  pages and re-gate MDX rendering then. Until that runs, the MDX story
  format is unexercised.
- **RSC (React Server Components).** `main.ts` enables
  `features.experimentalRSC: true`, but none of the six spike stories
  import a server component or exercise the RSC boundary. Storybook
  itself calls this experimental — consider this gate deferred to Phase 6
  when a real `EditorShell` smoke story forces the issue.
- **Mounted `EditorShell` / `Canvas` / `LayerPanel`** — container panels
  that depend on the custom store have zero coverage here. Phase 6 smoke
  stories will seed them from fixtures.
- **A11y addon wall-to-wall** — addon is installed and registered, but
  only the spike stories have been exercised. Phase 3 turns on axe gating
  per story.
- **Light/dark *visual* parity** — only the `html.className` is asserted.
  The CSS-vars gate (#4) proves the tokens resolve, but the spike does
  not diff light/dark pixels.
- **Bun test integration** — Storybook tests run under Vitest; the repo's
  `bun test` still owns `tests/**`. These are two parallel runners and
  will stay that way unless a future phase consolidates them.

## Phase 3 status

Phase 3 landed the real primitive stories and 9 token MDX pages, so
the six Phase 1 spike smoke stories in `.storybook/spike/**` have
been retired. Gate coverage now comes from:

- **5 enumerated interaction stories** with play functions:
  `button.stories.tsx`, `dialog.stories.tsx`, `tabs.stories.tsx`,
  `select.stories.tsx`, `dropdown-menu.stories.tsx`. Each exercises
  the keyboard / a11y contract per plan §6 Phase 3.
- **~20 basic primitive stories** (Input, Label, Checkbox, Switch,
  Slider, Tooltip, Badge, Card, RadioGroup, Accordion, Popover,
  Separator, Progress, Skeleton, Alert, Textarea, Toggle, ToggleGroup,
  Kbd, Spinner, AlertDialog, Collapsible, ScrollArea) with
  Default/AllVariants/Disabled/WithIcon as applicable.
- **9 token MDX pages** under `components/ui/tokens/` rendering live
  from CSS vars and citing the exact `/DESIGN.md` section per page:
  Colors (§2, §9), Typography (§3), Spacing (§5), Dimensions (§5, §9),
  Shadows (§6), Motion (§7), Radii (§4, §9), Focus (§7, §9),
  Do/Don't (§8).

The a11y addon is registered globally in `preview.tsx` with
`parameters.a11y.test = 'todo'` so axe violations show up in the addon
panel without breaking the build. Plan §6 Phase 8 flips this to
`'error'` for blocking CI.

## What was retired and why

- `.storybook/spike/**` — the six Phase 1 smoke stories existed only to
  prove the toolchain worked end-to-end. Once real primitive stories
  exercise the same gates (Button primitive, theme, CSS vars, toast
  portal, Vitest play functions, `next/navigation`), the spike files
  became duplicate coverage. Deleted.

## Proceed to Phase 4+

Plan §6 Phase 4 is the interaction-hook track (useInlineRename,
useMarqueeSelection) gated by React test infra — Commit 1 of which
already shipped during Phase 2 (happy-dom + RTL), so Phase 4 can
start without test-infra setup work. Phase 5 DS extractions
(StatusBadge, KbdHint, ColorField, IconButton) depend on both
Phases 3 and 4.

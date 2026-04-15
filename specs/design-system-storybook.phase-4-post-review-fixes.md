---
status: fix-plan
owner: taehee-pd
parent: specs/design-system-storybook.plan.md
created: 2026-04-15
target_commit: 51658f5 (Phase 4 hook extraction + Phase 2 codemod backfill)
---

# Phase 4 post-review fixes

This doc tracks the fixes for issues surfaced by three independent reviews
of the Phase 1–4 diff against `main`:

1. `/review` — gstack specialists (testing, maintainability, security, performance) — 32 findings, 7 critical
2. `/codex review` — 2 P1 findings (both real TypeScript errors that `pnpm build` missed because Next's typecheck is scoped to app code, not tests)
3. `/codex challenge` — adversarial review — 8/10 focus areas FAIL

Ship blockers first, then should-fix, then informationals. Everything
lands in one commit titled `Phase 4 post-review fixes` on top of
`51658f5`.

---

## 🔴 Ship-blocking

### T1 — Fix `listExpanded` → `listPaneExpanded` (TS2353)

- **File:** `tests/char-marquee-listPane.test.tsx:106`
- **Error:** `Object literal may only specify known properties, and 'listExpanded' does not exist in type 'Partial<EditorStore>'`
- **Fix:** one-word rename. `listPaneExpanded` is the real field name.
- **Gate:** `pnpm exec tsc --noEmit` on that file must pass.

### T2 — Add jest-dom matcher type augmentation for bun:test (TS2339)

- **File:** `tests/toast-smoke.test.tsx:62,65` — `toBeInTheDocument()` not on `Matchers<HTMLElement>`
- **Root cause:** `tests/setup/react.ts` calls `expect.extend(matchers)` at runtime but never registers the TypeScript types. Bun's `expect` type is strict.
- **Fix:** create `tests/setup/bun-jest-dom.d.ts` that uses `declare module 'bun:test'` to augment the `Matchers` interface with the jest-dom matchers (toBeInTheDocument, toHaveTextContent, toHaveAttribute, toBeDisabled, toHaveClass, etc.). Reference it from all React test files via a triple-slash directive OR include it in the tsconfig.
- **Gate:** `pnpm exec tsc --noEmit` on `tests/toast-smoke.test.tsx` must pass.

### P1 — useInlineRename re-entry guard is not synchronous-safe

- **File:** `lib/editor-hooks/use-inline-rename.ts:82–106`
- **Root cause:** `commit()` reads `isRenaming` from the render closure. If Enter fires commit() synchronously and blur fires commit() in the same React tick, React may not have flushed the `setIsRenaming(false)` yet — second commit sees stale `true` and re-enters.
- **Unit test miss:** `tests/use-inline-rename.test.tsx:100` wraps each commit in its own `act()` so React flushes between calls. The real-browser same-tick case is unexercised.
- **Fix:** hold `isRenaming` + `draft` in a ref mirror that is mutated synchronously in `start`/`commit`/`cancel`/`setDraft`. The commit guard reads `ref.current.isRenaming`. React state stays for re-render triggering but the guard no longer depends on React's flush timing.
- **Test:** add a case that calls `commit()` twice synchronously without `act()` between them, asserts `onCommit` fires exactly once.

### P2 — LayerPanel dep-chain memoization broken (multi-specialist confirmed)

- **Files:** `components/editor/LayerPanel.tsx:80–101, 135–141`
- **Root cause stack:**
  - `onCommit` is an inline arrow literal → new identity every render
  - `renameHook` is a plain object literal from `useInlineRename` → new identity every render
  - `startRenameLayer` depends on `[renameHook]` → new identity every render
  - `handleListKeyDown` depends on `startRenameLayer` → new identity every render
  - `commitRename` depends on `[renameHook]` → same problem
  - Marquee adapters `getCurrentSelection: () => [...selection.layerIds]` and `setSelection: (ids) => setSelection({...})` are inline lambdas → `onPointerDown` recreates every render → ScrollArea re-renders on every keystroke during rename
- **Fix:**
  1. Destructure `{ start, commit, cancel, isRenaming, draft, setDraft }` from the hook return
  2. Wrap `onCommit` in `useCallback` with deps `[renamingLayerId, currentIconId, renameLayer]`
  3. Replace `renameHook` in dep arrays with individual stable callbacks
  4. Wrap marquee `getCurrentSelection` in `useCallback([selection.layerIds])` and `setSelection` adapter in `useCallback([setSelection])`
- **Gate:** characterization test for LayerPanel rename must still pass.

### P3 — ListPane dep-chain memoization

- **File:** `components/studio/ListPane.tsx:75–82`
- **Fix:** wrap `getCurrentSelection: () => [...editorStore.getState().selectedIconIds]` in `useCallback([])` (store read is imperative, no deps). Wrap/keep `setSelection` as-is since `setSelectedIconIds` is already stable from `useEditorActions`.

### P4 — IconGridItem rename onCommit memoization

- **File:** `components/explorer/IconGridItem.tsx:47–50`
- **Fix:** destructure hook returns and wrap `onCommit: (next) => onRename?.(next)` in `useCallback([onRename])`. Also destructure for dep stability.

### M1 — useMarqueeSelection missing lifecycle cleanups

- **File:** `lib/editor-hooks/use-marquee-selection.ts`
- **Missing handlers:**
  - `onPointerCancel` — OS-level drag interrupt
  - `onLostPointerCapture` — focus loss / alt-tab / modal
  - useEffect unmount cleanup — component removed mid-drag
  - Window blur handler (optional, out of scope for this fix)
- **Fix:** add a shared `endDrag()` helper that clears `dragRef.current` + `setRect(null)` + releases pointer capture if held. Bind it to `onPointerCancel`, `onLostPointerCapture`, and a useEffect cleanup. Return the new handlers from the hook API.

### M2 — characterization test `[data-marquee-overlay]` false-green

- **File:** `tests/char-marquee-listPane.test.tsx` (the "pointerup ends drag cleanly" test)
- **Bug:** the test queries `container.querySelector('[data-marquee-overlay]')` but **no element in the real DOM carries that attribute**. The query always returns null → the test always passes regardless of whether the drag actually ended.
- **Fix:** check the hook's returned `rect` state by observing the overlay DOM. Real ListPane renders a `<div className="..." style={{position:'absolute', ..., pointerEvents:'none'}}>` when `marqueeRect != null`. Assert that the overlay element either disappears OR tag the real overlay with `data-marquee-overlay` in ListPane/LayerPanel so the test can actually find it.
- **Better fix:** add the `data-marquee-overlay` attribute to the overlay div in both `ListPane.tsx` and `LayerPanel.tsx` — cheap, makes the test actually assert something, and gives DS components a semantic hook.

### INFRA1 — Happy-dom process split not enforced on `bun test`

- **File:** `package.json:13` split works only via `pnpm test`. Direct `bun test` ignores the split.
- **Risk:** reintroduces the svg-sanitizer contamination bug from Phase 2 review if anyone runs `bun test` from the CLI.
- **Fix (two parts):**
  1. Add a `tests/.warn-bun-test.md` placeholder — no, better: update `CLAUDE.md` and `docs_canonical/TESTING.md` (if exists) with a warning block that says "do not run `bun test` directly; use `pnpm test`". Add it to the `bunfig.toml` comment too.
  2. More robust: rename React test files from `tests/*.test.tsx` to `tests/dom/*.test.tsx`. Then `test:core` can use `tests/*.test.ts` (which excludes the subdirectory) and `test:dom` uses `tests/dom/*.test.tsx`. `bun test` run directly hits both but they're already isolated-by-directory. Still better to enforce separate processes, but now even a raw `bun test` exercises both without cross-contamination risk (they're still in one process — contamination still possible but now mitigated by the register/unregister-per-import pattern… wait, that's what broke before).

  **Decision:** Option 1 only (documentation-based enforcement). The CI and `pnpm test` already handle the real gating. Bun's module-cache constraint makes true in-process isolation impossible without massive rework. Document the landmine and move on.

---

## 🟡 Should-fix

### S1 — Toast regression guards brittle string matching

- **File:** `tests/toast-smoke.test.tsx:74,85`
- **Fix:** replace exact-string `expect(layout).toContain("import { Toaster } from '@/components/ui/toaster'")` with a regex that allows whitespace variation, quote style, and named imports on either side of Toaster. Same for the `<Toaster />` JSX check.

### S2 — ESLint dynamic-import bypass

- **File:** `eslint.config.mjs:87–150`
- **Fix:** add a `no-restricted-syntax` rule with an `ImportExpression` selector checking the argument's value against the banned patterns. Add a second rule for `require()` calls. Example AST selector: `CallExpression[callee.name='require'][arguments.0.value=/@\/components\/kibo-ui/]`.

### S3 — Storybook toast store leaks across stories

- **File:** `.storybook/preview.tsx`
- **Fix:** add a `beforeEach` (or decorator cleanup) that imports `memoryState` or the `DISMISS_TOAST` action from use-toast and resets it. Since use-toast's memoryState is not exported, easier: dispatch `toast().dismiss` for any pending entries, OR mount the `<Toaster />` inside a new React tree per story (decorators already do this actually — let me verify). If decorators create fresh React trees but module state persists, use a custom beforeEach that calls `reset()` on the reducer via an exported helper. Cleanest: add a test-only `resetToastState()` function to `components/ui/use-toast.ts` and call it from the preview decorator.

### S4 — Codemod scope hardening

- **File:** `scripts/codemod/kibo-to-ds.ts`
- **Fixes:**
  1. `lstatSync` instead of `statSync` — don't follow symlinks
  2. Assert resolved path starts with `projectRoot` before `writeFileSync`
  3. Add `.mdx` to the EXT set
  4. Widen regex char class from `[a-z0-9-]` to `[a-zA-Z0-9-]` (defensive; current repo has no mixed-case)

---

## 🟢 Nice-to-have (informational)

### I1 — Rename `ArrowDownEnterActivates` dropdown-menu story

- **File:** `components/ui/dropdown-menu.stories.tsx`
- **Bug:** story name promises ArrowDown navigation but play function doesn't press ArrowDown — it just opens with Enter then presses Enter again. That's `KeyboardOpenEnterActivates`.
- **Fix:** rename the story AND add a separate `ArrowDownNavigate` story that presses ArrowDown explicitly.

### I2 — Add missing unit test: cold `commit()` never-started

- **File:** `tests/use-inline-rename.test.tsx`
- **Fix:** add test asserting `commit()` before any `start()` returns undefined and doesn't call onCommit.

### I3 — Add missing unit test: null `containerRef` mid-drag

- **File:** `tests/use-marquee-selection.test.tsx`
- **Fix:** mount harness, start drag, set `ref.current = null`, fire pointermove, assert no crash.

### I4 — Add scrollbar exclusion test

- **File:** `tests/use-marquee-selection.test.tsx`
- **Fix:** render harness with a child carrying `data-slot="scroll-area-scrollbar"`, pointerdown on it, assert drag does not start.

### I5 — Button AriaInvalidRing story weak assertion

- **File:** `components/ui/button.stories.tsx`
- **Fix:** either add a `toHaveClass` check for the Tailwind aria-invalid ring, or update the story comment to clarify the assertion is attribute-only and visual is verified elsewhere.

### I6 — Dialog focus trap not exercised

- **File:** `components/ui/dialog.stories.tsx`
- **Fix:** add a `FocusTrap` story that opens the dialog, tabs through the focusable elements, asserts focus wraps.

### I7 — Color picker informational fixes

- **File:** `components/ds/color-picker/index.tsx`
- **Fixes:**
  - Add mounted ref to skip first-render onChange (line 119)
  - Remove `console.error('EyeDropper failed:', error)` — this fires on every non-Chrome browser
  - Extract `hslGradientLightness(x)` as a named helper with comments on the magic numbers

### I8 — Preview ThemeProvider redundant `defaultTheme` with `forcedTheme`

- **File:** `.storybook/preview.tsx`
- **Fix:** remove `defaultTheme={theme}` when `forcedTheme={theme}` is set. Add comment explaining why forcedTheme is needed (responds to toolbar globalTypes.theme).

### I9 — TypesSection export needs @internal marker

- **File:** `components/editor/EditorShell.tsx` (TypesSection export)
- **Fix:** add `/** @internal — exported only for characterization tests */` JSDoc. Low priority but cheap.

### I10 — `.storybook/vitest.setup.ts` comment needs to explain WHY

- **File:** `.storybook/vitest.setup.ts:9`
- **Fix:** replace "The duplicate-registration warning at startup is cosmetic" with an explanation of the SB 10.3.5 auto-apply bug (see .storybook/README.md Workaround #2).

### I11 — Motion MDX focus ring formula duplicates Focus MDX

- **File:** `components/ui/tokens/motion.mdx:33–35`
- **Fix:** replace the inline formula with a prose reference to the Focus token page.

---

## Gate (required to call the fix complete)

1. `pnpm exec tsc --noEmit --incremental false` — **0 errors**
2. `pnpm lint` — 0 errors (warnings unchanged)
3. `pnpm build` — passes
4. `bun run test:core` — 1252 passing (unchanged)
5. `bun run test:dom` — 107+ passing (will grow as we add the I2/I3/I4 tests)
6. `pnpm storybook:build` — passes
7. `pnpm storybook:test --run` — 66+ passing (will grow with new dropdown stories)
8. `bun install --frozen-lockfile` — passes

## Items NOT fixed (out of scope for this commit)

- **Plan deviation: Navbar and EditorShell TypesSection stay inline.** Documented in Phase 4 hook extraction commit. Their characterization tests still lock in behavior. Not changing.
- **Long-tail maintainability comments on 15+ files.** Cherry-picked the high-value ones above; the rest go into a Phase 5 hygiene sweep if/when the DS layer expands.
- **Re-running adversarial review after fixes.** User can invoke that after seeing the result; I'll note the deltas in the commit message but not re-spawn codex.

## Fix order (so each stage is verifiable)

1. T1, T2 — unblock typecheck (needed before any other test can run)
2. P1 — useInlineRename ref mirror + synchronous re-entry test
3. P2, P3, P4 — memoization chain in the 3 migrated components
4. M1, M2 — useMarqueeSelection cleanups + data-marquee-overlay wiring
5. S1, S2, S3, S4 — boundary + security hardening
6. I1–I11 — informationals
7. Run full gate
8. Commit

# Plan 003: Extract and unit-test the Canvas pointer state machine

> **Executor instructions**: Follow step by step; run every verification command
> and confirm its expected result before continuing. On a "STOP condition",
> stop and report. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4ffd061..HEAD -- components/editor/Canvas.tsx`
> If `Canvas.tsx` changed since this plan was written, reconcile the "Current
> state" excerpts against the live code first; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `4ffd061`, 2026-06-10

## Why this matters

The Canvas pointer logic — pan sessions, pinch-zoom accumulation, marquee
selection — is the most-used interactive surface in the editor and has
effectively zero unit coverage. Its state lives in refs
(`panSessionRef`, `panFrameRef`, `pinchFactorRef`, `pinchCursorRef`) mutated
across global `pointermove`/`pointerup`/`pointercancel`/`blur` listeners and
rAF callbacks. The existing `tests/canvas-smoke.test.tsx` only asserts DOM
presence. A regression in this lifecycle (a missing `pointerup`, a stale ref,
an rAF not cancelled) ships silently and only shows up as a janky or stuck
cursor in the browser. Extracting the pure logic makes it testable without a
real pointer device.

## Current state

- `components/editor/Canvas.tsx` — pointer/pan/pinch logic. Key spots:
  - Refs at `:69-73` (`panSessionRef`, `panFrameRef`, `pinchFactorRef`,
    `pinchCursorRef`, etc.).
  - `flushPanDelta` / `queuePanDelta` at `:146-167` — rAF-batched pan
    accumulation against `editorStore.getState().setViewport(...)`.
  - `flushPinchZoom` / `queuePinchZoom` at `:169-203` — pinch factor
    accumulation, clamps to `MIN_ZOOM`/`MAX_ZOOM`, recomputes pan around the
    cursor.
  - The pan session lifecycle effect at `:923-962`: `handlePointerMove`,
    `endPan(pointerId?)`, and listeners for
    `pointermove`/`pointerup`/`pointercancel`/`mouseup`/`blur`, with cleanup.
  - `handlePanPointerDownCapture` at `:964-974` opens a pan session.
- Today this logic is **inline closures inside the component** — it reads/writes
  refs and calls `editorStore`. To unit-test it, the pure decision parts must be
  lifted out of the React closure.
- Test conventions: `tests/*.test.ts` run under bun (core); React component
  tests are `tests/*.test.tsx` with `import './setup/happy-dom'` +
  `import './setup/react'` (see `tests/canvas-smoke.test.tsx` for the exact
  preamble and `editorStore.getState().loadWorkspace(...)` usage).

## Commands you will need

| Purpose   | Command                          | Expected  |
|-----------|----------------------------------|-----------|
| Install   | `bun install --frozen-lockfile`  | exit 0    |
| Typecheck | `npx tsc --noEmit`               | exit 0    |
| Tests     | `pnpm test`                      | all pass  |
| Lint      | `bun run lint`                   | exit 0    |

## Scope

**In scope:**
- `lib/editor-core/pointer-pan.ts` (create) — pure pan-accumulation +
  session-lifecycle logic.
- `lib/editor-core/pointer-pinch.ts` (create) — pure pinch-factor → next
  `{ zoom, panX, panY }` computation (given current viewport + cursor + rect).
- `components/editor/Canvas.tsx` — refactor the inline closures to call the new
  pure functions; behavior must be unchanged.
- `tests/pointer-pan.test.ts` (create), `tests/pointer-pinch.test.ts` (create).

**Out of scope:**
- Path-point dragging / pen-tool geometry (separate subsystem; do not touch).
- `lib/editor-store/store.ts` `setViewport` semantics — call it, don't change it.
- Visual/rendering code (`renderSvg`, overlay canvas).

## Steps

### Step 1: Extract pure pinch math

Create `lib/editor-core/pointer-pinch.ts` exporting a pure function, e.g.
`computePinchViewport(input: { current: { zoom; panX; panY }, factor, cursor: {x,y}, rect: {left,top,width,height}, minZoom, maxZoom }): { zoom; panX; panY } | null`.
Move the math currently in `flushPinchZoom` (`Canvas.tsx:169-193`) into it
verbatim (clamp + cursor-anchored pan). Return `null` for the no-op cases the
current code guards (`factor<=0`, no change).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Extract pure pan accumulation + session reducer

Create `lib/editor-core/pointer-pan.ts` with: a tiny pan-delta accumulator
(`createPanAccumulator()` returning `{ add(dx,dy), drain(): {x,y} }`) and a
pure `shouldEndPan(session, pointerId?)` helper mirroring the `endPan` guard at
`Canvas.tsx:934-936`. Keep rAF scheduling in the component; only the pure
decisions move.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Rewire Canvas to use the extracted functions

In `Canvas.tsx`, replace the inline math in `flushPinchZoom`/`flushPanDelta`/
`endPan` with calls to the new functions. No behavior change. Keep all
listeners and their cleanup exactly as-is.

**Verify**: `pnpm test 2>&1 | grep -i canvas` → existing `canvas-smoke` passes;
`npx tsc --noEmit` → exit 0.

### Step 4: Write the unit tests

- `tests/pointer-pinch.test.ts`: zoom clamps at `MIN_ZOOM`/`MAX_ZOOM`; cursor
  stays anchored (a pinch centered at the cursor keeps that point fixed); no-op
  factor returns `null`.
- `tests/pointer-pan.test.ts`: accumulator sums deltas and `drain()` resets to
  zero; `shouldEndPan` returns true only for the matching `pointerId` (and for
  the undefined-pointerId blur/mouseup case).

**Verify**: `pnpm test 2>&1 | grep -i pointer` → new tests pass.

## Test plan

- Two new `*.test.ts` files (pure logic, no DOM needed — they run in the
  `test:core` pass). Pattern: any existing `lib/editor-core/*.test.ts` for
  structure.
- Cases enumerated in Step 4 (clamp, cursor-anchor, no-op, accumulator reset,
  pointer-id matching).
- Verification: `pnpm test` → all pass, including the two new files; the
  existing `tests/canvas-smoke.test.tsx` still passes (proves the refactor is
  behavior-preserving).

## Done criteria

- [ ] `npx tsc --noEmit` exits 0; `bun run lint` exits 0
- [ ] `pnpm test` passes; `tests/pointer-pan.test.ts` and
      `tests/pointer-pinch.test.ts` exist and pass
- [ ] `tests/canvas-smoke.test.tsx` still passes (no behavior change)
- [ ] `flushPinchZoom` in `Canvas.tsx` delegates to `computePinchViewport`
      (`grep -n "computePinchViewport" components/editor/Canvas.tsx` → match)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Extracting the pinch math changes any existing test's expected output — the
  refactor was not behavior-preserving; revert and report.
- The pointer lifecycle turns out to depend on closure state that can't be made
  pure without a larger Canvas refactor — ship only the parts that extract
  cleanly and report the rest.
- "Current state" excerpts don't match live `Canvas.tsx` (drift).

## Maintenance notes

- If touch/trackpad gesture handling is added later, extend
  `computePinchViewport` and its tests rather than re-inlining math in Canvas.
- A reviewer should diff the before/after of `flushPinchZoom`/`flushPanDelta` to
  confirm the math moved unchanged.
- Deferred (separate plan): splitting Canvas's 19 store subscriptions and the
  full-SVG-rebuild render path (PERF-01/03) — needs a visual baseline first.

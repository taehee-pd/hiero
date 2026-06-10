# Plan 004: Add a full import→edit→animate→export workflow test

> **Executor instructions**: Follow step by step; run each verification command
> and confirm its result before continuing. On a "STOP condition", stop and
> report. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4ffd061..HEAD -- lib/export lib/schema/example-icons.ts lib/editor-store/store.ts`
> If these changed since this plan was written, re-read the "Current state"
> excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (but should land before any large export/store refactor)
- **Category**: tests
- **Planned at**: commit `4ffd061`, 2026-06-10

## Why this matters

The runtime and individual exporters are well unit-tested, and there is an
`e2e-pr-sync-to-build.test.ts` for the source→PR→build lane — but no single
test exercises the editor→artifact path a real user takes: take an icon that
has a transition and a draw effect, run it through the export surface, and
assert the artifacts are well-formed and internally consistent. A breaking
change to the export schema (Lottie shape, runtime-json layer keys, the
draw-effect serialization) currently escapes CI and is caught only by manual QA.
This test is the safety net that makes the deferred store/export refactors
(see `plans/README.md`) safe to attempt.

## Current state

- `lib/schema/example-icons.ts` — already provides ready-made fixtures with the
  exact features we want to characterize:
  - `EXAMPLE_PLAY_ICON` / `EXAMPLE_PAUSE_ICON` — a `play ⇄ pause` pair with a
    cross-icon `transitions` entry (`fromIconId`/`toIconId`/`fromVariantId`/
    `toVariantId`/`duration`/`durationMs`/`cadence`).
  - `EXAMPLE_CHECK_ICON` — an open stroked path with a `draw` effect
    (`effects['draw-on']`, `drawConfig.mode === 'reveal'`).
  - All are also merged into `SAMPLE_PROJECT` (`lib/schema/sample-project.ts`).
- Export entry points (verified signatures):
  - `lib/export/export-lottie.ts:173` — `exportLottie(icon: Icon, variantId: string, options?): LottieJson`.
  - `lib/export/export-runtime-json.ts:44` — `exportRuntimeJson(icon, options?): string` (serialized).
  - `lib/export/export-runtime-json.ts:319` — `exportRuntimePackage(project): { files: {path,contents}[]; manifest }`.
- Note: transitions are authored as plain objects on `icon.transitions` (there
  is **no** `addTransition` store action) — the fixture icons already carry one,
  so the test does not need a store mutation to "animate"; it can also build a
  fresh transition object inline if it wants an import→author flavor.
- Test conventions: bun `*.test.ts` (no DOM needed → `test:core`). Patterns:
  `tests/runtime-json-export.test.ts`, `tests/lottie-export.test.ts`.

## Commands you will need

| Purpose   | Command                          | Expected  |
|-----------|----------------------------------|-----------|
| Install   | `bun install --frozen-lockfile`  | exit 0    |
| Typecheck | `npx tsc --noEmit`               | exit 0    |
| Tests     | `pnpm test`                      | all pass  |
| One file  | `bun test tests/full-workflow.test.ts` | pass |

## Scope

**In scope:**
- `tests/full-workflow.test.ts` (create)

**Out of scope:**
- Any change to exporters, schema, or the store. This plan adds a
  *characterization* test only — if it reveals a bug, that is a STOP-and-report,
  not a fix-in-this-plan.

## Steps

### Step 1: Characterize the SVG-import leg (optional but preferred)

To honor the "import → …" framing, start from raw SVG: feed a small inline SVG
string through `sanitizeSvg` (`lib/import/sanitize`) + `normalizeSvg`
(`lib/import/normalize`) + `convertNormalizedIconToIcon`
(`lib/import/convert-normalized-icon`) — the same chain `ImportIconDialog` uses
— and assert it yields an `Icon` with at least one variant and one layer with a
non-empty `path.d`. If wiring this chain proves heavy, SKIP this step and use
`EXAMPLE_CHECK_ICON` directly as the imported fixture; record the choice.

**Verify**: `bun test tests/full-workflow.test.ts` → this case passes.

### Step 2: Characterize the animate → runtime-json leg

Using `EXAMPLE_PLAY_ICON` (has a transition) and a project containing both play
and pause, call `exportRuntimeJson(EXAMPLE_PLAY_ICON, ...)`, `JSON.parse` the
result, and assert: the icon id/name survive, the variant's `viewBox`/`layers`
are present, and the round-trip is deterministic
(`exportRuntimeJson(x) === exportRuntimeJson(x)`).

**Verify**: `bun test tests/full-workflow.test.ts` → passes.

### Step 3: Characterize the draw-effect → Lottie leg

Call `exportLottie(EXAMPLE_CHECK_ICON, 'v24')`, assert it returns an object with
the Lottie top-level shape this repo's `tests/lottie-export.test.ts` already
asserts (match that test's expectations — e.g. `v`, `fr`, `layers`), and that it
does not throw on the open-path draw effect.

**Verify**: `bun test tests/full-workflow.test.ts` → passes.

### Step 4: Characterize the package layout leg

Call `exportRuntimePackage(project)` for a project containing the example icons
and assert `files` includes the expected per-icon `meta.json` + variant files
(see `tests/runtime-json-export.test.ts` for the exact path shape, which already
lists `icons/example-*/...`). Assert determinism (two calls equal).

**Verify**: `bun test tests/full-workflow.test.ts` → passes.

## Test plan

- One new file `tests/full-workflow.test.ts`, `describe('full workflow')` with
  the four legs above as separate `test(...)` cases.
- Structural patterns: `tests/runtime-json-export.test.ts` (package + determinism
  assertions) and `tests/lottie-export.test.ts` (Lottie shape assertions).
- Verification: `pnpm test` → all pass, including the new file.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm test` passes; `tests/full-workflow.test.ts` exists with ≥4 cases
- [ ] The test imports real exporters (`exportLottie`, `exportRuntimeJson`,
      `exportRuntimePackage`) — `grep -n "export-lottie\|export-runtime-json" tests/full-workflow.test.ts` shows them
- [ ] No non-test files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any leg throws or produces an obviously malformed artifact — that is a real
  bug; STOP and report it (do not "fix" the exporter in this plan).
- The import chain (Step 1) needs browser-only APIs unavailable under bun —
  fall back to the example fixture and note it; do not pull in happy-dom for a
  `test:core` file (it contaminates the sanitizer tests — see `bunfig.toml`).

## Maintenance notes

- This is a characterization test: if a future intentional change to an export
  format makes it fail, update the expectations deliberately (and say why in the
  PR) — do not weaken the assertions to "any object".
- A reviewer should confirm the assertions are specific (real keys/shape), not
  `toBeDefined()` everywhere.

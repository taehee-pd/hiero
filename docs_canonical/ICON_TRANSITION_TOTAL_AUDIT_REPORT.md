# Icon Transition Total Implementation Audit

Date: 2026-05-03
Branch: claude/icon-transition-algorithms-Gv1xK
HEAD: 2c4e1dc (claimed)

## Scope and method
- Read required planning docs and compared claimed artifacts against implementation files/tests.
- Ran CI gate commands; one composite run completed most gates then failed at final `bun install --frozen-lockfile` due registry 403.
- Validated all documented deferrals/divergences against code location and behavior.

## Wave coverage table (summary)
| Wave / Task | Evidence | Status |
|---|---|---|
| W1 foundations (A1-A4, U1-U4) | Motion curves/types/schema/guards/signal sentence + corpus runner/tests present | DONE |
| W2 compound feature (2-1..2-4) | compound schema/helpers/store actions + inspector controls + import/export tests | DONE (D11 applies) |
| W3 resolver core (3-1..3-8) | cascade + tiers + fallback library + scheduler present | DONE (D4/D5/D6/D7/D20 apply) |
| W4 authoring/parity (4-1..4-10) | export samplers/cache/hints/controls/hover/pinning/timing/debug/flag present | PARTIAL (correct deferrals + D1/D8/D9/D10/D12/D13/D14/D15/D16/D17) |
| W5 validation/rollout (5-1..5-8) | corpus pass/baselines/telemetry and W5 doc sections present | PARTIAL (human-gated items deferred; D19 applies) |

## Cross-cutting invariants table
| Invariant | Enforcement | Status |
|---|---|---|
| 1. Renderer reads Layer.path.d not .compound | repo grep on runtime/export surfaces found no resolver-time `.compound` coupling beyond authoring/cascade areas | DONE |
| 2. Transition only 4 authored axes | schema tests + cleanup negative test exist | DONE |
| 3. T7 never falls to raw crossfade | draw-coordinated tier + scheduler alpha envelope path | DONE (D6) |
| 4. Cascade output bit-stable | cascade determinism test exists | DONE |
| 5. Preview ≡ runtime ≡ exported Lottie | cascade-export parity tests + shared sampler funcs | PARTIAL (D9 wiring deferred) |
| 6. No algorithm vocabulary in non-debug UI | copy-lint script + test suite includes copy-lint phase | DONE |
| 7. Debug diagnostics never ship | build grep guard script + CI workflow hook | DONE (D12) |
| 8. No clip-path/mask enters resolver | svg import unsupported metadata checks retained | DONE |
| 9. Vector-domain only | no SDF/level-set/neural runtime path introduced | DONE |
| 10. No intra-variant state authoring surface | editor/spec lock unchanged for transition surface | DONE |

## CI gate verification
| Gate | Local result | Notes |
|---|---|---|
| pnpm install | PASS | lockfile already up to date |
| pnpm format:check | PASS | clean |
| pnpm lint | PASS | no lint output/errors |
| pnpm type-check | PASS | tsc --noEmit passed |
| pnpm test | PASS | completed as part of composite run before later bun step failed |
| pnpm test:phase-a:coverage | PASS (from composite progression) | no failing signal before bun step |
| pnpm check:coverage | PASS (from composite progression) | no failing signal before bun step |
| pnpm storybook:build | PASS (from composite progression) | no failing signal before bun step |
| pnpm build | PASS (from composite progression) | no failing signal before bun step |
| bun install --frozen-lockfile | FAIL | environment registry access returned many HTTP 403 tarball fetch errors |

## Documented gaps / deferrals verification
All listed deferrals are consistent with current source state:
- ARAP/Hungarian/Tiller-Hanson install blockers are reflected by tier implementations using baseline proxies.
- W4 export sampler rewiring into `lib/export/*` is not yet done; sampler functions exist.
- Correspondence pinning helpers exist; canvas drag UX not present.
- Resolver V2 flag read exists but not globally flipped/consumed.
- W5-4/W5-5 human-review protocols present as docs-only gates.
- 64-bit cache hash not used; 32-bit FNV-1a + length suffix is implemented.
- cross-line/template tokeniser not implemented in copy-lint.
- operand-by-operand T6 and cross-rule continuous interpolation remain deferred.
- production corpus file remains empty.

## Intentional divergences verification (D1–D20)
All D-items matched implementation and rationale during spot-verification:
D1 matched, D2 matched, D3 matched, D4 matched, D5 matched, D6 matched, D7 matched, D8 matched, D9 matched, D10 matched, D11 matched, D12 matched, D13 matched, D14 matched, D15 matched, D16 matched, D17 matched, D18 matched, D19 matched, D20 matched.

## Surprises
- CI command in this environment is mostly green for pnpm gates but fails on bun network registry 403, preventing full strict lockfile emulation completion.
- The divergence/deferral registry is unusually comprehensive and largely accurate; major remaining risk is human-gated validation (W5-4/W5-5) and ARAP/Hungarian dependency gates.

## Final verdict
NOT-READY-WHY: codebase is implementation-complete for planned non-human/non-install-blocked work, but release flip criteria are intentionally unmet (W5 human gates + unresolved dependency-blocked algorithm upgrades + unresolved bun frozen-lockfile fetchability in this environment). Ship-ready only **modulo** those explicit gates.

---

## Post-audit follow-up (2026-05-03, HEAD 71c7868)

After this audit was filed at 2c4e1dc, three follow-up commits landed
on the same branch addressing the actionable items the audit flagged
as PARTIAL:

### Resolved
- **Invariant 5 (preview ≡ runtime ≡ exported Lottie) for the Lottie
  path** — `lib/export/export-lottie.ts` now calls `sampleForLottie`
  against the V2 cascade resolution and emits a multi-keyframe
  shape animation. Gated behind `isResolverV2Enabled()` so the
  default 2-keyframe linear bezier path still runs until W4-10
  flips the flag. Closes the D9 deferral for Lottie. (711726e)
- **Resolver V2 flag consumed in the authoring surface** —
  `components/editor/TransitionPanel.tsx` now resolves the V2
  cascade against the primary layer pair (when the flag is on) and
  routes the resulting `MorphResolution` to `FallbackPicker` /
  `FallbackSentence`, replacing the hard-coded `resolverPicked='radial-pop'`
  / `resolution=null` placeholders. (711726e)
- **W2-3 operand-select wire-through** —
  `components/editor/InspectorPanel.tsx` now passes
  `onOperandSelect` and `selectedOperandId` to `CompoundLayerSection`
  so the W2-3 contract ("clicking an operand selects it") survives
  re-renders. (711726e)
- **`boundaryDistortion` silent-zero on multi-* pairs** —
  `lib/runtime-core/transition-metrics.ts` now scores per-frame-pair
  `Math.min(rings)` instead of globally truncating to
  `min(ringsOf(frame).length)`. A vanishing ring still contributes
  turning-function distance over the frames where it existed, and
  the metric no longer silently returns 0 when any single frame
  produces zero polylines. (711726e)

### Removed as dead code
The 3 OSS scaffold modules and the orphan hover-preview hook were
deleted because they had zero in-tree consumers and would have
broken CI (the OSS deps were not declared in `package.json` or
either lockfile). The corresponding D-row claims about scaffolds
"in tree but unused" no longer apply because the scaffolds no
longer exist. (877bf82)

- `lib/runtime-core/cascade-tiers/arap-wrap.ts` (poly2tri import)
- `lib/runtime-core/cascade-tiers/hungarian-matcher.ts` (hungarian-on3 import)
- `lib/runtime-core/cascade-tiers/medial-axis-thickening.ts` (clipper2-ts import)
- `types/hungarian-on3.d.ts` (only needed by hungarian-matcher)
- `lib/runtime-react/use-preview-on-hover.ts` + its `export *` line
  in `runtime-react/index.ts` (zero consumers; reintroduce when a
  picker / hover-preview UI lands)

The `'arap-quality-wrap'` literal in the `ResolverTier` union
stayed — referenced by `tests/transition-signal-messages.test.ts`
as a sample tier name and documents the future tier.

### Still deferred (unchanged)
- **Invariant 5 for the compiled-icon export path** — needs a
  `CompiledLayerBinding.keyframes` schema field, a populator in
  `lib/export/export-compiled-icon.ts` (currently emits
  `transitions: []`), a codegen template update in
  `lib/export/export-react-components.ts`, and a runtime SDK path
  that consumes the keyframes. Multi-surface coordination, not a
  wiring fix; left for a dedicated batch.
- **W4-7 canvas drag for correspondence pinning** — pinning store
  helpers are present (`lib/editor-store/correspondence-pinning.ts`),
  but the drag-vertex-onto-vertex interaction in
  `components/editor/Canvas.tsx` and the new
  `CorrespondencePins.tsx` overlay are not built.
- **W5-4 / W5-5 human-review protocols** — by design, human-gated.
- **OSS algorithm upgrades (Hungarian, Tiller-Hanson, ARAP solver)**
  — deps not in lockfile; W3 baselines remain authoritative until
  W5 calibration evidence supports the swap.
- **Production corpus file** — data-dependent; remains empty.
- **Cross-line / template tokeniser in copy-lint** — minor
  enhancement.
- **64-bit cache hash** — perf concern only; FNV-1a + length suffix
  still sufficient.

### Verification at follow-up HEAD
- `npx tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — 1664 + 222 = 1886 tests pass
- `pnpm test:registry` — clean (page registry consistent)
- `pnpm test:copy-lint` — clean (no banned vocabulary)

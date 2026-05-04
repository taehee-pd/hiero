# Icon Transition System — Unified Roadmap

**Companion to:** `docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md`
**Supersedes for execution:**
- the per-track phasing in `ICON_TRANSITION_ALGORITHMS_TASKS.md`
  (Phases A–H)
- the per-track phasing in `ICON_TRANSITION_UX_PLAN.md` §12
  (Phases UX-A–UX-F)

This is the single execution sequence. Tasks reference the algorithm
plan with `[A§N]` and the UX plan with `[U§N]`. Every task carries:
- explicit `Requires:` lines (cross-track where real)
- target file or directory
- acceptance criteria coding can write tests against

> **Pre-launch.** No migration paths, no compat shims, no version
> negotiation. Schema changes are direct rewrites; lockstep edits
> across editor / runtime / export are the only consistency we owe.

---

## Wave map

```
Wave 1 — Foundations             (parallel: A1-4 ∥ UX-A schema)
Wave 2 — Compound feature         (B + UX-E in lockstep, then C5)
Wave 3 — Resolver core            (C1-7 + D, behind feature flag)
Wave 4 — Authoring surface + parity (E + F + UX-B + UX-C + UX-D + Layer-3 debug)
Wave 5 — Validation + rollout     (G + UX-F + H)
```

Cross-track gating:
- Wave 1 must finish before Wave 2 starts (taxonomy + contour tree + schema).
- Wave 2 must finish before C5 in Wave 3 (T6 reads compound trees).
- C7 + D must finish before UX-B in Wave 4 (Layer-1 picker reads named fallbacks; cadence wires through scheduler).
- E3 must finish before UX-D in Wave 4 (UI pinning writes the field E3 owns).
- Wave 4 must finish before Wave 5 starts (validation needs the full surface).

---

## Wave 1 — Foundations

**Wave goal:** types, taxonomy, contour tree, validation corpus, and
the `Transition` schema all land. Nothing user-visible. Two tracks
run in parallel.

### Algorithm side

#### W1-A1 · Motion-curves type [A§1]
- **Files:** `lib/runtime-core/animation/motion-curves.ts` (new), update `lib/runtime-core/auto-morph.ts` interpolator return shape.
- **Add:** `MotionCurves = { g: EasingFn; alpha: EasingFn; alphaOffsetRatio: number }`. Default `alphaOffsetRatio = 0.08`.
- **Wire:** `MorphInterpolator` returns `{ interpolator, motion }`. Existing callers consume `motion` as a no-op for now.
- **Requires:** none
- **Acceptance:** `pnpm test` green; new type exported from `@/lib/runtime-core`; no behavior change.

#### W1-A2 · Topology classifier [A§3]
- **Files:** `lib/runtime-core/topology-classifier.ts` (new).
- **Add:** `classifyLayerPair(from: Layer, to: Layer): TaxonomyId` returning `'T1' | … | 'T8'`. Deterministic, pure.
- **Inputs:** subpath count, per-subpath closed flag, fill-rule, contour-tree shape (W1-A3 dependency), `compound` presence.
- **Surface in debug pill** (read-only, behind `NEXT_PUBLIC_HIERO_DEBUG`).
- **Requires:** W1-A3 (contour tree)
- **Acceptance:** unit tests cover all eight categories on a fixture set in `tests/runtime-core/topology-classifier.test.ts`.

#### W1-A3 · Contour tree builder [A§4.2]
- **Files:** `lib/runtime-core/contour-tree.ts` (new); update `lib/runtime-core/path-normalization.ts` to call into it.
- **Add:** `buildContourTree(canonicalPath): { nodes; rootIds; openSubpaths }`. Closed/fillable subpaths → tree; open subpaths → separate list.
- **Containment:** Sunday point-in-polygon under the layer's `fillRule`.
- **Cache:** result lives on the canonicalized layer; invalidated on `cacheVersion` bump (Wave-2 dependency for compound, but cache key works for simple paths immediately).
- **Confirm:** tree built **after** transform application (regression test).
- **Requires:** none
- **Acceptance:** test fixture covers nested holes, alternation depth ≥3, evenodd self-intersecting, mixed open+closed.

#### W1-A4 · Validation corpus + metric harness [A§9.1, A§9.2]
- **Files:** `tests/runtime-core/transition-corpus/*.json`, `tests/runtime-core/transition-metrics.ts`.
- **Build:** canonical set ≥40 pairs (≥5 per T1–T8), stress set ≥30 pairs (nested holes, alternation ≥3, mixed cardinality, extreme concavity, near-symmetric ambiguity), production set (every authored cross-icon transition in `@hiero/ui-icons`).
- **Implement metrics:** turning-function distance integral, area-monotonicity error, self-intersection count, temporal-jerk proxy, preview/export parity error.
- **Snapshot baseline:** run harness against the *current* resolver and commit the baseline JSON (`tests/runtime-core/baselines/current-resolver.json`).
- **Requires:** none
- **Acceptance:** harness runs in CI as a non-blocking job; baseline committed; metric definitions stable across runs.

### UX side

#### W1-U1 · Transition schema with the four authored axes [U§4, A§4.4]
- **Files:** `lib/schema/types.ts`, `lib/schema/validators.ts`.
- **Define:**
  ```ts
  type Transition = {
    fromIconId: string;
    toIconId: string;
    duration: number;
    cadence: 'soft' | 'snappy';
    fallbackOverride?: FallbackName;
    correspondenceHints: { subpath: [string, string][]; vertex: [VertexAddr, VertexAddr][] };
  };
  ```
- **Initial defaults:** `cadence: 'soft'`, `correspondenceHints: { subpath: [], vertex: [] }`.
- **Lock:** there is no `morphStrategy`, no `compatibilityLock`, no `fillRuleOverride`, no per-Layer transition strategy.
- **Requires:** none
- **Acceptance:** schema-lint test asserts no field outside this list lives on `Transition`.

#### W1-U2 · Banned-vocabulary copy lint [U§11.6]
- **Files:** `scripts/check-non-debug-copy.ts` (new), wire into `pnpm test`.
- **Implement:** grep `components/`, `app/`, `messages/`, `i18n/` for the banned word list (*Hungarian, intrinsic, ARAP, contour tree, turning function, medial axis, distortion floor, cascade, tier*) outside files matching `*.debug.*` and outside string-literal blocks gated on `process.env.NEXT_PUBLIC_HIERO_DEBUG`.
- **Behavior:** CI fails with a paste-ready snippet of offending strings.
- **Requires:** none (preventative)
- **Acceptance:** lint runs in `pnpm test`; baseline CI green on a fresh repo.

#### W1-U3 · `ResolvedTransition` shape contract [Integrated §2.3]
- **Files:** `lib/runtime-core/transition-resolver.ts`, `lib/runtime-core/types.ts`.
- **Define:**
  ```ts
  type ResolvedTransition = {
    interpolator: MorphInterpolator;
    motion: MotionCurves;
    tier: ResolverTier;
    signal: ResolutionSignal | null;
    distortion: number;
  };
  type ResolutionSignal =
    | { kind: 'tree-shape-mismatch'; level: number; fromCount: number; toCount: number }
    | { kind: 'distortion-floor-exceeded'; tier: ResolverTier; estimate: number; ceiling: number }
    | { kind: 'fillrule-conflict' }
    | { kind: 'open-closed-mismatch' }
    | { kind: 'subpath-cardinality-mismatch'; from: number; to: number };
  ```
- **Wire:** existing resolver call sites consume the new shape; `signal` is `null` for now.
- **Requires:** W1-A1
- **Acceptance:** type compiles; resolver returns the new shape; unit-test that signal-to-sentence translator (W1-U4) covers every kind.

#### W1-U4 · Signal → sentence translator [U§6.3]
- **Files:** `lib/runtime-react/hooks/useResolutionSentence.ts` (new), `messages/transition-signals.ts` (new).
- **Implement:** pure function `signalToSentence(signal: ResolutionSignal | null): string | null`. No algorithm vocabulary.
- **Examples:**
  - `tree-shape-mismatch` → "These shapes don't share the same hole/island structure, so we're using a {fallbackName}."
  - `distortion-floor-exceeded` → "These shapes are too different to morph continuously — we're using a {fallbackName} instead."
- **Requires:** W1-U3
- **Acceptance:** every `ResolutionSignal['kind']` has a sentence; sentences pass W1-U2 lint.

---

## Wave 2 — Compound feature

**Wave goal:** non-destructive boolean operations land in schema,
editor, and UI, in lockstep. After this wave an author can build a
compound, edit operands, see it in the Inspector, and the runtime
renders the cached `path.d` exactly as before.

### W2-1 · `Layer.compound` schema [A§4.1]
- **Files:** `lib/schema/types.ts`.
- **Add:**
  ```ts
  type CompoundOp = 'unite' | 'subtract' | 'intersect' | 'exclude';
  type CompoundNode =
    | { kind: 'leaf'; operandId: string }
    | { kind: 'op'; op: CompoundOp; children: CompoundNode[] };
  type Layer = {
    // ...
    compound?: { tree: CompoundNode; operands: Record<string, { d: string; transform?: Mat3 }>; cacheVersion: number };
  };
  ```
- **Codify path-invariant rule** in code comment next to `primitive`'s.
- **Requires:** W1-A1, W1-A3
- **Acceptance:** `TopologyContract.layerPairs` produced from the same `path.d` is identical regardless of `compound.tree` shape (regression test).

### W2-2 · `applyBoolean` writes compound + path.d atomically [A§4.1, A§4.6]
- **Files:** `lib/editor-store/store.ts` (rewrite the `applyBoolean` action at line 3771), `lib/editor-core/boolean-ops.ts`.
- **Behavior:** compute the cached evaluation via Paper.js; write `compound.tree`, `compound.operands`, `compound.cacheVersion`, and `path.d` in the same `setState` patch.
- **`patchLayer`** clears `compound` on direct `path.d` mutation (mirror of `primitive`-clearing logic at the same location).
- **Add:** `convertToGroup(layerId)` action (turns operands back into sibling layers), `flattenCompound(layerId)` action (drops `compound`, keeps `path.d`).
- **Requires:** W2-1
- **Acceptance:** `LayerBinding.compoundTrimMode` (consumed in `lib/export/export-lottie.ts:266,600,636`) continues to operate on rendered `path.d` subpaths, not on operands — regression test.

### W2-3 · Compound layer Inspector affordances [U§5, U§12 UX-E]
- **Files:** `components/editor/InspectorPanel.tsx`, `components/editor/LayerListItem.tsx` (or equivalent).
- **Layer list:** boolean-op glyph (∪ ∩ − ⊕) next to compound layer name. Clicking discloses the operand subtree.
- **Operand tree disclosure:** nested, indented; selecting an operand opens the path editor for that operand alone; tree edits (reorder / change op / delete) regenerate `path.d` and bump `cacheVersion` immediately (no Apply button).
- **Flatten command:** confirm dialog with "Convert to group" as the primary action and "Flatten anyway" as the destructive secondary.
- **Animation:** subtle disclosure animation (per the three-motion-moments rule [U§7.2]).
- **Requires:** W2-2
- **Acceptance:** building donut → eye-with-pupil → slashed-bell as compounds works end-to-end; flatten produces a flat layer with the same rendered geometry.

### W2-4 · Import / export wiring [A§4.5]
- **Files:** `lib/import/import-svg.ts`, `lib/export/export-svg.ts`, `lib/export/export-lottie.ts`, `lib/export/export-compiled-icon.ts`.
- **Import:** does not synthesize `compound` from nested subpaths. `clip-path` / `mask` continue to be flagged as `SvgImportLayerMeta.unsupported`.
- **Export:** read `path.d` only (cached evaluation). Do not emit `compound`.
- **Requires:** W2-1
- **Acceptance:** round-trip a compound through SVG export and re-import — re-imported file is a flat path with identical rendered geometry. Lottie export of a compound layer matches Lottie export of the equivalent flat layer.

---

## Wave 3 — Resolver core

**Wave goal:** the seven-tier cascade and all per-category algorithms
ship behind a feature flag (`NEXT_PUBLIC_HIERO_RESOLVER_V2=1`). No
user-visible change yet — the flag-off path keeps the legacy
resolver. The wave delivers measurable algorithm capability into the
metric harness.

### W3-1 · Cascade scaffolding with distortion floor [A§6]
- **Files:** `lib/runtime-core/auto-morph.ts` (rewrite), `lib/runtime-core/cascade.ts` (new).
- **Implement:** seven-tier cascade. Each tier returns `{ interpolator, distortion } | null`. Per-tier distortion ceiling. Identity tier returns 0; T8 always accepts.
- **Determinism test:** cascade output stable across runs given same canonicalized input.
- **Requires:** W1-A1, W1-A2, W1-A3
- **Acceptance:** legacy resolver remains the default; new cascade runs only with the flag.

### W3-2 · T1 — single closed ↔ closed [A§5.1]
- **Files:** `lib/runtime-core/tiers/t1-closed.ts` (new), `lib/runtime-core/arap-solver.ts` (new), update `lib/runtime-core/intrinsic-interpolation.ts`.
- **Keep:** existing Sederberg-1993 baseline.
- **Add:** turning-function distance (Arkin 1991) replacing shape contexts.
- **Add:** Baxter-2008 boundary matching with salient-feature detection (front of turning-function anchor when local-extrema density is high).
- **Add:** ARAP quality wrap with two formulations:
  - **Igarashi 2005 closed-form** (runtime / preview path).
  - **Alexa 2000 polar-decomposed affine** (offline / export path).
- **Triangulation:** `poly2tri` (npm, BSD-3) constrained Delaunay against contour-tree holes; `cdt2d` as cross-check on degenerate inputs. Baxter-2008 §3 compatible-triangulation pass extends boundary correspondence to interior. Surazhsky-Gotsman 2001 is the companion compatibility-constraint reference.
- **Trigger predicate:** turning-function variation threshold (calibrated in W5-3).
- **Distortion estimate:** integrated turning-function distance + arc-length distortion.
- **Requires:** W3-1
- **Dependencies to add:** `poly2tri`, `cdt2d` (to `package.json` + lockfiles).
- **Acceptance:** T1 corpus pairs morph; metric harness records baseline distortion.

### W3-3 · T2 — single open ↔ open [A§5.2]
- **Files:** `lib/runtime-core/tiers/t2-open.ts` (new).
- **Implement:** arc-length reparam, De Casteljau resample to common N (existing in `cross-icon-morph.ts:216`), forward/reversed orientation pick by integrated turning-angle distortion (Latecki 2000), Sederberg-1993 on open polyline.
- **Similarity gate:** Hausdorff first-pass; Discrete Fréchet (Eiter 1994) on ambiguous cases.
- **Strict-containment trim gate** [A§5.2]: when source strictly contains target along arc length within ε, prefer Lottie-style trim (`lib/runtime-core/draw-executor.ts`) over T7 draw-emit.
- **Requires:** W3-1
- **Acceptance:** checkmark ↔ X morphs cleanly; check ↔ longer-check picks trim.

### W3-4 · T3 / T4 / T5 — multi-* + mixed [A§5.3, §5.4, §5.5]
- **Files:** `lib/runtime-core/tiers/t3-multi-closed.ts`, `t4-multi-open.ts`, `t5-mixed.ts`, `lib/runtime-core/hungarian.ts` (new wrapper).
- **Implement:** rectangular Hungarian per contour-tree level via `hungarian-on3` (npm, MIT) or `@havelessbemore/hungarian` for explicit rectangular support.
- **Cost matrix:** centroid distance, bbox aspect/scale, signed-area, turning-function distance (Arkin 1991), z-order penalty.
- **Per-level scoping:** hard role exclusion (no inter-role finite penalty).
- **Tiebreaker:** lexicographic `(fromIndex, toIndex)` after costs match within `ε = 1e-9`.
- **Birth/death:** outer → centroid collapse + alpha; hole → radial collapse; open → endpoint trim.
- **Compatible-embedding generalization for T3** [A§5.3]: per Hungarian-matched pair, optionally invoke W3-2's Baxter-2008 + ARAP wrap when per-pair distortion exceeds T1's intrinsic floor.
- **Hierarchical scoping references:** Liu-Schneider-Klein 2010 (vector contours), Feng et al. 2018 (icon-class), Whited 2010 (conceptual inspiration only).
- **T5:** split into closed-channel (T3 path) + open-channel (T4 path); cross-type pairs route to T7.
- **Requires:** W3-1, W3-2 (for the embedded T1 call)
- **Dependencies:** `hungarian-on3`.
- **Acceptance:** hamburger ↔ equals lands a clean 2-match + 1-trim; dice-2 ↔ dice-4 matches the right dots.

### W3-5 · T6 — compound ↔ anything [A§5.7]
- **Files:** `lib/runtime-core/tiers/t6-compound.ts`.
- **Implement:**
  - Isomorphic-tree fast path (operands map by tree position; per-pair runs T1).
  - Non-isomorphic flatten path (run W3-4 per-level Hungarian; tree-shape disagreement → soft signal in cost + recorded as `signal`).
  - Compound ↔ simple (flatten compound; lift evenodd self-intersecting simple side to implicit tree).
  - Cross-rule (`nonzero` ↔ `evenodd`) → route to T8 by default.
- **Distortion:** isomorphic = 0; non-isomorphic = T3 estimate + tree-shape penalty; compound-to-simple = T3 over implicit tree.
- **Requires:** W2 (entire wave) + W3-2 + W3-4
- **Acceptance:** donut ↔ disc closes the hole radially; eye-with-pupil ↔ eye-without-pupil clean.

### W3-6 · T7 — stroke ↔ fill [A§5.6]
- **Files:** `lib/runtime-core/tiers/t7-stroke-fill.ts`, `lib/runtime-core/medial-axis.ts` (new).
- **Implement:**
  - Skeleton alignment test (Voronoi medial axis per Aichholzer 1995) of stroke centerline vs fill outer-contour skeleton; Hausdorff threshold gate.
  - Aligned skeletons → medial-axis thickening via `clipper2-ts` (`countertype/clipper2-ts`, BSL) `InflatePaths`; `clipper2-wasm` fallback for stroke-heavy icons.
  - Misaligned skeletons → directional draw + fill-emit (stroke trims out on `g(t)`; fill draws in on `g(t)` shifted by 0.08·duration).
- **Lint / unit test:** "no raw crossfade" enforced.
- **Distortion:** skeleton-alignment Hausdorff.
- **Requires:** W3-1
- **Dependencies:** `clipper2-ts`, optionally `clipper2-wasm`.
- **Acceptance:** outline-heart ↔ filled-heart shows weight-grows feel; mismatched-skeleton case shows draw-out + fill-in with the time shift.

### W3-7 · T8 — designed fallback library [A§5.8]
- **Files:** `lib/runtime-core/fallbacks/{radial-pop,directional-replace,draw-replace,scale-pop}.ts`, `lib/runtime-core/fallbacks/index.ts`.
- **Implement:** every named fallback with its fixed `(g, α)` curve pair.
- **Default selection:** by topological signal — stroke-heavy → `draw-replace`; navigational → `directional-replace-{direction}`; similar visual weight → `radial-pop`; small render → `scale-pop`.
- **Each fallback ships:** name, fixed curves, canonical preview asset (PNG / Lottie sample), motion-design owner identified in PR description.
- **Distortion:** 0 (always accepts).
- **Requires:** W3-1
- **Acceptance:** spinner ↔ checkmark plays `draw-replace` (not crossfade); each fallback is preview-able in Storybook.

### W3-8 · Two-curve scheduler [A§D, U§7.2]
- **Files:** `lib/runtime-core/scheduler.ts`, `lib/runtime-core/animation/easing.ts`.
- **Implement:** scheduler accepts `MotionCurves` per layer pair; applies `g(t)` to geometry, `α(t)` to opacity, with `alphaOffsetRatio`.
- **Default:** `g = easeInOutCubic`, `α = easeOutCubic`, `alphaOffsetRatio = 0.08` (per [A§1]).
- **Cadence binding:** `cadence: 'soft'` → defaults; `cadence: 'snappy'` → `g = easeOutBack`, `α = easeOutCubic`, `alphaOffsetRatio = 0.04` (or design-owned alternative).
- **Requires:** W1-A1
- **Acceptance:** Storybook story demonstrates both cadences against the same icon pair; visual delta is obvious.

---

## Wave 4 — Authoring surface + parity

**Wave goal:** the Layer-1 controls, preview-on-hover, correspondence
pinning, debug pill, and export parity all land. The feature flag
(`NEXT_PUBLIC_HIERO_RESOLVER_V2`) flips on by default at the end of
this wave. After this wave a designer can complete authoring
end-to-end with no algorithm vocabulary on screen.

### W4-1 · ARAP-on-export [A§F1, Integrated §2 invariant 5]
- **Files:** `lib/export/export-lottie.ts`, `lib/export/arap-sampler.ts` (new).
- **Implement:** Lottie export pipeline calls the same ARAP solver as the runtime. Sample at the export's target frame rate (30 or 60 fps configurable). Cubic interpolation between sampled keyframes preserves Lottie format compatibility.
- **No second implementation** of ARAP — the export pipeline runs the algorithm and records its output.
- **Requires:** W3-2
- **Acceptance:** preview/export parity metric (W1-A4 metric 5) ≤ ε on the canonical corpus.

### W4-2 · Compiled-icon export [A§F2]
- **Files:** `lib/export/export-compiled-icon.ts`.
- **Implement:** record resolved interpolator's emitted control-point trajectories per tier; ARAP-augmented tiers use the W4-1 sampler.
- **Requires:** W4-1
- **Acceptance:** compiled icon plays in the runtime SDK with bit-equal motion to the editor preview.

### W4-3 · Resolver memoization [A§F3]
- **Files:** `lib/runtime-core/resolver-cache.ts` (new).
- **Implement:** memo key = `(layerId, cacheVersion)`. LRU bound (default 1024; configurable). Invalidate on `cacheVersion` bump. **Does not** depend on tree-shape canonicalization — dodges the canonical-form question.
- **Requires:** W2-1
- **Acceptance:** repeated resolves of the same compound layer hit cache; mutating an operand busts the entry.

### W4-4 · Correspondence-hint plumbing [A§E3, U§4]
- **Files:** `lib/runtime-core/hungarian.ts` (extend with row/column masking), `lib/runtime-core/transition-resolver.ts`.
- **Implement:** read `Transition.correspondenceHints`; convert subpath hints (`fromId`, `toId`) into Hungarian row/column masks (hard constraint, not a soft penalty); convert vertex hints into per-pair correspondence overrides for T1's intrinsic alignment.
- **Vertex addressing:** `VertexAddr = { subpathId: string; vertexIndex: number }`; subpath ids derive from canonicalization (stable across non-destructive edits).
- **Requires:** W3-4 (Hungarian)
- **Acceptance:** test pair with 4 ambiguous subpaths matches differently with no hint vs with one pin (verifies hint actually flows).

### W4-5 · Layer 1 controls — duration, cadence, fallback picker [U§3, U§4, U§12 UX-B]
- **Files:** `components/editor/AnimationStudioPanel.tsx`, `components/editor/TransitionPanel.tsx`, `components/ds/CadenceToggle.tsx` (new), `components/ds/FallbackPicker.tsx` (new).
- **Cadence toggle:** two-state `Soft` / `Snappy` using `IconButton` pair from `components/ds`. Keyboard: `←` / `→`. Selected state visible without colour alone (a11y).
- **Fallback picker:** appears **only** when `ResolvedTransition.tier === 'T8'`. Uses `Tag` chips from `components/ds`. Default selection = the resolver's pick (visible as "Auto" badge); user override persists on the `Transition`.
- **Plain-language fallback sentence:** uses the W1-U4 translator. Placement: primary in `AnimationStudioPanel`; appears in `TransitionPanel` only when studio is collapsed/hidden (resolves the [U§11.3] overlap).
- **A11y:** all controls keyboard-reachable; sentence narrated via polite live region on resolution change [U§11.4].
- **Requires:** W3-7, W3-8, W1-U3, W1-U4
- **Acceptance:** completes the [U§12 UX-B] exit criteria — author finishes a transition with Duration + Cadence + (conditional) Fallback only.

### W4-6 · Hover preview pipeline [U§6.2, U§12 UX-C]
- **Files:** `components/studio/IconPicker.tsx`, `lib/runtime-react/hooks/usePreviewOnHover.ts` (new).
- **Implement:** hovering a candidate target icon plays the would-be transition without committing. 120 ms ease-in ramp before transition begins (one of the three [U§7.2] motion moments). Freeze at `t = 1` while hover persists; revert on hover end.
- **Performance:** prewarm/cache the resolved interpolator on icon-list mount; target ≤ 100 ms time-to-first-frame.
- **Requires:** W3 (entire wave) + W4-1 (parity guarantee)
- **Acceptance:** median TTF ≤ 100 ms on the canonical corpus; a11y respects `prefers-reduced-motion` (no hover preview when set).

### W4-7 · Layer 2 — correspondence pinning UI [U§3 Layer 2, U§12 UX-D]
- **Files:** `components/editor/PathEditorCanvas.tsx`, `components/editor/CorrespondencePins.tsx` (new), `lib/editor-store/store.ts` (`pinCorrespondence` action).
- **Drag-vertex-onto-vertex** in the path editor when in Advanced mode. Compatible-target highlights (per Hungarian's pre-computed top-K candidates).
- **Pin lifecycle:** create / remap (replace previous) / delete; one source vertex/subpath maps to at most one target. Deleting either endpoint (vertex or subpath) deletes the pin. All pin actions undoable.
- **Visual:** colored dots, persistent across source and target views; same colour pairs source→target for one pin.
- **Discoverability hint:** one-time, dismissible, shown only after the user has hit T8 fallback ≥ 3 times on the same pair without using Advanced.
- **Requires:** W4-4, W4-5 (Advanced disclosure)
- **Acceptance:** [U§12 UX-D] exit criteria met — pin operations fully undoable; pins survive non-destructive path edits; default users never see pin UI.

### W4-8 · Layer 2 — timing-curve override [U§3 Layer 2]
- **Files:** `components/editor/TimingCurveEditor.tsx` (new — two-curve picker).
- **Implement:** two-curve editor with named presets; one curve for `g(t)`, one for `α(t)`. Lives in Advanced disclosure.
- **Persistence:** writes to `Transition.cadence: 'custom'` with explicit curve refs (or a separate authored field; design owner picks).
- **Requires:** W3-8
- **Acceptance:** override surfaces only in Advanced; reverting to *Soft* / *Snappy* drops the custom curves cleanly.

### W4-9 · Layer 3 — debug pill + build guard [U§3 Layer 3, U§11.6, U§12 UX-F]
- **Files:** `components/editor/TransitionDebugPill.tsx` (new), `next.config.mjs` (build assertion).
- **Render** behind `NEXT_PUBLIC_HIERO_DEBUG=1` only: tier name, raw `signal` (verbatim), per-tier distortion estimate.
- **Build assertion:** in production builds, `TransitionDebugPill` and the raw `signal` must compile to dead code (verified by bundle-size diff and grep on `.next/static/**`).
- **Requires:** W1-U3
- **Acceptance:** [U§12 UX-F] partial — production build greps clean for tier names and raw signals.

### W4-10 · Flip the flag [Wave gate]
- **Files:** `next.config.mjs`, removal of `NEXT_PUBLIC_HIERO_RESOLVER_V2` gate from `auto-morph.ts`.
- **Action:** when W4-1..W4-9 are green and metric harness shows W4 corpus pass against W1-A4 baseline, remove the flag. New cascade becomes default.
- **Requires:** all of Wave 4 above + provisional metric pass
- **Acceptance:** flag removed; legacy resolver code deleted (no compat shim).

---

## Wave 5 — Validation + rollout

**Wave goal:** corpus pass, blinded design panel, threshold
calibration, telemetry, a11y QA, copy-lint sign-off. The shipping
gate.

### W5-1 · Quantitative corpus pass [A§G1]
- **Files:** test runner config, `tests/runtime-core/transition-corpus/report.json`.
- **Run:** W1-A4 metric harness against every corpus pair × every shipped tier.
- **Performance gate:** realistic icons (≤ 20 subpaths, ≤ 200 vertices each) resolve under 5 ms on commodity hardware.
- **Acceptance:** report committed; per-tier baselines published.

### W5-2 · Comparative baselines [A§G2]
- **Compare:** proposed cascade vs. the W1-A4 snapshot of the previous resolver, vs. Flubber-style greedy ring matching, vs. d3-interpolate-path single-path.
- **Success criterion:** strictly reduces catastrophic failures (hard topology misreads, role-swaps, severe distortions) while preserving determinism and parity.
- **Requires:** W5-1
- **Acceptance:** comparison table committed alongside the corpus report.

### W5-3 · Threshold calibration [A§H1]
- **Calibrate from the corpus:** ARAP trigger threshold (turning-function variation), skeleton-alignment Hausdorff threshold, per-tier distortion ceilings.
- **Files:** `lib/runtime-core/thresholds.ts`, `specs/runtime/transition-resolver.md` (document chosen values + corpus-derived rationale).
- **Requires:** W5-1
- **Acceptance:** thresholds checked in; corpus metrics within target bands.

### W5-4 · Blinded human-perception panel [A§G3]
- **Recruit:** ≥ 3 design + ≥ 3 engineering reviewers.
- **Pairwise blinded preference test:** proposed vs. baseline per corpus pair.
- **Likert predictability score** ("I can guess where this point goes").
- **Requires:** W5-2
- **Acceptance:** statistically meaningful preference for the proposed cascade on canonical + stress sets.

### W5-5 · UX QA matrix [U§12 UX-F]
- **Test matrix:** keyboard navigation; screen reader narration of fallback sentence; hover-preview performance on slow hardware; fallback copy on every named fallback × every signal kind; correspondence-pinning lifecycle; compound flatten / convert-to-group; `prefers-reduced-motion` support.
- **Requires:** W4 complete
- **Acceptance:** zero P0/P1 usability regressions.

### W5-6 · Telemetry + dashboards [A§H2]
- **Files:** runtime telemetry hooks; ops dashboard.
- **Record per resolved transition:** `(tierPicked, signalKind, distortion, durationMs)`.
- **Dashboard:** tier-pick distribution and fallback rate per icon-set version; alarm when fallback rate spikes after an icon-set update.
- **Requires:** W4 complete
- **Acceptance:** telemetry visible in the ops dashboard for at least one icon-set release before launch.

### W5-7 · Open research queue [A§H3, A§11]
- **Defer with explicit issues filed:** cross-rule continuous interpolation; variable-width stroke generalization for T7; SRVF correspondence-quality audit; Gromov-Wasserstein for non-isomorphic compound matching; Floater MVC post-ARAP cage smoothing; ML-based vector morphing exploration.
- **Acceptance:** issues in tracker; nothing blocks ship.

### W5-8 · Final design + engineering sign-off [U§12 UX-F]
- **Run a sign-off session** against a real icon corpus (easy / ambiguous / hard pairs) per [U§12 UX-F].
- **Acceptance:** design + engineering confirm shipping readiness in writing.

---

## Cross-wave invariants (ship-blocking)

| Invariant | Where enforced |
|-----------|----------------|
| `Layer.path.d` is the only renderer-facing geometry field | W2-1 schema, runtime tests |
| `Transition` has only the four authored axes | W1-U1 schema lint |
| T7 never falls to raw crossfade | W3-6 lint/test |
| Cascade output is bit-stable | W3-1 determinism test |
| Preview ≡ runtime ≡ exported Lottie | W4-1 + W5-1 parity metric |
| No algorithm vocabulary in non-debug UI | W1-U2 copy lint |
| Debug surfaces compile out of production builds | W4-9 build assertion |
| No `clip-path` / `mask` enters the resolver | W2-4 import test |
| Vector-domain only — no SDF / level-set / neural | code review |
| No intra-variant state authoring surface | spec lock |

---

## OSS dependencies introduced

| Package | License | Wave | Used for |
|---------|---------|------|----------|
| `poly2tri` | BSD-3 | W3-2 | constrained Delaunay (ARAP triangulation) |
| `cdt2d` | MIT | W3-2 | CDT cross-check on degenerate input |
| `hungarian-on3` *or* `@havelessbemore/hungarian` | MIT | W3-4 | rectangular Hungarian assignment |
| `clipper2-ts` | BSL | W3-6 | curve offsetting via `InflatePaths` |
| `clipper2-wasm` | BSL | W3-6 (perf path, optional) | WASM-backed offsetting |

Already present and reused: `paper.js` (MIT — boolean ops, contour
hierarchy), winding/morph patterns from `flubber` and
`d3-interpolate-path` (already conceptually mirrored in
`lib/runtime-core/cross-icon-morph.ts`).

Reference implementations consulted but not depended on:
`zhangzhensong/arap`, `deliagander/ARAPShapeManipulation` (Igarashi
2005 ARAP closed-form, used during W5 validation as oracle).

---

## What this roadmap does *not* cover

- **Migration paths** — there are no users; rewrites land directly.
- **Per-icon-set defaults** — all authored state lives on the
  `Transition`.
- **Authored intra-variant states** — out of scope per
  `specs/editor/cross-icon-transitions.md`.
- **Rasterization-based morphing** — out of scope per
  `ICON_TRANSITION_ALGORITHMS_PLAN.md` §12.
- **CLI / SDK config layer** — `@hiero/cli` reads the same
  `Transition` payload the editor writes; no separate config layer.
- **Ticket-level work breakdown** — tasks above are sized to
  spawn coding tickets, not to be coding tickets themselves.

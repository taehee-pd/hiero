# Icon Transition Algorithms — Phased Action Items

**Companion to:** `docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md`
**Status:** Phasing draft
**Branch convention:** all phases land on feature branches off `main`,
gated by the validation protocol in plan §9 before merge.

This document maps the plan's architecture into ordered, mergeable
phases. Phases are independently shippable except where `requires:` is
explicit. Tasks are checklist items, not implementation tickets — each
will spawn its own ticket with acceptance criteria during planning.

The plan section being satisfied is cited next to every phase and task
(`§N.M`).

---

## Phase ordering at a glance

```
A. Foundations           (motion contract types, taxonomy classifier,
                          contour tree, validation corpus)
B. Compound feature      (schema, editor, UX, import/export)
C. Resolver core         (cascade + T1–T8 algorithms)
D. Progress decoupling   (two-curve scheduler, timing defaults)
E. Authoring affordances (preview-on-hover, why-fallback, hints)
F. Export pipeline parity (ARAP-on-export, sampling, cache memo)
G. Validation            (run §9 protocol)
H. Calibration & rollout (thresholds, telemetry, open questions)
```

Phase A is a hard prerequisite for B, C, D, F, G.
Phase B is a hard prerequisite for C5 (T6) and E3 (correspondence
hints touch compound trees).
Phase G runs continuously from C2 onward, not as a single trailing
phase, but the formal sign-off lives in G.

---

## Phase A — Foundations

> Establish the types, classifiers, and corpus that every later phase
> depends on. No user-visible changes.

### A1 — Motion contract types (plan §1)

- [ ] Define `MotionCurves = { g: EasingFn; alpha: EasingFn; alphaOffsetRatio: number }` in `lib/runtime-core/animation/`.
- [ ] Default tier curves table: `{ tier: ResolverTier → MotionCurves }`.
- [ ] Wire `MotionCurves` through the existing `auto-morph.ts` interpolator return shape (additive — no behavior change yet; consumed in Phase D).
- [ ] Document non-negotiables (draw-coordinated stroke ↔ fill, no raw crossfade) as runtime invariants in `specs/runtime/morph-interpolation.md`.

### A2 — Topology taxonomy classifier (plan §3)

- [ ] Add `classifyLayerPair(from: Layer, to: Layer): TaxonomyId` returning `'T1' | … | 'T8'`.
- [ ] Inputs: subpath count, per-subpath closed flag, fill-rule, contour-tree shape, `compound` presence.
- [ ] Pure function, deterministic, fully unit-tested against a fixed fixture set.
- [ ] Surface classification in the resolver debug pill (read-only; full UX in Phase E2).

### A3 — Contour tree builder (plan §4.2)

- [ ] Build `ContourTree = { nodes: ContourNode[]; rootIds: string[] }` from a canonicalized `path.d`.
- [ ] Restrict to **closed or fillable** subpaths; open subpaths are returned as a separate `openSubpaths: SubPath[]` collection.
- [ ] Parent/child via Sunday point-in-polygon under the layer's `fillRule`.
- [ ] Confirm tree is built **after** transform application (already true at `path-normalization.ts:23`; add a regression test).
- [ ] Cache result on the canonicalized layer; invalidate on `cacheVersion` bump (Phase B prereq for invalidation key).

### A4 — Validation corpus + metrics scaffolding (plan §9.1, §9.2)

- [ ] Define corpus schema: source/target SVG, expected `TaxonomyId`, expected fallback family (if any), authored hints (if any).
- [ ] Seed canonical topology set (≥ 40 pairs covering T1–T8, ≥ 5 per category).
- [ ] Seed stress topology set (≥ 30 pairs: nested holes, alternation depth ≥ 3, mixed with cardinality mismatch, extreme concavity, near-symmetric ambiguity).
- [ ] Wire production set: every authored cross-icon transition in `@hiero/ui-icons`.
- [ ] Implement metric harness: turning-function distance integral, area-monotonicity error, self-intersection count, temporal-jerk proxy, preview/export parity error.
- [ ] Run harness on the **current** resolver as a baseline snapshot before any later phase ships.

---

## Phase B — Compound shapes feature

> Make boolean operations non-destructive without changing the
> renderer contract.
>
> **Requires:** A3 (contour tree).

### B1 — Schema extension (plan §4.1)

- [ ] Add optional `compound?: { tree: CompoundNode; operands: Record<string, OperandRef>; cacheVersion: number }` to `Layer`.
- [ ] Define `CompoundNode = { kind: 'leaf'; operandId: string } | { kind: 'op'; op: CompoundOp; children: CompoundNode[] }`.
- [ ] Codify the **path-invariant rule** in `lib/schema/types.ts` next to the existing `primitive` invariant comment.
- [ ] Migration: zero — existing layers keep `path` only.
- [ ] Schema-version bump and round-trip tests across save/load.

### B2 — Editor wiring (plan §4.1, §4.6)

- [ ] `applyBoolean` (`lib/editor-store/store.ts:3771`) writes **both** `compound` and the regenerated `path.d` atomically.
- [ ] `patchLayer` clears `compound` on direct `path.d` mutation (mirror of existing `primitive`-clearing logic).
- [ ] Operand-level edits regenerate `path.d` from `compound.tree` and bump `cacheVersion`.
- [ ] Add `convertToGroup(layerId)` action for the §4.3 non-destructive alternative to flatten.
- [ ] Add `flattenCompound(layerId)` action that prompts before destroying the tree.

### B3 — Compound authoring UX principles (plan §4.3)

- [ ] Layer list shows a boolean-op glyph and disclosure for compound layers.
- [ ] Inspector tree-edit surface: reorder operands, change op type, edit operand geometry inline.
- [ ] Flatten command shows warning dialog with "Convert to group instead" option.
- [ ] Why-fallback signal (full implementation in E2): include "tree shape disagreed at level N" string when applicable.

### B4 — Import / export (plan §4.5)

- [ ] SVG import does **not** synthesize `compound` from nested subpaths. Confirm `clip-path` / `mask` continue to be flagged as `SvgImportLayerMeta.unsupported`.
- [ ] SVG export reads `path.d` only. No format change.
- [ ] Lottie export reads `path.d` only. No format change. Compound-aware ARAP export lives in Phase F1.
- [ ] Compiled-icon export (`lib/export/`) reads `path.d` only. No format change.

---

## Phase C — Resolver core

> Build the cascade and per-category algorithms. Land tiers
> incrementally; each tier ships with corpus metrics from §9.
>
> **Requires:** A1, A2, A3.

### C1 — Cascade scaffolding with distortion floor (plan §6)

- [ ] Replace the existing `auto-morph.ts` cascade with the seven-tier structure.
- [ ] Each tier returns `{ interpolator, distortion } | null`.
- [ ] Per-tier distortion ceiling; tier returns `null` when self-reported distortion exceeds its ceiling.
- [ ] Identity tier always present and always returns 0.
- [ ] Designed-fallback tier (T8) always accepts (terminal).
- [ ] Determinism test: cascade output is stable across runs given the same input.

### C2 — T1 (single closed ↔ closed) (plan §5.1)

- [ ] Keep existing Sederberg-1993 intrinsic baseline (`lib/runtime-core/intrinsic-interpolation.ts`).
- [ ] Replace shape-context cost component with **turning-function distance** (Arkin 1991) over arc-length-resampled boundaries.
- [ ] Implement **boundary matching with salient-feature detection** per **Baxter, Barla & Anjyo 2008 "Compatible Embedding for 2D Shape Animation"** for the ambiguous-turning-function-landscape case (used in front of the existing turning-function anchor when local-extrema density is high).
- [ ] Add **ARAP quality wrap**:
  - Triangulation: **constrained Delaunay against contour-tree holes** via `poly2tri` (npm, BSD-3) or `cdt2d` (npm, MIT) as cross-check.
  - **Compatible-triangulation pass** per Baxter 2008 §3 to extend the boundary correspondence to the interior.
  - Solver: **two formulations**:
    - **Igarashi 2005 closed-form** (zhangzhensong/arap or deliagander/ARAPShapeManipulation as reference) — runtime / preview-on-hover path.
    - **Alexa 2000 polar-decomposed affine** — offline / export sampling path (tighter distortion bound, marginally slower).
- [ ] Define **ARAP trigger predicate** (turning-function variation threshold; calibrated in Phase H).
- [ ] Self-reported distortion = integrated turning-function distance + arc-length distortion.

### C3 — T2 (single open ↔ open) (plan §5.2)

- [ ] Arc-length reparameterization + De Casteljau resample to common N.
- [ ] Forward/reversed orientation pick by integrated turning-angle distortion.
- [ ] Sederberg-1993 intrinsic on open polyline.
- [ ] Hausdorff first-pass / Discrete Fréchet ambiguity gate; route to T7 draw-emit when over threshold.

### C4 — T3 / T4 / T5 (multi-* + mixed) (plan §5.3, §5.4, §5.5)

- [ ] **Rectangular Hungarian** assignment per contour-tree level via `hungarian-on3` (npm, MIT — O(n³), ~13× faster than naive JS impls on benchmarks) or `@havelessbemore/hungarian` for explicit rectangular support.
- [ ] Cost matrix: centroid distance, bbox aspect/scale, signed-area, turning-function distance (Arkin 1991), z-order penalty.
- [ ] Hard exclusion across roles enforced by per-level scoping (no inter-role finite penalty).
- [ ] Tiebreaker: lexicographic `(fromIndex, toIndex)` after costs match within `ε = 1e-9`.
- [ ] Hierarchical scoping per **Feng et al. 2018 "2D Shape Morphing via Automatic Feature Matching and Hierarchical Interpolation"** as the contemporary methodological reference; **Liu, Schneider & Klein 2010** as the closer reference for vector-contour decomposition.
- [ ] Birth/death: outer subpath → centroid collapse + alpha; hole → radial collapse; open subpath → endpoint trim.
- [ ] T5 splits into closed-channel (T3 path) + open-channel (T4 path); cross-type pairs route to T7.

### C5 — T6 (compound ↔ anything) (plan §5.7)

> **Requires:** B1 (schema).

- [ ] **Isomorphic-tree fast path:** structural pair operands by tree position; per operand pair runs T1 (with full Baxter 2008 compatible-embedding pipeline since per-operand correspondence quality drives compound morph quality).
- [ ] **Non-isomorphic-tree path:** flatten both to contour trees (§4.2) and run C4 per-level Hungarian; tree-shape disagreement enters cost matrix as soft signal **and** is recorded as the why-fallback signal.
- [ ] **Compound ↔ simple:** flatten compound; lift `evenodd` self-intersecting simple sides to implicit contour tree.
- [ ] **Cross-rule (`nonzero` ↔ `evenodd`):** route to T8 by default per plan §5.7 conservative default.
- [ ] Operand-level boolean evaluation reuses Paper.js (`lib/editor-core/boolean-ops.ts`); for offsetting needs that arise within compound evaluation (e.g., subtractive shape with rounded corner), evaluate via `clipper2-ts` as a faster alternative to Paper.js round-trips.

### C6 — T7 (stroke ↔ fill) (plan §5.6)

- [ ] **Skeleton alignment test:** Voronoi-based medial axis (Aichholzer 1995) of stroke centerline vs fill outer-contour skeleton; Hausdorff threshold gate.
- [ ] **Aligned skeletons → medial-axis thickening:** Tiller-Hanson (1984) offsetting from centerline outward implemented via **`clipper2-ts`** (`countertype/clipper2-ts`, BSL — pure-TS port of Angus Johnson's Clipper2) `InflatePaths` for the outer offsets, with `clipper2-wasm` (`ErikSom/Clipper2-WASM`) as the perf-critical fallback for large stroke counts; opacity over `α(t)`.
- [ ] **Misaligned skeletons → directional draw + fill-emit:** stroke trims out on `g(t)`; fill draws in on `g(t)` shifted by 0.08·duration.
- [ ] **No raw crossfade.** Enforced by lint or unit test on the T7 implementation.

### C7 — T8 designed fallback library (plan §5.8)

- [ ] Implement named fallbacks: `radial-pop`, `directional-replace-{up,down,left,right,toward,away}`, `draw-replace`, `scale-pop`.
- [ ] Each fallback ships with fixed `(g, α)` curve pair, name, preview asset, and canonical example pair.
- [ ] Resolver chooses default fallback by topological signal (stroke-heavy → `draw-replace`, navigational → `directional-replace-*`, similar visual weight → `radial-pop`, small render → `scale-pop`).
- [ ] Authors override at the `Transition` level (UX in Phase E5 piggy-backs on transition schema).

---

## Phase D — Progress decoupling & timing

> Promote the §1 motion contract from spec into the runtime scheduler.
>
> **Requires:** A1, C1.

### D1 — Two-curve scheduler

- [ ] Animation scheduler accepts `MotionCurves` per layer pair: `g(t)` for geometry progress, `α(t)` for opacity progress.
- [ ] Default `α` offset of 8 % of duration (geometry leads opacity).
- [ ] Backward compatibility: existing single-curve callers continue to work via `MotionCurves` constructed with `g === α`.

### D2 — Tier-default timing curves

- [ ] Per-tier defaults table: T1/T3/T5 use `easeInOutCubic`; T2/T4 use `easeOutCubic` (stroke-feel); T7 uses asymmetric draw-out / fill-in pair; T8 fallbacks use the curves shipped with each named motion.
- [ ] Authors override at the `Transition` level.

### D3 — Designed fallback timing curves

- [ ] Each §5.8 named fallback ships with its own `(g, α)`. Codify in a `FALLBACK_TIMING` constant; locked by motion-design owner.

---

## Phase E — Authoring affordances

> Make the resolver designer-legible and authorable.
>
> **Requires:** C1 (cascade emits tier + signal); B1 (compound schema)
> for E3.

### E1 — Preview-on-hover in icon picker

- [ ] Hovering a candidate target in the icon picker plays the would-be transition without committing.
- [ ] Replaces the legacy compatibility-status tones (already removed by `ANIMATE_PANEL_REVAMP_PLAN.md` §2.2).
- [ ] Performance budget: preview must start within 100 ms of hover.

### E2 — Why-fallback signal in the debug pill

- [ ] Cascade returns both the tier picked and the **signal** that gated up-tier selection (e.g. "trees disagreed at level 2 — 3 holes vs 1 hole", "turning-function distance 0.42 over threshold 0.30").
- [ ] Debug pill (`NEXT_PUBLIC_HIERO_DEBUG=1` and Advanced disclosure) displays the signal verbatim.

### E3 — Author-supplied correspondence hints

> **Requires:** B1.

- [ ] Extend `Transition` schema with `correspondenceHints: { subpath: Array<[fromId, toId]>; vertex: Array<[fromAddr, toAddr]> }`.
- [ ] Subpath hints: addressed by stable subpath id derived during canonicalization.
- [ ] Vertex hints: addressed by `(subpathId, vertexIndex)` post-canonicalization.
- [ ] Hints feed Hungarian as **hard constraints** (row/column masking), not soft penalties.
- [ ] Editor: drag-vertex-onto-vertex pin interaction; visualizable on the path-editor canvas.
- [ ] Hints are pair-specific (live on `Transition`, not `Layer`).

### E4 — Compound layer affordances

> Already enumerated in B3 — kept here as cross-reference. Ships with B.

### E5 — Fallback override at Transition level

- [ ] Transition schema accepts an optional `fallbackOverride: FallbackName` field.
- [ ] Inspector exposes a fallback picker when the resolver is in T8 territory.

---

## Phase F — Export pipeline parity

> Eliminate preview/export drift; resolve eng-review B5.
>
> **Requires:** C1, C2 (ARAP solver lives there).

### F1 — ARAP-on-export

- [ ] Lottie export pipeline calls the **same** ARAP solver as the runtime.
- [ ] Sample at the export's target frame rate (30 or 60 fps configurable).
- [ ] Cubic interpolation between sampled keyframes preserves Lottie format compatibility.
- [ ] Verify visual indistinguishability above the export's frame rate via the §9.2 preview/export parity metric.

### F2 — Compiled-icon export

- [ ] Compiled-icon format records the resolved interpolator's emitted control-point trajectories per tier.
- [ ] ARAP-augmented tiers record sampled keyframes the same way Lottie does.

### F3 — Compound caching memoization

- [ ] Resolver memoization key: `(layerId, cacheVersion)` — does **not** depend on tree-shape canonicalization.
- [ ] Invalidate on `cacheVersion` bump (set by Phase B2).
- [ ] LRU bound on the memoization cache; default 1024 entries.

---

## Phase G — Validation (plan §9)

> Run continuously from C2 onward; formal sign-off here.
>
> **Requires:** A4 (corpus and metrics).

### G1 — Quantitative pass

- [ ] Run the §9.2 metric harness against every corpus pair for every shipped tier.
- [ ] Publish per-tier baselines for boundary distortion, area monotonicity, self-intersection count, temporal jerk, parity error.

### G2 — Comparative baselines

- [ ] Compare proposed cascade output against:
  - current Hiero resolver (`cross-icon-morph.ts` baseline snapshotted in A4),
  - Flubber-style greedy ring matching,
  - d3-interpolate-path single-path interpolation (where applicable).
- [ ] Success criterion (plan §9.3): proposed cascade strictly reduces catastrophic failures (hard topology misreads, role-swaps, severe distortions) while preserving determinism and export parity.

### G3 — Human-perception blinded panel

- [ ] Recruit fixed reviewer panel (≥ 3 design + 3 engineering).
- [ ] Pairwise blinded preference test: proposed vs. baseline per corpus pair.
- [ ] Likert predictability score ("I can guess where this point goes").
- [ ] Aggregate results; require statistically meaningful preference for the proposed cascade on the canonical + stress sets before sign-off.

---

## Phase H — Calibration & rollout

> Set the empirical thresholds the algorithm flags, instrument
> production, and queue the open research questions.
>
> **Requires:** G1.

### H1 — Threshold calibration

- [ ] ARAP trigger threshold (turning-function variation) — corpus sweep.
- [ ] Skeleton-alignment Hausdorff threshold for T7 — corpus sweep.
- [ ] Per-tier distortion-floor calibration — false-positive vs false-negative sweep against G1 outputs.
- [ ] Document chosen thresholds and the corpus-derived rationale in `specs/runtime/transition-resolver.md`.

### H2 — Production telemetry

- [ ] Record `(tierPicked, signal, distortion)` per resolved transition in production runtime.
- [ ] Dashboard for tier-pick distribution and fallback rate per icon-set version.
- [ ] Alarm when fallback rate spikes after an icon-set update.

### H3 — Open research questions queue (plan §11)

- [ ] Cross-rule continuous interpolation experiment (currently routed to T8 default).
- [ ] Variable-width stroke generalization for T7 medial-axis thickening.
- [ ] SRVF correspondence-quality audit (plan §8 research-only citation).
- [ ] Gromov-Wasserstein for non-isomorphic compound matching with large cardinality deltas (plan §8 research-only citation).
- [ ] Floater MVC post-ARAP cage smoothing for severe concavities (plan §8 research-only citation).
- [ ] ML-based vector morphing exploration (e.g. SVGformer, CVPR 2023) — out of current vector-domain scope per §12, but track as a separate research thread for future viability.

---

## Cross-phase invariants

These hold across all phases and gate any merge:

- **Renderer contract unchanged.** `Layer.path.d` is the canonical
  geometry; no reader changes (plan §12 non-goal).
- **No raw crossfade in T7.** Enforced by lint or test (plan §1, §5.6).
- **Determinism.** Cascade output is bit-stable for a given
  canonicalized input pair across runs and platforms (plan §10).
- **Preview/export parity.** Export pipeline runs the same ARAP
  solver as runtime; parity error tracked by §9.2 metric.
- **No clip-path / mask in resolver.** Imported SVG `clip-path` /
  `mask` remain `SvgImportLayerMeta.unsupported` (plan §12).
- **Validation gating.** No tier merges without its corpus metrics
  attached and meeting the §9.3 success criterion vs. the baseline
  snapshot from A4.

---

## OSS dependencies introduced by this plan

Added by phases below; bundled here as the dependency manifest delta
that will land in `package.json` over the course of execution. Each
dependency is anchored to the academic source it operationalizes.

| Package | License | Phase | Operationalizes |
|---------|---------|-------|-----------------|
| `poly2tri` | BSD-3 | C2 (T1 ARAP) | constrained Delaunay triangulation with hole + Steiner-point support |
| `cdt2d` | MIT | C2 (cross-check) | alt CDT on planar straight-line graphs |
| `hungarian-on3` *or* `@havelessbemore/hungarian` | MIT | C4 (T3/T4/T5) | Kuhn-Munkres rectangular assignment |
| `clipper2-ts` | BSL | C6 (T7) | Tiller-Hanson curve offsetting via `InflatePaths` |
| `clipper2-wasm` | BSL | C6 (T7 perf path) | WASM-backed Clipper2 for stroke-heavy icons |

Existing dependencies leveraged: `paper` (boolean ops, contour
hierarchy), `flubber` patterns (winding normalization, present in
`cross-icon-morph.ts`), `d3-interpolate-path` patterns (cubic-segment
equalization, present in same file).

Reference implementations consulted but not depended on:
`zhangzhensong/arap`, `deliagander/ARAPShapeManipulation` (both
Igarashi 2005 ARAP closed-form). Used during validation (Phase G) as
oracle implementations to confirm distortion bounds.

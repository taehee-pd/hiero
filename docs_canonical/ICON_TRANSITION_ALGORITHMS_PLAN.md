# Enhanced Icon-to-Icon Transition Algorithms

**Status:** Plan (v2 — incorporates engineering + design review)
**Owners:** runtime-core, editor-core, schema, motion-design
**Related specs:**
`specs/runtime/morph-interpolation.md`,
`specs/runtime/topology-detection.md`,
`specs/runtime/transition-resolver.md`,
`specs/runtime/draw-executor.md`,
`specs/runtime/hybrid-compositor.md`,
`specs/schema/icon-schema.md`,
`specs/schema/transition-schema.md`,
`specs/editor/cross-icon-transitions.md`,
`docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`

This document is an **architecture and algorithm plan**, not a delivery
plan. It does not define phases, owners, or task lists. It defines the
motion contract, the topology model, the compound-shapes feature that
the topology model depends on, and the family of transition algorithms
that operate over that model.

---

## 1. Motion contract

Algorithms downstream are arbitrary unless the product first commits
to what its motion *feels* like. Hiero's three-sentence POV:

> **Hiero icons reveal their structure when they change.** A path that
> changes weight grows along its medial axis; a path that gains a hole
> opens from the inside; a path that's gaining presence draws in,
> never crossfades. **Counterparts are predictable** — the human eye
> can guess where a vertex will end up before the morph plays.
> **Every transition has a designed cadence.** Geometry progress and
> opacity progress are different timing curves; nothing snaps and
> nothing oozes.

This POV is non-negotiable input to algorithm selection. Concretely it
mandates:

- **Draw-coordinated stroke ↔ fill** as the only acceptable answer for
  T7 (no plain crossfade); see §5.6.
- **Progress decoupling.** Each tier in the resolver cascade emits two
  timing functions — a geometry curve `g(t)` and an alpha curve
  `α(t)` — that are explicitly *not* the same easing. The runtime
  scheduler accepts both. Defaults: `g(t) = easeInOutCubic`,
  `α(t) = easeOutCubic` shifted by 8 % of duration so geometry leads
  opacity (the SF Symbols 7 default heuristic, observable in WWDC
  reference clips).
- **Designed fallbacks.** Crossfade and `directional-replace` are
  named, art-directed motions, not "we gave up" placeholders. The
  fallback library has a small finite set (§5.8).
- **Predictability over peak quality.** A transition that always works
  acceptably beats one that's stunning 80 % of the time and confusing
  20 %. The cascade prefers conservative tiers and rejects best-tier
  outputs above a distortion floor (§6).

---

## 2. Problem framing

The runtime treats every icon as a flat list of layers and every
layer's path as a flat `d` string. Subpaths are recovered ad-hoc by
splitting on `M`, and pairing across icons is a greedy O(n²) heuristic
over centroid + bbox + area + segment-count + closed-flag
(`lib/runtime-core/cross-icon-morph.ts:139`). This handles "hamburger
↔ X" / "play ↔ pause" / "plus ↔ close" and degrades on three axes
the editor already exposes:

1. **Compound shapes.** `applyBoolean`
   (`lib/editor-store/store.ts:3771`) flattens to `path.d` with no
   record of `unite | subtract | intersect | exclude`, no operand
   references, and no parent/child hierarchy between resulting
   contours. The morph pipeline cannot tell the outer of `A ∪ B`
   from a hole produced by `A \ B`.
2. **Fill-rule semantics.** `path.fillRule` (`lib/schema/types.ts:199`)
   is parsed and rendered but ignored by topology detection and morph
   scoring. `nonzero` and `evenodd` over the same `d` are
   topologically distinct under the interior test.
3. **Higher-order correspondence.** Greedy matching fails on rotated
   grids, concentric rings, eyedropper stacks, and any pair where the
   optimal assignment is not the locally-greedy one.

The product goal: a single resolver that picks a high-quality,
designer-acceptable algorithm for every icon pair the editor can
produce — including boolean-derived compounds — with a
deterministic, designed fallback when geometry truly cannot
interpolate.

---

## 3. Topology taxonomy

The resolver classifies each `(source, target)` *layer pair* (not icon
pair) by joint topology. Categories are mutually exclusive per layer
pair — an icon with a stroke layer and a fill compound layer gets two
classifications, one per layer pair.

| ID | Source layer | Target layer | Examples |
|----|-------------|-------------|----------|
| **T1** | single closed | single closed | circle ↔ rounded square, triangle ↔ pentagon |
| **T2** | single open  | single open  | checkmark ↔ X, single chevron ↔ single arrow |
| **T3** | multi closed | multi closed | dice-2 ↔ dice-4, two-circle Venn ↔ three-circle |
| **T4** | multi open   | multi open   | hamburger (3 lines) ↔ equals (2 lines) |
| **T5** | mixed (closed + open) | mixed | speech-bubble (closed body + open tail) ↔ thought-bubble |
| **T6** | compound (boolean tree) | any | donut ↔ disc, eye-with-pupil ↔ eye-without-pupil, slashed-bell ↔ bell |
| **T7** | stroke style | fill style | outline-heart ↔ filled-heart |
| **T8** | hard-incompatible | hard-incompatible | spinner ↔ checkmark, bug ↔ keyboard |

A layer's category is a function of (subpath count, per-subpath closed
flag, fill-rule, contour-tree shape, declared compound metadata). The
same icon can be T1 against one target and T6 against another.

---

## 4. Compound shapes as a first-class feature

Boolean operations exist in the editor today as a destructive flatten
via Paper.js (`lib/editor-core/boolean-ops.ts`,
`lib/editor-store/store.ts:3771`). The plan replaces destructive
flatten with non-destructive authoring metadata that **does not break
the existing renderer or schema invariants**.

### 4.1 Schema — invariant-preserving extension

`Layer.path.d` remains the **canonical, single, renderer-facing
geometry**. Every renderer, exporter, hit-tester, and runtime path
(e.g. `path-normalization.ts:21`, `topology-detection.ts:237`) keeps
reading `layer.path.d`. No reader is changed.

A new optional field carries the authoring tree:

```ts
type CompoundOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

type CompoundNode =
  | { kind: 'leaf'; operandId: string }
  | { kind: 'op'; op: CompoundOp; children: CompoundNode[] };

type Layer = {
  // existing fields …
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };
  primitive?: PrimitiveShape;        // already exists
  formerPrimitiveKind?: …;            // already exists
  compound?: {                        // NEW
    tree: CompoundNode;
    operands: Record<string, { d: string; transform?: Mat3 }>;
    cacheVersion: number;             // bumped on tree/operand edits
  };
};
```

**The path-invariant rule** (`Layer.path` invariant, mirrored from
the existing `primitive` rule at `lib/schema/types.ts:200-207`):

> When `compound` is present, `path.d` is the cached evaluation of
> `compound.tree`. Any direct mutation of `path.d` outside the
> compound-evaluation flow MUST clear `compound`, exactly as direct
> path mutation today clears `primitive`. The store action that owns
> this is `patchLayer`; `applyBoolean` is the one path that writes
> both `compound` and `path.d` together.

This resolves the schema collision raised in eng review:
`Layer.path` and `Layer.compound` are not alternatives — `compound`
is authoring metadata over the canonical `path.d`. Layers without
boolean operations stay simple (`path` only); compound layers add
the tree as additional metadata.

**`TopologyContract.layerPairs`** (`lib/schema/types.ts:421-426`)
remains keyed off the authoring contract, which is `path.d`. When a
compound is edited, the cache regenerates `path.d` and the contract is
recomputed exactly as it would be after any other edit. The contract
is **not** keyed off `compound.tree`, so commutative reorderings of
operands that produce the same `path.d` produce the same contract.

**`LayerBinding.compoundTrimMode`** (`lib/schema/types.ts:354`,
consumed in `lib/export/export-lottie.ts:266,600,636`) operates on the
**rendered** `path.d` subpaths, not on operands. This is the same
behavior as today; compound metadata does not change trim semantics.

### 4.2 Contour hierarchy

For both `path` and `compound`-cached `path.d`, the resolver derives a
**contour tree** during canonicalization (already a step in the
runtime via `canonicalizeLayerPath`,
`lib/runtime-core/path-normalization.ts:23`):

- Each **closed or fillable** subpath is a node:
  `{ ring, signedArea, depth, parent, children }`.
- Open subpaths (stroke-only, no implicit closure under `fillRule`)
  do **not** participate in the contour tree. They are passed
  separately to T2 / T4 / T5 channels.
- Parent/child is determined by point-in-polygon containment of one
  ring's interior point against another's filled region under the
  layer's `fillRule` (Sunday's "Inclusion of a Point in a Polygon";
  Foley/van Dam).
- Depth alternates `outer → hole → island → hole-in-island → …`.

The contour tree is built **after** layer transforms are applied —
`canonicalizeLayerPath` already does this — so two icons differing
only in transform produce identical trees.

### 4.3 Editor authoring UX (principles)

This plan does not enumerate components but commits to four
principles that the Inspector and path-editor must uphold:

1. **Compound layers are visually distinguishable from flat layers**
   in the layer list (e.g. a boolean-op glyph next to the layer name
   plus a disclosure showing the operand tree).
2. **Operand-level edits are non-destructive** by default. The
   "Flatten compound" action exists but always prompts before
   running; it explicitly says "this cannot be undone after the
   project is closed" and offers a non-destructive alternative
   ("convert to group" — preserves the geometry of operands as
   sibling layers).
3. **Why-fallback is surfaced.** When the resolver picks a tier below
   the best available, the editor's debug pill (currently "Engine
   chose: …") includes the *signal* that gated up-tier selection
   ("trees disagreed at level 2 — 3 holes vs 1 hole",
   "turning-function distance over threshold", "open subpath count
   mismatch"). This is the design review's "name what you can't fix"
   request.
4. **Preview-on-hover.** Hovering a candidate target in the icon
   picker plays the would-be transition without committing it. This
   replaces the legacy "compatibility status" tones that
   `ANIMATE_PANEL_REVAMP_PLAN.md` §2.2 deliberately removed — the
   feedback is now experiential, not categorical.

### 4.4 Author-supplied correspondence hints

Promoted from "open question" (the design review's call). When the
resolver picks a tier that runs assignment (T3, T4, T5, T6 case 2),
the author can pin specific correspondences:

- subpath-to-subpath: "this hole maps to that hole"
- vertex-to-vertex: "this corner maps to that corner"

Hints feed the cost matrix as hard constraints (Hungarian's row/column
masking), not soft penalties. They are stored on the `Transition`
schema, not on the `Layer`, because they are pair-specific. This is
specifically the design-review unblock — for a tool whose product
premise is icon authoring, manual override of a heuristic is a P0
affordance.

### 4.5 Import / export

- **SVG import** (`lib/import/import-svg.ts`): SVGs encode compound
  topology only as nested subpaths under one `<path>` with
  `fill-rule`. Original boolean intent is unrecoverable. Imported
  compounds arrive as flat `path` (no `compound`); the contour tree
  is derived at canonicalization time. Authors who want
  operand-level non-destructive edits rebuild the tree explicitly.
  - **`clip-path` and `mask` from imported SVG do not enter this
    resolver.** They are already flagged as
    `SvgImportLayerMeta.unsupported` (`lib/schema/types.ts:276`,
    `lib/import/import-svg.ts:267-274`) and dropped before
    canonicalization. This plan does not change that.
- **SVG export** writes `path.d` (the cached evaluation). No
  information loss vs. today.
- **Lottie / compiled-icon export** writes the cached `path.d` and
  the runtime SDK never sees `compound`. ARAP-augmented morphs are
  exported via the export-time evaluator described in §10.

### 4.6 Why this shape

Three alternatives were considered and rejected:

1. **Replace `Layer.path` with `Layer.compound`.** Breaks every
   existing `path.d` reader (B1 from eng review). Rejected.
2. **Flat `booleanOp` field on Layer.** Cannot represent operand
   identity; contributes nothing to morphing.
3. **One layer per operand using z-order convention.** Conflicts with
   the existing layer model — z-order is paint stacking, not boolean
   composition.

The cached-tree-as-metadata shape preserves the renderer contract,
preserves authoring intent, and is the minimum representation that
lets the resolver pair operands across icons.

---

## 5. Per-category transition algorithms

Each category gets a primary algorithm, a quality wrap when
applicable, and a degradation path. All algorithms are vector-based;
rasterization-based morphs (level-set, signed-distance-field) are out
of scope to preserve crisp exports.

### 5.1 T1 — single closed ↔ single closed

**Primary: Sederberg-1993 intrinsic interpolation,** already in place
(`lib/runtime-core/intrinsic-interpolation.ts`). Interpolation of edge
length and turning angle rather than `(x,y)` is the strongest baseline
for similar-topology closed contours. Resampling for unequal segment
counts uses De Casteljau subdivision with arc-length-weighted
distribution, already in
`lib/runtime-core/cross-icon-morph.ts:216`.

**Vertex correspondence:** when both shapes share command signature,
existing rotation search (cyclic alignment minimizing turning-angle
distortion) suffices. When signatures differ, a dynamic-programming
correspondence step over a **turning-function descriptor** (Arkin,
Chew, Huttenlocher, Kedem & Mitchell 1991, *"An Efficiently Computable
Metric for Comparing Polygonal Shapes"*) anchors the start vertex of
both shapes at corresponding turning extrema before resampling.
Turning-function distance replaces shape contexts (Belongie 2002) for
the icon-grid use case — at 24×24 viewbox scale, log-polar histograms
are dominated by quantization noise; turning function is well-behaved
at any scale and computable from the existing arc-length-resampled
polyline.

**Quality wrap: As-Rigid-As-Possible (ARAP).** Two formulations are
in scope:

- **Alexa, Cohen-Or & Levin 2000** is the canonical *interpolation*
  formulation — given two compatibly-triangulated shapes, interpolate
  per-triangle affine transforms in their polar-decomposed form. Used
  here as the source for the math.
- **Igarashi, Moscovich & Hughes 2005** is a faster, two-step
  closed-form *manipulation* variant (rotation step then scale step;
  each minimization is a system of linear equations). Designed for
  real-time interaction. We use Igarashi's closed-form for the
  preview-on-hover path (§7.E1) where ≤ 100 ms time-to-first-frame
  matters; Alexa's formulation drives offline export sampling where
  we can take a few extra ms for tighter distortion bounds. Both
  share the same triangulation step.

**Compatible triangulation step.** Triangulate the polygon interior
once over the resampled boundary plus its holes from the contour
tree. Use **Baxter, Barla & Anjyo 2008 ("Compatible Embedding for 2D
Shape Animation")** as the algorithmic source. Baxter's contribution
is a three-part pipeline: (1) boundary matching that *locates salient
features* before turning-function anchoring runs (sharper start-vertex
anchoring than turning-function extrema alone for shapes with weak
turning-function maxima); (2) boundary simplification that maintains
parametric correspondence; (3) compatible triangulation that extends
the mapping to the interior — the step ARAP requires. Baxter's
boundary-matching step replaces the dynamic-programming pass over the
turning-function descriptor when the shapes have ambiguous turning-
function landscapes (e.g., shapes with many shallow local extrema).

ARAP **does** handle holes when the triangulation is constrained
against the contour tree's hole rings; it does not handle self-
intersecting boundaries — those are lifted to a contour tree first
via the same evenodd reduction T6 uses.

**ARAP trigger predicate:** the turning-function variation across the
boundary above a threshold. Empirical threshold belongs in §11.

**Degradation:** if vertex correspondence cannot be established with
distortion under the cascade's distortion floor (§6), drop to T7
draw-coordinated emit.

### 5.2 T2 — single open ↔ single open

**Primary: arc-length-parameterized resampling + endpoint-aligned
intrinsic interpolation.**

1. Reparameterize both curves by arc length.
2. Resample to a common `N` using De Casteljau subdivision.
3. Try forward and reversed pairings of the target; choose the one
   minimizing integrated turning-angle distortion (Latecki &
   Lakaemper 2000, *"Shape Similarity Measure Based on Correspondence
   of Visual Parts"*).
4. Interpolate via Sederberg-1993 intrinsic on the open polyline.

**Curve-similarity gate:** Hausdorff distance between the resampled
polylines as a fast first pass; Discrete Fréchet (Eiter & Mannila
1994) for ambiguous cases. Above threshold, fall to trim-style draw
emit (§5.6).

**Trim fallback:** the existing trim executor
(`lib/runtime-core/draw-executor.ts`) using Lottie-style
`trimStart`/`trimEnd`/`trimOffset` is the right answer when one path
strictly contains the other along arc length.

### 5.3 T3 — multi closed ↔ multi closed

**Primary: rectangular Hungarian assignment per contour-tree level,
then per-pair T1.**

The naive "Hungarian over the full subpath set" fails when source and
target have different cardinality at a tree level (eng review B4: 2
outers + 1 hole vs 1 outer + 2 holes is a common case). The fix:

1. Build the contour tree for both layers (§4.2).
2. For each tree level (root level, then per matched parent in the
   next level), run **rectangular Hungarian** (Bourgeois & Lassalle's
   extension; or the standard square Hungarian on a padded matrix
   with explicit "unmatched" rows/columns) over the level's
   cardinality. Output: `min(n, m)` matched pairs + `|n−m|`
   unmatched (birth or death).
3. Cost matrix entries combine:
   - centroid distance (normalized by joint diagonal),
   - bbox aspect/scale similarity,
   - signed-area similarity,
   - **turning-function distance** between the resampled
     boundaries (replaces shape contexts; Arkin 1991),
   - z-order penalty if relative paint order would invert,
   - hard exclusion across roles (outer never matches hole — handled
     by per-level scoping, not penalty).
4. Per matched pair, run T1.
5. Per unmatched outer, birth/death via centroid collapse + alpha;
   per unmatched hole, birth/death via radial collapse to preserve
   the visual reading "the hole closes."

**Tiebreaker.** Hungarian is deterministic only with an explicit
tiebreaker: when two assignments share total cost within `ε = 1e-9`,
prefer the lexicographically smaller `(fromIndex, toIndex)` pair.
Specified to make preview/export bit-stable.

**Hierarchical scoping** is grounded in three references:

- **Whited et al. 2010 *"BetweenIT"*** as conceptual inspiration —
  the original paper operates on hand-drawn stroke animation, not
  vector contours; we adopt the *idea* of level-by-level
  decomposition, not the full shape-tree algorithm.
- **Liu, Schneider & Klein 2010 *"Decomposing Curves into Segments
  for Shape Blending"*** as the closer reference for vector contours.
- **Feng et al. 2018 *"2D Shape Morphing via Automatic Feature
  Matching and Hierarchical Interpolation"*** as the contemporary
  vindication — independently arrives at the same level-by-level
  Hungarian + per-pair morph topology used here, with empirical
  results on icon-class inputs. Adopted as a methodological
  reference for the corpus-based threshold calibration in §11.

The compatible-embedding pipeline (Baxter 2008) generalizes
naturally to multi-shape T3 by applying its boundary-matching +
compatible-triangulation steps to each Hungarian-matched pair, then
running ARAP over the joint triangulation per pair.

### 5.4 T4 — multi open ↔ multi open

**Primary: rectangular Hungarian over endpoint-aware cost, then
per-pair T2.**

Cost matrix uses Hausdorff distance over resampled polylines,
endpoint-pair distance, and arc-length similarity. Endpoint asymmetry
matters — two strokes whose ends are near each other should morph in
the orientation that aligns ends, which Hausdorff over unordered
points does not capture.

Birth/death uses **trim collapse to an endpoint** (the stroke
retracts), not centroid collapse (the stroke would implode). For
multi-stroke icons like the hamburger ↔ equals case, the unmatched
hamburger line dies by trimming from one end with a configurable
offset relative to the other strokes' geometry progress (§1's progress
decoupling — death is not synchronized with the surviving morphs).

### 5.5 T5 — mixed ↔ mixed

**Primary: split into closed-channel and open-channel, run T3 and T4
independently, composite in original z-order.**

A mixed-topology layer is decomposed by the contour tree (closed) and
the open-subpath list (open) into two channels; each runs its own
rectangular Hungarian and per-pair morph; both render every frame.

Cross-type pairs (closed-source has no closed-target match but has an
open-target match — e.g., closing-bracket → arrow) are **not** forced
into a closed-to-open morph. They route to T7 (§5.6).

### 5.6 T7 — stroke style ↔ fill style

**Primary: draw-coordinated emit.** Per the §1 motion contract, this
is the only acceptable answer — plain crossfade is rejected. The
existing `'draw-crossfade'` recommendation
(`lib/runtime-core/topology-detection.ts:223`) is the starting point.

**When stroke skeleton aligns with fill outer contour**
(outline-heart ↔ filled-heart): **medial-axis-aligned thickening.**
Tiller-Hanson curve offsetting (1984) widens the stroke's offset
curves outward from its centerline until they meet the fill's outer
contour, while opacity crossfades over `α(t)`. Produces the
"weight grows" feel of SF Symbols' weight axis.

**Skeleton alignment test:** the stroke's medial axis (computed once
via Voronoi diagram of the resampled centerline; Aichholzer et al.
1995) is compared against the fill's outer-contour skeleton via
Hausdorff distance. Above threshold, skeletons are misaligned.

**When skeletons do not align:** **directional draw + fill-emit.**
The stroke draws *out* (Lottie trim from end-to-start) along
`g(t)`; the fill draws *in* from the matched stroke endpoint along
a 0.08 · duration delay. Both at full opacity, no crossfade — the
motion contract forbids it.

**Variable-width strokes** (eng review Q8): Tiller-Hanson handles
variable-width centerlines by interpolating widths along arc length;
the offsetting step uses `width(t)` per sample. Already trivially
true since `style.strokeWidth` is constant per layer in the schema —
when per-vertex widths land in a future phase, the offsetter
generalizes naturally.

### 5.7 T6 — compound ↔ anything

T6 reduces to T3 / T5 by reading `compound.tree`:

- **Compound ↔ compound, isomorphic trees** (same shape, possibly
  different operand geometry): pair operands by tree position. Donut
  ↔ donut-with-thicker-rim morphs the outer-disc operand to the
  outer-disc operand and the hole operand to the hole operand. This
  is the case the schema is designed for and produces the highest
  motion quality in T6.
- **Compound ↔ compound, non-isomorphic trees:** flatten both to
  contour trees (§4.2) and run §5.3's per-level rectangular
  Hungarian. The tree-shape disagreement is a soft signal added to
  cost (and surfaced as the why-fallback signal in §4.3.3).
- **Compound ↔ simple:** flatten the compound to its contour tree.
  Holes unmatched in the simple side birth/death via radial closure
  (§5.3). When the simple side has self-intersecting subpaths under
  `evenodd`, treat as implicit compound — lift to contour tree
  before matching.

**Fill-rule plumbing.** `fillRule` enters cost matrices as a penalty
on cross-rule pairings and enters contour-tree construction as the
interior test. A cross-rule morph never silently produces a different
rendered region than either endpoint — rendered region is always
evaluated under each endpoint's own rule and crossfaded over `α(t)`
when continuous interpolation does not exist. **Default for cross-
rule pairs: route to T8 fallback** until empirical evidence supports
a designed crossfade (this resolves §11's open question
conservatively).

### 5.8 T8 — designed fallback library

When the resolver's distortion estimate exceeds the cascade's
distortion floor (§6) across all upper tiers, the runtime falls back
to a small, art-directed library. **No tier returns "raw crossfade."**

Named fallbacks:

- **`radial-pop`** — outgoing scales out from centroid with curve
  `g(t) = easeInQuad`, alpha `α(t) = easeOutCubic`, then incoming
  scales in from centroid with reversed curves. Default for hard-
  incompatible pairs of similar visual weight.
- **`directional-replace-{up,down,left,right,toward,away}`** —
  outgoing translates and fades; incoming translates from the
  opposite direction and fades in. The direction is either authored
  on the transition or inferred from the icons' semantics
  (configurable). Default for navigational pairs (e.g.,
  arrow-left ↔ arrow-right at hard-incompatible distortion).
- **`draw-replace`** — outgoing trim-collapses to its starting
  endpoint; incoming trim-emits from its starting endpoint, on a
  shared `g(t)`. Default for stroke-heavy hard-incompatible pairs
  (the spinner ↔ checkmark case from the design stress test —
  spinner trims to its arc-end while the checkmark draws in
  starting from where the spinner ended).
- **`scale-pop`** — small overshoot scale-down on outgoing, reverse
  on incoming. Default for symbol-only pairs at small render sizes
  where motion legibility wins over morph fidelity.

The fallback library is the design system's responsibility, not the
algorithm's. Each fallback has a fixed timing-curve pair, a name, a
preview, and a designer-owned canonical example. Authors can override
the default at the `Transition` level. The plan commits to *naming*
these and *requiring* them; their visual specification belongs in a
motion-design doc.

### 5.9 Stress-test outcomes (design review)

| Pair | Tier | Strategy | Expected outcome |
|------|------|----------|------------------|
| circle ↔ rounded square | T1 | intrinsic + ARAP-when-triggered | smooth corner-radius interpolation |
| hamburger (3 lines) ↔ X (2 lines) | T4 | rect Hungarian (2 matched + 1 birth/death), per-pair T2 | clean 2-line morph; 3rd line trim-retracts on offset timing |
| heart-outline ↔ heart-filled | T7 | medial-axis thickening (skeletons align) | weight-grows feel; falls to directional draw + fill-emit if skeletons misalign |
| donut ↔ disc | T6 | compound ↔ simple; outer matches outer; hole birth/death via radial closure | hole closes from rim inward |
| lock-closed ↔ lock-open | T6 isomorphic if authored as compound (shackle as operand); T3 per-level Hungarian if flat | shackle pairs to shackle; body stays — *conditional on authoring discipline*; `compound` schema makes this the default authoring path |
| arrow-right ↔ arrow-down | T1 / T2 | intrinsic — turning-function distance is rotation-invariant | clean 90° rotation |
| speech-bubble ↔ thought-bubble | T5 | closed-channel matches body; open-channel routes mismatches to T7 | body morphs continuously; tail/dots draw-replace on offset timing |
| spinner ↔ checkmark | T8 | `draw-replace` from §5.8, **not** raw crossfade | spinner trims out as checkmark draws in from spinner endpoint |

The spinner ↔ checkmark case was the design review's hardest
counterexample. The §5.8 named fallback library is the answer: the
motion is designed, predictable, and brand-coherent, even though no
geometric morph is possible.

---

## 6. Resolver cascade

The resolver runs per layer pair. Each tier returns either a
`MorphInterpolator` **with a self-reported distortion estimate** or
`null`. A non-null return is accepted only if its distortion is below
that tier's accept-floor; otherwise it falls through.

```
1. identity                    — equal d strings (distortion = 0)
2. compound-isomorphic         — both sides have isomorphic trees
                                 (§5.7 case 1)
3. intrinsic-strict            — same command signature
                                 (§5.1, §5.2)
4. hierarchical-match          — per-level rectangular Hungarian over
                                 contour tree (§5.3, §5.4, §5.5,
                                 §5.7 cases 2–3)
5. ARAP-quality-wrap           — wraps the chosen vertex correspondence
                                 with As-Rigid-As-Possible
                                 (§5.1 quality wrap)
6. draw-coordinated            — stroke/fill emit (§5.6)
7. designed-fallback           — named library (§5.8)
```

**Distortion floor.** Tiers 2-5 each have a tier-specific distortion
ceiling. If the tier's interpolator's worst-frame distortion estimate
exceeds the ceiling, the tier returns `null` even if it produced a
syntactically valid interpolator. This is the eng review's R2 fix:
the post-2026-04-14 "no premature gates" behavior is preserved
(tiers don't pre-gate based on shape), but a tier that produces a
*bad* interpolator falls through instead of locking in.

**Distortion estimates.** Each tier emits its own:

- T1 / T2 / T3 / T4 / T5: integrated turning-function distance plus
  arc-length distortion across the morph.
- T6 isomorphic: 0 by definition (operands map identity).
- T6 non-isomorphic: T3's estimate plus tree-shape penalty.
- T7: skeleton-alignment Hausdorff.
- T8: 0 (always accepts).

**Determinism.** Hungarian, intrinsic interpolation, ARAP,
contour-tree construction are deterministic given canonicalized
input. Hungarian's tiebreaker is specified (§5.3). Canonicalization
(`canonicalizeLayerPath`) is the single source of input.

**Fall-through correctness.** The cascade is conservative-first then
permissive *with quality gating*: identity before structural,
structural before heuristic, heuristic before fallback, but each
tier's bad output falls through. Identity to fallback is always
reachable.

---

## 7. Authoring affordances

Hiero is an authoring tool. The plan commits to the following
affordances rather than leaving them as research questions:

1. **Preview-on-hover** in the icon picker (§4.3.4). Replaces legacy
   compatibility-status tones.
2. **Why-fallback signal** (§4.3.3). The cascade's tier-pick is
   surfaced with the *signal* that gated up-tier selection.
3. **Author-supplied correspondence hints** (§4.4). Subpath-to-
   subpath and vertex-to-vertex pinning, stored on `Transition`,
   feeding the cost matrix as hard constraints.
4. **Compound layer affordances** (§4.3): visual distinction in layer
   list, non-destructive operand editing, explicit "Flatten with
   warning" command, "Convert to group" alternative.
5. **Fallback selection.** Authors can pick from the §5.8 named
   library at the `Transition` level when the resolver falls back.
   Defaults are designer-owned, not algorithm-owned.

These are listed as principles, not components. Their UX
implementation belongs in the editor specs (`specs/editor/*`) and
the Animate panel revamp (`docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`).

---

## 8. Mathematical foundations

| Algorithm | Source | Used for |
|-----------|--------|----------|
| Intrinsic vertex-path interpolation | Sederberg, Gao, Wang & Mu, "2D Shape Blending: An Intrinsic Solution to the Vertex Path Problem", SIGGRAPH 1993 | T1, T2 primary |
| As-Rigid-As-Possible interpolation | Alexa, Cohen-Or & Levin, "As-Rigid-As-Possible Shape Interpolation", SIGGRAPH 2000 | T1 quality wrap (offline / export sampling) |
| ARAP closed-form (interactive) | Igarashi, Moscovich & Hughes, "As-Rigid-As-Possible Shape Manipulation", SIGGRAPH 2005 | T1 quality wrap (preview-on-hover real-time path) |
| Compatible embedding | Baxter, Barla & Anjyo, "Compatible Embedding for 2D Shape Animation", IEEE TVCG 2009 (TR 2008) | boundary matching, simplification, compatible triangulation — used by T1 ARAP and T3 multi-shape generalization |
| Compatible triangulations | Surazhsky & Gotsman, "Controllable Morphing of Compatible Planar Triangulations", TOG 2001 | ARAP triangulation step (companion reference) |
| Hierarchical icon-class morphing | Feng et al., "2D Shape Morphing via Automatic Feature Matching and Hierarchical Interpolation", 2018 | contemporary methodological vindication of T3 / T6 hierarchical Hungarian approach |
| Turning-function metric | Arkin, Chew, Huttenlocher, Kedem & Mitchell, "An Efficiently Computable Metric for Comparing Polygonal Shapes", PAMI 1991 | correspondence cost in Hungarian; vertex anchoring at extrema |
| Discrete curve evolution | Latecki & Lakaemper, "Shape Similarity Measure Based on Correspondence of Visual Parts", PAMI 2000 | open-curve simplification & matching |
| Discrete Fréchet distance | Eiter & Mannila, 1994 | open-curve similarity gate |
| Hungarian assignment (rectangular) | Kuhn 1955; Munkres 1957; Bourgeois & Lassalle 1971 | T3 / T4 / T5 / T6 subpath matching |
| Curve-segment shape blending | Liu, Schneider & Klein, "Decomposing Curves into Segments for Shape Blending", 2010 | inspiration for hierarchical matching |
| Inbetween-by-shape-tree (inspiration) | Whited, Noris, Simmons, Sumner, Gross & Rossignac, "BetweenIT", Eurographics 2010 | conceptual reference for level-by-level decomposition (the original applies to hand-drawn strokes, not vector contours; we adopt the *idea*, not the algorithm) |
| Voronoi-based medial axis | Aichholzer, Aurenhammer, Alberts & Gärtner, 1995 | T7 skeleton alignment test |
| Curve offsetting | Tiller & Hanson, "Offsets of Two-Dimensional Profiles", 1984 | T7 medial-axis thickening |
| Point-in-polygon containment | Sunday; Foley/van Dam | contour-tree construction |
| Elastic shape analysis (SRVF) | Srivastava, Klassen, Joshi & Jermyn, "Shape Analysis of Elastic Curves in Euclidean Spaces", TPAMI 2011 | diagnostic baseline for correspondence quality audits; not in runtime path |
| Gromov-Wasserstein correspondence | Peyré, Cuturi & Solomon, "Gromov-Wasserstein Averaging of Kernel and Distance Matrices", ICML 2016 | research fallback for future non-isomorphic compound matching with large cardinality deltas |
| Mean value coordinates | Floater, "Mean Value Coordinates", CAGD 2003 | optional post-ARAP cage smoothing experiment for severe concavities (research-only) |

Citations removed since v1: shape contexts (Belongie 2002 — replaced
by Arkin 1991 turning function for icon scale); Sederberg-Greenwood
1992 (cited in v1 but never used by any algorithm); Floater 2003
mean-value coordinates (deferred to ARAP follow-up research, not
used by the v2 plan); Vaillant et al. 2013 / Bonneel et al. 2015
sliced Wasserstein (deferred — birth/death is now handled by
explicit centroid/radial collapse with no transport-theoretic
treatment).

**Open-source implementations cross-checked:**

*Already in tree or already conceptually mirrored.*

- **Flubber** (Veltman, BSD-3, archived 2018): subpath winding
  normalization, ring matching by bbox/area. Current
  `cross-icon-morph.ts` is closest to this. We retain its winding
  normalization and replace its greedy matcher.
- **d3-interpolate-path** (Pelletier, BSD-3, active): cubic-segment-
  count equalization. The De Casteljau subdivision in
  `cross-icon-morph.ts:216` is functionally equivalent.
- **Paper.js** (Lehni & Puckey, MIT): boolean operations and contour
  hierarchy. Already a dependency
  (`lib/editor-core/boolean-ops.ts`); reused for compound evaluation
  and contour-tree construction.

*Candidates to add — production-quality JS/TS implementations
identified by this plan's research pass.*

- **poly2tri** (`r3mi/poly2tri.js`, BSD-3): mature 2D constrained
  Delaunay triangulation with native support for polygon contours,
  holes, and Steiner points. Drives the ARAP triangulation step.
- **cdt2d** (Mikola Lysenko, MIT): alternate constrained Delaunay
  on planar straight-line graphs; used as cross-check or fallback
  when poly2tri rejects a degenerate input.
- **hungarian-on3** (npm, MIT): O(n³) Hungarian implementation
  benchmarked at ~13× faster than common JS alternatives on 1000×1000
  matrices. Drives the per-level rectangular Hungarian in §5.3 / §5.4.
  `@havelessbemore/hungarian` is the rectangular-explicit alternative.
- **clipper2-ts** (`countertype/clipper2-ts`, BSL — pure TS port of
  Angus Johnson's Clipper2) and **clipper2-wasm** (WASM port for
  perf-critical paths): polygon clipping plus offsetting. Drives the
  T7 Tiller-Hanson medial-axis thickening — `InflatePaths` performs
  the offsetting we need with the same numerical guarantees as the
  industrial Clipper2 reference.

*Reference implementations of the cited algorithms.*

- **Igarashi 2005 ARAP** — multiple open implementations exist
  (`zhangzhensong/arap`, `deliagander/ARAPShapeManipulation`)
  covering the closed-form two-step solver. We do not depend on
  these but use them as algorithmic reference checks during
  validation (§9).

*Behavior-only references (no code reuse).*

- **GSAP MorphSVG** (proprietary, Club GreenSock licensed):
  referenced for behavior only via published documentation.
- **Skia `SkPath::Op`** (BSD-3, C++): industrial reference for
  `fill-rule` semantics. WASM build or out-of-process oracle would
  be needed as a test ground truth; not in scope.
- **Lottie / lottie-web** (Apache 2.0): trim-path semantics. Already
  mirrored in `draw-executor.ts`. T7 keeps Lottie-format
  compatibility for export.
- **Apple SF Symbols** (proprietary): aspirational reference for T6
  / T7 / motion-contract feel. Behavior referenced from WWDC
  sessions; no code borrowed.

---

## 9. Validation protocol (academic + OSS-grounded)

To satisfy design review quality without collapsing into task-level
execution, the plan adds a reproducible validation protocol that can be
run on any candidate resolver implementation.

### 9.1 Corpus design

Build and freeze a benchmark corpus with three strata:

1. **Canonical topology set** (minimum 40 pairs): explicit coverage of
   T1–T8 with at least five pairs per category.
2. **Stress topology set** (minimum 30 pairs): adversarial cases —
   nested holes, ring/island alternation depth ≥ 3, open/closed mixed
   with cardinality mismatch, extreme concavity, and near-symmetric
   ambiguity that challenges Hungarian tie-breaking.
3. **Production set** (all icons in `@hiero/ui-icons` with authored
   transitions): serves as ecological validity layer.

The corpus stores source SVG/path data, expected topology labels,
expected fallback family (when applicable), and authored hints (when
present).

### 9.2 Quantitative metrics

Each transition is evaluated by the following metrics over sampled
frames `t ∈ [0,1]`:

- **Boundary distortion:** turning-function distance integrated over
  time (primary metric used by cascade floors).
- **Area monotonicity error:** detects implausible oscillation in
  filled region area (critical for T6 hole birth/death).
- **Self-intersection count:** any emergent self-intersections in
  intermediate contours (hard failure for T1/T3/T6 unless explicitly
  permitted by fallback).
- **Temporal jerk proxy:** finite-difference third derivative of key
  boundary landmarks to detect "snap then ooze" failures against §1
  cadence.
- **Preview/export parity error:** Hausdorff delta between runtime
  sampled frames and exported frames at matching timestamps.

### 9.3 Comparative baselines

Every corpus pair is compared against:

- current Hiero resolver baseline (`cross-icon-morph.ts` path),
- Flubber-style greedy ring matching,
- d3-interpolate-path single-path interpolation (where applicable),
- proposed cascade tier output.

Success criterion is not "wins every metric on every pair"; it is:
proposed cascade strictly reduces catastrophic failures (hard topology
misreads, role-swaps, severe distortions) while preserving determinism
and export parity.

### 9.4 Human-perception check

Because icon motion quality is perceptual, add a blinded pairwise
evaluation over a fixed panel (design + engineering reviewers). For each
pair, reviewers choose preferred motion and rate predictability
("I can guess where this point goes") on a 5-point Likert scale. This
operationalizes the §1 motion contract in measurable form.

---

## 10. Determinism, performance, exportability

- **Determinism.** All algorithms are deterministic given
  canonicalized input. Canonicalization
  (`canonicalizeLayerPath`) is the single input source. Hungarian
  has a specified tiebreaker (§5.3).
- **Performance budget.** All algorithms are linear or low-polynomial
  in subpath / vertex count. Realistic icons (≤ 20 subpaths, ≤ 200
  vertices each) resolve under 5 ms on commodity hardware. ARAP
  triangulation runs once per resolve and is cached for the
  playback's duration.
- **Exportability and preview/export parity.** This is the eng review
  B5 fix.

  **Cubic-Bézier-trajectory tiers** (T1 without ARAP, T2, T3, T4, T5
  without ARAP, T6, T7) export to Lottie and compiled icons by
  emitting per-control-point cubic trajectories. Preview and export
  are bit-equal at every `t`.

  **ARAP-augmented tier** (T1 with ARAP) does **not** decompose into
  cubic trajectories — its per-frame work is per-triangle polar
  decomposition. The plan's commitment: the export pipeline runs the
  **same ARAP solver** as the runtime, sampling at the export's
  target frame rate (commonly 30 or 60 fps). The Lottie keyframe set
  is generated from those samples, with cubic interpolation between
  keyframes preserving Lottie format compatibility. Preview and
  export are visually indistinguishable above the export's frame
  rate; below it (i.e., when scrubbing the exported Lottie at slow-
  motion in a viewer that interpolates between sample keyframes),
  visual difference is bounded by the inter-keyframe ARAP residual,
  which is small by ARAP's distortion-minimizing construction.

  Operationally: the ARAP sampler is shared code between the runtime
  and the export pipeline; there is no second implementation. The
  export pipeline is not a cubic-resampler over a geometric trace —
  it runs the algorithm and records its output.

- **Compound caching.** The `compound.cacheVersion` field is bumped
  on tree/operand edits. Resolver-level memoization keys off
  `(layerId, cacheVersion)` — not off tree-shape hashing — so
  memoization correctness does not depend on a canonical-form
  tree-equivalence question. This dodges the §11 open question on
  commutative reordering.

---

## 11. Open research questions

Flagged for future work; not blockers for this plan to commit:

- **ARAP trigger threshold.** Turning-function-variation predicate
  threshold is empirical and needs corpus sweep against the internal
  `@hiero/ui-icons` set.
- **Skeleton-alignment threshold.** The Hausdorff distance threshold
  separating "skeletons aligned" from "skeletons misaligned" in T7 is
  empirical.
- **Per-tier distortion-floor calibration.** Each tier's accept-floor
  in §6 needs a corpus sweep to set without false positives (good
  morphs rejected as "too distorted") or false negatives (bad morphs
  accepted).
- **Cross-rule continuous interpolation.** Whether `nonzero ↔
  evenodd` ever has a meaningful continuous interpolation, or
  whether the resolver should always route cross-rule to fallback,
  is an open question. **Default: route to T8 fallback** (§5.7).
- **Variable-width strokes for T7.** When per-vertex stroke widths
  land in the schema, the Tiller-Hanson offsetter needs the
  generalization (§5.6).

---

## 12. Non-goals

- **No intra-variant state authoring.** Cross-icon transition remains
  the only authored axis (`specs/editor/cross-icon-transitions.md`).
- **No rasterization-based morphing** (level sets, signed-distance-
  field interpolation). All algorithms are vector-domain.
- **No public renderer-contract change.** `runtime-dom`,
  `runtime-react`, and the export pipeline read `Layer.path.d`. The
  `compound` field is authoring metadata; readers do not change.
- **No clip-path / mask support** in the resolver. Imported SVG
  clip-paths and masks remain `SvgImportLayerMeta.unsupported`.
- **No task-level work enumeration.** Sequencing and scoping belong
  in `docs_canonical/TASKS.md`, not here.

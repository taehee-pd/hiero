# Enhanced Icon-to-Icon Transition Algorithms

**Status:** Plan
**Owners:** runtime-core, editor-core, schema
**Related specs:**
`specs/runtime/morph-interpolation.md`,
`specs/runtime/topology-detection.md`,
`specs/runtime/transition-resolver.md`,
`specs/runtime/draw-executor.md`,
`specs/runtime/hybrid-compositor.md`,
`specs/schema/icon-schema.md`,
`specs/schema/transition-schema.md`,
`specs/editor/cross-icon-transitions.md`

This document is an **architecture and algorithm plan**, not a delivery
plan. It does not define phases, owners, or task lists. It defines the
topology model, the compound-shapes feature that the topology model
depends on, and the family of transition algorithms that operate over
that model.

---

## 1. Problem framing

The runtime currently treats every icon as a flat list of layers, and
every layer's path as a flat `d` string. Subpaths are recovered ad-hoc
by splitting on `M`, and pairing across icons is a greedy O(n²)
heuristic over centroid + bbox + area + segment-count + closed-flag
(`lib/runtime-core/cross-icon-morph.ts:139`). This is sufficient for the
"hamburger ↔ X" / "play ↔ pause" / "plus ↔ close" family of
transitions but degrades on three axes the editor already exposes
to authors:

1. **Compound shapes.** The editor's `applyBoolean` path
   (`lib/editor-store/store.ts:3771`, `lib/editor-core/boolean-ops.ts`)
   produces a flattened `d` string with no record of `unite | subtract |
   intersect | exclude`, no operand-layer references, and no
   parent/child hierarchy between resulting contours. The morph
   pipeline cannot tell the outer contour of `A ∪ B` from a hole
   produced by `A \ B`.
2. **Fill-rule semantics.** `path.fillRule` is parsed and rendered
   (`lib/schema/types.ts:199`) but topology detection and morph scoring
   ignore it. A `fill-rule="evenodd"` shape and a `nonzero` shape with
   the same `d` are topologically distinct (interior tests differ on
   self-intersecting or nested contours), yet the resolver scores them
   as identical.
3. **Higher-order correspondence.** The greedy matcher fails as soon as
   subpath count or content composition stops being trivially
   recoverable from per-subpath bbox: rotated 4-dot grids, concentric
   ring icons, eyedropper-style stacks, anything where a hole moves
   between contours, and any pair where the optimal assignment is not
   the locally-greedy one.

The product goal is a single resolver that picks a high-quality
algorithm for every icon pair the editor can produce, including
boolean-derived compounds, with a deterministic, well-defined fallback
when geometry truly cannot interpolate.

---

## 2. Topology taxonomy

The resolver classifies each `(source, target)` icon pair by the joint
topology of its layers and subpaths. The taxonomy below is the unit of
algorithm selection. Categories are mutually exclusive per layer pair,
not per icon — an icon with a stroke layer and a fill compound layer
gets two classifications, one per layer pair.

| ID | Source layer | Target layer | Examples |
|----|-------------|-------------|----------|
| **T1** | single closed | single closed | circle ↔ rounded square, triangle ↔ pentagon |
| **T2** | single open  | single open  | checkmark ↔ X, single chevron ↔ single arrow |
| **T3** | multi closed | multi closed | dice-2 ↔ dice-4, two-circle Venn ↔ three-circle |
| **T4** | multi open   | multi open   | hamburger (3 lines) ↔ equals (2 lines) |
| **T5** | mixed (closed + open) | mixed | speech-bubble (closed body + open tail) ↔ thought-bubble |
| **T6** | compound (boolean) | any | donut ↔ disc, eye-with-pupil ↔ eye-without-pupil, slashed-bell ↔ bell |
| **T7** | stroke style | fill style | outline-heart ↔ filled-heart (SF Symbols-class) |
| **T8** | hard-incompatible | hard-incompatible | meaningless pair: bug ↔ keyboard |

T6 is **not** a property of a single layer in the schema today; it is a
property the resolver must reconstruct from the flat path string. Part
of this plan is to make T6 a first-class authoring concept so the
resolver can read it instead of re-deriving it.

A layer's category is a function of (subpath count, per-subpath closed
flag, fill-rule, nesting tree, declared boolean-op metadata). The same
icon can be T1 against one target and T6 against another.

---

## 3. Compound shapes as a first-class feature

Boolean operations exist in the editor today as a destructive flatten
via Paper.js. The plan replaces destructive flatten with a hybrid
representation that is non-destructive in the schema and compatible
with the existing renderer and the new resolver.

### 3.1 Schema

A new optional `compound` field on `Layer`:

```ts
type CompoundOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

type CompoundNode =
  | { kind: 'leaf'; pathId: string }              // reference to a stored sub-path
  | { kind: 'op'; op: CompoundOp; children: CompoundNode[] };

type Layer = {
  // existing fields …
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };
  compound?: {
    tree: CompoundNode;          // expression tree
    operands: Record<string, { d: string; transform?: Mat3 }>;
    cached: { d: string; fillRule: 'nonzero' | 'evenodd' };
  };
};
```

Two principles drive the design:

- **`cached.d` is the renderer contract.** Existing rendering paths
  (`runtime-dom`, SVG export, Lottie export) continue to read a flat
  `d`. The cache is regenerated from the tree on edit, not on render.
  This keeps the runtime hot path identical to today.
- **`tree + operands` is the resolver contract.** The morph resolver
  reads the tree to recover hierarchy, operand identity, and operation
  type. When morphing one compound to another, it can pair operands by
  identity instead of by post-flatten geometry.

A `Layer` always has either `path` (simple) or `compound` (compound),
never both. Migration: existing layers stay simple and require no
change.

### 3.2 Contour hierarchy

For both `path` and `compound.cached`, the resolver derives a
**contour tree** at canonicalization time:

- Each subpath is a node: `{ ring: Polygon, area: signedArea, depth, parent, children }`.
- Parent/child is determined by point-in-polygon containment of one
  ring's interior point against another ring's filled region, using
  the layer's `fillRule`.
- Depth alternates `outer → hole → island → hole-in-island → …`.
  Polygon containment + Shoelace sign together produce the depth
  parity (Foley/van Dam computational-geometry treatment;
  Sunday's "Inclusion of a Point in a Polygon" algorithm).

The contour tree replaces the flat subpath list as the unit of
correspondence and is what makes T6 tractable.

### 3.3 Editor interaction

`applyBoolean` stops flattening. It builds or extends the
`compound.tree`, leaves operands intact, and recomputes
`compound.cached`. The Inspector exposes the tree as a collapsible
node so authors can edit operands non-destructively. A
"Flatten compound" command remains available for users who want to
hand-tune the post-boolean path.

The editor's `topology.ts` is extended to expose contour-tree
visualization in the path editor (outer rings vs holes coloured
differently), which doubles as a debugging surface for the resolver.

### 3.4 Import / export

- **SVG import** (`lib/import/import-svg.ts`): SVGs encode compound
  topology only as nested subpaths under one `<path>` with
  `fill-rule`. Import does not synthesize a `CompoundNode` tree —
  the original boolean intent is unrecoverable. Imported compounds
  arrive as `path` (simple) with the contour tree derived at
  canonicalization time. Authors who want operand-level non-destructive
  edits must rebuild the tree explicitly.
- **SVG export** writes `compound.cached.d`. No information loss vs.
  today.
- **Lottie / compiled-icon export** writes the cached path. The runtime
  SDK never sees the tree.

### 3.5 Why this shape

Three alternatives were considered and rejected:

1. **Flat `booleanOp` field on Layer.** Cannot represent operand
   identity, so contributes nothing to morphing.
2. **One-layer-per-operand with z-order convention.** Conflicts with
   the existing layer model, which uses z-order for paint. Boolean
   trees are not paint stacks.
3. **Tree without cache.** Forces the renderer to evaluate Paper.js on
   every paint. Unacceptable for runtime perf budgets.

The cached-tree shape preserves the renderer contract (flat string),
preserves authoring intent (tree), and is the minimum representation
that lets the morph resolver pair operands across icons.

---

## 4. Per-category transition algorithms

Each category gets a primary algorithm and a degradation path. All
algorithms are vector-based; rasterization-based morphs (level-set,
implicit-surface) are out of scope because they do not preserve the
authoring contract that exports must remain crisp at any zoom.

### 4.1 T1 — single closed ↔ single closed

**Primary: vertex-correspondence intrinsic interpolation.** The
existing `intrinsicStrictMorph`
(`lib/runtime-core/intrinsic-interpolation.ts`) implements
Sederberg, Gao, Wang & Mu (1993), *"2D Shape Blending: An Intrinsic
Solution to the Vertex Path Problem"* — interpolation of edge length
and turning angle rather than `(x,y)`. This is the strongest baseline
for similar-topology closed contours and is already in place.

**Resampling for unequal segment counts:** De Casteljau subdivision
with arc-length-weighted distribution
(`lib/runtime-core/cross-icon-morph.ts:216`). Already in place.

**Vertex correspondence search:** when both shapes share command
signature, the existing rotation search (cyclic alignment minimizing
turning-angle distortion) is sufficient. When signatures diverge,
add a dynamic-programming correspondence step over a shape-context
descriptor (Belongie, Malik & Puzicha 2002, *"Shape Matching and
Object Recognition Using Shape Contexts"*) so the start vertex of
both shapes is anchored at corresponding extrema before resampling.

**Distortion mitigation:** wrap intrinsic interpolation in
**As-Rigid-As-Possible (ARAP)** triangulation (Alexa, Cohen-Or &
Levin 2000, SIGGRAPH). ARAP triangulates the polygon interior
once, then interpolates per-triangle affine transforms in their
polar-decomposed (rotation × stretch) form. This kills the "swimming"
artefact of pure intrinsic interpolation on non-convex shapes (e.g.,
star ↔ heart). For a polygon with `n` vertices, ARAP is `O(n)` per
frame after a one-time triangulation.

**Degradation:** if vertex correspondence cannot be established with
distortion under a threshold, drop to draw-coordinated crossfade
(§4.7).

### 4.2 T2 — single open ↔ single open

**Primary: arc-length parameterized resampling + endpoint-aligned
intrinsic interpolation.** Open paths have a defined start and end;
the algorithm:

1. Reparameterize both curves by arc length.
2. Resample to a common `N` using De Casteljau subdivision.
3. Try both forward and reversed pairings of the target; choose the
   one minimizing the integrated turning-angle distortion (Latecki &
   Lakaemper 2000, *"Shape Similarity Measure Based on Correspondence
   of Visual Parts"* — discrete curve evolution).
4. Interpolate via Sederberg-1993 intrinsic on the open polyline.

**Curve-similarity gate:** Discrete Fréchet distance (Eiter & Mannila
1994) between the resampled polylines as the "is this morph
geometrically reasonable" predicate. If above a threshold, fall to
trim + draw-coordinated emit (§4.7).

**Trim fallback:** the existing trim executor
(`lib/runtime-core/draw-executor.ts`) using Lottie-style
`trimStart`/`trimEnd`/`trimOffset` remains the secondary strategy and
is the right answer when one path strictly contains the other along
the arc length (e.g., short check ↔ longer check with same prefix).

### 4.3 T3 — multi closed ↔ multi closed

**Primary: Hungarian assignment over a content-aware cost matrix,
then per-pair T1.**

Replace the current greedy matcher with the Hungarian algorithm
(Kuhn 1955; Munkres 1957) operating on a cost matrix `C[i][j]` that
combines:

- centroid distance (current weight 0.35),
- bbox aspect/scale similarity (current 0.30),
- area similarity (current 0.10),
- **shape-context descriptor distance** (Belongie 2002) — adds true
  geometric similarity, not just bbox proxy,
- **z-order penalty** if relative paint order would invert,
- **fill-role penalty** under the layer's contour tree (outer-to-outer,
  hole-to-hole only; outer-to-hole carries a high cost).

Hungarian is `O(n³)` in subpath count; for the icons in scope (≤ 20
subpaths) this is negligible. The output is an optimal one-to-one
assignment; per-pair morph then runs T1.

**Birth and death.** Unmatched source subpaths morph toward their own
centroid while fading out; unmatched target subpaths morph from
their own centroid while fading in. This is the discrete analogue of
the optimal-transport "spawn from atom" treatment in Wasserstein
distance over shape distributions (Vaillant, Bonneel & Lévy 2013,
*"Sliced and Radon Wasserstein Barycenters of Measures"*) and matches
the perceptual expectation of dots appearing/disappearing rather than
sliding from off-canvas.

**Shape-tree blending option.** For dense multi-shape cases (multiple
holes, nested compounds), Whited, Noris, Simmons, Sumner, Gross &
Rossignac 2010, *"BetweenIT: An Interactive Tool for Tight
Inbetweening"*, and Liu, Schneider & Klein 2010, *"Decomposing Curves
into Segments for Shape Blending"*, decompose each shape into a tree
of features and blend feature-by-feature. We adopt a lightweight
variant: **the contour tree from §3.2 is the assignment unit.**
Hungarian runs separately per tree level (outers, then holes-within-
each-matched-outer, etc.), which is `O(k · n_k³)` and never explores
biologically-impossible matches like "outer ring of donut ↔ hole of
disc."

### 4.4 T4 — multi open ↔ multi open

**Primary: Hungarian assignment over endpoint-aware cost, then
per-pair T2.**

Cost matrix uses Hausdorff distance over the resampled polylines,
endpoint-pair distance, and arc-length similarity. The endpoint
asymmetry is key — two strokes whose ends are near each other should
morph in the orientation that aligns their ends, which Hausdorff over
the unordered point set does not capture on its own.

Birth/death uses trim collapse to an endpoint, not centroid, since
that visually reads as "the stroke retracts" rather than "the stroke
implodes."

### 4.5 T5 — mixed ↔ mixed

**Primary: split into closed-channel and open-channel, run T3 and
T4 independently, composite.**

A mixed-topology layer is decomposed by the contour tree into a
closed channel (rings) and an open channel (strokes). Each channel
runs its own Hungarian + per-pair morph. The two channels render
into the same layer, in the original z-order, every frame.

When a closed-source contour has no closed-target match but has an
open-target match (e.g., closing-bracket → arrow), the resolver does
**not** force a closed-to-open morph. Such cross-type pairs route to
T7 (stroke ↔ fill emit, §4.6).

### 4.6 T7 — stroke style ↔ fill style

**Primary: draw-coordinated crossfade,** as already implemented for
`'draw-crossfade'` in `topology-detection.ts`. This matches the SF
Symbols 7 design philosophy that a stroke does not deform into a fill
— the stroke is drawn out while the fill grows underneath it.

**Refinement:** when the stroke contour and the fill outer contour
share a topological skeleton (e.g., outline-heart and filled-heart),
the algorithm runs **medial-axis-aligned thickening**: at `t = 0` the
stroke renders normally; at `t = 1` the fill renders normally;
interpolation runs the stroke's offset curves (Tiller-Hanson curve
offsetting, 1984) outward from its centerline until they meet the
fill outer contour, while opacity crossfades. This produces the
"weight grows" feel of SF Symbols' `weight` axis.

When skeletons do not align, fall back to plain draw-out + fade-in.

### 4.7 T6 — compound ↔ anything

T6 is reduced to T3 / T5 by reading the `compound.tree`:

- **Compound ↔ compound, same tree shape:** pair operands by tree
  position. If both icons declare `donut = disc \ inner-disc`, the
  outer disc morphs to the outer disc and the hole morphs to the
  hole. This is the case the schema is designed for.
- **Compound ↔ compound, different tree shape:** flatten both to
  contour trees (§3.2) and run §4.3's level-by-level Hungarian. The
  tree disagreement is a soft signal added to the cost matrix, not a
  hard reject.
- **Compound ↔ simple:** flatten the compound to its contour tree.
  When the simple shape has no holes and the compound does, the holes
  are unmatched and birth/death — typically fading the hole to zero
  area at its own centroid (visually: the hole closes up). When the
  simple shape has self-intersecting subpaths under `evenodd`, treat
  it as an implicit compound and lift it into a contour tree before
  matching.

**Fill-rule plumbing.** `fillRule` enters the cost matrix as a
penalty on cross-rule pairings, and enters the contour tree
construction as the interior test. A cross-rule morph never silently
produces a different rendered region than either endpoint —
rendered region is always evaluated under each endpoint's own rule
and crossfaded if a continuous interpolation does not exist.

### 4.8 T8 — hard-incompatible

When the resolver's distortion estimate exceeds a configured
threshold across all strategies, the runtime falls back to the
existing `FallbackMode` (`crossfade` | `directional-replace`). This
is a feature, not a bug: the schema explicitly does not guarantee
every pair morphs (`specs/schema/transition-schema.md`).

---

## 5. Resolver cascade

A unified `autoMorph` cascade runs per layer pair (the existing
five-tier cascade in `lib/runtime-core/auto-morph.ts` is the
starting point):

```
1. identity            — equal d strings
2. compound-tree pair  — both sides have compound trees with
                         compatible structure (§4.7 case 1)
3. intrinsic strict    — same command signature (§4.1, §4.2)
4. hierarchical match  — Hungarian over contour tree (§4.3, §4.4, §4.5)
5. ARAP-blended morph  — wraps the chosen vertex correspondence with
                         As-Rigid-As-Possible interpolation
6. draw-coordinated    — stroke/fill emit (§4.6)
7. fallback            — crossfade or directional-replace (§4.8)
```

Each tier returns either a `MorphInterpolator` or `null`. `null`
falls through; the first non-null wins. The resolver records which
tier it chose; the editor's hidden Advanced disclosure surfaces this
read-only.

The cascade is intentionally **conservative-first then permissive**:
identity is checked before structural match, structural match before
heuristic match, and heuristic match before any fallback. This makes
the resolver deterministic and reproducible, which matters for
exports — a Lottie or compiled-icon export must pick the same tier
the runtime would pick at preview time.

---

## 6. Mathematical foundations

| Algorithm | Source | Used for |
|-----------|--------|----------|
| Intrinsic vertex-path interpolation | Sederberg, Gao, Wang & Mu, "2D Shape Blending: An Intrinsic Solution to the Vertex Path Problem", SIGGRAPH 1993 | T1, T2 primary |
| Physically-based shape blending | Sederberg & Greenwood, "A Physically Based Approach to 2D Shape Blending", SIGGRAPH 1992 | distortion-minimizing reference |
| As-Rigid-As-Possible interpolation | Alexa, Cohen-Or & Levin, "As-Rigid-As-Possible Shape Interpolation", SIGGRAPH 2000 | T1 quality wrap |
| Compatible triangulations | Surazhsky & Gotsman, "Controllable Morphing of Compatible Planar Triangulations", TOG 2001 | ARAP triangulation step |
| Mean-value coordinates | Floater, "Mean Value Coordinates", CAGD 2003 | warp transfer for non-convex interiors |
| Shape contexts | Belongie, Malik & Puzicha, "Shape Matching and Object Recognition Using Shape Contexts", PAMI 2002 | correspondence cost in Hungarian |
| Discrete curve evolution | Latecki & Lakaemper, "Shape Similarity Measure Based on Correspondence of Visual Parts", PAMI 2000 | open-curve simplification & matching |
| Discrete Fréchet distance | Eiter & Mannila, 1994 | open-curve similarity gate |
| Hungarian assignment | Kuhn 1955; Munkres 1957 | T3 / T4 / T5 subpath matching |
| Sliced Wasserstein | Bonneel, Rabin, Peyré & Pfister 2015; Vaillant, Bonneel & Lévy 2013 | birth/death formulation |
| Shape-tree decomposition | Whited et al., "BetweenIT", Eurographics 2010; Liu, Schneider & Klein 2010 | T6 hierarchical matching |
| Curve offsetting | Tiller & Hanson 1984 | T7 medial-axis thickening |
| Point-in-polygon containment | Sunday, "Inclusion of a Point in a Polygon"; Foley/van Dam | contour-tree construction |

Implementations cross-checked:

- **Flubber** (Veltman): subpath winding normalization, ring matching by
  bbox/area. The current `cross-icon-morph.ts` is closest to this. We
  retain its winding normalization, replace its greedy matcher.
- **GSAP MorphSVG** (closed-source but documented): rotation-aligned
  vertex correspondence + arc-length resampling. Parallel to T1 above.
- **d3-interpolate-path** (Pelletier): pure cubic-segment-count
  equalization. The De Casteljau subdivision in
  `cross-icon-morph.ts:216` is functionally equivalent.
- **Paper.js** (Lehni & Puckey): boolean operations and contour
  hierarchy. Already a dependency
  (`lib/editor-core/boolean-ops.ts`, `lib/editor-core/paper-runtime.ts`);
  reused for compound evaluation and contour-tree construction.
- **Skia `SkPath::Op`**: industrial-grade boolean reference for
  `fill-rule` semantics. Used as ground truth in cross-rule tests.
- **Lottie** (Airbnb): trim path semantics. Already mirrored in
  `draw-executor.ts`. T7 keeps Lottie compatibility.
- **Apple SF Symbols** (WWDC 2021–2024 sessions): draw-coordinated
  stroke/fill emit, weight-axis interpolation. Aspirational reference
  for T6 / T7 quality; we follow the published behavior, not internal
  implementation.

---

## 7. Determinism, performance, exportability

- **Determinism.** Hungarian, intrinsic interpolation, ARAP, contour-
  tree construction are all deterministic given a canonicalized
  input. Canonicalization (`canonicalizeLayerPath`, already in place)
  remains the single source of input for the resolver.
- **Performance budget.** All algorithms are linear or low-polynomial
  in subpath / vertex count. Realistic icons stay below a few
  milliseconds per resolve; the resolved interpolator runs
  per-frame as cheap polynomial evaluation. ARAP triangulation runs
  once per resolve and is cached for the duration of the playback.
- **Exportability.** Every algorithm must be expressible as a sequence
  of cubic-Bézier control-point trajectories so the export pipeline
  (Lottie keyframes, compiled-icon JSON, React codegen) can sample it
  at fixed timestamps without runtime branching. ARAP is the only
  algorithm that requires per-frame work outside cubic interpolation;
  for export, ARAP is sampled at N keyframes (default 16, configurable)
  and emitted as cubic-interpolated control points. This matches
  Lottie's existing keyframed-shape model.

---

## 8. Open research questions

These are flagged for follow-up research, not for this plan to
resolve:

- **Shape-context descriptor weight.** Belongie's descriptor has a
  scale parameter; the right value for icon-grid shapes (typically
  24×24 viewBox) is empirical and needs a corpus sweep against the
  internal `@hiero/ui-icons` set.
- **ARAP trigger threshold.** ARAP is more expensive than plain
  intrinsic and only beats it on non-convex shapes. A turning-
  variation predicate is the likely trigger; the threshold is
  empirical.
- **Cross-rule interpolation.** Whether `nonzero ↔ evenodd` ever has a
  meaningful continuous interpolation, or whether the resolver should
  always crossfade across rule changes, is an open question.
  Conservative default: crossfade.
- **Tree-structure hashing for compound caching.** The `compound.tree`
  hash should drive resolver memoization, but tree equivalence under
  operand reordering (e.g., `unite` is commutative, `subtract` is
  not) needs a canonical form before hashing.
- **Author-supplied correspondence hints.** Future authoring affordance:
  let the author drag a vertex on source onto a vertex on target to
  pin correspondence, overriding Hungarian for that pair. Out of scope
  for this plan but the resolver should leave room for it.

---

## 9. Non-goals

- This plan does not introduce intra-variant state authoring. Cross-
  icon transition remains the only authored axis
  (`specs/editor/cross-icon-transitions.md`).
- This plan does not commit to rasterization-based morphing (level
  sets, signed-distance-field interpolation). All algorithms are
  vector-domain.
- This plan does not change the public renderer contract. The
  cached flat `d` string remains what `runtime-dom`, `runtime-react`,
  and the export pipeline read.
- This plan does not enumerate task-level work. Sequencing and scoping
  belong in `docs_canonical/TASKS.md`, not here.

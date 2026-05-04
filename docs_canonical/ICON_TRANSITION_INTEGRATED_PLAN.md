# Icon Transition System — Integrated Plan

**Status:** Integrated (algorithm × UX), pre-launch
**Supersedes:** none — consolidates and integrates these source docs:
- `docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md` (algorithm v2 + validation)
- `docs_canonical/ICON_TRANSITION_ALGORITHMS_TASKS.md` (algo phasing A–H)
- `docs_canonical/ICON_TRANSITION_UX_PLAN.md` (UX contract + UX phasing A–F)
- `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` (existing animate-panel decisions)
- `specs/editor/cross-icon-transitions.md`, `specs/runtime/*`, `specs/schema/*`

This document is the **single coherent narrative** that joins the
runtime-side algorithm revamp to the UI-side authoring contract. The
source docs above remain the depth references; this doc is the joint.
A reader picking one up first should be able to ship with conviction
without bouncing across five files.

> **Pre-launch context.** Hiero is not yet released. There are no
> existing users, no shipped projects, no on-disk format to preserve.
> This plan deletes any migration / backward-compatibility scaffolding
> that earlier drafts carried. Schema changes are direct rewrites; the
> only invariants to preserve are within-tree consistency between
> editor, runtime, and export.

---

## 1. Vision in one paragraph

Hiero ships an industrial-grade vector-shape transition resolver
that runs invisibly under a zero-config authoring surface. The user
picks a source icon and a target icon, presses play, and gets a
designer-acceptable motion regardless of the icons' topology
(single closed, single open, multi-closed, multi-open, mixed,
compound boolean trees, stroke ↔ fill). They never choose an
algorithm. They author four outcomes only — duration, cadence,
fallback motion (when applicable), correspondence pins (when needed)
— and the resolver makes everything else true. Preview ≡ runtime ≡
export. Compound shapes are authored non-destructively. Fallback is
designed motion, not a placeholder.

---

## 2. The contract joints — where algorithm meets UX

The two tracks meet at exactly five contract surfaces. Everything in
this doc that matters at the boundary lives at one of these joints.

### 2.1 The `Transition` schema

The schema is the user's authored representation. Algorithm reads it,
UI writes it. **Authored fields, complete:**

```ts
type Transition = {
  fromIconId: string;
  toIconId: string;
  duration: number;                                 // UI Layer 1
  cadence: 'soft' | 'snappy';                       // UI Layer 1
  fallbackOverride?: FallbackName;                  // UI Layer 1 (T8 only)
  correspondenceHints: {                            // UI Layer 2
    subpath: Array<[fromId: string, toId: string]>;
    vertex:  Array<[fromAddr: VertexAddr, toAddr: VertexAddr]>;
  };
};
```

Anything not in this list is a contract violation. No `morphStrategy`,
no `compatibilityLock`, no `fillRuleOverride`, no per-Layer transition
strategy. The surface area of *what the user can configure* is the
surface area of *what the user has to learn* — and we hold it down to
four axes.

### 2.2 The `Layer` schema with non-destructive compound

```ts
type Layer = {
  // ...existing fields
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };  // canonical
  compound?: {                                              // authoring metadata
    tree: CompoundNode;
    operands: Record<string, { d: string; transform?: Mat3 }>;
    cacheVersion: number;
  };
};
```

`path.d` is the renderer/exporter contract. `compound` is authoring
metadata over it; when present, `path.d` is the cached evaluation of
`compound.tree`. Direct `path.d` mutation outside the compound flow
clears `compound`, mirroring the `primitive` invariant. The Inspector
exposes the tree; the resolver reads it; nothing else needs to know
it exists.

### 2.3 The resolver result shape

Algorithm emits, UI consumes:

```ts
type ResolvedTransition = {
  interpolator: MorphInterpolator;
  motion: { g: EasingFn; alpha: EasingFn; alphaOffsetRatio: number };
  tier: ResolverTier;                  // T1..T8 + isomorphic + identity
  signal: ResolutionSignal | null;     // why the cascade fell to this tier
  distortion: number;
};
```

The UI shows `interpolator` (always), `motion` (always, derived from
`cadence`), the `signal` translated into a sentence (only when the
tier is T8 or below the user's expectation), and `tier` only behind
`NEXT_PUBLIC_HIERO_DEBUG=1`.

### 2.4 The named fallback library

Fixed list, designer-owned, motion-designed:

```ts
type FallbackName =
  | 'radial-pop'
  | 'directional-replace-up'
  | 'directional-replace-down'
  | 'directional-replace-left'
  | 'directional-replace-right'
  | 'directional-replace-toward'
  | 'directional-replace-away'
  | 'draw-replace'
  | 'scale-pop';
```

Algorithm picks a default by topological signal; UI Layer-1 lets the
author pick a different one. Each name has a fixed `(g(t), α(t))`
pair, a canonical preview asset, and a motion-design owner. No raw
crossfade is ever a fallback — the spinner ↔ checkmark case routes
to `draw-replace`, not crossfade.

### 2.5 The why-fallback signal → sentence translator

Algorithm emits a structured signal:

```ts
type ResolutionSignal =
  | { kind: 'tree-shape-mismatch'; level: number; fromCount: number; toCount: number }
  | { kind: 'distortion-floor-exceeded'; tier: ResolverTier; estimate: number; ceiling: number }
  | { kind: 'fillrule-conflict' }
  | { kind: 'open-closed-mismatch' }
  | { kind: 'subpath-cardinality-mismatch'; from: number; to: number }
  | …;
```

The UI maps each signal kind to a designer-readable sentence in the
`AnimationStudioPanel`. The raw signal lives only in the debug pill.
This is the only authorized place where the algorithm's vocabulary
crosses into anything user-facing — and even there, the user-facing
form is plain English, not a code.

---

## 3. Cross-cutting invariants

Every commit on either track must hold these:

| Invariant | Owner | Test surface |
|-----------|-------|--------------|
| Renderer reads `Layer.path.d`; never `compound` | algo (schema) + UI (Inspector) | unit + e2e |
| `Transition` has only the four authored axes | algo + UI | schema lint |
| `T7` never falls to raw crossfade | algo (C6) | unit |
| Cascade output is bit-stable across runs/platforms | algo (C1, C4) | determinism test |
| Preview, runtime, and exported Lottie produce the same motion | algo (F1) + UI (UX-C parity tests) | snapshot |
| No algorithm vocabulary in non-debug UI strings | UI (UX-A copy lint) | grep-based lint in CI |
| Debug diagnostics never ship to production builds | UI (UX-F) | build-time assertion |
| No `clip-path` / `mask` enters the resolver | algo (B4) | import test |
| Vector-domain only — no SDF / level-set / neural | both | code review + lint |
| No intra-variant state authoring surface | UI | spec lock |

---

## 4. The algorithm side, condensed

The full architecture lives in
`docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md`. This is the
30-second summary.

- **Topology taxonomy (T1–T8)** classifies every layer pair.
- **Resolver cascade** runs seven tiers (identity → compound-isomorphic
  → intrinsic-strict → hierarchical-match → ARAP-quality-wrap →
  draw-coordinated → designed-fallback) with per-tier distortion
  floors. Bad outputs fall through; never lock in.
- **Algorithms.** Sederberg-1993 intrinsic for closed contours;
  arc-length + intrinsic for open; rectangular Hungarian per
  contour-tree level for multi-shape; ARAP wrap (Igarashi 2005
  closed-form for runtime, Alexa 2000 for offline) gated by
  turning-function variation; Tiller-Hanson via Clipper2 for
  T7 medial-axis thickening.
- **Compound shapes** are first-class: `Layer.compound = { tree,
  operands, cacheVersion }` over canonical `path.d`. Boolean ops
  stop being destructive.
- **Validation** runs a corpus (canonical ≥40, stress ≥30, prod set)
  through five quantitative metrics (boundary distortion, area
  monotonicity, self-intersection, temporal jerk, parity error)
  plus a blinded human panel.
- **OSS dependencies** chosen by research pass: `poly2tri` /
  `cdt2d` (CDT), `hungarian-on3` / `@havelessbemore/hungarian`
  (rectangular Hungarian), `clipper2-ts` / `clipper2-wasm`
  (offsetting). Existing `paper.js` retained for boolean ops.
- **Academic foundations:** Sederberg 1993, Alexa 2000, Igarashi
  2005, Baxter 2008, Surazhsky-Gotsman 2001, Arkin 1991, Latecki
  2000, Eiter 1994, Aichholzer 1995, Tiller-Hanson 1984, Liu 2010,
  Whited 2010 (inspiration), Feng 2018.

---

## 5. The UX side, condensed

The full UX plan lives in
`docs_canonical/ICON_TRANSITION_UX_PLAN.md`. This is the 30-second
summary.

- **Single non-negotiable principle:** the user never chooses a
  transition algorithm.
- **Surface map:** icon picker (preview-on-hover) → TransitionPanel
  (endpoint + scrub + advanced disclosure) → AnimationStudioPanel
  (per-Transition authoring) → Inspector (compound layers) → debug
  pill (engineer signals only). No new top-level surface.
- **Four progressive-disclosure layers:**
  - **Layer 0** — pick + play, nothing else (95 % case).
  - **Layer 1** — duration, cadence (`Soft`/`Snappy`), fallback
    motion (T8 only).
  - **Layer 2** — Advanced disclosure: correspondence pins
    (drag-vertex-to-vertex in canvas), timing-curve override.
  - **Layer 3** — debug pill (`NEXT_PUBLIC_HIERO_DEBUG=1`): tier,
    signal, distortion.
- **Designer trust contract:** preview ≡ runtime ≡ export;
  preview-on-hover ≤100 ms time-to-first-frame; why-fallback as a
  plain-language sentence.
- **Visual / motion principles** (per `frontend-design` skill):
  refined minimalism; only three motion moments earn animation
  (the preview itself, hover ramp-in, compound disclosure); reuse
  `components/ds/`; no AI-default aesthetics.
- **Anti-patterns:** no tier badges, no morph-quality scores, no
  in-editor algorithm tutorials, no per-layer strategy override,
  no auto-toggle.

---

## 6. How the two tracks compose

The composition is not a hand-off — both tracks ship together at
each wave. The algorithm produces capability; the UI surfaces it.
Capability without surface is dead code; surface without capability
is a lie.

**Wave-level joint exit criteria (informative):** at the end of each
wave (defined in the roadmap), both the algorithm and UI deliverables
must be true together.

| Wave | Algorithm capability | UI surface | Joint truth |
|------|---------------------|------------|-------------|
| 1 — Foundations | taxonomy classifier, contour tree, motion-curves type | `Transition` schema with the four axes | the four authored axes route through the schema; classifier output exists; nothing user-visible yet |
| 2 — Compound feature | non-destructive `Layer.compound`; `applyBoolean` writes both fields | Inspector glyph + tree disclosure + flatten/convert-to-group | author can build a compound non-destructively and see it in the Inspector |
| 3 — Resolver core | cascade scaffolding + T1–T7 algorithms + T8 named fallbacks + two-curve scheduler | (still nothing user-visible — capability lands behind feature flag) | corpus baseline measurable; engineer can flip the flag and see real motion |
| 4 — Authoring surface + parity | export pipeline runs same ARAP solver; correspondence-hint plumbing | Layer 1 controls (cadence, fallback picker), preview-on-hover, Layer 2 correspondence pins, debug pill | designer can author a transition end-to-end with no algorithm vocabulary |
| 5 — Validation + rollout | corpus pass, blinded panel, threshold calibration, telemetry | a11y QA, copy lint, debug-isolation guard | shipping bar reached |

The roadmap (`docs_canonical/ICON_TRANSITION_ROADMAP.md`) breaks each
wave into the algorithm + UI tasks, in execution order, with
`requires:` lines that cross tracks where dependencies are real.

---

## 7. What's deliberately out of scope

- **Migrations / backward-compat shims.** Nothing has shipped. We
  rewrite freely.
- **Per-icon-set defaults** (cadence, fallback, etc.). All authored
  state lives on the `Transition`.
- **CLI / SDK config layer separate from the schema.** `@hiero/cli`
  reads the same `Transition` payload the editor writes.
- **Rasterization-based morphs** (level-set, SDF, neural).
- **Intra-variant state authoring** (per the existing
  cross-icon-transitions spec).
- **Designer-facing academic citations.** All references live in
  `docs_canonical/`; the editor never shows a citation.
- **Tutorial / onboarding for the resolver.** No tooltip explains
  morphing. Show, don't teach.

---

## 8. Reference index

- **Architecture:** `docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md`
- **UX:** `docs_canonical/ICON_TRANSITION_UX_PLAN.md`
- **Phased execution:** `docs_canonical/ICON_TRANSITION_ROADMAP.md`
  (this is the unified roadmap; supersedes the per-track phasing in
  the algorithm and UX docs for execution purposes — those sections
  remain as architectural appendices)
- **Existing animate-panel decisions:**
  `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`
- **Existing specs:** `specs/editor/cross-icon-transitions.md`,
  `specs/runtime/morph-interpolation.md`,
  `specs/runtime/topology-detection.md`,
  `specs/runtime/transition-resolver.md`,
  `specs/runtime/draw-executor.md`,
  `specs/runtime/hybrid-compositor.md`,
  `specs/schema/icon-schema.md`,
  `specs/schema/transition-schema.md`

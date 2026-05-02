# Icon Transition System — Wave 5 Validation

**Companion to:** `docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md`,
`docs_canonical/ICON_TRANSITION_ROADMAP.md`
**Status:** Wave 5 — validation + rollout

This document is the operational artefact for Wave 5: it captures
the calibration values, the human-perception protocol, the UX QA
matrix, the open research queue, and the ship checklist. The
roadmap's W5 tasks reference back to the sections here.

---

## 1. Threshold calibration values (W5-3)

The cascade's per-tier distortion ceilings and the trigger
thresholds that gate ARAP and skeleton-alignment routing land here
after the W5-1 corpus pass against the seed + stress sets. Until
the W5 calibration sweep runs against the production corpus
(`@hiero/ui-icons`), these values are the engineering defaults
established during W3.

### 1.1 Per-tier distortion ceilings

| Tier | Ceiling | Rationale |
|------|---------|-----------|
| `identity` | 0 | Equal canonicalised paths; tier returns 0 by construction. |
| `compound-isomorphic` | 0 | Tree isomorphism is structural — distortion is 0 by definition; rendered drift is the W4-3-mooted concern. |
| `intrinsic-strict` | 0.20 | Empirical floor on the canonical seed pairs; 95th-percentile boundary distortion of well-behaved T1/T2 morphs. |
| `hierarchical-match` | 0.50 | Wider acceptance because greedy ring matching introduces correspondence noise; W5 calibration tightens once `hungarian-on3` lands. |
| `draw-coordinated` | 0.60 | Hardcoded 0.5 self-report today (W3 baseline); ceiling above to leave headroom for the medial-axis Hausdorff once Tiller-Hanson installs. |
| `designed-fallback` | `+Infinity` | Terminal — always accepts. |

The W5 corpus run produces a per-tier distribution; the ceilings
below the 95th percentile of the proposed cascade's distortion on
canonical pairs OF that tier are the calibrated values. Stress-set
distortions are NOT used to set ceilings — they intentionally
exceed them to verify cascade fall-through.

### 1.2 ARAP trigger predicate

ARAP wraps intrinsic-strict only when the closed-contour boundary's
turning-function variation exceeds a threshold (algorithms-plan
§5.1). W3 ships intrinsic-strict without ARAP because the
poly2tri / igl dependency hasn't installed; W5 introduces the
predicate alongside the ARAP wrap.

**Calibration target:** ARAP fires on the corpus pairs that show
"swimming" artefact under pure intrinsic interpolation, never
fires on pairs where intrinsic produces designer-acceptable
motion. Empirical threshold of `turning-variation > 0.7` is the
working hypothesis from the §6 algorithms-plan reference; W5
sweep will tune.

### 1.3 Skeleton-alignment Hausdorff threshold

T7's two paths split on a Hausdorff distance between the stroke's
medial axis and the fill's outer-contour skeleton. Below threshold
→ medial-axis thickening; above → directional draw + fill-emit.
Threshold is `H_threshold` ∈ `[viewbox-diagonal × 0.05,
viewbox-diagonal × 0.15]` per §5.6. W5 calibrates this against
the SF Symbols-class outline ↔ filled corpus pairs.

### 1.4 Performance gate

Realistic icons (≤20 subpaths, ≤200 vertices each) resolve under
**5 ms** on commodity hardware (algorithms-plan §10). The W5
corpus run records per-pair resolve times alongside the metric
suite; merging is gated on the 95th-percentile latency staying
under the gate.

---

## 2. UX QA matrix (W5-5)

The QA matrix is run once before sign-off (W5-8) and again on
post-merge production verification. Every cell must pass.

### 2.1 Authoring surface

| Test | Acceptance |
|------|-----------|
| Layer-1 Cadence toggle: keyboard arrow-keys cycle | ✅ `Soft` ↔ `Snappy` flip on `←` / `→` / `↑` / `↓` |
| Layer-1 Cadence toggle: roving-tabindex | ✅ Tab lands on the radiogroup once; non-selected radio `tabIndex=-1` |
| Layer-1 Fallback picker: appears only on T8 | ✅ `tier === 'designed-fallback'` gates the mount |
| Layer-1 Fallback picker: explicit override sticks across resolver-pick changes | ✅ Re-clicking the resolver's auto-pick does NOT silently un-pin a different override (W4 audit §5 fix) |
| Layer-1 Fallback picker: "Use auto" resets the override | ✅ Visible affordance only when `override !== undefined` |
| Plain-language fallback sentence: aria-live polite | ✅ Screen readers announce on resolution change |
| Layer-2 Advanced: hidden by default | ✅ Disclosure collapsed; no `aria-expanded` violation |
| Layer-2 Correspondence pin: drag-vertex-on-vertex creates a pin | ✅ `Transition.correspondenceHints.vertex` mutation observable |
| Layer-2 Correspondence pin: undo / redo | ✅ Pins follow the editor's undo stack (`temporalState`) |
| Layer-2 Timing override: serialised easing names validate | ✅ Unknown easing names rejected by `isValidTimingOverride` (W4 audit §8 fix) |
| Layer-3 Debug pill: hidden in production builds | ✅ `bun scripts/check-debug-not-in-prod.ts` exits 0 against `.next/` |
| Hover preview: ≤100 ms TTF | ✅ Median measured against canonical corpus on commodity hardware |
| Hover preview: stale-frame elimination | ✅ Rapid hover-target switches show no flicker (W4 audit §6 fix) |
| Hover preview: `prefers-reduced-motion` honoured | ✅ Jumps to `t=1` without playing the trajectory |

### 2.2 Compound layer authoring

| Test | Acceptance |
|------|-----------|
| Compound layer in layer list shows the op glyph | ✅ Outermost-op glyph next to the layer name |
| Compound section in Inspector shows operand count | ✅ "N operands — edit the path to flatten…" |
| Convert to group: explodes operands into siblings | ✅ Per-operand sibling layers; `Transition.compoundTrimMode` semantics intact |
| Flatten: confirm dialog with "Convert to group" alternative | ✅ Destructive action prompts; "Use auto" resets correctly |
| Flatten on icon scope: works | ✅ Action gated on `editScope.kind === 'icon'` (W2 audit §1 fix) |
| Direct path edit clears compound + stamps `formerCompound` | ✅ Inspector explains "this was a compound shape" |

### 2.3 Copy / accessibility

| Test | Acceptance |
|------|-----------|
| `pnpm test:copy-lint` clean | ✅ Zero banned algorithm vocabulary in user-facing surfaces |
| `prefers-reduced-motion` respected across all motion surfaces | ✅ Hover preview, transitions, ramps |
| Keyboard reachability for every Layer-1 control | ✅ Tab + arrow keys |
| Screen-reader narration of the fallback sentence | ✅ Polite live region |

---

## 3. Human-perception protocol (W5-4)

A lightweight blinded preference test. Not run in CI; the
protocol below is what the design + engineering reviewers execute
before sign-off.

### 3.1 Recruitment

≥3 design reviewers + ≥3 engineering reviewers. Reviewers may
not be the cascade authors. The pool is the design-system + icon-
authoring team.

### 3.2 Blinded pairwise preference

For each canonical corpus pair (8 pairs), the reviewer is shown
two animations side-by-side, randomised left/right, unlabeled:
- (A) the proposed cascade output
- (B) the legacy `auto-morph` output

Reviewer chooses preferred motion. We record the preference and
the per-reviewer Likert score for predictability:
*"I can guess where this point goes."* on a 5-point scale.

### 3.3 Sign-off criterion

Proposed cascade must show **statistically meaningful preference**
across the canonical + stress sets. "Statistically meaningful" =
the cascade wins ≥60% of pairwise votes after Bonferroni
correction across the 8+ pairs, AND mean Likert predictability
score for the cascade is ≥4.0.

### 3.4 Captures

The reviewer panel produces:
- A CSV of preferences and Likert scores
- An aggregate report committed to `docs_canonical/W5_PERCEPTION_PANEL.md`
- A list of pairs where the cascade lost — these flag candidates
  for W5-3 calibration adjustment

---

## 4. Open research queue (W5-7)

These items are flagged for follow-up after W5 ships; they don't
block the wave.

| Item | Source | Wave / status |
|------|--------|---------------|
| ARAP solver landing (poly2tri / igl) | algorithms-plan §5.1, W3-2 deferral | Tracked; lands when poly2tri installs into the build |
| Hungarian assignment (`hungarian-on3`) | algorithms-plan §5.3, W3-4 deferral | Tracked; replaces greedy ring matcher |
| Tiller-Hanson curve offsetting (`clipper2-ts`) | algorithms-plan §5.6, W3-6 deferral | Tracked; replaces draw-coordinated misaligned-skeleton baseline with medial-axis thickening |
| 64-bit hash for resolver-cache key | W4 audit §2 | Defer; FNV-1a 32-bit is sufficient at icon-set scale; document collision behaviour accurately |
| Operand-by-operand T6 evaluation | algorithms-plan §5.7, W3-5 deferral | Tracked; closes the "cached path morph isn't operand-by-operand" gap |
| Cross-rule continuous interpolation | algorithms-plan §5.7 | Conservative default routes to T8; future research |
| Correspondence-hint consumption inside tiers | W4 audit §3 | Active follow-up — hints pipe through `CascadeInput.hints` but tiers don't yet read them |
| Cross-line / template-`${}` lint tokenisation | W1 audit §U2 | Defer — no live false positives today |
| ML-based vector morphing (SVGformer, etc.) | algorithms-plan §11 | Out of scope; tracked separately |
| Production icon-set corpus (`@hiero/ui-icons`) | roadmap W5-1 | Continuing curation; harness wired |

---

## 5. Ship checklist (W5-8)

Before flag-flip:

- [ ] **W5-1** corpus pass: every canonical + stress pair resolves to its expected taxonomy and lands on a tier within ceiling.
- [ ] **W5-2** comparative report: proposed cascade strictly reduces catastrophic failures vs. legacy / Flubber / d3-interpolate-path baselines.
- [ ] **W5-3** ceilings calibrated from corpus distribution; ARAP / skeleton thresholds set; performance gate met (95p < 5 ms).
- [ ] **W5-4** human-perception panel: ≥60% pairwise preference, mean Likert ≥4.0.
- [ ] **W5-5** UX QA matrix all-green.
- [ ] **W5-6** telemetry emitter wired into the production runtime; dashboard receives events.
- [ ] **W5-7** open research items tracked.
- [ ] Build-guard active in CI: `bun scripts/check-debug-not-in-prod.ts` runs after `pnpm build` on the production-channel build.
- [ ] Copy-lint clean: `pnpm test:copy-lint` exits 0 across the user-facing surface.
- [ ] Schema-contract tests pass: `Transition` exposes only the four authored axes.
- [ ] Storybook coverage: `CadenceToggle.stories.tsx`, `FallbackPicker.stories.tsx`, `FallbackSentence.stories.tsx`, `TransitionDebugPill.stories.tsx`, `CompoundLayerSection.stories.tsx` all mount without errors.
- [ ] Author Acceptance: at least one designer ships a non-trivial transition end-to-end using only the Layer-1 controls.
- [ ] Engineer Acceptance: at least one engineer toggles `NEXT_PUBLIC_HIERO_DEBUG=1` in dev and verifies the debug pill renders.

When all green: flip `NEXT_PUBLIC_HIERO_RESOLVER_V2=1` in the
production env and remove the legacy `autoMorph` path in the
follow-up cleanup commit.

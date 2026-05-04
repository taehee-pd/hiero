# Icon Transition UX Plan

**Companion to:** `docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md`,
`docs_canonical/ICON_TRANSITION_ALGORITHMS_TASKS.md`
**Status:** UX plan
**Aligned with:** `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` (§2.2
strategy selection → fully automatic; §2.3 Advanced escape hatch),
`specs/editor/cross-icon-transitions.md` (preview is icon-to-icon;
no per-state authoring)
**Skill basis:** `frontend-design` (installed via
`npx skills add anthropics/skills -s frontend-design`) — its
principles drive the visual / motion treatment.

This doc defines how the resolver cascade, compound-shape feature,
and authoring affordances from the algorithm plan are exposed in the
UI. It is a UX plan, not an implementation spec — it commits to the
authoring contract, surface map, and visual principles, and leaves
component-level work to the editor specs that consume it.

---

## 1. Authoring contract

> **The user never chooses a transition algorithm.**

This is the single non-negotiable principle. Every other UX decision
in this doc derives from it. Concretely:

- **No "morph strategy" picker.** The resolver cascade
  (`auto-morph.ts`) runs invisibly. Users never see "intrinsic vs.
  cross-icon vs. ARAP" anywhere outside the `NEXT_PUBLIC_HIERO_DEBUG`
  flag.
- **No "compatibility" tone.** Already removed in
  `ANIMATE_PANEL_REVAMP_PLAN.md` §2.2 (green/yellow/orange/red).
  This doc commits to never re-introducing a categorical
  morph-quality readout.
- **No algorithm vocabulary in the user-facing surface.** Words like
  *Hungarian*, *intrinsic*, *contour tree*, *ARAP*, *turning
  function*, *medial axis* never appear in tooltips, labels, or
  errors. They live in code, in this docs_canonical/ tree, and in
  the debug pill.
- **The user authors *outcomes*, not *mechanisms*.** Outcomes the
  user can shape (timing, named fallback, correspondence pin)
  appear in the UI. Mechanisms the resolver picks for them
  (algorithm tier, distortion floor, cost-matrix weights) do not.

The product premise is icon authoring. A designer who has to learn a
seven-tier cascade to ship a transition is not being authored *for*;
they are being engineered *at*.

---

## 2. Surface map

Three editor surfaces touch transitions today; each gets a defined
role under this plan.

| Surface | File | Role under this plan |
|---------|------|---------------------|
| Icon picker | inside `components/studio/`, `components/explorer/` | preview-on-hover entry point (§4.1) |
| Transition panel | `components/editor/TransitionPanel.tsx` | endpoint selection + scrub + advanced disclosure |
| Animation studio panel | `components/editor/AnimationStudioPanel.tsx` | per-Transition authoring (timing, fallback override, correspondence hints) |
| Inspector (compound layers) | `components/editor/InspectorPanel.tsx` | compound layer affordances (§4.4) |
| Debug pill | inside `TransitionPanel`, gated by `NEXT_PUBLIC_HIERO_DEBUG=1` | engineer- / power-user-facing tier + signal |

No new top-level surface is introduced. This plan adds affordances
inside the existing four; it does not create a "transitions
workspace" or a "morph editor."

---

## 3. Progressive disclosure layers

Every authoring affordance lives in one of four layers. The
resolver-picked algorithm lives only in the deepest layer.

### Layer 0 — Default (what 95 % of users see)

- Pick a source icon, pick a target icon, press play.
- The resolver runs. The transition plays.
- Nothing else is visible. No chips, no readouts, no warnings.

This is the SF Symbols 7 baseline already endorsed by
`ANIMATE_PANEL_REVAMP_PLAN.md` §2.1.

### Layer 1 — Outcome controls (visible inline)

Three controls appear next to the preview, treated as authored
properties of the `Transition`, not of the resolver:

1. **Duration** (existing) — the time the transition plays.
2. **Cadence** — a soft, two-state toggle: *Soft* (default) /
   *Snappy*. Behind the scenes this swaps the `g(t)` and `α(t)`
   defaults from §1 of the algorithm plan. Users do not see "easing
   curves." They see two cadences, named for feel.
3. **Fallback motion** — appears *only* when the resolver landed in
   T8 for this pair. Picker shows the named library (§5.8 of the
   algorithm plan): *Radial pop*, *Slide (←/→/↑/↓)*, *Draw replace*,
   *Scale pop*. Default is the resolver's pick (per topological
   signal); user can override.

That is the entire Layer-1 surface. Nothing else.

### Layer 2 — Authoring overrides (Advanced disclosure, collapsed by default)

The §2.3 Advanced disclosure from the Animate panel revamp expands
under this plan to host two affordances:

1. **Correspondence pin** — drag-vertex-onto-vertex or
   drag-subpath-onto-subpath interaction in the path-editor canvas.
   The pin is recorded on the `Transition` schema (algorithm plan
   §4.4), feeding the resolver as a hard constraint. UI affordance:
   a small handle on each vertex/subpath that on drag-target shows a
   compatible candidate on the target icon; release pins it. Pins
   are visible as colored dots persisting between source and target.
   No "correspondence editor" modal — pinning happens in-canvas.
2. **Timing curve override** — a per-axis curve picker (`g(t)` and
   `α(t)`) for users who exceed the *Soft / Snappy* binary. Surface:
   a two-curve editor with named presets. This is the only place in
   the UI where the geometry/opacity decoupling becomes visible.

### Layer 3 — Engineer signals (debug, not user-facing)

Behind `NEXT_PUBLIC_HIERO_DEBUG=1`:

- The chosen tier (e.g. *"Engine chose: T6 isomorphic"*).
- The why-fallback signal verbatim (e.g. *"trees disagreed at level
  2 — 3 holes vs 1 hole"*, *"turning-function distance 0.42 over
  threshold 0.30"*) — algorithm plan §4.3.3 / §7 commitment.
- The distortion estimate per tier the cascade considered.

This layer exists so engineers and power-users can debug without
forcing the vocabulary on the 95 % default user. It is also the
only layer where algorithm-plan terminology surfaces.

---

## 4. The four authored axes

The user can author exactly four things about a transition. Each
maps to a named, value-typed field on the `Transition` schema.

| Axis | Surface | Default | Schema field |
|------|---------|---------|--------------|
| **Duration** | Layer 1 | inherited from project default | `duration: number` |
| **Cadence** | Layer 1 | `'soft'` | `cadence: 'soft' \| 'snappy'` |
| **Fallback motion** | Layer 1 (T8 only) | resolver's pick | `fallbackOverride?: FallbackName` |
| **Correspondence pins** | Layer 2 | `[]` | `correspondenceHints: { subpath, vertex }` |

Notable absences (deliberate):

- **No "morph strategy" field.** The resolver picks.
- **No "fillRule override" for transitions.** Cross-rule pairs route
  to T8 silently per algorithm plan §5.7.
- **No "compatibility lock" field.** The resolver always runs; the
  user cannot force a tier the resolver rejected.

These absences are themselves the design — the surface area equals
the number of decisions the user is *allowed* to make. Anything
else is not a feature gap, it is a contract.

---

## 5. Compound layer affordances (Inspector)

Compound layers (algorithm plan §4) get four UI affordances, all
inside `InspectorPanel.tsx` next to the existing boolean-op buttons.

1. **Visual identity in the layer list.** A compound layer shows a
   small boolean-op glyph (∪ ∩ − ⊕) next to its name. The glyph is
   the *outermost* operation in the tree. Clicking the glyph
   discloses the operand subtree.
2. **Operand tree disclosure.** A nested, indented tree under the
   layer row. Each operand is itself an editable layer: select →
   path editor opens for that operand alone. Tree edits (reorder,
   change op type, delete operand) regenerate `path.d` and bump
   `cacheVersion` (algorithm plan §4.1) — the user sees the canvas
   update with no "Apply" button.
3. **Flatten with warning.** A *Flatten compound* command on the
   compound layer's context menu. Opens a confirm dialog: *"This
   will replace the operand tree with a single path. You can't
   re-enter operand-edit mode after this. Convert to group
   instead?"* The "Convert to group" alternative (algorithm plan
   §4.3 principle 2) is a primary button next to the destructive
   *Flatten* secondary.
4. **No transition-side compound UI.** The user does not configure
   how a compound morphs. The resolver routes T6 silently — the
   only user-facing signal is the layer-list glyph telling them
   *"this is a compound shape."* No "compound morph quality" badge,
   no "tree compatibility" indicator.

Why no transition-side compound UI: a designer who built a
compound to author it once should not have to reason about whether
their compound morphs well against another compound. The answer to
"does this morph well?" is *play it and watch* — i.e., Layer 0.

---

## 6. Designer trust contract

The resolver is invisible. Trust replaces the categorical readout
that the Animate panel revamp removed (§2.2). Three commitments:

### 6.1 Preview ≡ runtime ≡ export

What plays in the editor preview is what plays in the runtime is
what plays in the exported Lottie / compiled icon. This is the
algorithm plan §10 / Phase F commitment, surfaced here as a UX
contract: a designer signing off a transition can ship that
transition without re-checking it on the runtime.

### 6.2 Preview-on-hover

Hovering a candidate target in the icon picker plays the would-be
transition without committing it. Time-to-first-frame budget:
≤ 100 ms (algorithm plan §7.E1). The hover plays at the project's
default duration, paused at `t = 1` until hover ends. This replaces
the legacy compatibility tones with experiential preview — *show*,
not *label*.

### 6.3 Why-fallback signal — surfaced as a sentence, not a code

When the resolver lands a transition on a tier the designer might
not expect (e.g. T8 fallback when the icons looked morphable), the
Animation studio panel shows a single sentence in plain language:

> *"These shapes are too different to morph continuously, so we're
> using a Slide instead. Pick a different fallback motion below if
> you'd prefer."*

The sentence is generated from the why-fallback signal but
translated into the user's language. Engineers see the raw signal in
the debug pill; designers see the translation. Both are derived
from the same backing field on the `ResolvedTransition`.

---

## 7. Visual and motion principles (per `frontend-design`)

The `frontend-design` skill (installed via `npx skills`) supplies
principles, not pixel-pushing. Three of its principles drive this
UX:

### 7.1 "Pick an extreme. Commit to a clear conceptual direction."

This UX commits to **refined minimalism**. The transition surface
is the negative space the icons play in. The Layer-0 default has
two icons, a play button, and a scrub bar. That is the entire
default surface. No chrome on top.

The opposite extreme — a maximalist transition workbench with
dials, curves, and nested panels — is rejected explicitly. It would
foreground the mechanism over the outcome.

### 7.2 "Motion: high-impact moments, not scattered micro-interactions."

Three motion moments earn animation:

1. **The preview itself.** This is the motion product, so it gets
   the design budget.
2. **Hover-preview ramp-in.** When hover starts, the target icon
   eases into focus over 120 ms before the transition begins. This
   sells preview-on-hover as a designed affordance, not a glitch.
3. **Layer-list compound disclosure.** When a designer expands the
   operand tree on a compound layer, the disclosure animates open
   on a subtle curve — telegraphing that the compound has structure
   worth exploring.

Everything else is static. No micro-interaction noise on buttons,
no whoosh on tab change, no parallax. The product *is* motion;
adding motion to the chrome around it would compete.

### 7.3 "Typography and color: characterful, not generic. Avoid AI defaults."

The transition surface inherits the project's design system
(`components/ds/`) — `StatusBadge`, `KbdHint`, `ColorField`,
`IconButton`, `Tag`, `ColorPicker` per CLAUDE.md. No new font
families and no purple-gradient-on-white aesthetic (the
frontend-design skill explicitly calls out this anti-pattern). The
fallback-motion picker uses the existing `Tag` DS component for the
named-fallback chips; the cadence toggle uses the existing
`IconButton` pair. Reuse before invention.

---

## 8. Anti-patterns

What this plan explicitly does **not** do, with rationale:

- **No tier badge on each transition.** Even read-only. Foregrounds
  mechanism over outcome and re-introduces the categorical-quality
  readout the Animate panel revamp deliberately killed.
- **No "morph quality score."** A 0–100 number is the same anti-
  pattern as the green/yellow/red tones, just with more decimals.
  If quality matters, the resolver routes to T8; the user sees a
  named fallback they can re-pick.
- **No tutorial about how morphing works.** No tooltip, no
  onboarding, no docs link inside the editor. The product
  documentation lives in `docs_canonical/`; the editor surface
  itself does not teach algorithms.
- **No "auto" toggle.** Users cannot turn the resolver "on" or
  "off." The resolver always runs. The only override is named
  fallback selection.
- **No per-layer transition strategy override.** Authored
  affordances live on the `Transition` (pair-level), not the
  `Layer`. A layer cannot declare "always crossfade me" — that
  would re-introduce mechanism-as-property.
- **No JSON / power-user inspector for the resolver state.** The
  debug pill is the only escape hatch, and it is gated behind a
  build flag.

Each absence is a feature. The surface area of *what the user can
configure* is the surface area of *what the user has to learn*.
The smaller the better.

---

## 9. Open UX questions (deferred, not blocking)

- **Cadence axis cardinality.** Two values (*Soft* / *Snappy*) is
  the proposed minimum. Whether a third (*Bouncy*?) earns its place
  is empirical — defer to a corpus test once Phase D ships.
- **Correspondence-pin discoverability.** Drag-vertex-onto-vertex
  inside the path editor is discoverable for power users but
  invisible to first-time authors. Whether to surface a one-time
  hint (without re-introducing tutorials per §8) is open.
- **Compound-layer disclosure default state.** Whether the operand
  tree disclosure defaults to expanded or collapsed when the layer
  is selected is empirical — likely *collapsed* to preserve layer
  list density, but A/B worth running.
- **Fallback motion preview in the picker.** Whether each named
  fallback in the Layer-1 picker plays its own micro-preview on
  hover (~600 ms each) is a quality-vs-noise call.

These are flagged for follow-up; they do not block the rest of the
plan.

---

## 10. Non-goals

- **No re-introduction of state-to-state authoring.** Cross-icon
  transitions remain the only authored axis
  (`specs/editor/cross-icon-transitions.md`).
- **No per-icon-set "default cadence" or "default fallback" config.**
  Such global config would create implicit dependencies between
  unrelated icons. Authoring lives on the `Transition`, full stop.
- **No CLI / API exposure of the algorithm cascade.** The
  `@hiero/cli` and runtime SDK accept the same `Transition` schema
  this UX writes; no separate config layer.
- **No designer-facing reference of the academic citations** in the
  algorithm plan. Sederberg, Baxter, Igarashi, Arkin, etc. live
  entirely in `docs_canonical/`. The editor never shows a citation.


---

## 11. UX audit alignment to PR #174 (algorithm revamp UI)

> Context note: this audit targets the UI-side implications of the algorithm revamp tracked by PR #174 and validates that the current UX plan preserves the authoring contract while adding enough implementation specificity for shipping.

### 11.1 Contract integrity check

- **Pass — algorithm opacity preserved.** The plan consistently enforces "no strategy picker" and keeps tier selection invisible outside debug mode.
- **Pass — outcome-first control surface.** Editable inputs remain outcome-level (`duration`, `cadence`, `fallbackOverride`, `correspondenceHints`) and avoid mechanism-level leaks.
- **Pass — progressive disclosure is coherent.** Default users can complete transition authoring in Layer 0/1 without touching Advanced.
- **Guardrail needed — wording drift risk.** Any PR #174 copy/UI labels must be checked to prevent algorithm terms from leaking into non-debug strings.

### 11.2 Interaction-model audit

- **Preview-on-hover is the correct replacement for compatibility badges** and aligns with "show, don't score".
- **T8 fallback override is correctly conditional,** but requires deterministic reveal rules:
  - reveal only after a resolved T8 result exists for the active pair;
  - keep hidden for non-T8 pairs;
  - persist user override across editor reload.
- **Correspondence pinning is correctly scoped to Advanced,** but needs explicit undo/redo semantics and pin-conflict behavior (replace vs multi-pin) to avoid authoring ambiguity.
- **Cadence control is right-sized (2 states),** but requires clear state tokens in UI copy and accessibility labels.

### 11.3 Information architecture audit

- **Surface ownership is well-defined** (picker, Transition panel, Animation studio, Inspector, debug pill).
- **Potential overlap to resolve:** Transition panel vs Animation studio ownership for fallback sentence + picker; implementation should pick a single primary home to reduce scanning cost.
- **No new workspace is a UX strength** and should remain invariant during PR #174 rollout.

### 11.4 Accessibility and trust audit

- **Needs explicit a11y acceptance criteria** for new controls:
  - keyboard-operable cadence toggle;
  - keyboard and screen-reader operation for fallback picker;
  - readable pin targets and focus affordances in canvas mode;
  - narrated fallback explanation sentence via polite live region when resolution changes.
- **Trust contract is strong** (`preview = runtime = export`) but should be tested with snapshot-style parity checks per tier/fallback path.

### 11.5 UX risks introduced by algorithm revamp

1. **Silent behavior shift risk:** users may perceive changed motion as regressions without understanding resolver improvements.
2. **Discoverability risk:** correspondence pins may remain too hidden for users who need them most.
3. **Control-fragmentation risk:** cadence + curve override can feel redundant if naming and hierarchy are unclear.
4. **Debug bleed risk:** engineering signals can accidentally leak to production builds.

### 11.6 Required adjustments to this plan (normative)

- Add a **single-sentence fallback explanation component** spec with exact placement hierarchy:
  1) Animation studio (primary),
  2) Transition panel (only when studio collapsed/hidden).
- Add **pinning behavior rules**:
  - one source vertex/subpath may map to at most one target at a time;
  - remapping replaces previous pin;
  - deleting either endpoint deletes the pin;
  - all pin actions are undoable.
- Add **copy policy rule**: non-debug UI strings must never include algorithm-tier names or academic method terms.
- Add **debug build guard**: debug pill and raw why-fallback details must be excluded unless `NEXT_PUBLIC_HIERO_DEBUG=1`.

## 12. Phased action plan to implement PR #174 UX fully

The phases below convert this UX plan into executable UI work while preserving the authoring contract.

### Phase UX-A — Contract & schema hardening

**Goal:** lock outcome-only authoring contract in state/schema and UI copy.

- Finalize/confirm `Transition` authored fields: `duration`, `cadence`, `fallbackOverride`, `correspondenceHints`.
- Set initial defaults: `cadence: 'soft'`, empty `correspondenceHints`.
- Introduce UI-copy lint checklist for banned algorithm terms in non-debug surfaces.
- Define source-of-truth resolver output shape for plain-language fallback sentence.

**Exit criteria**
- No strategy field exists in authored transition payload.
- Non-debug UI contains zero algorithm vocabulary.

### Phase UX-B — Layer 1 controls (core authoring)

**Goal:** ship minimal, high-confidence transition authoring surface.

- Implement cadence toggle (*Soft*/*Snappy*) with keyboard support and clear selected state.
- Implement conditional fallback-motion picker visible only for T8 outcomes.
- Persist fallback override and cadence per transition pair.
- Add plain-language fallback explanation sentence tied to resolver result.

**Exit criteria**
- Users can complete authoring with Duration + Cadence + conditional Fallback only.
- Fallback controls do not appear for non-T8 transitions.
- All controls are keyboard reachable and screen-reader labeled.

### Phase UX-C — Hover preview performance + trust guarantees

**Goal:** make experiential preview the primary quality signal.

- Implement picker hover-preview pipeline with prewarm/cache for ≤100 ms time-to-first-frame target.
- Add subtle 120 ms ramp-in treatment before transition playback.
- Freeze-to-end (`t=1`) while hovering; revert on hover end.
- Add preview/runtime/export parity tests covering representative tiers and T8 fallback variants.

**Exit criteria**
- Median hover TTF ≤ 100 ms on canonical icon corpus.
- Preview behavior is deterministic across repeated hovers.
- Parity tests pass for preview/runtime/export.

### Phase UX-D — Advanced correspondence pinning

**Goal:** ship precise override mechanism without polluting default UX.

- Add in-canvas pin affordances (vertex/subpath handles + compatible-target highlight).
- Implement pin lifecycle: create, remap (replace), delete, undo/redo.
- Persist pins in `correspondenceHints` with stable IDs resilient to normal edits.
- Add one-time, dismissible discoverability hint triggered only after repeated T8 outcomes.

**Exit criteria**
- Pin operations are fully undoable.
- Pins persist after reload and survive non-destructive path edits.
- Default users never see pin UI unless Advanced is opened.

### Phase UX-E — Compound layer Inspector affordances

**Goal:** expose compound authoring structure while keeping transition UI clean.

- Add boolean-op glyph identity in layer list.
- Implement operand-tree disclosure with animated expand/collapse.
- Support operand edits (reorder/op change/delete) with immediate canvas regeneration.
- Implement "Flatten compound" confirm dialog with "Convert to group" primary alternative.

**Exit criteria**
- Compound structure is editable from Inspector only.
- No compound-specific strategy/quality controls appear in transition surfaces.
- Flatten flow is explicit, reversible via undo, and warning copy is clear.

### Phase UX-F — Debug isolation, QA, and rollout safety

**Goal:** keep engineer diagnostics powerful but production UX clean.

- Gate tier labels, raw why-fallback reasons, and distortion estimates behind `NEXT_PUBLIC_HIERO_DEBUG=1`.
- Add production build assertion ensuring debug components are absent/inert.
- Create UX QA matrix: keyboard, screen reader, hover performance, fallback copy, pinning, compound flows.
- Run design sign-off session against real icon corpus (easy/ambiguous/hard pairs).

**Exit criteria**
- Production builds expose zero debug diagnostics.
- QA matrix passes with no P0/P1 usability regressions.
- Design + engineering sign-off confirms PR #174 UX readiness.

<!-- /autoplan restore point: /Users/taehee/.gstack/projects/taehee-pd-cuneiform/claude-busy-mclean-autoplan-restore-20260329-151148.md -->
---
status: ready-for-implementation
last-reviewed: 2026-03-29
---

# Runtime Transition Rewrite Implementation Prompt

Use this prompt when implementing the reviewed Cuneiform product-model rewrite.

## Mission

Implement the reviewed v1 product direction for Cuneiform:

- Figma is ingress only
- Cuneiform becomes the source of truth inside the repo
- install behavior is defined at repo root via `cuneiform.config.ts`
- publish goes directly into the current React codebase
- Storybook is reference-only and must not become a product target
- backward compatibility is not required
- per-icon multi-state authoring must be removed
- icons keep intrinsic variants only, such as size and style
- animation becomes a runtime-owned icon-to-icon transition concern

## Specs changed in this session

These are the spec documents that were rewritten or added during this session and should be treated as the newest reviewed direction:

- [install-config.md](/Users/taehee/Cuneiform/specs/schema/install-config.md)
- [repo-native-distribution.md](/Users/taehee/Cuneiform/specs/export/repo-native-distribution.md)
- [repo-native-workflow.md](/Users/taehee/Cuneiform/specs/ui/repo-native-workflow.md)
- [icon-schema.md](/Users/taehee/Cuneiform/specs/schema/icon-schema.md)
- [transition-schema.md](/Users/taehee/Cuneiform/specs/schema/transition-schema.md)
- [editor-store.md](/Users/taehee/Cuneiform/specs/editor/editor-store.md)
- [cross-icon-transitions.md](/Users/taehee/Cuneiform/specs/editor/cross-icon-transitions.md)
- [animation-tab.md](/Users/taehee/Cuneiform/specs/editor/animation-tab.md)
- [inspect-tab.md](/Users/taehee/Cuneiform/specs/editor/inspect-tab.md)
- [transition-resolver.md](/Users/taehee/Cuneiform/specs/runtime/transition-resolver.md)
- [runtime-json-format.md](/Users/taehee/Cuneiform/specs/export/runtime-json-format.md)
- [lottie-export.md](/Users/taehee/Cuneiform/specs/export/lottie-export.md)
- [README.md](/Users/taehee/Cuneiform/specs/README.md)

## Required reading

Read these files first and treat them as the source of truth for this implementation:

- [DESIGN.md](/Users/taehee/Cuneiform/docs_canonical/DESIGN.md)
- [TASKS.md](/Users/taehee/Cuneiform/docs_canonical/TASKS.md)
- [ARCHITECTURE.md](/Users/taehee/Cuneiform/docs_canonical/ARCHITECTURE.md)
- [2026-03-29-installable-codebase-platform-design.md](/Users/taehee/Cuneiform/docs/plans/2026-03-29-installable-codebase-platform-design.md)
- [2026-03-29-installable-codebase-platform-implementation-plan.md](/Users/taehee/Cuneiform/docs/plans/2026-03-29-installable-codebase-platform-implementation-plan.md)
- [2026-03-29-installable-codebase-platform-verification.md](/Users/taehee/Cuneiform/docs/plans/2026-03-29-installable-codebase-platform-verification.md)
- [taehee-codex-sync-repo-and-implement-tasks-design-20260329-142247.md](/Users/taehee/.gstack/projects/taehee-pd-cuneiform/taehee-codex-sync-repo-and-implement-tasks-design-20260329-142247.md)

Then read the updated spec-kit files listed in `Specs changed in this session`.

## Hard constraints

- Do not preserve `project.syncTargets` or related compatibility code unless needed purely as a temporary refactor step inside one PR.
- Do not ship or plan `export to Storybook`.
- Do not keep authored `defaultState`, `states`, or state-to-state transitions as product concepts.
- Do not reintroduce local database truth; canonical source stays file-based in the repo.
- Treat transition choice as a runtime concern.
- Keep changed-icon-only rebuilds and changed-output-only publish as the default path.

## Primary code surfaces to change

### Schema and source model

- [types.ts](/Users/taehee/Cuneiform/lib/schema/types.ts)
- [workspace.ts](/Users/taehee/Cuneiform/lib/schema/workspace.ts)
- [variant-derivation.ts](/Users/taehee/Cuneiform/lib/schema/variant-derivation.ts)

Implementation goal:

- remove `Variant.defaultState`
- remove `Variant.states`
- remove authored state-centric transition assumptions
- keep icon variants for size and style families
- reshape `Icon.transitions` so it supports runtime icon-to-icon transition intent instead of per-icon state graphs

### Editor store and editor UI

- [store.ts](/Users/taehee/Cuneiform/lib/editor-store/store.ts)
- [types.ts](/Users/taehee/Cuneiform/lib/editor-store/types.ts)
- [selectors.ts](/Users/taehee/Cuneiform/lib/editor-store/selectors.ts)
- [hooks.ts](/Users/taehee/Cuneiform/lib/editor-store/hooks.ts)
- [InspectorPanel.tsx](/Users/taehee/Cuneiform/components/editor/InspectorPanel.tsx)
- [TransitionPanel.tsx](/Users/taehee/Cuneiform/components/editor/TransitionPanel.tsx)
- [AnimationStudioPanel.tsx](/Users/taehee/Cuneiform/components/editor/AnimationStudioPanel.tsx)

Implementation goal:

- remove `currentStateId` and state CRUD flows
- make the editor operate on icon, variant, and layer editing
- keep transition preview, but make it preview runtime icon-to-icon behavior
- keep inspect and animation panels aligned with the new model

### Runtime transition engine

- [transition-resolver.ts](/Users/taehee/Cuneiform/lib/runtime-core/transition-resolver.ts)
- [cross-icon-morph.ts](/Users/taehee/Cuneiform/lib/runtime-core/cross-icon-morph.ts)
- [morph.ts](/Users/taehee/Cuneiform/lib/runtime-core/morph.ts)
- [draw-executor.ts](/Users/taehee/Cuneiform/lib/runtime-core/draw-executor.ts)
- [inspection.ts](/Users/taehee/Cuneiform/lib/runtime-core/inspection.ts)
- [weight-interpolation.ts](/Users/taehee/Cuneiform/lib/runtime-core/weight-interpolation.ts)
- [state-machine.ts](/Users/taehee/Cuneiform/lib/runtime-core/state-machine.ts)

Implementation goal:

- make runtime choose among `strictMorph`, `bestGuessMorph`, `lineAnimation`, and `replace`
- research and encode the main icon transition families worth supporting in v1
- prefer runtime resolution over authored transition graphs
- remove or rename state-machine concepts that no longer match the product

### Export and direct React publish

- [export-runtime-json.ts](/Users/taehee/Cuneiform/lib/export/export-runtime-json.ts)
- [export-react-components.ts](/Users/taehee/Cuneiform/lib/export/export-react-components.ts)
- [react-adapter.ts](/Users/taehee/Cuneiform/lib/export/adapters/react-adapter.ts)
- [generate-component.ts](/Users/taehee/Cuneiform/lib/export/export-react/generate-component.ts)
- [generate-library.ts](/Users/taehee/Cuneiform/lib/export/export-react/generate-library.ts)
- [write-library.ts](/Users/taehee/Cuneiform/lib/export/export-react/write-library.ts)
- [compile-from-source.ts](/Users/taehee/Cuneiform/scripts/compile-from-source.ts)
- [validate-source-export.ts](/Users/taehee/Cuneiform/scripts/validate-source-export.ts)

Implementation goal:

- export atomic icons plus variants
- emit runtime transition payloads without authored state payloads
- keep deterministic output
- support direct React codebase publish with changed-icon-only writes

### Install config and repo-native publish path

- [SyncTargetPanel.tsx](/Users/taehee/Cuneiform/components/export/SyncTargetPanel.tsx)

Implementation goal:

- replace sync-target-first UI and types with repo-root install config
- remove `project.syncTargets` product behavior
- keep direct publish focused on the current React codebase

## Suggested execution order

1. Rewrite schema types and fixtures first.
2. Rewrite editor-store types and selectors to remove state-centric assumptions.
3. Rewrite runtime transition resolution around icon-to-icon strategies.
4. Rewrite runtime JSON export and React export to consume the new schema.
5. Remove sync-target UI and replace it with repo install config handling.
6. Update tests and snapshots only after the new code path is coherent.

## Verification checklist

Before calling the work done, verify all of the following:

- `rg -n "defaultState|states: Record|currentStateId|syncTargets" lib components tests` only returns temporary refactor leftovers or intentionally historical comments
- runtime transition tests cover morph success, morph fallback, line animation, and replace
- export tests prove no authored state payload is emitted
- direct publish rewrites only changed icons and changed outputs
- Storybook-specific code is not part of the product path

## Commands to run

Run these from [/Users/taehee/Cuneiform](/Users/taehee/Cuneiform):

```bash
bun test
bun run lint
bun run format:check
pnpm build
```

If dependencies change, also run:

```bash
bun install
bun install --frozen-lockfile
```

## Expected output

The implementation should end with:

- updated schema, store, runtime, and export code matching the rewritten specs
- updated tests proving the new product model
- removal of old state-centric and sync-target-centric product assumptions
- a concise note listing any deferred work, especially optional watch mode or later reference-app exploration

---

## /autoplan CEO Review (Phase 1)

### Step 0A: Premise Challenge

The design doc states three premises:

**P1: "The real pain is not drawing icons, it is turning Figma output into maintainable React design-system code without manual handoff labor."**

Assessment: VALID. This is well-grounded. Every React design-system team does some version of: export SVGs from Figma, run SVGR or manual cleanup, commit, maintain. The pain is real and recurring. But the premise implies the wedge is the pipeline, not the animation system. The plan then invests heavily in runtime transition families (4 strategies, morph scoring, layer matching). This creates a tension: if the pain is handoff, why is 40% of the code surface about animation?

Auto-decision (P3 pragmatic): The animation runtime is already built (Phases C through O shipped). This rewrite reshapes it, it does not build it from scratch. The handoff pipeline reuses existing export/adapter code. Both ship together without one blocking the other. ACCEPT premise as stated.

**P2: "Figma should be an ingress path, not the long-term source of truth."**

Assessment: VALID with a caveat. Correct for the React design-system wedge. But "ingress-only forever" is too strong as an architectural constraint. Designers iterate continuously in Figma. If Cuneiform cannot reflect changes back eventually, the SSOT claim erodes when designers maintain parallel Figma files. The plan correctly makes this v1-only, and the design doc lists back-sync as an open question.

Auto-decision (P6 bias toward action): Ship ingress-only in v1. Do not encode ingress-only as a permanent architectural constraint. The schema and plugin should remain back-sync-compatible. ACCEPT.

**P3: "The first wedge is React design-system teams working directly inside their current codebase."**

Assessment: VALID. React teams are the highest-density target for icon consumption. Repo-native delivery fits their mental model (they already use packages and codegen). The installable control plane approach (Approach A in the design doc) is the strongest match.

Auto-decision (P1 completeness): ACCEPT.

**Implicit premise: "No users exist on the current model, so backward compatibility is not required."**

Assessment: NEEDS VALIDATION. TASKS.md shows 17 shipped phases with real code. Lottie export (Phase M) shipped March 28, one day before this rewrite. If anyone (internal or external) depends on the current model, deleting it without migration is a data loss risk.

Auto-decision (P5 explicit): This premise should be confirmed by the user at the premise gate. Marked as GATE ITEM.

**Implicit premise: "Removing per-icon multi-state authoring does not lose the product's differentiator."**

Assessment: TENSION. States (default, active, disabled, loading) are how design systems model icons. Volume icons with mute/low/high are inherently stateful. The plan replaces authored states with "separate icons + runtime transitions," which works for simple toggles (play/pause = two icons) but breaks for 3+ state icons that share geometry. The reframe should be: states become variant axes, not a runtime state machine.

Auto-decision: TASTE DECISION. The subagent and the code analysis both flag this. Surface at gate.

### Step 0B: Existing Code Leverage Map

| Sub-problem | Existing Code | Reuse? |
|-------------|--------------|--------|
| Icon schema without states | `lib/schema/types.ts` (Icon, Variant, Layer) | Reshape: remove State, flatten Variant |
| Variant derivation | `lib/schema/variant-derivation.ts` | Keep: already works on variant axes |
| Runtime morph engine | `lib/runtime-core/cross-icon-morph.ts` (749 LOC) | Keep as-is: pure geometry, no state deps |
| Transition resolution | `lib/runtime-core/transition-resolver.ts` (752 LOC) | Reshape: takes State params, needs icon-to-icon |
| State machine | `lib/runtime-core/state-machine.ts` (87 LOC) | Replace: remove state-machine concept |
| Editor store | `lib/editor-store/store.ts` (3,489 LOC) | Heavy reshape: 50+ currentStateId refs |
| Editor selectors | `lib/editor-store/selectors.ts` (125 LOC) | Reshape: remove state lookups |
| Transition panel UI | `components/editor/TransitionPanel.tsx` (1,886 LOC) | Reshape: icon-to-icon instead of state-to-state |
| Sync target UI | `components/export/SyncTargetPanel.tsx` (689 LOC) | Replace: repo install config |
| Export pipeline | `lib/export/export-runtime-json.ts` | Reshape: no state payloads |
| React adapter | `lib/export/adapters/react-adapter.ts` | Keep: adapter pattern still applies |
| Figma plugin | `figma-plugin/export-to-cuneiform/` | Keep: ingress path already built |

### Step 0C: Dream State Diagram

```
CURRENT STATE                    THIS PLAN                       12-MONTH IDEAL
──────────────────              ──────────────────              ──────────────────
Standalone app                  Repo-native control plane       Installable platform
State-machine icons             Flat variant icons              Variant-axis icons
Authored transitions            Runtime transitions             Smart runtime + user hints
SyncTarget dashboard            cuneiform.config.ts                CLI + watch + CI publish
Multi-target export             React-first publish             Multi-framework publish
NPM registry (Phase Q)          Direct codebase publish         Both NPM + direct
No Figma back-sync              Figma ingress-only              Optional Figma back-sync
```

Delta after this plan: Gets to ~70% of the 12-month ideal. Remaining gaps: CLI extraction, watch mode, CI publish, multi-framework adapters, Figma back-sync.

### Step 0C-bis: Implementation Alternatives

| Approach | Effort (CC) | Risk | Pros | Cons |
|----------|-------------|------|------|------|
| A: Full rewrite (this plan) | ~2-3h | Medium | Clean break, spec-aligned, removes all debt | Large blast radius (~8k LOC), all-or-nothing |
| B: Incremental migration | ~4-5h | Low | Each step is deployable, can stop anytime | Longer, temporary compatibility shims |
| C: Handoff-only first, animation later | ~1-2h | Low | Fastest to prove wedge | Defers animation rewrite, two-phase effort |

Auto-decision (P1 completeness + P5 explicit): Approach A. The specs are already rewritten. The blast radius is bounded (8 files critical, 4 more moderate). With CC compression this is ~2-3 hours, not weeks. Incremental migration (B) adds shim complexity that gets deleted anyway. Handoff-only (C) leaves a broken animation model alongside new code.

### Step 0D: Mode Analysis (SELECTIVE EXPANSION)

Mode: **SELECTIVE EXPANSION** (auto-decided per P2 boil lakes).

Baseline scope: The 6 execution steps in the plan's "Suggested execution order."

Expansion opportunities identified:
1. Add `cuneiform.config.ts` loader and validator (in blast radius, <1 day) -> AUTO-APPROVE (P2)
2. Add CLI entry point (`cuneiform dev`, `cuneiform build`) -> OUT OF SCOPE (new infra, >1 day) -> DEFER to TODOS.md
3. Add watch mode for live rebuild -> OUT OF SCOPE -> DEFER
4. Update Figma plugin to match new schema -> BORDERLINE (1-2 files) -> TASTE DECISION

### Step 0E: Temporal Interrogation

**HOUR 1:** Schema types rewritten, fixtures updated. Compiler errors everywhere but the foundation is correct.
**HOUR 2:** Editor store reshaped. Most currentStateId references cleaned up. UI panels broken but compiling.
**HOUR 3:** Runtime transition resolver updated to icon-to-icon. State machine replaced.
**HOUR 4:** Export pipeline producing state-free payloads. React adapter consuming new schema.
**HOUR 5:** SyncTarget UI replaced with install config. Tests updated and passing.
**HOUR 6+:** Polish, edge cases, verify the full verification checklist. Deferred items documented.

Risk inflection: Hour 2-3 is the highest risk. The editor store has 50+ references to remove. If any are missed, runtime crashes. The plan's execution order (schema first, then store) is correct for catching these at compile time.

### Step 0F: Mode Selection

SELECTIVE EXPANSION confirmed. Hold the 6-step baseline, cherry-pick config loader expansion, defer CLI and watch mode.

### Step 0.5: Dual Voices

**CODEX SAYS (CEO, strategy challenge):**
Codex identified the core strategic tension: 17 shipped phases are effectively being rewritten. The canonical design doc says "Cuneiform with SF Symbols-grade animation capabilities" while this plan pivots toward "repo-native handoff platform." Codex was analyzing whether the plan conflates execution scope with a product pivot when its output was truncated. Key concern surfaced: the plan does not address competitive positioning against SVGR and Figma Dev Mode. [codex-partial]

**CLAUDE SUBAGENT (CEO, strategic independence):**
7 findings, 1 critical, 5 high, 1 medium:
1. (High) Animation bundled with handoff wedge, should ship handoff first
2. (Critical) "No backward compat" is an untested premise, validate user count
3. (High) No competitive analysis vs SVGR/Figma DevMode
4. (High) Repo-root config creates adoption friction vs NPM
5. (Medium) Figma ingress-only closes doors prematurely
6. (High) 6-month regret: rewrite with no adoption
7. (High) Removing states may kill the differentiator

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex   Consensus
  ───────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                    Partial Partial DISAGREE
  2. Right problem to solve?            Yes     Yes     CONFIRMED
  3. Scope calibration correct?         Too big N/A     DISAGREE
  4. Alternatives sufficiently explored? No     N/A     DISAGREE
  5. Competitive/market risks covered?  No      No      CONFIRMED (gap)
  6. 6-month trajectory sound?          Risky   Risky   CONFIRMED (concern)
═══════════════════════════════════════════════════════════════
CONFIRMED = 3 (2 confirming gaps). DISAGREE = 3.
Codex output partial [codex-partial] — 3 dimensions marked N/A.
Single critical finding from Claude subagent: backward compat premise untested.
```

### Sections 1-10 Review Summary

**Section 1 (Problem Definition):** Examined. The handoff pain is real and well-articulated. No issues. The design doc's problem statement is concrete and user-grounded.

**Section 2 (Error & Rescue Registry):**

| Error Scenario | Detection | Recovery | User Sees | Tested? |
|----------------|-----------|----------|-----------|---------|
| Schema migration fails mid-rewrite | TypeScript compiler | Fix types | Build error | Will be |
| Store references missed | Runtime null access | Crash | Editor crash | Needs test |
| Export emits stale state payload | Snapshot diff | Fix export | Wrong output | Needs test |
| Morph scoring on incompatible icons | MorphReadiness < threshold | Fallback to replace | Graceful degrade | Existing |
| Config loader parses invalid config | Zod validation | Error message | CLI error | Needs test |

**Section 3 (Security):** Examined. No new attack surface. Config file is local. NPM tokens stay in keychain (existing decision). No secrets in config (hard constraint in install-config spec). No issues.

**Section 4 (Data Flow):** Examined. Happy path: Figma -> import -> canonical source -> export -> React components. Shadow paths: nil import (empty Figma selection), zero-layer icon, upstream Figma API error. All addressed by existing import validation in `lib/import/cuneiform-plugin-payload.ts`. No new shadow paths introduced by this rewrite.

**Section 5 (Observability):** Not applicable for a local authoring tool. No dashboards, alerts, or metrics needed. The verification checklist serves as the observability surface.

**Section 6 (Testing):** Examined. The plan's verification checklist is concrete: grep for removed concepts, test 4 transition strategies, test export output, test changed-only publish. This is well-scoped. Missing: no test for the config loader (expansion item).

**Section 7 (Performance):** Examined. No N+1 queries. No network calls in the hot path. The morph scoring adds compute per transition preview, but this is already benchmarked (Phase O shipped). No new performance risks.

**Section 8 (Dependencies):** Examined. No new dependencies needed. Zod is already in the project for validation. No risks.

**Section 9 (Rollback):** The plan states "backward compatibility is not required." This is the critical premise. If validated (no users), rollback is "git revert the PR." If not validated, rollback requires a migration path. Marked at premise gate.

**Section 10 (Timeline):** Estimated 2-3 hours with CC. 6 sequential steps, each independently verifiable. The plan's execution order is sound (schema -> store -> runtime -> export -> UI -> tests).

### NOT in scope

- CLI extraction (`@cuneiform/cli`, `cuneiform dev`, `cuneiform build`) -> TODOS.md
- Watch mode for live rebuild -> TODOS.md
- CI publish integration -> TODOS.md
- Figma back-sync -> TODOS.md
- Multi-framework adapters (Flutter, Swift, Web Components) -> TODOS.md
- Storybook reference app -> explicitly excluded by hard constraint
- Competitive positioning document -> TODOS.md (recommended before launch)

### What already exists

| Sub-problem | Existing Code | Status |
|-------------|--------------|--------|
| Cross-icon morph engine | `lib/runtime-core/cross-icon-morph.ts` | Complete, no changes needed |
| Morph scoring | `transition-resolver.ts:computeReadiness()` | Reshape to icon-to-icon |
| Figma plugin | `figma-plugin/export-to-cuneiform/` | Complete, already ingress |
| React adapter | `lib/export/adapters/react-adapter.ts` | Keep, reshape input |
| Variant derivation | `lib/schema/variant-derivation.ts` | Keep as-is |
| NPM publish client | `lib/sync-service/npm-publish-client.ts` | Keep, decouple from syncTargets |

### Failure Modes Registry

| Failure Mode | Severity | Mitigation | Critical Gap? |
|-------------|----------|------------|---------------|
| Missed currentStateId reference -> runtime crash | High | TypeScript compiler + grep verification | No (compiler catches) |
| Export still emits defaultState -> spec violation | High | Snapshot test against new spec | No (testable) |
| Icons with 3+ logical states lose expressiveness | Medium | Variant axes reframe | YES (taste decision) |
| Config loader accepts invalid config | Medium | Zod schema validation | No (standard) |
| SyncTarget removal breaks existing project files | High | No users validated | GATE ITEM |

### CEO Completion Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Problem Definition | 8/10 | Clear, user-grounded, but competitive positioning missing |
| Premises | 7/10 | 3 explicit valid, 2 implicit need validation |
| Scope | 7/10 | Correct for v1 but bundling animation with handoff is a risk |
| Alternatives | 6/10 | Only 1 approach deeply analyzed, 2 dismissed quickly |
| Execution Plan | 8/10 | Sound order, bounded blast radius, verifiable steps |
| Risk Management | 7/10 | Good verification checklist, missing user validation |
| Overall | 7/10 | Directionally right, needs premise validation before proceeding |

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Accept P1 (handoff pain is real) | P3 pragmatic | Well-grounded in user research, design doc | — |
| 2 | CEO | Accept P2 (Figma ingress-only for v1) | P6 action | Ship now, keep back-sync compatible | Hard ingress-only forever |
| 3 | CEO | Accept P3 (React wedge) | P1 completeness | Highest-density target | — |
| 4 | CEO | GATE: backward compat premise | — | Needs user validation | Auto-decide |
| 5 | CEO | TASTE: states-as-variant-axes | — | Reasonable people disagree | Auto-decide |
| 6 | CEO | Full rewrite (Approach A) | P1+P5 | Specs rewritten, bounded blast radius | Incremental (B), handoff-only (C) |
| 7 | CEO | SELECTIVE EXPANSION mode | P2 boil lakes | Hold baseline + cherry-pick config loader | SCOPE EXPANSION |
| 8 | CEO | Auto-approve config loader expansion | P2 | In blast radius, <1 day, 1-2 files | — |
| 9 | CEO | Defer CLI extraction | P3 | New infra, >1 day | Include now |
| 10 | CEO | Defer watch mode | P3 | New infra, >1 day | Include now |
| 11 | CEO | TASTE: update Figma plugin to new schema | — | Borderline scope, 1-2 files | Auto-decide |
| 12 | CEO | GATE: no users, break freely | USER | User confirmed sole user, no external consumers | Migration path |
| 13 | CEO | GATE: remove states entirely | USER | User chose atomic icons, no variant axes | States as variant axes |

---

## /autoplan Design Review (Phase 2)

### Step 0: Design Scope

Completeness rating: **5/10**. The plan specifies what to remove but not what the user experiences after removal. Four UI panels affected, only one (SyncTargetPanel replacement) has a wireframe. DESIGN.md exists but predates this rewrite. Existing patterns: shadcn/ui components, wire-* CSS classes, Radix primitives.

### Step 0.5: Dual Voices

**CODEX SAYS (design, UX challenge):**
Strong verdict: "The plan has strong product direction and weak interaction design." Key findings:
1. Information hierarchy serves the developer, not the user. Organized by code surfaces, not user tasks.
2. Interaction states are under-specified: 11 specific missing states enumerated (loading import, invalid payload, config missing, host not detected, watcher disconnected, partial publish, file conflicts, stale cache, back-sync failure, offline, long-running publish).
3. No responsive strategy. Zero breakpoints, no desktop-only declaration.
4. Accessibility requirements absent. No keyboard flows, no ARIA, no reduced motion for animation previews.
5. Transition model is "technically named but experientially undefined." Four strategies exist but no spec for what users control vs what's automatic.
6. Live lane vs release lane is architecturally clear but UX-ambiguous.

**CLAUDE SUBAGENT (design, independent review):**
16 findings (2 critical, 8 high, 6 medium):
- Critical: TransitionPanel has two contexts (embedded + full tab), only full tab is specified
- Critical: No config-not-found empty state for repo-native publish panel
- High: No auto-fill of source icon from current editor context
- High: No publish progress/success/error states
- High: No diagnostic for morph fallback ("why replace?")
- High: Timeline tracks unspecified per strategy type
- High: Strategy dropdown contradicts "runtime-resolved" constraint
- High: Canvas behavior during transition preview unspecified
- High: Duration/easing persistence ambiguous
- High: inspect-tab.md Phase L still uses State references the rewrite deletes

```
DESIGN DUAL VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex   Consensus
  ───────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy correct?     Partial No      CONFIRMED (gap)
  2. Interaction states specified?      No      No      CONFIRMED (gap)
  3. User journey complete?             2 breaks Slogan CONFIRMED (gap)
  4. Specificity sufficient?            Mixed   Weak    CONFIRMED (gap)
  5. Accessibility addressed?           N/A     No      CONFIRMED (gap)
  6. Responsive strategy present?       N/A     No      CONFIRMED (gap)
  7. Ambiguity resolved for impl?       No      No      CONFIRMED (gap)
═══════════════════════════════════════════════════════════════
CONFIRMED = 7/7 (all gaps). DISAGREE = 0.
Both voices agree: strong direction, weak interaction spec.
```

### Passes 1-7: Auto-Decided Design Fixes

**Pass 1: Information Hierarchy (4/10)**
The plan orders by code refactor, not user task. Auto-fix (P5 explicit): the implementation should prioritize the import-to-publish user flow. Animation tab is secondary to the handoff workflow. No plan change needed, this is an implementation priority note.

**Pass 2: Missing States (3/10)**
11+ interaction states missing. Auto-fix (P1 completeness): during implementation, each panel must handle: empty, loading, error, success. Specific additions:
- Config-not-found: "Create cuneiform.config.ts" button with template
- Publish progress: "Publishing X of Y icons..." with cancel
- Publish success: toast + count reset
- Morph fallback: diagnostic line showing why ("3 subpaths vs 1")
- Single-icon project: "Import a second icon to preview transitions"

**Pass 3: User Journey (5/10)**
Two breaks identified: config-not-found wall and no publish feedback. Auto-fix (P5): implement config creation wizard inline and publish feedback toast.

**Pass 4: Specificity (5/10)**
Good: strategy colors, compatibility types, wireframes. Bad: timeline tracks, icon picker, canvas preview behavior. Auto-fix (P3 pragmatic): resolve these during implementation using existing component patterns. TransitionPanel embed becomes read-only summary card.

**Pass 5: Consistency (7/10)**
Existing shadcn/ui patterns are well-established. The rewrite follows existing conventions. No issues beyond what's flagged above.

**Pass 6: Accessibility (2/10)**
No a11y requirements specified. Auto-decision (P1 completeness): add desktop-only declaration, keyboard navigation for all new controls, reduced-motion respect for animation previews. This is scope expansion but it's <1 day CC effort and is standard practice. AUTO-APPROVE.

**Pass 7: Responsive (N/A)**
Desktop-only authoring tool. Auto-fix: declare minimum 1024px viewport. No responsive breakpoints needed.

### Design Decisions Auto-Resolved

1. **TransitionPanel dual context**: Inspect embed becomes read-only summary card. Full Animation tab is the authoring surface. (P5 explicit)
2. **Strategy dropdown vs runtime-resolved**: Runtime auto-resolves by default. User can pin a "hint" override. Dropdown shows auto-resolved value with optional override. (P3 pragmatic)
3. **Canvas preview during scrub**: Transition preview renders on main canvas. Sidebar preview is secondary thumbnail. (P5 explicit)
4. **Duration/easing persistence**: Persist as lightweight transition hints in icon metadata. Runtime can use or ignore. (P3 pragmatic)
5. **Source icon auto-fill**: Default source to currently-open icon/variant. User picks target only. (P5 explicit)
6. **Icon picker**: Searchable popover with icon thumbnail grid for icon selection. Plain dropdown for variant selection (<10 items). (P3 pragmatic)

### Design Completion Summary

| Dimension | Score | Fix Applied |
|-----------|-------|-------------|
| Information Hierarchy | 4 -> 6 | Implementation priority note |
| Missing States | 3 -> 7 | 5 specific states added to implementation scope |
| User Journey | 5 -> 7 | Config wizard + publish feedback |
| Specificity | 5 -> 7 | 6 ambiguities resolved |
| Consistency | 7 | No changes needed |
| Accessibility | 2 -> 5 | Desktop-only + keyboard + reduced-motion |
| Responsive | N/A | Desktop-only declared |

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 14 | Design | TransitionPanel embed = read-only summary card | P5 explicit | Two contexts with one spec is ambiguous | Full authoring in both |
| 15 | Design | Strategy dropdown = hint override, not authority | P3 pragmatic | Respects runtime-resolved constraint while giving user control | Pure runtime-only (no dropdown) |
| 16 | Design | Canvas shows transition preview during scrub | P5 explicit | Canvas is primary visual surface | Sidebar-only preview |
| 17 | Design | Duration/easing persisted as hints | P3 pragmatic | Users shouldn't re-set every preview | Preview-only (not persisted) |
| 18 | Design | Source icon auto-fills from context | P5 explicit | Reduces cold-start to 1 picker interaction | All 4 dropdowns manual |
| 19 | Design | Searchable popover for icon picker | P3 pragmatic | Dropdown unusable at 500+ icons | Plain dropdown |
| 20 | Design | Auto-approve a11y scope (keyboard + reduced-motion) | P1+P2 | Standard practice, <1 day CC effort | Skip a11y |
| 21 | Design | Desktop-only, 1024px minimum | P3 pragmatic | Authoring tool with dense panels | Responsive breakpoints |

---

## /autoplan Eng Review (Phase 3)

### Step 0: Scope Challenge

Actual blast radius verified by grep:

```
Files with defaultState/states/currentStateId/syncTargets references:
lib/schema/types.ts                         - schema definition
lib/schema/workspace.ts                     - workspace loader
lib/editor-store/store.ts                   - 36 currentStateId refs
lib/editor-store/selectors.ts               - 5 state refs
lib/editor-store/hooks.ts                   - state exports
lib/runtime-core/transition-resolver.ts     - State params
lib/runtime-core/state-machine.ts           - direct state access
lib/runtime-core/inspection.ts              - state inspection
lib/runtime-react/CuneiformIcon.tsx            - variant.states resolution *
lib/runtime-react/use-icon.ts               - state machine usage *
lib/runtime-dom/dom-renderer.ts             - state rendering *
lib/compiler-contracts/types.ts             - CompiledVariant.states *
lib/export/export-runtime-json.ts           - defaultState in export
lib/export/export-react-components.ts       - state in component gen
lib/export/export-react/generate-component.ts - state references
lib/export/export-react/generate-library.ts   - state references
lib/export/export-react/write-library.ts      - state references
lib/sync-source/export-source.ts            - source reconstruction
components/editor/EditorShell.tsx            - currentStateId usage *
components/editor/TransitionPanel.tsx        - state-to-state UI
components/editor/AnimationStudioPanel.tsx   - effect + transition state
components/editor/InspectorPanel.tsx         - state-dependent sections
components/editor/Canvas.tsx                 - state for rendering
components/editor/LayerPanel.tsx             - state layer listing
components/editor/TimelineEditor.tsx         - timeline state refs
components/platform/DesktopCommandBridge.tsx - desktop SVG export *
components/export/SyncTargetPanel.tsx        - syncTargets CRUD
components/export/GitHubSyncPanel.tsx        - sync refs
tests/                                      - multiple test files

* = NOT listed in plan's "primary code surfaces"
```

**Verdict: 29+ files affected, plan lists 8.** The plan needs to expand its file inventory. However, the TypeScript compiler will catch all of these as hard errors when the schema types change. The risk is not "missed files" but "underestimated effort."

### Step 0.5: Dual Voices

**CODEX SAYS (eng, architecture challenge):**
7 findings (1 critical, 4 high, 2 medium):
1. (Critical) Blast radius includes compiler-contracts, runtime-react, desktop bridge, editor shell. Plan is structurally incomplete.
2. (High) Install-platform prerequisites missing. Config is a UI fiction without loader/CLI.
3. (High) File ownership and stale-output cleanup undefined for changed-only publish.
4. (High) Transition contract ambiguous: runtime-owned vs user-pinnable hints.
5. (High) Grep+compiler insufficient. Need contract tests for behavioral coupling.
6. (Medium) Canonical architecture docs not updated to match clean break.
7. (Medium) 2-3h estimate masks hidden sequencing risk.

**CLAUDE SUBAGENT (eng, independent review):**
13 findings (1 critical, 7 high, 5 medium):
1. (Critical) "Remove states" means keep State internally or rewrite 30+ signatures.
2. (High) Blast radius is 29 files, not 8.
3. (High) Zero-variant icons crash export.
4. (High) Empty layers produce silent 0-duration transition.
5. (High) No schema migration/rejection test.
6. (High) No full fallback chain test.
7. (High) 36 currentStateId refs in undo-sensitive store code.
8. (Medium) from/to fields undefined after state removal.
9. (Medium) StateMachine + runtime-react not in plan scope.
10. (Medium) O(N^2) topology analysis at scale.
11. (Medium) Export structurally requires defaultState.
12. (Medium) Config loader executes arbitrary code.
13. (Medium) EditorTab.stateId persists stale refs.

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                            Claude  Codex   Consensus
  ───────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?                No      No      CONFIRMED (gap)
  2. Test coverage sufficient?          No      No      CONFIRMED (gap)
  3. Performance risks addressed?       Medium  N/A     N/A
  4. Security threats covered?          Low     Low     CONFIRMED (low risk)
  5. Error paths handled?               No      No      CONFIRMED (gap)
  6. Deployment risk manageable?        Medium  No      DISAGREE
═══════════════════════════════════════════════════════════════
CONFIRMED = 4 (3 confirming gaps, 1 low risk). DISAGREE = 1. N/A = 1.
Both voices agree on critical finding: State type decision must be made explicit.
```

### Section 1: Architecture

```
ARCHITECTURE DEPENDENCY GRAPH (after rewrite):

lib/schema/types.ts (Icon, Variant, Layer — NO State, NO defaultState)
    │
    ├── lib/editor-store/store.ts (accesses variant.layers directly)
    │       ├── lib/editor-store/selectors.ts
    │       ├── lib/editor-store/hooks.ts
    │       └── components/editor/*.tsx (6 panels)
    │
    ├── lib/runtime-core/
    │       ├── transition-resolver.ts (takes pseudo-State from variant layers)
    │       ├── cross-icon-morph.ts (pure geometry, no State deps)
    │       ├── draw-executor.ts (draws from layer data)
    │       └── [REMOVED: state-machine.ts]
    │
    ├── lib/runtime-react/
    │       ├── CuneiformIcon.tsx (resolves variant, NO state lookup)
    │       └── use-icon.ts (NO state machine)
    │
    ├── lib/export/
    │       ├── export-runtime-json.ts (NO defaultState in output)
    │       ├── export-react-components.ts
    │       └── adapters/react-adapter.ts
    │
    ├── lib/compiler-contracts/types.ts (CompiledVariant.layers, NO .states)
    │
    └── lib/sync-source/export-source.ts (source from variant layers)

components/platform/DesktopCommandBridge.tsx
    └── uses getCurrentIconContext() → needs variant.layers, NOT state
```

### Critical Architecture Decision: State Type

**Auto-decision (P5 explicit + P3 pragmatic):** Keep `State` as an **internal runtime adapter type**. Variant.layers replaces the authored state concept. At the runtime boundary, synthesize a pseudo-State from variant layers:

```typescript
// Internal adapter — NOT exported in schema
function variantToRuntimeState(variant: Variant): RuntimeState {
  return { layers: variant.layers, topology: variant.topology };
}
```

**Rationale:** Eliminating State from 30+ function signatures (resolveTransition, computeReadiness, resolveBindings, etc.) is high-risk for a cosmetic benefit. The product decision is "no authored states." The implementation decision is "State becomes an internal adapter at the runtime boundary." This cuts blast radius by ~40%.

### Section 2: Code Quality

DRY violations: The plan will create a `variantToRuntimeState()` adapter that gets called at every runtime entry point. This is acceptable (explicit adapter pattern > scattered inline conversions).

Naming: `State` should be renamed to `RuntimeLayerSnapshot` or similar to avoid confusion with the removed product concept. Auto-decision (P5): rename to `LayerSnapshot`.

### Section 3: Test Review

**Test diagram — every new codepath and its coverage:**

| Codepath | Type | Test Exists? | Gap? |
|----------|------|-------------|------|
| Variant without states (flat layers) | Schema | No | YES — need fixture |
| Editor store without currentStateId | Integration | No | YES — undo/redo regression |
| Transition resolver with LayerSnapshot | Unit | Partial (takes State) | YES — update signatures |
| Cross-icon morph (unchanged) | Unit | Yes | No |
| Export with no defaultState | Snapshot | No | YES — new snapshot |
| Export with zero-variant icon | Edge case | No | YES — guard test |
| Export with empty-layer variant | Edge case | No | YES — guard test |
| Fallback chain (strict -> bestGuess -> replace) | Integration | No | YES — full waterfall |
| Config loader (valid config) | Unit | No | YES — new code |
| Config loader (invalid config) | Unit | No | YES — Zod error |
| Config loader (missing config) | Unit | No | YES — empty state |
| Desktop bridge SVG export (no state) | Integration | No | YES — update context |
| Compiled artifact (no CompiledVariant.states) | Contract | No | YES — schema test |
| Runtime-react variant resolution | Unit | Partial | YES — remove state lookup |

**14 test gaps identified. 11 are new tests needed, 3 are updates to existing tests.**

### Section 4: Performance

No new performance risks beyond existing O(N^2) topology analysis (documented, accepted for v1). The rewrite does not add new hot paths. Morph scoring is unchanged.

### Eng Completion Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 6/10 | Sound direction, blast radius under-scoped, State decision now resolved |
| Test Coverage | 4/10 | 14 gaps, 11 new tests needed |
| Performance | 8/10 | No new risks |
| Security | 9/10 | No new attack surface |
| Error Paths | 5/10 | Zero-variant, empty-layer, config-missing paths unspecified |
| Deployment Risk | 7/10 | Clean break confirmed, but canonical docs need update |
| Overall | 6/10 | Needs expanded file list, test plan, and State decision documented |

### NOT in scope (Eng)

- CLI extraction and config loading runtime (deferred, not needed for product-model rewrite)
- File ownership manifest for changed-only publish (deferred, needs design)
- Legacy Project/Workspace document migration (clean break, but update ARCHITECTURE.md)
- O(N^2) topology analysis optimization (documented, accepted for v1)

### What already exists (Eng)

| Sub-problem | Existing Code | Reuse? |
|-------------|--------------|--------|
| Cross-icon morph geometry | cross-icon-morph.ts | Keep as-is |
| Topology detection | transition-resolver.ts | Keep, rename State param |
| Undo/redo framework | store.ts temporal integration | Keep, remove stateId |
| Desktop bridge | DesktopCommandBridge.tsx | Update getCurrentIconContext() |
| Source export | export-source.ts | Update to use variant.layers |

### Failure Modes Registry (Eng)

| Failure Mode | Severity | Mitigation | Critical Gap? |
|-------------|----------|------------|---------------|
| Missed State reference → compiler error | Medium | TypeScript strict mode | No |
| Undo produces corrupt state after rewrite | High | Regression test | YES |
| Zero-variant icon → export crash | High | Guard + test | YES |
| Empty-layer variant → silent 0-duration transition | High | Diagnostic + test | YES |
| Stale EditorTab.stateId → tab restore crash | Medium | Strip stateId + ignore | No |
| CompiledVariant.states still in contract | High | Update contract type | No (compiler catches) |
| Canonical ARCHITECTURE.md contradicts code | Medium | Update docs | No |

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 22 | Eng | Keep State as internal LayerSnapshot adapter | P5+P3 | 40% blast radius reduction, same product outcome | Eliminate State from 30+ signatures |
| 23 | Eng | Expand file inventory to 29+ files | P1 | Compiler catches all, but plan should be honest | Keep 8-file scope |
| 24 | Eng | Rename State → LayerSnapshot | P5 | Avoid confusion with removed concept | Keep State name |
| 25 | Eng | Add 14 test gaps to implementation scope | P1+P2 | Tests are the verification layer | Skip tests |
| 26 | Eng | Zero-variant guard in export | P1 | Prevents crash on edge case | Let it crash |
| 27 | Eng | Empty-layer diagnostic in resolver | P5 | Surface failure instead of silent no-op | Accept silent fallback |
| 28 | Eng | Update ARCHITECTURE.md to match clean break | P5 | Docs must match code | Leave stale docs |
| 29 | Eng | Defer file ownership manifest | P3 | Needs separate design, not blocking schema rewrite | Include in this PR |
| 30 | Eng | TASTE: transition hints (duration/easing) — authored vs advisory | — | Codex flags this as schema-impacting | Auto-decide |

---

## Cross-Phase Themes

**Theme 1: Blast radius is wider than acknowledged** — flagged in CEO (scope calibration), Design (inspect-tab Phase L still uses State), and Eng (29 files vs 8). High-confidence signal. Resolution: expand file list, but accept that TypeScript compiler is the primary safety net.

**Theme 2: Interaction states are unspecified** — flagged in Design (11 missing states) and Eng (zero-variant, empty-layer, config-missing). Both phases independently identified the same gaps. Resolution: specify during implementation, add guard tests.

**Theme 3: Transition contract ambiguity** — flagged in CEO (runtime vs authored), Design (strategy dropdown contradiction), and Eng (Codex finding #4). All three phases identified the same tension. Resolution: runtime auto-resolves, user hints are advisory and persisted in icon metadata. This is the strongest cross-phase signal.

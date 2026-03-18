# Morph Animation Audit + Improvement Report

## 1) Current system architecture summary

- Transition schema contract supports `from`, `to`, `strategy`, `durationMs`, `easing`, and `layerBindings`.
- Runtime previously resolved bindings directly from declared transition bindings and did not auto-resolve semantic matches.
- Morph implementation existed (`strictMorph`, `bestGuessMorph`) but fallback logic was limited to crossfade and mostly global-style behavior.
- Runtime playback had a single shared progress timeline without staged choreography.

## 2) Morph capability matrix (representative icon pairs)

| Pair | Strategy used (new) | Expected strategy | Failure / downgrade reason |
|---|---|---|---|
| plus → x | strictMorph | strictMorph | none |
| menu → close | strictMorph | strictMorph | none |
| play → pause | fallback | fallback | subpath mismatch |
| chevron-down → chevron-up | strictMorph | strictMorph | none |
| arrow-right → arrow-up-right | bestGuessMorph | bestGuessMorph | command mismatch but high geometric similarity |
| heart → heart.fill | bestGuessMorph | bestGuessMorph | close-path difference |
| bell → bell.fill | bestGuessMorph | bestGuessMorph | close-path + bbox drift |
| eye → eye.slash | fallback | fallback | extra slash subpath |
| mic → mic.slash | fallback | fallback | extra slash subpath |
| bookmark → bookmark.fill | strictMorph | strictMorph | none |

## 3) Defects grouped by severity

### Critical
- All-or-nothing transition handling caused visible popping in mismatched morph cases.

### Major
- Binding strategy was overly dependent on authored IDs and could degrade with imports/reordering.
- No readiness scoring to gate morph decisions.
- No staged choreography; layers animated in lockstep.

### Minor
- Limited diagnostics tooling for runtime transition inspection.
- Fallback mode variety was not available.

## 4) Root cause analysis

- **Binding issues:** no deterministic semantic+geometry resolver for unmatched layers.
- **Normalization issues:** command and subpath normalization were not centrally enforced at transition planning time.
- **Topology issues:** strict morph compatibility relied on direct command signatures only.
- **Choreography issues:** no per-layer delay/duration plan existed.

## 5) Reproducible test cases

- Added `tests/morph-audit-system.test.ts` with the required 10 icon-pair scenarios and assertions for:
  - binding/inspection outputs
  - morph vs fallback decisions
  - centroid similarity floor for morph-capable pairs
  - transition timing choreography presence (`delayMs`/`durationMs`)

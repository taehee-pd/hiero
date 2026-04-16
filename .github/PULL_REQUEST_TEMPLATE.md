## Summary

<!-- 1-3 bullet points describing what this PR does and why -->

## Test plan

<!-- How was this tested? -->
- [ ] `pnpm test` passes (core + DOM)
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` has 0 errors

## Design system checklist

<!-- Complete ONLY if this PR touches components/ds/ -->
- [ ] If this PR adds a component to `components/ds`, all five admission criteria are met:
  1. Same semantics across call sites
  2. Same a11y contract
  3. Same behavior (hover/focus/disabled/loading/error)
  4. Same change axis — moves together when redesigned
  5. DESIGN.md fidelity — no invented values
- [ ] If this PR adds a component to `components/ds`, at least two consumers outside a single feature folder exist in the same PR
- [ ] If this PR touches `components/ds`, a `.stories.tsx` and `.test.tsx` file exist for the component
- [ ] If this PR adds a new semantic token to `app/globals.css`, it is also documented in `/DESIGN.md`

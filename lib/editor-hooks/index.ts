// lib/editor-hooks — interaction hooks extracted in Phase 4 of
// specs/design-system-storybook.plan.md.
//
// These are editor-local for now, not in components/ds/hooks, because
// the plan's §3 admission criteria require proven cross-feature use
// (≥ 2 consumers outside one feature family) before promotion. Today
// both hooks only serve editor/studio/explorer sites; if a future
// Phase 5 component needs them, they move up a layer.

export { useInlineRename } from './use-inline-rename';
export type {
  InlineRenameApi,
  InlineRenameOptions,
} from './use-inline-rename';

export { useMarqueeSelection } from './use-marquee-selection';
export type {
  MarqueeSelectionApi,
  MarqueeSelectionOptions,
  MarqueeRect,
} from './use-marquee-selection';

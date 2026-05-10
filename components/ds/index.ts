// Hiero Design System — barrel export.
//
// This is the ONE import surface for shared, cross-feature UI components
// that pass the §3 admission criteria in specs/design-system-storybook.plan.md:
//
//   1. Same semantics across call sites
//   2. Same a11y contract
//   3. Same behavior (hover/focus/disabled/loading/error)
//   4. Same change axis — moves together when redesigned
//   5. DESIGN.md fidelity — no invented values
//
//   plus one of: ≥2 consumers outside one feature family, OR
//   system-level concern (status, color, keyboard, toast).
//
// This barrel re-exports named exports only. It MUST NOT import from
// components/editor, components/studio, components/explorer, or
// components/export — the ESLint no-restricted-imports rule enforces this.
//
// Populated incrementally by Phase 5 of the plan. Phase 2 only seeds it
// with ColorPicker (moved from the deleted components/kibo-ui folder).

export * from './color-picker';
export { StatusBadge } from './status-badge';
export type { StatusBadgeProps, StatusBadgeVariant } from './status-badge';
export { KbdHint, resolveKey } from './kbd-hint';
export type { KbdHintProps } from './kbd-hint';
export { ColorField } from './color-field';
export type { ColorFieldProps } from './color-field';
export { IconButton } from './icon-button';
export type { IconButtonProps, IconButtonSize } from './icon-button';
export { Tag } from './tag';
export type { TagProps, TagVariant } from './tag';
export { ShortcutRow } from './shortcut-row';
export type { ShortcutRowProps } from './shortcut-row';

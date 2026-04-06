# DESIGN.md — Contour Studio

This file is a design-system prompt document for coding/design agents.
Use it as the first source when generating or refactoring UI in this repo.

---

## 1) Visual Theme & Atmosphere

- **Product tone:** professional toolsmith + creative precision.
- **Visual style:** dark-first, editor-grade workspace with restrained accent color.
- **Density:** medium-dense data tooling (inspector + timeline + panes), never cramped.
- **Personality keywords:** focused, technical, calm, deliberate.

Design intent:
- Prioritize legibility and editability over decorative visuals.
- Keep interaction chrome minimal so authored icon previews and animation behavior remain focal.

---

## 2) Color Palette & Roles

> Prefer existing Tailwind utility classes and tokens already used in the codebase.

### Core semantic roles

- **Background / shell:** near-black neutrals (`zinc`/`neutral` dark ranges).
- **Panel surfaces:** slightly lifted dark surfaces with subtle contrast from shell.
- **Text primary:** high-contrast off-white.
- **Text secondary:** muted gray for labels/help text.
- **Border / separators:** low-contrast neutral lines, visible but not dominant.
- **Accent (brand/action):** violet/purple family for primary interactive emphasis.
- **Success / warning / danger:** standard semantic hues with accessibility-safe contrast.

### Usage rules

- Reserve strong accent saturation for primary actions, focus indicators, and active states.
- Keep panel/surface hierarchy obvious through tone and border contrast before using shadow.
- Avoid introducing brand-new chroma families unless product direction changes.

---

## 3) Typography Rules

- **Primary UI font:** system sans stack (matching current app behavior).
- **Code / technical values:** monospace where value precision matters.
- **Hierarchy strategy:** compact utility-app scale, clear contrast between section titles, labels, and value text.

### Recommended scale intent

- Page/workspace heading: semibold, compact tracking.
- Section heading: semibold, slightly smaller than page heading.
- Control labels: medium weight, small size.
- Metadata/help text: small, muted.

Do:
- Keep line lengths short in side panes.
- Prefer consistent casing within a panel.

Don't:
- Use oversized marketing-style hero typography inside tool panels.

---

## 4) Component Stylings

### Buttons

- Radius: small-to-medium; avoid pill shapes unless functionally meaningful.
- Primary: accent-backed with high-contrast label.
- Secondary/ghost: low-emphasis neutral with clear hover/focus states.
- Destructive: semantic danger; always obvious in confirmation flows.

### Inputs & form controls

- Dark surfaces with clear border delineation.
- Strong keyboard focus ring (visible in dense UIs).
- Placeholder text must remain distinguishable from real values.

### Panels & cards

- Use soft separation via border + slight tone shift.
- Maintain consistent internal spacing rhythm.
- Avoid deep nested card stacks unless information architecture requires them.

### Navigation and tabs

- Active state should be unambiguous (tone + text + optional accent marker).
- Hover states are subtle; active states are explicit.

---

## 5) Layout Principles

- Single-screen, multi-pane studio layout is the canonical interaction model.
- Preserve clear pane responsibilities (navigation, lists, canvas/editor, inspector/export).
- Favor stable pane dimensions; avoid content jumps.
- Use predictable spacing increments (tight in controls, roomier between semantic groups).

### Responsive behavior intent

- On narrower widths, collapse non-critical panes first.
- Preserve core authoring canvas and essential edit controls.
- Keep destructive or publish actions visible and explicit.

---

## 6) Depth & Elevation

- Base hierarchy should come from contrast and borders.
- Shadows are subtle and used sparingly for overlays/popovers/dialogs.
- Dialogs should feel above workspace without dramatic blur/glow effects.

---

## 7) Motion & Interaction Feedback

- Motion should communicate state change, not decorate.
- Keep transitions short and utility-like for editor responsiveness.
- Provide immediate feedback on save/sync/export actions.
- Keyboard accessibility and focus management are first-class behavior.

---

## 8) Do / Don’t Guardrails

### Do

- Reuse existing shadcn/Radix-based primitives and current component patterns.
- Keep UI changes consistent with the dark editor ecosystem.
- Preserve accessibility semantics (ARIA labels, focus visibility, keyboard flow).
- Maintain visual consistency across nav/list/editor/inspector surfaces.

### Don’t

- Introduce consumer-marketing visual language into production tooling surfaces.
- Add high-saturation gradients or glassmorphism without explicit product decision.
- Hide critical actions behind ambiguous icon-only affordances.
- Trade clarity for novelty in animation or style experiments.

---

## 9) Agent Prompt Guide (for implementation)

When generating UI in this repository, follow this checklist:

1. Start from existing layout and component primitives.
2. Keep dark theme hierarchy and panel contrast intact.
3. Use violet accent sparingly for primary/active/focus states.
4. Preserve dense-but-readable spacing rhythm.
5. Ensure keyboard and screen-reader affordances remain complete.
6. Validate changes with lint/tests/build as appropriate.

Quick prompt snippet:

> Build this as a dark, professional authoring tool UI for Contour Studio using existing component primitives, subtle panel contrast, clear focus states, and restrained violet accents. Prioritize editability, accessibility, and layout stability over decorative styling.

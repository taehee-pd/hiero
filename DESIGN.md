---
version: alpha
name: Hiero Studio
description: >-
  Dark-first, editor-grade design system for Hiero — a professional icon
  authoring workspace. Inspired by ElevenLabs' multi-layered shadow
  philosophy and typographic restraint. Token values below reflect the
  canonical dark theme; the light theme is documented in prose.
colors:
  primary: "#6DADFF"
  primary-hover: "#8CBFFF"
  primary-soft: "#1E3252"
  neutral: "#0A0A0A"
  neutral-hover: "#1A1F22"
  surface: "#21282D"
  surface-hover: "#2A3136"
  surface-warm: "#29303A"
  foreground: "#FFFFFF"
  foreground-inverse: "#090D10"
  foreground-secondary: "#CBD1D6"
  foreground-tertiary: "#949A9F"
  border: "#33393D"
  border-subtle: "#22282D"
  success: "#4ADE80"
  warning: "#FFB648"
  danger: "#FF6B6B"
typography:
  display-hero:
    fontFamily: Spline Sans
    fontSize: 48px
    fontWeight: 450
    lineHeight: 1.17
    letterSpacing: -0.1875rem
  headline-lg:
    fontFamily: Spline Sans
    fontSize: 24px
    fontWeight: 450
    lineHeight: 1.33
    letterSpacing: -0.10625rem
  body-lg:
    fontFamily: Spline Sans
    fontSize: 15px
    fontWeight: 450
    lineHeight: 1.5625
    letterSpacing: -0.03125rem
  body-md:
    fontFamily: Spline Sans
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.375
    letterSpacing: -0.015625rem
  label-md:
    fontFamily: Spline Sans
    fontSize: 11px
    fontWeight: 550
    lineHeight: 1.0
    letterSpacing: 0.03125rem
  caption:
    fontFamily: Spline Sans
    fontSize: 9px
    fontWeight: 550
    lineHeight: 0.875
    letterSpacing: 0.03125rem
  code:
    fontFamily: Spline Sans Mono
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.5
rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  panel-padding: 12px
  panel-gap: 8px
  section-gap: 12px
  navbar-height: 40px
  toolbar-height-min: 36px
  toolbar-height-max: 40px
  navpane-width-expanded: 200px
  navpane-width-collapsed: 56px
  listpane-width: 260px
  inspector-width: 260px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.foreground-inverse}"
    rounded: "{rounded.full}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.foreground-inverse}"
    rounded: "{rounded.full}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: 12px
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: 12px
  button-accent-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 12px
  button-ghost:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  button-ghost-hover:
    backgroundColor: "{colors.neutral-hover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  icon-button-sm:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    size: 24px
  icon-button-md:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    size: 28px
  icon-button-lg:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    size: 32px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  input-placeholder:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground-tertiary}"
    rounded: "{rounded.md}"
    padding: 8px
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 8px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 12px
  panel-featured:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 12px
  panel-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.md}"
    padding: 12px
  tab-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px
  tab-inactive:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.md}"
    padding: 8px
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  divider-subtle:
    backgroundColor: "{colors.border-subtle}"
    height: 1px
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.foreground-inverse}"
    rounded: "{rounded.full}"
    padding: 4px
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.foreground-inverse}"
    rounded: "{rounded.full}"
    padding: 4px
  badge-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.foreground-inverse}"
    rounded: "{rounded.full}"
    padding: 4px
---

# DESIGN.md — Hiero Studio

This file is a design-system prompt document for coding/design agents.
Use it as the first source when generating or refactoring UI in this repo.

Inspired by ElevenLabs' multi-layered shadow philosophy and typographic
restraint, adapted for Hiero's dark-first professional icon authoring
workspace.

## Overview

- **Product tone:** professional toolsmith + creative precision.
- **Visual style:** dark-first, editor-grade workspace with restrained
  accent color.
- **Density:** medium-dense data tooling (inspector + timeline + panes),
  never cramped.
- **Personality keywords:** focused, technical, calm, deliberate.
- **Signature quality:** surfaces that barely exist — depth through
  whisper-level shadows rather than heavy borders or dramatic elevation.

Design intent:

- Prioritize legibility and editability over decorative visuals.
- Keep interaction chrome minimal so authored icon previews and animation
  behavior remain focal.
- Use multi-layered shadows at sub-0.1 opacity to create surfaces that
  feel present but not heavy — the ElevenLabs principle of "felt rather
  than seen" edges.
- Let typography weight and spacing do the work before reaching for color
  or decoration.

## Colors

The palette is rooted in a high-contrast dark-first neutral system with a
single, restrained blue accent. **Dark is the canonical theme** and its
values are the normative design tokens above. A parallel light theme is
documented at the end of this section for parity.

- **Primary (`#6DADFF`):** A bright editorial blue used exclusively for
  primary actions, focus indicators, and active states on dark surfaces.
- **Primary hover (`#8CBFFF`):** A lifted variant for hover on primary
  CTAs — preserves accent identity while signalling interaction.
- **Primary soft (`#1E3252`):** A deep tinted blue used as
  selected-item background, active pane highlight, and accent badge
  fill. Blue accent text reads cleanly on top.
- **Neutral (`#0A0A0A`):** Shell background — near-black for the
  canonical dark theme.
- **Surface (`#21282D`):** Panel surface tone sitting one step above the
  shell background to establish pane hierarchy. Hover lifts to
  `surface-hover`.
- **Surface warm (`#29303A`):** A warmer, slightly lifted variant of
  surface used for featured CTA areas and hero actions.
- **Foreground (`#FFFFFF`):** Primary text on dark surfaces. Secondary
  (`#CBD1D6`) and tertiary (`#949A9F`) foreground roles step down in
  contrast for metadata and muted labels.
- **Foreground inverse (`#090D10`):** Near-black text used on bright
  fills (primary buttons, success/warning/danger badges).
- **Border (`#33393D`) / border subtle (`#22282D`):** Low-contrast edges
  that define surfaces without adding visual weight.
- **Success (`#4ADE80`) / Warning (`#FFB648`) / Danger (`#FF6B6B`):**
  Semantic hues tuned for dark-surface legibility, paired with
  `foreground-inverse` for badge text.

### Light theme parity

When rendering in light mode, roles flip as follows (prose-documented,
not tokenized — dark is the single source of truth):

| Role                   | Light value                   |
| ---------------------- | ----------------------------- |
| neutral (shell)        | `#FFFFFF`                     |
| surface                | `#F3F7FA`                     |
| surface-warm           | `rgba(243, 247, 250, 0.8)`    |
| foreground             | `#090D10`                     |
| foreground-secondary   | `#3C464D`                     |
| foreground-tertiary    | `#7E8991`                     |
| primary (accent)       | `#3186EE`                     |
| primary-soft           | `rgba(49, 134, 238, 0.08)`    |
| border                 | `rgba(0, 0, 0, 0.05)`         |
| border-subtle          | `rgba(0, 0, 0, 0.06)`         |

### Usage rules

- Reserve strong accent saturation for primary actions, focus
  indicators, and active states.
- Use `primary-soft` for selected-item backgrounds, active pane
  highlights, and hover badges.
- Keep panel/surface hierarchy obvious through tone and border contrast
  before reaching for shadow.
- Use warm surface treatment for featured CTA areas and hero actions.
- Avoid introducing brand-new chroma families unless product direction
  changes.

## Typography

The typography strategy pairs the system sans stack with **Spline Sans**
(Google Fonts, variable weight axis 300–700) for display text and
**Spline Sans Mono** for code and precise numeric values. Both families
are bundled via the `@fontsource-variable/spline-sans` and
`@fontsource-variable/spline-sans-mono` npm packages (self-hosted
variable WOFF2 files that ship the same Google Fonts assets).

- **Display & headlines:** Spline Sans at weight **450** — the Hiero
  equivalent of ElevenLabs' light-weight display approach. Lightness
  creates intrigue through restraint.
- **Body & UI:** System sans stack at weight 450 for standard reading
  and control text.
- **Labels & captions:** Weight **550** with positive letter-spacing for
  airy readability at small sizes.
- **Code & technical values:** Spline Sans Mono, used wherever value
  precision matters.

### Principles

- **Restrained weight as identity:** Hiero uses weight 450 (not bold)
  for display text. The understated weight signals precision and
  professionalism.
- **Positive letter-spacing on small text:** Labels and captions use
  `+0.03125rem` tracking for airy readability at small sizes,
  contrasting with the tighter display tracking.
- **Monospace as ambient:** Spline Sans Mono at relaxed line-height for code
  values feels unhurried.

Do:

- Keep line lengths short in side panes.
- Prefer consistent casing within a panel.

Don't:

- Use oversized marketing-style hero typography inside tool panels.
- Use bold (700) weights for headings — the lighter weight IS the
  identity.

## Layout

Hiero follows a **single-screen, multi-pane studio layout** as the
canonical interaction model. Each pane has a clear responsibility
(navigation, lists, canvas/editor, inspector/export), and pane
dimensions remain stable so content does not jump.

The spacing rhythm is tight inside controls and roomier between semantic
groups. Panel padding is `12px`, panel gap `8px`, section gap `12px`.

### Concrete dimensions

| Element             | Value                         |
| ------------------- | ----------------------------- |
| Navbar height       | `40px`                        |
| Toolbar height      | `36–40px` (responsive clamp)  |
| NavPane expanded    | `200px`                       |
| NavPane collapsed   | `56px`                        |
| ListPane width      | `260px`                       |
| Inspector width     | `260px`                       |
| Panel padding       | `12px`                        |
| Panel gap           | `8px`                         |
| Section gap         | `12px`                        |

### IconButton dimensions

| Size | Frame  | Inner icon |
| ---- | ------ | ---------- |
| sm   | `24px` | `12px`     |
| md   | `28px` | `14px`     |
| lg   | `32px` | `16px`     |

Ghost icon buttons at 28px with 14px icons are the default for
toolbar/navbar actions.

### Range token pattern

When a dimension needs responsive behavior, expose the range as three
tokens: `--<name>-min`, `--<name>` (the `clamp()`), and `--<name>-max`.
The toolbar height is the first instance of this pattern.

### Whitespace philosophy

- **Purposeful breathing room:** Apple-like generosity adapted for
  density — each pane is self-contained with clear internal rhythm.
- **Warm emptiness:** Empty states use subtle dotted backgrounds
  (`.studio-dots`) and muted text rather than harsh blank space.
- **Typography-led rhythm:** The lighter-weight headings create visual
  hierarchy that guides the eye without needing heavy dividers.

### Responsive behavior

- On narrower widths, collapse non-critical panes first
  (NavPane → ListPane).
- Preserve core authoring canvas and essential edit controls.
- Keep destructive or publish actions visible and explicit.

## Elevation & Depth

The shadow system draws from ElevenLabs' refined approach: every shadow
at sub-0.1 opacity, many including both outward cast AND inward inset
components.

### Light mode shadows

```css
--shadow-inset-edge: inset 0 0 0 0.5px rgba(0,0,0,0.06),
                     inset 0 1px 0 rgba(255,255,255,0.7);
--shadow-outline:    0 0 0 1px rgba(0,0,0,0.05),
                     0 1px 2px rgba(0,0,0,0.04);
--shadow-sm:         0 1px 3px rgba(0,0,0,0.06);
--shadow-md:         0 4px 12px rgba(0,0,0,0.08);
--shadow-lg:         0 8px 24px rgba(0,0,0,0.12);
--shadow-panel:      0 12px 32px rgba(0,0,0,0.10);
```

### Dark mode shadows

```css
--shadow-inset-edge: inset 0 0 0 0.5px rgba(255,255,255,0.06),
                     inset 0 1px 0 rgba(255,255,255,0.04);
--shadow-outline:    0 0 0 1px rgba(255,255,255,0.08),
                     0 1px 2px rgba(0,0,0,0.18);
--shadow-sm:         0 1px 3px rgba(0,0,0,0.16);
--shadow-md:         0 4px 12px rgba(0,0,0,0.22);
--shadow-lg:         0 8px 24px rgba(0,0,0,0.28);
--shadow-panel:      0 12px 32px rgba(0,0,0,0.24);
```

### Multi-layer shadow system

| Level               | Treatment                                                               | Use                                |
| ------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| Flat (0)            | No shadow                                                               | Background surfaces, text blocks   |
| Inset edge (0.5)    | `inset 0 0 0 0.5px border, inset 0 1px 0 highlight`                     | Panel internal edge definition     |
| Outline ring (1)    | `0 0 0 1px border, 0 1px 2px ambient`                                   | Shadow-as-border for cards         |
| Elevated (2)        | `0 1px 2px ambient, 0 4px 12px ambient`                                 | Prominent cards, dropdowns         |
| Feature lift (3)    | `0 8px 24px deep, 0 0 0 1px border`                                     | Dialogs, popovers                  |

### Shadow philosophy

- **Inset half-pixel borders:** `0 0 0 0.5px inset` creates edges so
  subtle they are felt rather than seen — surfaces define themselves
  through the lightest possible touch.
- **Combined inset + outset:** Studio panels use both inward glow and
  outward cast to create dimensional surfaces without heavy visual
  weight.
- **Dark mode compensation:** Dark shadows use higher opacity
  (16%–28%) because they compete with a dark canvas. Inset highlights
  shift to very subtle white glows (4%–6%).

## Shapes

Hiero's shape language balances **soft editorial radius** for content
surfaces with **pill shapes** for status and action affordances. Corners
are never sharper than `6px` on interactive elements — generous radius
is structural.

- **Toolbar actions:** `8px` radius — crisp but not hard.
- **Panel navigation:** `14px` radius — noticeably rounded to soften
  dense pane stacks.
- **Pills / badges / primary CTAs:** `9999px` (full pill).
- **Standard inputs:** `8px`; search inputs step up to `10px` for a
  softer silhouette when they sit above a muted surface.

## Components

### Buttons

**Primary pill**

- Background: primary.
- Text: primary foreground (near-white).
- Radius: full pill (`9999px`) for primary CTAs.
- Shadow: `0 1px 2px ambient, inset 0 1px 0 rgba(255,255,255,0.12)`.

**Secondary pill (shadow-bordered)**

- Background: card surface.
- Text: foreground.
- Radius: full pill.
- Shadow: `0 0 0 1px border, 0 1px 3px ambient`.
- No explicit border — shadow-as-border for lightweight feel.

**Accent soft pill**

- Background: `primary-soft` (translucent accent).
- Text: primary.
- Radius: full pill.
- Shadow: `0 0 0 0.5px primary inset` (half-pixel inset border).
- Use: featured badge, selected state indicator.

**Ghost button**

- Border: `1px solid transparent`.
- On hover: `border-color: border; background: background-hover`.
- Radius: `8px` for toolbar actions, `14px` for panel nav.

### Inputs & form controls

- Dark surfaces with clear border delineation.
- Strong keyboard focus ring:
  `0 0 0 3px color-mix(in srgb, primary 18%, transparent)`.
- Placeholder text must remain distinguishable from real values.
- Radius: `8px` for standard inputs, `10px` for search inputs.
- Search inputs: inset icon, subtle background (`background/60`).

### Panels & cards

- Maintain consistent internal spacing rhythm (panel padding `12px`).
- Avoid deep nested card stacks unless information architecture
  requires them.
- Panel hover: shift from Level 1 to Level 2 shadow; border-color shifts
  from `border` to `border-secondary`.

### Navigation and tabs

- Active state should be unambiguous: `primary-soft` background +
  `primary` text + optional accent marker.
- Hover states are subtle (background-hover); active states are
  explicit (primary-soft).
- Selected project item in NavPane:
  `bg-primary/10 font-medium text-primary` (current).

### Motion & interaction feedback

Motion communicates state change, not decoration. Transitions stay
short and utility-like for editor responsiveness.

| Interaction                 | Duration  | Easing        |
| --------------------------- | --------- | ------------- |
| Button hover/active         | `120ms`   | `ease`        |
| Panel border/shadow shift   | `160ms`   | `ease`        |
| NavPane collapse/expand     | `200ms`   | CSS transition|
| Dialog enter                | `150ms`   | `ease-out`    |
| Toast/error enter           | `200ms`   | `ease-out`    |
| Scrollbar fade              | Instant   | —             |

Feedback patterns:

- **Save status:** Badge shifts from muted to amber (unsaved) —
  immediate visual signal.
- **Hover elevation:** Cards shift one shadow level up on hover
  (Level 1 → Level 2).
- **Focus ring:**
  `0 0 0 3px color-mix(in srgb, primary 18%, transparent)` — visible
  but not harsh.
- **Error toast:** Red border + background, fixed positioned,
  auto-dismiss after 3s.
- Keyboard accessibility and focus management are first-class behavior.

## Do's and Don'ts

### Do

- Reuse existing shadcn/Radix-based primitives and current component
  patterns.
- Keep UI changes consistent with the dark editor ecosystem.
- Preserve accessibility semantics (ARIA labels, focus visibility,
  keyboard flow).
- Maintain visual consistency across nav/list/editor/inspector
  surfaces.
- Use multi-layer shadows (inset + outline + elevation) at sub-0.1
  opacity for surfaces.
- Use `primary-soft` for selected/active item backgrounds.
- Use pill shapes (`9999px`) for badges, status indicators, and
  primary CTA buttons.
- Keep font weight restrained — 450 for body, 550 for emphasis. Never
  700 for headings.

### Don't

- Introduce consumer-marketing visual language into production tooling
  surfaces.
- Add high-saturation gradients or glassmorphism without explicit
  product decision.
- Hide critical actions behind ambiguous icon-only affordances.
- Trade clarity for novelty in animation or style experiments.
- Use heavy shadows (>0.12 opacity in light mode) — the refined
  quality requires whisper-level depth.
- Use sharp corners (<6px radius) on interactive elements — generous
  radius is structural.
- Use bold (700) display headings — the lighter weight signals
  professional restraint.
- Skip the inset shadow component on panels — half-pixel inset borders
  define edges.

## Agent Prompt Guide

When generating UI in this repository, follow this checklist:

1. Start from existing layout and component primitives (`shadcn/ui`,
   `studio-*`, `workspace-*` classes).
2. Keep dark theme hierarchy and panel contrast intact.
3. Use blue accent (`primary`) sparingly for primary/active/focus
   states.
4. Use `primary-soft` for selected backgrounds and accent badges.
5. Preserve dense-but-readable spacing rhythm (12px panel padding, 8px
   gaps).
6. Apply multi-layer shadows: combine inset edge + outline + elevation
   at sub-0.1 opacity.
7. Use pill radius (`9999px`) for badges and primary CTAs; `8px`–
   `14px` for panels/buttons.
8. Keep display text at weight 450; label text at weight 550 with
   positive letter-spacing.
9. Ensure keyboard and screen-reader affordances remain complete.
10. Validate changes with lint/tests/build as appropriate.

### Example component prompts

- "Create a panel header: 13px system font weight 550, uppercase
  tracking `+0.03125rem`, muted foreground color. Panel uses
  multi-layer shadow: `inset 0 0 0 0.5px border, 0 1px 2px ambient`.
  Padding 12px."
- "Design a project list item: 12px system font weight 450, rounded-lg
  (8px). Active state: `bg-primary/10 text-primary font-medium`.
  Hover: `bg-accent text-foreground`. Include folder icon at 14px and
  count badge at 10px muted."
- "Build an icon grid card: square aspect ratio, rounded-xl (14px),
  multi-layer shadow on hover. Icon preview centered with 60%
  padding. Name below at 10px truncated. Active state: blue ring
  `0 0 0 2px primary`."
- "Create a navbar: h-10, border-b at `border/70`, background. Project
  name at 13px font-semibold, save badge as pill (9999px) with amber
  tint when unsaved. Right side: ghost icon buttons at 28px with 14px
  icons."

### Quick prompt snippet

> Build this as a dark, professional authoring tool UI for Hiero Studio
> using existing component primitives, whisper-level multi-layer
> shadows, clear focus states, and restrained blue accents. Use weight
> 450 for body text and 550 for labels. Apply pill radius for badges
> and primary buttons. Prioritize editability, accessibility, and
> layout stability over decorative styling.

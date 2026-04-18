# DESIGN.md — Cuneiform Studio

This file is a design-system prompt document for coding/design agents.
Use it as the first source when generating or refactoring UI in this repo.

Inspired by ElevenLabs' multi-layered shadow philosophy and typographic restraint,
adapted for Cuneiform's dark-first professional icon authoring workspace.

---

## 1) Visual Theme & Atmosphere

- **Product tone:** professional toolsmith + creative precision.
- **Visual style:** dark-first, editor-grade workspace with restrained accent color.
- **Density:** medium-dense data tooling (inspector + timeline + panes), never cramped.
- **Personality keywords:** focused, technical, calm, deliberate.
- **Signature quality:** surfaces that barely exist — depth through whisper-level
  shadows rather than heavy borders or dramatic elevation.

Design intent:
- Prioritize legibility and editability over decorative visuals.
- Keep interaction chrome minimal so authored icon previews and animation behavior remain focal.
- Use multi-layered shadows at sub-0.1 opacity to create surfaces that feel present
  but not heavy — the ElevenLabs principle of "felt rather than seen" edges.
- Let typography weight and spacing do the work before reaching for color or decoration.

---

## 2) Color Palette & Roles

> Prefer existing Tailwind utility classes and tokens already used in the codebase.

### Core semantic roles

| Role | Light | Dark | Token |
|------|-------|------|-------|
| Background / shell | `#FFFFFF` | `#0A0A0A` | `--background` |
| Panel surface | `#F3F7FA` | `--greyscale-700` | `--background-secondary` |
| Warm surface (feature CTA) | `rgba(243, 247, 250, 0.8)` | `rgba(33, 40, 45, 0.8)` | `--surface-warm` |
| Text primary | `#090D10` | `#FFFFFF` | `--foreground` |
| Text secondary | `#3C464D` | `#CBD1D6` | `--foreground-secondary` |
| Text tertiary / muted | `#7E8991` | `#7E8991` | `--foreground-tertiary` |
| Border / separators | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.20)` | `--border` |
| Border subtle | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` | `--border-subtle` |
| Accent (brand/action) | `#3186EE` (blue-400) | `#6DADFF` (blue-300) | `--primary` |
| Accent soft | `rgba(49,134,238,0.08)` | `rgba(109,173,255,0.12)` | `--primary-soft` |
| Success / warning / danger | Standard semantic hues | Accessibility-safe contrast | See token system |

### Usage rules

- Reserve strong accent saturation for primary actions, focus indicators, and active states.
- Use `--primary-soft` for selected-item backgrounds, active pane highlights, hover badges.
- Keep panel/surface hierarchy obvious through tone and border contrast before using shadow.
- Use warm surface treatment (`--surface-warm`) for featured CTA areas and hero actions.
- Avoid introducing brand-new chroma families unless product direction changes.

---

## 3) Typography Rules

- **Primary UI font:** system sans stack (matching current app behavior).
- **Display font:** Geist Sans at weight 450 (default) — the Cuneiform equivalent of
  ElevenLabs' light-weight display approach. Lightness creates intrigue through restraint.
- **Code / technical values:** Geist Mono where value precision matters.
- **Hierarchy strategy:** compact utility-app scale, clear contrast between section titles, labels, and value text.

### Concrete scale

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display hero | `3rem` (48px) | 450 | 1.17 (tight) | `-0.1875rem` | Workspace heading, sparse use |
| Section heading | `1.5rem` (24px) | 450 | 1.33 | `-0.10625rem` | Panel titles |
| Body large | `0.9375rem` (15px) | 450 | 1.5625 | `-0.03125rem` | Introductions, descriptions |
| Body / UI | `0.8125rem` (13px) | 450 | 1.375 | `-0.015625rem` | Standard reading text |
| Label / control | `0.6875rem` (11px) | 550 | 1.0 | `+0.03125rem` | Control labels, kickers |
| Caption / metadata | `0.5625rem` (9px) | 550 | 0.875 | `+0.03125rem` | Tiny labels, tags |

### Principles
- **Restrained weight as identity**: Like ElevenLabs' Waldenburg 300, Cuneiform uses weight
  450 (not bold) for display text. The understated weight signals precision and professionalism.
- **Positive letter-spacing on small text**: Labels and captions use +0.03125rem tracking
  for airy readability at small sizes, contrasting with the tighter display tracking.
- **Monospace as ambient**: Geist Mono at relaxed line-height for code values feels unhurried.

Do:
- Keep line lengths short in side panes.
- Prefer consistent casing within a panel.

Don't:
- Use oversized marketing-style hero typography inside tool panels.
- Use bold (700) weights for headings — the lighter weight IS the identity.

---

## 4) Component Stylings

### Buttons

**Primary pill**
- Background: `var(--primary)`
- Text: `var(--primary-foreground)`
- Radius: `9999px` (full pill) for primary CTAs
- Shadow: `0 1px 2px var(--darker-100), inset 0 1px 0 rgba(255,255,255,0.12)`

**Secondary pill (shadow-bordered)**
- Background: `var(--card)`
- Text: `var(--foreground)`
- Radius: `9999px`
- Shadow: `0 0 0 1px var(--border), 0 1px 3px var(--darker-100)`
- No explicit border — shadow-as-border for lightweight feel

**Accent soft pill**
- Background: `var(--primary-soft)` (translucent accent)
- Text: `var(--primary)`
- Radius: `9999px`
- Shadow: `0 0 0 0.5px var(--primary) inset` (half-pixel inset border)
- Use: Featured badge, selected state indicator

**Ghost button**
- Border: 1px solid transparent
- On hover: `border-color: var(--border); background: var(--background-hover)`
- Radius: `0.5rem` (8px) for toolbar actions, `0.875rem` (14px) for panel nav

### Inputs & form controls

- Dark surfaces with clear border delineation.
- Strong keyboard focus ring: `0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)`.
- Placeholder text must remain distinguishable from real values.
- Radius: `0.5rem` (8px) for standard inputs, `0.625rem` (10px) for search inputs.
- Search inputs: inset icon, subtle background (`var(--background)/60`).

### Panels & cards

**Multi-layer shadow system** (adapted from ElevenLabs):

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | Background surfaces, text blocks |
| Inset edge (Level 0.5) | `0 0 0 0.5px var(--border) inset, 0 0 0 1px var(--lighter-700) inset` | Panel internal edge definition |
| Outline ring (Level 1) | `0 0 0 1px var(--border), 0 1px 2px var(--darker-100)` | Shadow-as-border for cards |
| Elevated (Level 2) | `0 1px 2px var(--darker-100), 0 4px 12px var(--darker-100)` | Prominent cards, dropdowns |
| Feature lift (Level 3) | `0 8px 24px var(--darker-200), 0 0 0 1px var(--border)` | Dialogs, popovers |

- Maintain consistent internal spacing rhythm (`var(--panel-padding)` = 12px).
- Avoid deep nested card stacks unless information architecture requires them.
- Panel hover: shift from Level 1 to Level 2 shadow, border-color from `--border` to `--border-secondary`.

### Navigation and tabs

- Active state should be unambiguous: `var(--primary-soft)` background + `var(--primary)` text + optional accent marker.
- Hover states are subtle (background-hover); active states are explicit (primary-soft).
- Selected project item in NavPane: `bg-primary/10 font-medium text-primary` (current).

---

## 5) Layout Principles

- Single-screen, multi-pane studio layout is the canonical interaction model.
- Preserve clear pane responsibilities (navigation, lists, canvas/editor, inspector/export).
- Favor stable pane dimensions; avoid content jumps.
- Use predictable spacing increments (tight in controls, roomier between semantic groups).

### Concrete dimensions

| Element | Value | CSS token |
|---------|-------|-----------|
| Navbar height | `40px` (h-10) | `--navbar-height` |
| Toolbar height | `36–40px` (responsive clamp) | `--toolbar-height` (`--toolbar-height-min` / `--toolbar-height-max`) |
| NavPane expanded | `200px` | `--navpane-width-expanded` |
| NavPane collapsed | `56px` (w-14) | `--navpane-width-collapsed` |
| ListPane width | `260px` | `--listpane-width` |
| Inspector width | `260px` | `--inspector-width` |
| Panel padding | `12px` | `--panel-padding` |
| Panel gap | `8px` | `--panel-gap` |
| Section gap | `12px` | `--section-gap` |

### IconButton dimensions

| Size | Frame | Inner icon | CSS tokens |
|------|-------|------------|------------|
| sm | `24px` | `12px` | `--button-icon-size-sm` / `--icon-inner-size-sm` |
| md | `28px` | `14px` | `--button-icon-size-md` / `--icon-inner-size-md` |
| lg | `32px` | `16px` | `--button-icon-size-lg` / `--icon-inner-size-lg` |

Ghost icon buttons at 28px with 14px icons are the default for toolbar/navbar actions.

### Radii

| Context | Value | CSS token |
|---------|-------|-----------|
| Toolbar action | `0.5rem` (8px) | `--radius-toolbar-action` |
| Panel navigation | `0.875rem` (14px) | `--radius-panel-nav` |
| Pill / badge | `9999px` | `--radius-pill` |
| Standard input | `0.5rem` (8px) | `--radius-input` |
| Search input | `0.625rem` (10px) | `--radius-search` |

### Range token pattern

When a dimension needs responsive behavior, expose the range as three
tokens: `--<name>-min`, `--<name>` (the `clamp()`), and `--<name>-max`.
The toolbar height is the first instance of this pattern.

### Whitespace philosophy
- **Purposeful breathing room**: Like ElevenLabs' Apple-like generosity but adapted for
  density — each pane is self-contained with clear internal rhythm.
- **Warm emptiness**: Empty states use subtle dotted backgrounds (`.studio-dots`) and
  muted text rather than harsh blank space.
- **Typography-led rhythm**: The lighter-weight headings create visual hierarchy that
  guides the eye without needing heavy dividers.

### Responsive behavior intent

- On narrower widths, collapse non-critical panes first (NavPane → ListPane).
- Preserve core authoring canvas and essential edit controls.
- Keep destructive or publish actions visible and explicit.

---

## 6) Depth & Elevation

The shadow system draws from ElevenLabs' refined approach: every shadow at sub-0.1
opacity, many include both outward cast AND inward inset components.

### Light mode shadows

```css
--shadow-inset-edge: inset 0 0 0 0.5px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7);
--shadow-outline:    0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm:         0 1px 3px rgba(0,0,0,0.06);
--shadow-md:         0 4px 12px rgba(0,0,0,0.08);
--shadow-lg:         0 8px 24px rgba(0,0,0,0.12);
--shadow-panel:      0 12px 32px rgba(0,0,0,0.10);
```

### Dark mode shadows

```css
--shadow-inset-edge: inset 0 0 0 0.5px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04);
--shadow-outline:    0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.18);
--shadow-sm:         0 1px 3px rgba(0,0,0,0.16);
--shadow-md:         0 4px 12px rgba(0,0,0,0.22);
--shadow-lg:         0 8px 24px rgba(0,0,0,0.28);
--shadow-panel:      0 12px 32px rgba(0,0,0,0.24);
```

### Shadow philosophy
- **Inset half-pixel borders**: `0 0 0 0.5px inset` creates edges so subtle they're
  felt rather than seen — surfaces define themselves through the lightest possible touch.
- **Combined inset + outset**: Studio panels use both inward glow and outward cast to
  create dimensional surfaces without heavy visual weight.
- **Dark mode compensation**: Dark shadows use higher opacity (16%–28%) since they compete
  with a dark canvas. Inset highlights shift to very subtle white glows (4%–6%).

---

## 7) Motion & Interaction Feedback

- Motion should communicate state change, not decorate.
- Keep transitions short and utility-like for editor responsiveness.

### Concrete timing

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Button hover/active | `120ms` | `ease` |
| Panel border/shadow shift | `160ms` | `ease` |
| NavPane collapse/expand | `200ms` | CSS transition |
| Dialog enter | `150ms` | `ease-out` |
| Toast/error enter | `200ms` | `ease-out` |
| Scrollbar fade | Instant | — |

### Feedback patterns
- **Save status**: Badge shifts from muted to amber (unsaved) — immediate visual signal.
- **Hover elevation**: Cards shift one shadow level up on hover (Level 1 → Level 2).
- **Focus ring**: `0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)` — visible but not harsh.
- **Error toast**: Red border + background, fixed positioned, auto-dismiss after 3s.
- Keyboard accessibility and focus management are first-class behavior.

---

## 8) Do / Don't Guardrails

### Do

- Reuse existing shadcn/Radix-based primitives and current component patterns.
- Keep UI changes consistent with the dark editor ecosystem.
- Preserve accessibility semantics (ARIA labels, focus visibility, keyboard flow).
- Maintain visual consistency across nav/list/editor/inspector surfaces.
- Use multi-layer shadows (inset + outline + elevation) at sub-0.1 opacity for surfaces.
- Use `var(--primary-soft)` for selected/active item backgrounds.
- Use pill shapes (`9999px`) for badges, status indicators, and primary CTA buttons.
- Keep font weight restrained — 450 for body, 550 for emphasis. Never 700 for headings.

### Don't

- Introduce consumer-marketing visual language into production tooling surfaces.
- Add high-saturation gradients or glassmorphism without explicit product decision.
- Hide critical actions behind ambiguous icon-only affordances.
- Trade clarity for novelty in animation or style experiments.
- Use heavy shadows (>0.12 opacity in light mode) — the refined quality requires whisper-level depth.
- Use sharp corners (<6px radius) on interactive elements — generous radius is structural.
- Use bold (700) display headings — the lighter weight signals professional restraint.
- Skip the inset shadow component on panels — half-pixel inset borders define edges.

---

## 9) Agent Prompt Guide (for implementation)

When generating UI in this repository, follow this checklist:

1. Start from existing layout and component primitives (`shadcn/ui`, `studio-*`, `workspace-*` classes).
2. Keep dark theme hierarchy and panel contrast intact.
3. Use blue accent (`--primary`) sparingly for primary/active/focus states.
4. Use `--primary-soft` for selected backgrounds and accent badges.
5. Preserve dense-but-readable spacing rhythm (12px panel padding, 8px gaps).
6. Apply multi-layer shadows: combine inset edge + outline + elevation at sub-0.1 opacity.
7. Use pill radius (`9999px`) for badges and primary CTAs; `0.5rem`–`0.875rem` for panels/buttons.
8. Keep display text at weight 450; label text at weight 550 with positive letter-spacing.
9. Ensure keyboard and screen-reader affordances remain complete.
10. Validate changes with lint/tests/build as appropriate.

### Quick color reference

| Purpose | Light | Dark |
|---------|-------|------|
| Background | `#FFFFFF` | `#0A0A0A` |
| Surface | `#F3F7FA` | `#21282D` |
| Warm surface | `rgba(243,247,250,0.8)` | `rgba(33,40,45,0.8)` |
| Text | `#090D10` | `#FFFFFF` |
| Text secondary | `#3C464D` | `#CBD1D6` |
| Text muted | `#7E8991` | `#7E8991` |
| Accent | `#3186EE` | `#6DADFF` |
| Accent soft | `rgba(49,134,238,0.08)` | `rgba(109,173,255,0.12)` |
| Border | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.20)` |
| Border subtle | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` |

### Example component prompts

- "Create a panel header: 13px system font weight 550, uppercase tracking +0.03125rem, muted foreground color. Panel uses multi-layer shadow: `inset 0 0 0 0.5px var(--border), 0 1px 2px var(--darker-100)`. Padding 12px."
- "Design a project list item: 12px system font weight 450, rounded-lg (8px). Active state: `bg-primary/10 text-primary font-medium`. Hover: `bg-accent text-foreground`. Include folder icon at 14px and count badge at 10px muted."
- "Build an icon grid card: square aspect ratio, rounded-xl (14px), multi-layer shadow on hover. Icon preview centered with 60% padding. Name below at 10px truncated. Active state: blue ring `0 0 0 2px var(--primary)`."
- "Create a navbar: h-10, border-b at `--border/70`, background. Project name at 13px font-semibold, save badge as pill (9999px) with amber tint when unsaved. Right side: ghost icon buttons at 28px with 14px icons."

### Quick prompt snippet

> Build this as a dark, professional authoring tool UI for Cuneiform Studio using existing
> component primitives, whisper-level multi-layer shadows, clear focus states, and restrained
> blue accents. Use weight 450 for body text and 550 for labels. Apply pill radius for badges
> and primary buttons. Prioritize editability, accessibility, and layout stability over
> decorative styling.

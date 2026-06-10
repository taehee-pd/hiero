# Product

## Register

product

## Users

Hiero is for designers and design-system maintainers who author, animate, and
publish production icons. They work in a desktop-class, pointer-precise editor
where canvas fidelity, repeatable controls, and quick project navigation matter
more than marketing flourish.

## Product Purpose

Hiero exists to make production-ready icon creation and distribution feel like
one continuous workflow. Success means a designer can edit, animate, save, and
publish an icon without developer handoff, while developers can consume the
output through package and platform-native formats.

## Brand Personality

Focused, technical, calm, deliberate. The interface should feel like an
editor-grade instrument: quiet enough to disappear during repeated work, precise
enough to earn trust, and visually distinctive through structure rather than
decoration.

## Anti-references

Avoid generic AI-generated product chrome: one-sided accent borders on rounded
containers, decorative radial gradients, glassy cards as a default surface,
over-rounded panels, border-plus-shadow ghost cards, and ornamental effects that
compete with authored icon content.

## Design Principles

- Make the canvas and authored icon content the focal point.
- Use structure, density, and consistent controls before decoration.
- Keep accent color reserved for selection, focus, and state.
- Treat panes, toolbars, and inspectors as one coherent instrument.
- Prefer reusable design-system components and tokens over local visual one-offs.

## Accessibility & Inclusion

Target WCAG AA for contrast, keyboard access, focus visibility, and reduced
motion. Preserve the existing commitment to readable contrast, screen-reader
labels for icon-only actions, and `prefers-reduced-motion` alternatives for
preview and interaction motion.

## Positioning & Sustainability

**Why this exists in two years:** Hiero is the repo-native icon pipeline for
design-system teams — the tool that turns "designer exports SVGs, developer
hand-wires animations" into "the icon set is a versioned, animated package the
app imports." The moat is not drawing tools (Figma owns that); it is the
SF Symbols-grade animation engine plus the publish pipeline (Git PR, npm,
compiled runtime) that no icon tool ships end-to-end.

**Operating model (current bet):** open-core, team-funded. The public Studio,
runtime, and CLI stay free and open — adoption of the runtime format is the
asset. If sustainability requires revenue, the credible tiers are (in order of
fit): hosted team workspaces with shared libraries and access control, a
managed publish service (provenance-signed releases, registry hosting), and
support contracts for design-system teams. These are additive services around
the open format, never a paywall in front of authoring or rendering.

**What this gates:** real-time collaboration, team workspaces, and accounts
are only worth building on top of the hosted tier. Until that bet is made,
collaboration investment goes to the cheap asynchronous loop instead:
shareable read-only preview links and Git-based review. (See
docs_canonical/IMPROVEMENT_BACKLOG.md items C1/C2.)

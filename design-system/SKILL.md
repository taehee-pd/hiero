---
name: hiero-design
description: Use this skill to generate well-branded interfaces and assets for Hiero (an icon authoring studio with SF Symbols-grade animation capabilities), either for production or throwaway prototypes / mocks / decks. Contains essential design guidelines, color and type tokens, fonts, logo assets, and UI kit components for prototyping against the Hiero Studio workspace.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map

- `colors_and_type.css` — import this first; provides all tokens (`--primary`, `--foreground`, `--shadow-outline`, etc.) and semantic type classes (`.type-display`, `.type-h1`, `.type-body`, `.type-mono`, `.type-label`, `.type-caption`).
- `assets/` — design-system glyph mirror (`hiero.svg`) and generic placeholders. The production app logo is `../public/hiero.svg`.
- `ui_kits/studio/` — React recreation of the 3-pane studio workspace (Navbar / NavPane / ListPane / Editor). Open `index.html` for a live interactive reference.
- `preview/` — individual token / component specimen cards.
- `_src/components/` — verbatim snapshots of the original DS + studio components. Consult for exact behavior or copywriting.

## Hard brand rules (do not violate)

- **No emoji anywhere.** No exclamation points in UI copy.
- **Never use font-weight 700.** Body and display are **450**. Labels and emphasis are **550**.
- **Single accent color.** Lilac purple `#a885f2` in light and dark mode, with black foreground on brand surfaces. No gradients, no glass, no off-brand chroma.
- **Dark-first.** Design in dark mode unless asked; use `rgba(255,255,255,α)` hovers instead of tinted solids.
- **Icons:** Lucide at stroke-width 2, 14–20px. No hand-drawn SVGs for UI glyphs.
- **Copy is functional, not persuasive.** `Select an icon to start editing`, not "Click here to get started!" Kbd hints are compact: `⌘S`, `⇧⌘Z`, `?`.

## Brand mark usage

- Use `../public/hiero.svg` for the production application logo definition: 24 × 24 stroked SVG, 1px strokes, embedded light/dark `prefers-color-scheme` stroke colors for standalone use. In chrome, mask it and fill from the foreground token/current text color.
- Use `assets/hiero.svg` for design-system previews and exported static artifacts that need the same 24 × 24 glyph with `currentColor` strokes.
- Treat the logo as identity chrome, not as a product-authored icon. User icon previews should still come from `<HieroIcon>`.

When in doubt, open a component in `_src/` and copy its exact copy / structure.

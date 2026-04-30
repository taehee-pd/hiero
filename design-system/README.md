# Hiero Design System

> **Product tone:** professional toolsmith + creative precision.
> **Visual style:** dark-first, editor-grade workspace with restrained lilac purple accent.

Hiero is a Next.js-based **icon authoring studio** with SF Symbols-grade animation capabilities. It provides a single-screen workspace for creating, animating, and distributing production-ready icons — with two-lane distribution (live sync + versioned release), Figma import, and a canonical GitHub PR sync pipeline.

This folder is the design system distilled from the Hiero codebase. It is cross-compatible with Agent Skills — see `SKILL.md`.

---

## Source

- **Codebase:** `github.com/taehee-pd/icon-authoring-tool` (private)
- **Design SSOT in repo:** `DESIGN.md` (agent-facing prompt) + `app/globals.css` (primitive + semantic tokens)
- **Design-system components in repo:** `components/ds/` — StatusBadge, Tag, KbdHint, ColorField, IconButton, ColorPicker
- **Product shell in repo:** `components/studio/` — StudioLayout, Navbar, NavPane, ListPane

A snapshot of the live DS components and studio shell lives in `_src/` for reference.

---

## Index

| Path | What |
|------|------|
| `README.md` | This file — context, content and visual foundations, iconography |
| `SKILL.md` | Agent Skill manifest |
| `colors_and_type.css` | All tokens + semantic type classes. Import this first. |
| `fonts/` | Optional local variable WOFF2 fallbacks. By default `colors_and_type.css` `@import`s Instrument Sans + Geist Mono from Google Fonts; drop locally hosted WOFF2s here only for fully offline use. |
| `assets/` | Hiero mark, wordmark, placeholders |
| `preview/` | Design-system card specimens registered in the review pane |
| `ui_kits/studio/` | High-fidelity React recreation of the Hiero Studio workspace |
| `_src/` | Snapshots of the original DS + studio components (reference only) |

---

## Content Fundamentals

Hiero's copy is **functional, precise, and unhurried** — a professional tool speaking to a professional user. Marketing warmth is absent; utility-app clarity dominates. Examples from the actual product:

- **Titles are verbs or nouns, never slogans:** "New Project", "Import Icons", "Export Lottie JSON", "Open Project".
- **Micro-copy states, never persuades:** `Select an icon to start editing`, `Select a project to get started`, `No results found.`, `Your current workspace has unsaved changes.`
- **Status is literal:** `Saved`, `Saved 12s ago`, `Unsaved`. Never "Everything is safe!"
- **Second person, minimal:** Used only in confirmations — "Your current workspace…". No "we" or "I". No faux-friendly.
- **Sentence case for controls, Title Case for brand/menu labels:** menu items like `New Project`, `Open Project`, `Keyboard Shortcuts`. Panel titles use Title Case ("Projects", "Distribution"). Body descriptions are sentence case.
- **Technical terms are unapologetic:** icon/variant/state/layer/transition, manifest, compiled, Lottie, PR sync, package version. Users are builders; don't translate.
- **Numerical fact over adjective:** "`< 10KB` gzipped", "`< 2KB` per-icon", "200ms panel collapse", not "fast" or "lightweight".
- **No emoji.** Anywhere. No exclamation points in UI copy.
- **Kbd hints are platform-aware and compact:** `⌘S`, `⇧⌘Z`, `?`. Never "Press Command-S to save".
- **Errors are short, amber-colored, auto-dismiss:** `Invalid Hiero workspace file.`, `Failed to parse JSON file.`

**Voice cheatsheet**

| Do | Don't |
|----|-------|
| `Start a new project?` | `Ready to create something new?` |
| `Delete "Media icons" with 24 icons?` | `Are you sure you want to delete this?` |
| `Select an icon to start editing` | `Click an icon to get started!` |
| `React library (.zip)` | `Download your beautiful React icons ✨` |

---

## Visual Foundations

The signature quality is **surfaces that barely exist** — depth through whisper-level multi-layered shadows rather than heavy borders or dramatic elevation. Inspired by ElevenLabs' typographic restraint, adapted for a dark-first workspace.

### Colors
- **Primitives** are an 8-stop greyscale, lilac-violet scale (100–800, brand accent, hue locked at ~290), legacy blue scale (100–800), and semantic red/green/yellow, plus teal for charts.
- **Accent is a single lilac-violet** — `#a885f2` (`--purple-400`) in BOTH light and dark mode, paired with **black foreground** on the brand surface. Contrast ratio ~6.7:1 — passes WCAG AA. The light brand reads as a confident accent on either background; one canonical color across modes keeps brand recognition tight. Used only for primary action, focus ring, active states, selected-item backgrounds (via the auto-derived translucent `--primary-soft`, defined as `color-mix(in srgb, var(--primary) <8|14>%, transparent)` so any future brand tweak propagates).
- **No secondary brand color.** Never multi-hue gradients, never glassmorphism.
- **Alpha-over-tint:** borders and hovers use `rgba(0,0,0,α)` / `rgba(255,255,255,α)` overlays rather than tinted solids — keeps panel hierarchy honest in both modes.

### Typography
- **Instrument Sans** at weight **450** for body and display. `550` for labels and emphasis. **Never 700.** The understated weight *is* the identity — lightness reads as precision.
- **Geist Mono** for values that need precision (hex colors, numeric inputs, keyboard shortcuts, code blocks).
- **Compact tool-app scale:** body is 13px, labels 11px, captions 9px. Display is 48px but used sparingly.
- **Negative tracking on display sizes** (`-0.1875rem` at 48px) paired with **positive tracking on small text** (`+0.03125rem` at 9–11px). Tight up top, airy at the bottom.

### Spacing & Layout
- **4px grid** — tokens are `--space-1..8`. Most UI snaps to 4/8/12/16.
- **Single-screen multi-pane studio layout** is canonical. NavPane (200px) → ListPane (260px) → Canvas (flex) → Inspector (260px). Navbar is a fixed 40px.
- **Stable pane dimensions.** Content never jumps; pane collapse is the only responsive strategy (NavPane collapses to 56px first, then ListPane hides).
- **Panel padding 12px, panel gap 8px.**

### Borders & Radii
- **Shadow-as-border** for cards: `0 0 0 1px var(--border), 0 1px 2px var(--darker-100)` — no explicit 1px solid. Lighter feel.
- **Half-pixel inset edges** on panels (`inset 0 0 0 0.5px`) — "felt rather than seen".
- **Radii:** 8px for inputs/toolbar actions, 10px for search, 14px for panel nav, `9999px` for pills (primary CTAs, badges, status chips).

### Shadows & Elevation (multi-layer, sub-0.1 opacity)
1. **Flat** — no shadow. Backgrounds, text.
2. **Inset edge** — panel internal definition.
3. **Outline ring** — cards at rest. Shadow-as-border.
4. **Elevated** — dropdowns, prominent cards. Add 4–12px cast.
5. **Feature lift** — dialogs, popovers. 8–24px + border ring.

Hover shifts **one level up** (Level 1 → 2). Never dramatic.

### Backgrounds
- **Solid colors**, not gradients. The body has one subtle radial tint on top (`color-mix(in srgb, var(--primary) 8%, transparent)`) blending into `--background` — barely visible, adds warmth.
- **Dotted empty states** (`studio-dots` class: `radial-gradient(var(--darker-200) 0.8px, transparent 0.8px)` at 14px spacing) instead of blank or stock imagery.
- **No background images, no hand-drawn illustrations, no photography.**

### Motion
- **Snappy 50ms** for nearly all UI transitions — tooltips, popovers, hovers, toggles, panel border/shadow shifts. `--default-transition-duration: 50ms` overrides Tailwind's 150ms baseline.
- **200ms** for structural collapses (NavPane).
- **150ms ease-out** for dialog enter, **200ms ease-out** for toast enter.
- **No bounces, no overshoots, no decorative animation** in chrome. Icon-playback animations are the visible motion; everything around them is instant.
- `prefers-reduced-motion` collapses all transitions to 0.01ms.

### Interaction States
- **Hover:** subtle — `var(--background-hover)` (10% black in light, 40% white in dark) or a one-level shadow step.
- **Active/Selected:** explicit — `var(--primary-soft)` background + `var(--primary)` text + optional 1px colored ring.
- **Focus:** `0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)` — visible but not harsh. Always present, never suppressed.
- **Press:** no shrink, no scale — color shift only.
- **Disabled:** 40% opacity, `pointer-events: none`.

### Transparency & Blur
- Used for **vibrancy backdrops** only: `--bg-sidebar: rgba(246,246,246,0.72)` with `backdrop-filter: blur(22px)`. Applied to sidebar/toolbar surfaces to create depth without shadows.
- Popovers and error toasts get `backdrop-filter: blur(18px)`.
- **Never** on buttons, badges, or content cards.

### Cards
```css
border: 1px solid var(--border);
background: var(--card);
box-shadow: var(--shadow-outline);       /* at rest */
/* on hover: border-secondary + shadow-md */
```
Rounded at 10–14px depending on context. Content gets `--panel-padding` (12px).

### Layout Rules
- Navbar is sticky 40px at top. Nothing floats over it.
- Pane borders are `1px solid var(--border-subtle)` — not `var(--border)` — so the seams are softer than content borders.
- **No fixed-position floating actions** except: dock toolbar (centered, bottom 14px), error toast (top 16px, centered).
- Selections never use 100% saturation fills — always `primary-soft` + colored 1px ring or inset.

### Do / Don't
**Do:** multi-layer whisper shadows, 450/550 weights, pill shapes for badges + primary CTAs, `--primary-soft` for selected states, sentence case for controls, alpha overlays for borders.
**Don't:** bold headings (700), sharp corners on interactive elements (<6px), glassmorphism, saturated gradients, emoji, heavy shadows (>0.12 light / >0.28 dark), scale/shrink on press, decorative animation.

---

## Iconography

See `ICONOGRAPHY` section below.

### Icon library: **Lucide** (exact match with codebase)

The codebase imports icons directly from `lucide-react` — `ChevronDown`, `Download`, `FilePlus2`, `FolderOpen`, `Import`, `Keyboard`, `Monitor`, `Moon`, `Pencil`, `Redo2`, `Save`, `Search`, `Sun`, `FileJson`, `Package`, `Square`, `Undo2`, `Plus`, `Trash2`, `MoreHorizontal`, `ChevronLeft`, `ChevronRight`. Use Lucide for **everything**.

- **CDN:** `https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js` (umd) or `https://unpkg.com/lucide-react@latest` (React ESM).
- **Stroke width:** Lucide default (2px). No custom widths — the product relies on this consistency.
- **Sizes:** `size-3` (12px) for tight chrome, `size-3.5` (14px) default, `size-4` (16px) for primary. Inner icon sizes in IconButton are 12/14/16 for sm/md/lg.
- **Color:** always `currentColor` — inherit from parent. `text-muted-foreground` for idle, `text-foreground` for hovered/active.

### Brand marks
- `assets/hiero.svg` — square glyph mark
- `assets/hiero_wordmark.svg` — full wordmark (2144 × 408 aspect). Rendered as a CSS mask with `background: currentColor` so it inherits theme foreground — not as an `<img>`.

### Emoji / unicode
- **No emoji** in UI, ever.
- **No unicode symbol icons** as UI affordances — Lucide only.
- `⌘ ⇧ ⌃ ⌥` are the only unicode characters used, exclusively in keyboard-shortcut hints (via the `KbdHint` DS component, which is platform-aware).

### Icon-as-product (meta)
Hiero authors icons — so icon previews inside the app are **user-authored**, rendered by the runtime (`<HieroIcon>`). Don't confuse: the *chrome* is Lucide; the *content* is whatever the user just built.

---

## Iteration prompt

If you're an agent using this skill:
1. Read `colors_and_type.css` and import it.
2. Apply the semantic type classes (`.type-body`, `.type-label`, etc.) or CSS vars.
3. Use Lucide icons via CDN.
4. For full-product mocks, reference `ui_kits/studio/` and compose from its components.
5. Default to dark mode (`.dark` on `<body>` or `<html>`) — Hiero is dark-first.

---

## Caveats

- **Fonts:** Instrument Sans and Geist Mono are loaded from Google Fonts via an `@import` inside `colors_and_type.css`. The real repo loads the same families via `next/font/google`. Drop local variable WOFF2 fallbacks into `fonts/` only if you need fully offline use.
- **Editor surface chrome:** the codebase has a secondary `.editor-lab` theme (warm cream/teal, "Iowan Old Style" display font) used for a specific editor experiment. It's **not** the canonical brand and is excluded here to avoid confusion.
- **Components:** only the five `components/ds/*` pieces are the official design system. `components/ui/*` is shadcn/Radix and `components/studio/*` is product shell — both composed from DS primitives. This DS reflects the official set only.

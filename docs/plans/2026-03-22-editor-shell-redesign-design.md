---
status: approved
last-reviewed: 2026-03-22
---

# Editor Shell Redesign

Date: 2026-03-22

## Goal

Replace the current editor interface with a quieter, canvas-first shell.

The current surface exposes too many systems at once: large header copy,
multiple permanent panel stacks, soft-radius cards, and too many competing
controls. The redesign must feel like a focused professional editor rather
than a dashboard.

## Approved Direction

- Rebuild the editor shell from scratch.
- Keep the underlying canvas and editor-store capabilities.
- Do not keep the current editor chrome components mounted in the new shell.
- Use a canvas-first mode system:
  - `Edit`
  - `Animate`
  - `Guides`
  - `Publish`
- Keep only one navigator column and one contextual inspector column visible.
- Move advanced or secondary workflows into modes and trays instead of
  showing them all at once.

## Information Architecture

### Persistent Structure

- Top bar
  - breadcrumb and document identity
  - omnibox / command search
  - mode switch
  - save / publish entry points
- Tool rail
  - essential authoring tools only
- Navigator
  - `Icons`
  - `Layers`
  - `States`
- Canvas stage
  - dominant surface with reduced chrome
- Inspector
  - contextual to selection or current mode

### Mode Behavior

- `Edit`
  - default drawing and object editing
  - inspector shows document or selection controls
- `Animate`
  - inspector switches to transition controls
  - bottom tray opens for preview and transition authoring
- `Guides`
  - inspector exposes guide visibility, strength, and guide-master context
- `Publish`
  - inspector and tray show export and sync-adjacent actions

## Visual Direction

- Tone: industrial minimal
- Palette: warm bone, graphite, steel, one signal accent
- Shape language: tighter geometry, fewer rounded capsules
- Typography:
  - expressive serif display for titles and document identity
  - workhorse sans for controls
- Surfaces:
  - borders and contrast do more of the work than tinted cards
  - reduce badge count and helper copy

## Component Strategy

### Rebuilt

- `components/editor/EditorShell.tsx`
- top bar, tool rail, navigator, inspector framing, and mode tray model
- editor shell styling and layout tokens

### Retained As Underlying Capability

- `components/editor/Canvas.tsx`
- `lib/editor-store/`
- `lib/editor-core/`
- import / export utilities

### Explicitly Removed From The Mounted Shell

- `Toolbar`
- `ToolPanel`
- `IconListPanel`
- `LayerPanel`
- `InspectorPanel`
- `AnimationStudioPanel`
- `GuideMasterPanel`
- `TimelineEditor`

## Research Notes

The redesign follows shared patterns across major editor tools:

- Figma keeps a strong canvas center with toolbar, left structure, and right
  contextual properties. Figma Draw simplifies the sidebars further for
  illustration-focused work.
- Illustrator uses a left toolbar and contextual properties / task-bar model
  instead of exposing every subsystem at once.
- Penpot and Sketch both reinforce the same backbone:
  canvas, compact tools, layers, and a properties inspector.

References:

- [Figma Design](https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files)
- [Figma Draw](https://help.figma.com/hc/en-us/articles/31440394517143-Explore-Figma-Draw)
- [Adobe Illustrator Workspace Overview](https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/workspace-overview.html)
- [Penpot Interface](https://help.penpot.app/user-guide/first-steps/the-interface/)
- [Sketch Mac App Interface](https://www.sketch.com/docs/interface-and-settings/the-mac-app-interface/)

## Implementation Guardrails

- Keep route files thin.
- Do not move business logic out of `lib/editor-store/` or `lib/editor-core/`.
- Prefer a smaller number of durable primitives over many specialized panels.
- Keep copy short and operational.
- Maintain desktop and web compatibility through the platform bridge.

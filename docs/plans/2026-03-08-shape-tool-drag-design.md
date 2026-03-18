---
status: implemented
last-reviewed: 2026-03-18
---

# Shape Tool Drag Design

## Goal

Add drag-to-draw behavior for the shape tool using the existing path-based layer model and undo history.

## Store Changes

- Add `shapeType` to editor state with rectangle, ellipse, polygon, star, and line options.
- Add adjustable polygon and star counts in the editor store with defaults of `5`.
- Keep shape settings as active tool defaults rather than storing extra shape metadata on each layer.

## Interaction Model

- `pointerdown` in shape mode creates a temporary layer and starts a paused history transaction.
- `pointermove` updates the temporary layer's `path.d` using the path primitive helpers.
- `pointerup` commits the same layer as one undoable action.
- `Escape` and pointer cancel discard the paused transaction and remove the temporary layer.

## Modifiers

- `Shift` constrains the drag to equal width and height for square, circle, and symmetric polygon or star bounds.
- `Alt` draws from the center rather than from a corner.
- For lines, `Shift` constrains the deltas to equal magnitude and `Alt` mirrors the endpoint around the start point.

## Inspector

The inspector exposes shape tool defaults even with no selected layer so polygon sides and star points can be adjusted before drawing.

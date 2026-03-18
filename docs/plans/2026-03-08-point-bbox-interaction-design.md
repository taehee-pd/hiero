---
status: implemented
last-reviewed: 2026-03-18
---

# Point BBox Interaction Design

## Goal

Add canvas-level multi-point selection bounds for direct-select editing, including overlay rendering, drag-based move or resize interactions, live dimension labels, and multi-point keyboard operations.

## Data Flow

- `getSelectedPointsBoundingBox()` in `vector-commands.ts` resolves the selected editable points and returns their axis-aligned bounds.
- `Canvas` computes this bbox for direct-select mode and passes it into the overlay hook.
- `use-overlay.ts` renders the bbox, its eight handles, and an optional live dimension label without owning any interaction logic.

## Interaction Model

- `PathEditor` hit-tests the current selected-point bbox when direct-select is active.
- Clicking inside the bbox starts a move-all interaction.
- Clicking a bbox handle starts proportional resize against the original bbox.
- Resize remaps selected points using normalized bbox coordinates and scales handle vectors relative to each point anchor.

## Modifiers

- `Shift` preserves the original bbox aspect ratio while resizing.
- `Alt` resizes symmetrically from the selection center instead of the opposite edge or corner.

## History

- Bbox move and resize previews mutate the real path while history is paused.
- `pointerup` commits a single undoable action.
- `Escape` and pointer cancel discard the paused transaction and restore the original path.

## Keyboard

- Arrow key nudges apply to all selected points and move their handles with them.
- Delete and Backspace remove all selected points through a plural delete command.

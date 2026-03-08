# Shape Toolbar Picker Design

## Goal

Add a secondary picker for the active shape tool without changing the main Shape button's primary behavior.

## Store

- Add `shapeSubTool: ShapeType` to the editor store.
- Expose `setShapeSubTool(shapeSubTool)` as the action used by the toolbar, inspector, and shape drawing logic.
- Keep polygon side count and star point count as separate shape settings.

## Toolbar

- Keep the main Shape button as the normal `U` tool toggle.
- When the Shape tool is active, render a separate adjacent affordance that opens a popover.
- The popover lists Rectangle, Ellipse, Polygon, Star, and Line with compact icons and labels.
- The Shape tooltip shows the current active sub-tool, for example `Shape: Polygon`.

## Consistency

- Existing shape drawing and inspector controls read `shapeSubTool` instead of a separate shape type field.
- This avoids duplicate store state for the active shape selection.

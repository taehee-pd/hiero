# Vector Inspector Design

## Goal

Upgrade the point editing section into a vector-focused control surface for selected path points.

## Command Changes

- Add `alignSelectedPoints(axis, anchor)` for point alignment within a single editable path.
- Add `distributeSelectedPoints(axis)` for even spacing between outermost selected points.
- Add `setSelectedPointType(nodeType)` so the inspector can set corner, smooth, and symmetric states across one or more selected points.

## Inspector Changes

- Replace the `Points` section with `Vector`.
- Add point alignment and point distribution controls at the top of the section.
- Show `X` and `Y` fields side by side with `Mixed` placeholders for divergent multi-selection values.
- Replace the point type dropdown with visual toggle buttons.
- Keep handle coordinate fields only for single-point selection.

## Geometry Rules

- Point translation moves handles with the anchor so handle offsets remain stable.
- Symmetric handles mirror around the point anchor when edited.
- Radius uses the angle bisector of neighboring segments instead of a fixed horizontal direction.

## Persistence

The stored geometry remains plain SVG path data. Symmetric state is inferred from mirrored handles when the inspector reconstructs point context from the path.

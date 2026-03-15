# Bezier And Point Handle Requirements

## Goal

Make point-handle behavior feel consistent with Figma and Glyphs during path drawing, especially when placing a new curved point with the pen tool.

## Reference Behaviors

### Figma

- Dragging a vector point defines a smooth bezier direction and length from the anchor.
- Smooth points keep the incoming and outgoing handles aligned on one tangent.
- End-point continuation handles stay visible while you continue drawing the open path.

### Glyphs

- Dragging while placing a node extends two handles from the placed node.
- A smooth node is two-sided by default.
- The end handle of the currently active open path remains available for the next segment.

## Product Requirements

1. A dragged pen placement must create a two-sided smooth point, not a one-sided point.
2. The new point must show both handles while the drag is happening.
3. The previous point must not be mutated just to fake a mirrored new-point handle.
4. The outgoing handle on the last open point must survive between pen clicks, even though SVG `d` data cannot serialize that end handle yet.
5. When the next point is added, the pending outgoing handle must be materialized into the next cubic segment.
6. A click-without-drag pen placement must stay a static point with no pending continuation handle.
7. Changing tools or clearing the current pen flow must discard transient pending-handle state.

## Implementation Notes

- Persist committed geometry in SVG path data as before.
- Store the active end-point continuation handle separately as transient editor state.
- Render pen overlays from both committed path geometry and transient pending-handle state.
- Cover the flow with tests for:
  - mirrored handle creation on drag
  - carry-forward of the end handle into the next segment

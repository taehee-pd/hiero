# Layer Arrange Design

## Goal

Add editor commands that align and distribute selected layers by using the same Paper.js `CompoundPath(...).strokeBounds` geometry model as the selection overlay.

## Decisions

- Alignment and distribution operate on explicit `layerIds`.
- Bounds are computed from each layer's `path.d` plus its existing transform values.
- The alignment reference is the union bounds of all valid selected layers.
- Distribution keeps the first and last layers fixed on the target axis and spaces the interior layers evenly by edge-to-edge gaps.
- Invalid geometry is skipped by default.
- The whole operation is wrapped in one paused-history transaction so undo restores the full arrange action in one step.

## Edge Cases

- Missing icon, state, layer, or path data: no-op for that layer or command.
- Parse failures or non-finite bounds: skip that layer.
- Distribution with fewer than three valid layers: no-op.
- Missing transform values are treated as `0` for `x` and `y`.
- Ties on the distribution axis preserve the incoming `layerIds` order.

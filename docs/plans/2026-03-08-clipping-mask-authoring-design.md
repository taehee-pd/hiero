# Clipping Mask Authoring Design

## Goal

Add authoring actions for assigning and releasing clipping masks, surface those actions in the inspector, and show clipping relationships in the layer panel.

## Decisions

- Clipping relationships remain layer-to-layer references using `clipPathLayerId`.
- `setClipMask(maskLayerId, targetLayerIds)` marks the mask layer with `isClipMask` and assigns the referenced targets.
- `releaseClipMask(layerId)` works for both masks and clipped targets.
- The inspector is the primary trigger surface for clipping actions because it already owns multi-layer operations.
- The layer panel derives a presentation-only nested list so clipped targets appear visually attached to their mask layer without changing stored layer order.

## Edge Cases

- One mask can clip multiple target layers.
- Reassigning a target from one mask to another clears the old mask flag when it has no remaining targets.
- Releasing a mask clears all target references that point to it.
- Missing mask references fall back to normal top-level layer rows in the layer panel.

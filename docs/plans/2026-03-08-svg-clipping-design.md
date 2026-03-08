# SVG Clipping Design

## Goal

Add first-class layer clipping metadata so runtime rendering and SVG export can express a layer being clipped by another layer path.

## Decisions

- `Layer` gains optional `clipPathLayerId`, `isClipMask`, and `groupId` fields.
- A clipped layer references another layer by `clipPathLayerId`.
- The referenced mask layer contributes a `<clipPath>` definition built from its path geometry, fill rule, and transform.
- Layers marked `isClipMask` are not rendered as visible paths.
- Missing, hidden, or pathless mask layers do not produce a broken `clip-path` reference; the clipped layer renders normally instead.
- Clip path ids are derived from the clipped layer id so renderer and exporter stay deterministic.

## Edge Cases

- Multiple layers may reference the same mask layer; each clipped layer still gets its own deterministic clip id.
- Mask layers can carry transforms, which are preserved inside the generated `<clipPath>`.
- Layers that are both `isClipMask` and clipped remain hidden as visible output.

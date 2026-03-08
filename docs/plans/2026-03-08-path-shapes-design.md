# Path Shapes Design

## Goal

Add a small shape-path utility that generates SVG `d` strings compatible with the editor's existing `parseSvgPath` and `serializePath` round-trip behavior.

## Placement

The module lives in `lib/editor-core/path-shapes.ts` and is re-exported from `lib/editor-core/index.ts`. This keeps it close to the existing path parser and serializer used by `layer.path.d`.

## API

- `createRectPath(x, y, width, height, cornerRadius?)`
- `createEllipsePath(cx, cy, rx, ry)`
- `createPolygonPath(cx, cy, radius, sides)`
- `createStarPath(cx, cy, outerRadius, innerRadius, points)`
- `createLinePath(x1, y1, x2, y2)`

All functions return absolute SVG path commands.

## Shape Rules

- Rectangles use `M/L/Z` when the corner radius is zero.
- Rounded rectangles use cubic bezier quarter-corner approximations so the current parser preserves the full shape.
- Ellipses use the standard four-segment cubic bezier approximation with `kappa = 0.5522847498`.
- Polygons and stars begin at 12 o'clock and proceed clockwise.
- Polygon and star builders reject invalid side or point counts.

## Testing

`tests/path-shapes.test.ts` verifies that each generated path survives `parseSvgPath` followed by `serializePath` without changing its `d` string.

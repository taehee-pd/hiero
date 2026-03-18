// Normalized Intermediate Representation — public API surface.

export type {
  NormalizedIcon,
  NormalizedNode,
  NormalizedNodeKind,
  NormalizedGeometry,
  NormalizedStyle,
  NormalizedTransform,
  NormalizedSourceMeta,
  PathGeometry,
  RectGeometry,
  CircleGeometry,
  EllipseGeometry,
  LineGeometry,
  PolylineGeometry,
  PolygonGeometry,
  GroupGeometry,
  PaintRef,
  GradientStop,
  SvgUnsupportedFeature,
} from './types';

export {
  NodeIndexCounter,
  buildPathNode,
  buildRectNode,
  buildCircleNode,
  buildEllipseNode,
  buildLineNode,
  buildPolylineNode,
  buildPolygonNode,
  buildGroupNode,
} from './builders';

export {
  serializeNormalizedIcon,
  deserializeNormalizedIcon,
} from './serialize';

export {
  validateNormalizedIcon,
  validateNormalizedNode,
} from './validate';

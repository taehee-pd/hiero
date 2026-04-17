import type { PrimitiveShape } from '@/lib/schema/types';

const KAPPA = 0.5522847498;
const EPSILON = 1e-9;

export function createRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius = 0,
): string {
  assertFiniteNumbers({ x, y, width, height, cornerRadius });

  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const top = Math.min(y, y + height);
  const bottom = Math.max(y, y + height);
  const rectWidth = right - left;
  const rectHeight = bottom - top;
  const radius = clamp(
    Math.abs(cornerRadius),
    0,
    Math.min(rectWidth / 2, rectHeight / 2),
  );

  if (radius <= EPSILON) {
    return [
      moveTo(left, top),
      lineTo(right, top),
      lineTo(right, bottom),
      lineTo(left, bottom),
      'Z',
    ].join(' ');
  }

  const control = radius * KAPPA;

  return [
    moveTo(left + radius, top),
    lineTo(right - radius, top),
    cubicTo(
      right - radius + control,
      top,
      right,
      top + radius - control,
      right,
      top + radius,
    ),
    lineTo(right, bottom - radius),
    cubicTo(
      right,
      bottom - radius + control,
      right - radius + control,
      bottom,
      right - radius,
      bottom,
    ),
    lineTo(left + radius, bottom),
    cubicTo(
      left + radius - control,
      bottom,
      left,
      bottom - radius + control,
      left,
      bottom - radius,
    ),
    lineTo(left, top + radius),
    cubicTo(
      left,
      top + radius - control,
      left + radius - control,
      top,
      left + radius,
      top,
    ),
    'Z',
  ].join(' ');
}

export function createEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): string {
  assertFiniteNumbers({ cx, cy, rx, ry });

  const radiusX = Math.abs(rx);
  const radiusY = Math.abs(ry);
  const offsetX = radiusX * KAPPA;
  const offsetY = radiusY * KAPPA;

  return [
    moveTo(cx, cy - radiusY),
    cubicTo(
      cx + offsetX,
      cy - radiusY,
      cx + radiusX,
      cy - offsetY,
      cx + radiusX,
      cy,
    ),
    cubicTo(
      cx + radiusX,
      cy + offsetY,
      cx + offsetX,
      cy + radiusY,
      cx,
      cy + radiusY,
    ),
    cubicTo(
      cx - offsetX,
      cy + radiusY,
      cx - radiusX,
      cy + offsetY,
      cx - radiusX,
      cy,
    ),
    cubicTo(
      cx - radiusX,
      cy - offsetY,
      cx - offsetX,
      cy - radiusY,
      cx,
      cy - radiusY,
    ),
    'Z',
  ].join(' ');
}

export function createPolygonPath(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
): string {
  assertFiniteNumbers({ cx, cy, radius, sides });
  assertInteger('sides', sides, 3);

  const vertices = createRegularVertices(cx, cy, Math.abs(radius), sides);
  return createClosedPolyline(vertices);
}

export function createStarPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
): string {
  assertFiniteNumbers({ cx, cy, outerRadius, innerRadius, points });
  assertInteger('points', points, 2);

  const outer = Math.abs(outerRadius);
  const inner = Math.abs(innerRadius);
  const step = Math.PI / points;
  const startAngle = -Math.PI / 2;
  const vertices: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < points * 2; i += 1) {
    const angle = startAngle + step * i;
    const radius = i % 2 === 0 ? outer : inner;
    vertices.push(pointOnCircle(cx, cy, radius, angle));
  }

  return createClosedPolyline(vertices);
}

export function createLinePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  assertFiniteNumbers({ x1, y1, x2, y2 });
  return [moveTo(x1, y1), lineTo(x2, y2)].join(' ');
}

/**
 * Single entry point for turning a `PrimitiveShape` into a canonical path
 * string. Used at shape creation, during shape-drag preview, and by the store
 * action `setLayerPrimitive` — guaranteeing the Inspector and the canvas use
 * the exact same geometry.
 */
export function buildPrimitivePath(primitive: PrimitiveShape): string {
  switch (primitive.kind) {
    case 'rectangle':
      return createRectPath(
        primitive.x,
        primitive.y,
        primitive.width,
        primitive.height,
        primitive.radius ?? 0,
      );
    case 'ellipse':
      return createEllipsePath(primitive.cx, primitive.cy, primitive.rx, primitive.ry);
    case 'polygon':
      return createPolygonPath(primitive.cx, primitive.cy, primitive.r, primitive.sides);
    case 'star':
      return createStarPath(
        primitive.cx,
        primitive.cy,
        primitive.outerR,
        primitive.innerR,
        primitive.points,
      );
    case 'line':
      return createLinePath(primitive.x1, primitive.y1, primitive.x2, primitive.y2);
  }
}

function createRegularVertices(
  cx: number,
  cy: number,
  radius: number,
  count: number,
): Array<{ x: number; y: number }> {
  const vertices: Array<{ x: number; y: number }> = [];
  const step = (Math.PI * 2) / count;
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < count; i += 1) {
    vertices.push(pointOnCircle(cx, cy, radius, startAngle + step * i));
  }

  return vertices;
}

function createClosedPolyline(points: Array<{ x: number; y: number }>): string {
  const [first, ...rest] = points;
  return [moveTo(first.x, first.y), ...rest.map((point) => lineTo(point.x, point.y)), 'Z'].join(
    ' ',
  );
}

function pointOnCircle(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function moveTo(x: number, y: number): string {
  return `M${formatNumber(x)} ${formatNumber(y)}`;
}

function lineTo(x: number, y: number): string {
  return `L${formatNumber(x)} ${formatNumber(y)}`;
}

function cubicTo(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
): string {
  return `C${formatNumber(x1)} ${formatNumber(y1)} ${formatNumber(x2)} ${formatNumber(y2)} ${formatNumber(x)} ${formatNumber(y)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number): string {
  return `${Math.round(value * 1000) / 1000}`;
}

function assertFiniteNumbers(values: Record<string, number>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} must be a finite number.`);
    }
  }
}

function assertInteger(name: string, value: number, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
}

import { describe, expect, test } from 'bun:test';
import {
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectPath,
  createStarPath,
  parseSvgPath,
  serializePath,
} from '../lib/editor-core';

function expectStableRoundTrip(d: string) {
  const first = serializePath(parseSvgPath(d));
  const second = serializePath(parseSvgPath(first));
  expect(first).toBe(d);
  expect(second).toBe(first);
}

describe('shape primitives', () => {
  test('normalizes negative rectangle dimensions and clamps corner radius', () => {
    const d = createRectPath(10, 10, -8, -4, 99);

    expect(d.startsWith('M4 6')).toBeTrue();
    expect(d.includes('C')).toBeTrue();
    expectStableRoundTrip(d);
  });

  test('uses absolute ellipse radii and preserves cubic path stability', () => {
    const d = createEllipsePath(5, 5, -3, -4);

    expect(d.startsWith('M5 1')).toBeTrue();
    expectStableRoundTrip(d);
  });

  test('emits stable polygon, star, and line paths', () => {
    const polygon = createPolygonPath(8, 8, 5, 6);
    const star = createStarPath(8, 8, 5, 2.5, 5);
    const line = createLinePath(1, 2, 9, 11);

    expect(polygon.endsWith(' Z')).toBeTrue();
    expect(star.endsWith(' Z')).toBeTrue();
    expect(line).toBe('M1 2 L9 11');
    expectStableRoundTrip(polygon);
    expectStableRoundTrip(star);
    expectStableRoundTrip(line);
  });
});

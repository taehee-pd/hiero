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

function expectRoundTrip(d: string) {
  expect(serializePath(parseSvgPath(d))).toBe(d);
}

describe('path shape builders', () => {
  test('rectangle round-trips without rounded corners', () => {
    const d = createRectPath(2, 3, 8, 5);
    expect(d).toBe('M2 3 L10 3 L10 8 L2 8 Z');
    expectRoundTrip(d);
  });

  test('rounded rectangle round-trips with cubic corner arcs', () => {
    const d = createRectPath(2, 3, 8, 5, 1.5);
    expect(d).toContain('C');
    expectRoundTrip(d);
  });

  test('ellipse round-trips through cubic approximation', () => {
    const d = createEllipsePath(10, 12, 4, 6);
    expect(d).toContain('C');
    expectRoundTrip(d);
  });

  test('polygon round-trips as a closed polyline', () => {
    const d = createPolygonPath(10, 10, 6, 5);
    expect(d.endsWith(' Z')).toBeTrue();
    expectRoundTrip(d);
  });

  test('star round-trips as a closed polyline', () => {
    const d = createStarPath(10, 10, 6, 3, 5);
    expect(d.endsWith(' Z')).toBeTrue();
    expectRoundTrip(d);
  });

  test('line round-trips as a move and line segment', () => {
    const d = createLinePath(1, 2, 9, 11);
    expect(d).toBe('M1 2 L9 11');
    expectRoundTrip(d);
  });

  test('polygon rejects invalid side counts', () => {
    expect(() => createPolygonPath(0, 0, 10, 2)).toThrow(
      'sides must be an integer greater than or equal to 3.',
    );
  });

  test('star rejects invalid point counts', () => {
    expect(() => createStarPath(0, 0, 10, 5, 1)).toThrow(
      'points must be an integer greater than or equal to 2.',
    );
  });
});

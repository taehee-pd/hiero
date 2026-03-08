import { describe, expect, test } from 'bun:test';
import { mapPointIntoBounds } from '../lib/editor-core/path-editor';

describe('point bbox transform math', () => {
  test('remaps points between arbitrary bounding boxes', () => {
    const oldBounds = { minX: 10, minY: 20, maxX: 20, maxY: 40 };
    const newBounds = { minX: -5, minY: 0, maxX: 5, maxY: 10 };

    expect(mapPointIntoBounds({ x: 15, y: 30 }, oldBounds, newBounds)).toEqual({
      x: 0,
      y: 5,
    });
    expect(mapPointIntoBounds({ x: 20, y: 40 }, oldBounds, newBounds)).toEqual({
      x: 5,
      y: 10,
    });
  });

  test('maps collapsed source axes to the center of the destination bounds', () => {
    const oldBounds = { minX: 3, minY: 2, maxX: 3, maxY: 6 };
    const newBounds = { minX: 10, minY: 20, maxX: 30, maxY: 60 };

    expect(mapPointIntoBounds({ x: 3, y: 4 }, oldBounds, newBounds)).toEqual({
      x: 20,
      y: 40,
    });
  });
});

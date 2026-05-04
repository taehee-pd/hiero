import { describe, expect, test } from 'bun:test';

import {
  alignGuideItemsToViewBox,
  getGuideItemBounds,
  resizeGuideItemToBounds,
} from '../lib/editor-core/guide-item-geometry';
import type { GuideItem } from '../lib/schema/types';

describe('guide item geometry', () => {
  test('aligns selected guide items to the guide master viewBox', () => {
    const items: GuideItem[] = [
      { kind: 'rect', x: 2, y: 3, width: 4, height: 6, radius: 1 },
      { kind: 'ellipse', cx: 5, cy: 6, rx: 2, ry: 3 },
      { kind: 'line', x1: 2, y1: 4, x2: 8, y2: 6 },
    ];

    const centered = alignGuideItemsToViewBox('center-h', items, [0], [0, 0, 24, 24]);
    expect(centered[0]).toEqual({ kind: 'rect', x: 10, y: 3, width: 4, height: 6, radius: 1 });

    const rightAligned = alignGuideItemsToViewBox('right', items, [1], [0, 0, 24, 24]);
    expect(rightAligned[1]).toEqual({ kind: 'ellipse', cx: 22, cy: 6, rx: 2, ry: 3 });

    const bottomAligned = alignGuideItemsToViewBox('bottom', items, [2], [0, 0, 24, 24]);
    expect(bottomAligned[2]).toEqual({ kind: 'line', x1: 2, y1: 22, x2: 8, y2: 24 });
  });

  test('resizes guide items from normal editing bounds', () => {
    const rect = resizeGuideItemToBounds(
      { kind: 'rect', x: 2, y: 3, width: 8, height: 6, radius: 5 },
      { minX: 4, minY: 5, maxX: 10, maxY: 9 },
    );
    expect(rect).toEqual({ kind: 'rect', x: 4, y: 5, width: 6, height: 4, radius: 2 });

    const ellipse = resizeGuideItemToBounds(
      { kind: 'ellipse', cx: 10, cy: 10, rx: 4, ry: 2 },
      { minX: 6, minY: 4, maxX: 18, maxY: 16 },
    );
    expect(ellipse).toEqual({ kind: 'ellipse', cx: 12, cy: 10, rx: 6, ry: 6 });

    const line = resizeGuideItemToBounds(
      { kind: 'line', x1: 2, y1: 4, x2: 8, y2: 10 },
      { minX: 10, minY: 20, maxX: 22, maxY: 32 },
    );
    expect(line).toEqual({ kind: 'line', x1: 10, y1: 20, x2: 22, y2: 32 });
  });

  test('computes bounds for full-span line guides against the viewBox', () => {
    expect(getGuideItemBounds({ kind: 'hline', y: 12 }, [0, 0, 24, 24])).toEqual({
      minX: 0,
      minY: 12,
      maxX: 24,
      maxY: 12,
    });
    expect(getGuideItemBounds({ kind: 'vline', x: 8 }, [0, 0, 24, 24])).toEqual({
      minX: 8,
      minY: 0,
      maxX: 8,
      maxY: 24,
    });
  });
});

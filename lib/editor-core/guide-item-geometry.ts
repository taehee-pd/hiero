import type { GuideItem } from '@/lib/schema/types';

export type GuideItemBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type GuideAlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

const EPSILON = 0.001;

export function getGuideItemBounds(
  item: GuideItem,
  viewBox: [number, number, number, number] = [0, 0, 0, 0],
): GuideItemBounds | null {
  const [vx, vy, vw, vh] = viewBox;

  switch (item.kind) {
    case 'hline':
      return { minX: vx, minY: item.y, maxX: vx + vw, maxY: item.y };
    case 'vline':
      return { minX: item.x, minY: vy, maxX: item.x, maxY: vy + vh };
    case 'line':
      return normalizeBounds(item.x1, item.y1, item.x2, item.y2);
    case 'rect':
      return normalizeBounds(item.x, item.y, item.x + item.width, item.y + item.height);
    case 'ellipse':
      return normalizeBounds(
        item.cx - item.rx,
        item.cy - item.ry,
        item.cx + item.rx,
        item.cy + item.ry,
      );
    case 'drawPoint':
      return null;
  }
}

export function translateGuideItem(item: GuideItem, dx: number, dy: number): GuideItem {
  switch (item.kind) {
    case 'hline':
      return { ...item, y: item.y + dy };
    case 'vline':
      return { ...item, x: item.x + dx };
    case 'line':
      return {
        ...item,
        x1: item.x1 + dx,
        y1: item.y1 + dy,
        x2: item.x2 + dx,
        y2: item.y2 + dy,
      };
    case 'rect':
      return { ...item, x: item.x + dx, y: item.y + dy };
    case 'ellipse':
      return { ...item, cx: item.cx + dx, cy: item.cy + dy };
    case 'drawPoint':
      return item;
  }
}

export function resizeGuideItemToBounds(item: GuideItem, bounds: GuideItemBounds): GuideItem {
  const width = Math.max(bounds.maxX - bounds.minX, EPSILON);
  const height = Math.max(bounds.maxY - bounds.minY, EPSILON);

  switch (item.kind) {
    case 'rect':
      return {
        ...item,
        x: bounds.minX,
        y: bounds.minY,
        width,
        height,
        radius: Math.min(item.radius ?? 0, width / 2, height / 2),
      };
    case 'ellipse':
      return {
        ...item,
        cx: (bounds.minX + bounds.maxX) / 2,
        cy: (bounds.minY + bounds.maxY) / 2,
        rx: width / 2,
        ry: height / 2,
      };
    case 'line': {
      const previous = getGuideItemBounds(item);
      if (!previous) return item;
      return {
        ...item,
        ...mapLineIntoBounds(item, previous, bounds),
      };
    }
    case 'hline':
      return { ...item, y: (bounds.minY + bounds.maxY) / 2 };
    case 'vline':
      return { ...item, x: (bounds.minX + bounds.maxX) / 2 };
    case 'drawPoint':
      return item;
  }
}

export function alignGuideItemsToViewBox(
  mode: GuideAlignMode,
  items: GuideItem[],
  indexes: number[],
  viewBox: [number, number, number, number],
): GuideItem[] {
  const [vx, vy, vw, vh] = viewBox;
  const reference = {
    minX: vx,
    minY: vy,
    maxX: vx + vw,
    maxY: vy + vh,
    centerX: vx + vw / 2,
    centerY: vy + vh / 2,
  };
  const selected = new Set(indexes);

  return items.map((item, index) => {
    if (!selected.has(index)) return item;
    const bounds = getGuideItemBounds(item, viewBox);
    if (!bounds) return item;

    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = reference.minX - bounds.minX;
        break;
      case 'center-h':
        dx = reference.centerX - (bounds.minX + bounds.maxX) / 2;
        break;
      case 'right':
        dx = reference.maxX - bounds.maxX;
        break;
      case 'top':
        dy = reference.minY - bounds.minY;
        break;
      case 'center-v':
        dy = reference.centerY - (bounds.minY + bounds.maxY) / 2;
        break;
      case 'bottom':
        dy = reference.maxY - bounds.maxY;
        break;
    }

    return translateGuideItem(item, dx, dy);
  });
}

function normalizeBounds(x1: number, y1: number, x2: number, y2: number): GuideItemBounds {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}

function mapLineIntoBounds(
  item: Extract<GuideItem, { kind: 'line' }>,
  previous: GuideItemBounds,
  next: GuideItemBounds,
) {
  const p1 = mapPointIntoBounds({ x: item.x1, y: item.y1 }, previous, next);
  const p2 = mapPointIntoBounds({ x: item.x2, y: item.y2 }, previous, next);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function mapPointIntoBounds(
  point: { x: number; y: number },
  previous: GuideItemBounds,
  next: GuideItemBounds,
) {
  return {
    x: remapAxis(point.x, previous.minX, previous.maxX, next.minX, next.maxX),
    y: remapAxis(point.y, previous.minY, previous.maxY, next.minY, next.maxY),
  };
}

function remapAxis(value: number, oldMin: number, oldMax: number, newMin: number, newMax: number) {
  const oldSize = oldMax - oldMin;
  if (Math.abs(oldSize) <= EPSILON) return (newMin + newMax) / 2;
  return newMin + ((value - oldMin) / oldSize) * (newMax - newMin);
}

import type { GuideItem, GuideMaster } from '@/lib/schema/types';

const BASE_SIZE = 24;

const BASE_ITEMS: GuideItem[] = [
  { kind: 'rect', x: 1, y: 1, width: 22, height: 22 },
  { kind: 'rect', x: 3, y: 3, width: 18, height: 18 },
  { kind: 'ellipse', cx: 12, cy: 12, rx: 10, ry: 10 },
  { kind: 'rect', x: 2, y: 4, width: 20, height: 16 },
  { kind: 'rect', x: 4, y: 2, width: 16, height: 20 },
  { kind: 'hline', y: 12 },
  { kind: 'vline', x: 12 },
];

function scaleCoordinate(value: number, factor: number) {
  return Number((value * factor).toFixed(3));
}

function scaleGuideItem(item: GuideItem, factor: number): GuideItem {
  switch (item.kind) {
    case 'hline':
      return { kind: 'hline', y: scaleCoordinate(item.y, factor) };
    case 'vline':
      return { kind: 'vline', x: scaleCoordinate(item.x, factor) };
    case 'line':
      return {
        kind: 'line',
        x1: scaleCoordinate(item.x1, factor),
        y1: scaleCoordinate(item.y1, factor),
        x2: scaleCoordinate(item.x2, factor),
        y2: scaleCoordinate(item.y2, factor),
      };
    case 'rect':
      return {
        kind: 'rect',
        x: scaleCoordinate(item.x, factor),
        y: scaleCoordinate(item.y, factor),
        width: scaleCoordinate(item.width, factor),
        height: scaleCoordinate(item.height, factor),
        ...(item.radius !== undefined
          ? { radius: scaleCoordinate(item.radius, factor) }
          : null),
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        cx: scaleCoordinate(item.cx, factor),
        cy: scaleCoordinate(item.cy, factor),
        rx: scaleCoordinate(item.rx, factor),
        ry: scaleCoordinate(item.ry, factor),
      };
    case 'drawPoint':
      return {
        ...item,
        t: scaleCoordinate(item.t, factor),
      };
  }
}

function createScaledGuideMaster(size: number): GuideMaster {
  const factor = size / BASE_SIZE;
  return {
    id: `preset-${size}`,
    name: `${size}px Standard`,
    targetSize: size,
    viewBox: [0, 0, size, size],
    items: BASE_ITEMS.map((item) => scaleGuideItem(item, factor)),
    layers: {},
  };
}

export function createGuideMaster16(): GuideMaster {
  return createScaledGuideMaster(16);
}

export function createGuideMaster24(): GuideMaster {
  return {
    id: 'preset-24',
    name: '24px Standard',
    targetSize: 24,
    viewBox: [0, 0, 24, 24],
    items: [
      { kind: 'rect', x: 1, y: 1, width: 22, height: 22 },
      { kind: 'rect', x: 3, y: 3, width: 18, height: 18 },
      { kind: 'ellipse', cx: 12, cy: 12, rx: 10, ry: 10 },
      { kind: 'rect', x: 2, y: 4, width: 20, height: 16 },
      { kind: 'rect', x: 4, y: 2, width: 16, height: 20 },
      { kind: 'hline', y: 12 },
      { kind: 'vline', x: 12 },
    ],
    layers: {},
  };
}

export function createGuideMaster32(): GuideMaster {
  return createScaledGuideMaster(32);
}

export function createGuideMaster48(): GuideMaster {
  return createScaledGuideMaster(48);
}

export function getDefaultGuideMaster(size: number): GuideMaster {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Unsupported default guide size: ${size}`);
  }

  switch (size) {
    case 16:
      return createGuideMaster16();
    case 24:
      return createGuideMaster24();
    case 32:
      return createGuideMaster32();
    case 48:
      return createGuideMaster48();
    default:
      return createScaledGuideMaster(Math.round(size));
  }
}

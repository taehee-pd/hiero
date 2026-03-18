import {
  createEllipsePath,
  createLinePath,
  createRectPath,
} from '@/lib/editor-core/path-shapes';
import type {
  Icon,
  Layer,
  SvgImportLayerMeta,
  SvgUnsupportedFeature,
} from '@/lib/schema/types';
import type { NormalizedIcon, NormalizedNode } from './normalized-ir';

export type ConvertNormalizedIconOptions = {
  existingIconIds?: Iterable<string>;
  sourceName?: string;
  category?: string;
};

export function convertNormalizedIconToIcon(
  normalized: NormalizedIcon,
  options: ConvertNormalizedIconOptions = {},
): Icon {
  const sourceName = options.sourceName ?? normalized.name ?? 'Imported SVG';
  const baseName = stripSvgExtension(sourceName);
  const iconId = ensureUniqueId(buildIconId(baseName), options.existingIconIds ?? []);
  const displayName = formatIconName(baseName);
  const size = inferVariantSize(normalized.viewBox);
  const variantId = `v${size}`;

  const layers = normalizedNodesToLayers(normalized.nodes);

  const icon: Icon = {
    id: iconId,
    name: displayName,
    variants: {
      [variantId]: {
        id: variantId,
        name: String(size),
        size,
        viewBox: normalized.viewBox,
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers,
          },
        },
      },
    },
    transitions: {},
  };

  if (normalized.tags.length > 0) icon.tags = [...normalized.tags];
  if (options.category) icon.category = options.category;
  if (normalized.provenance) {
    icon.meta = {
      ...(icon.meta ?? {}),
      externalImport: normalized.provenance,
    };
  }

  return icon;
}

function normalizedNodesToLayers(nodes: NormalizedNode[]): Record<string, Layer> {
  const layers: Record<string, Layer> = {};
  const idCounts = new Map<string, number>();

  const walk = (node: NormalizedNode): void => {
    if (node.kind === 'group') {
      for (const child of node.children ?? []) walk(child);
      return;
    }

    const suggested = sanitizeLayerBaseId(node.sourceMeta.sourceNodeId ?? `${node.kind}-${node.index + 1}`);
    const layerId = ensureUniqueLayerId(suggested, idCounts);
    const d = geometryToPath(node);
    const importMeta = buildLayerImportMeta(node);

    layers[layerId] = {
      id: layerId,
      visible: node.style.visible === false ? false : undefined,
      path: {
        d,
        fillRule: node.geometry.kind === 'path' ? node.geometry.fillRule : undefined,
      },
      style: {
        fill: node.style.fill,
        stroke: node.style.stroke,
        strokeWidth: node.style.strokeWidth,
        fillOpacity: node.style.fillOpacity,
        strokeOpacity: node.style.strokeOpacity,
        lineCap: node.style.lineCap,
        lineJoin: node.style.lineJoin,
      },
      transform: node.transform,
      importMeta,
    };
  };

  for (const node of nodes) walk(node);
  return layers;
}

function buildLayerImportMeta(node: NormalizedNode): SvgImportLayerMeta | undefined {
  const unsupported = node.sourceMeta.unsupported.length > 0
    ? node.sourceMeta.unsupported.map(cloneUnsupported)
    : undefined;

  if (
    !node.sourceMeta.sourceNodeId
    && !node.sourceMeta.sourceClassName
    && !node.sourceMeta.originalTransform
    && !unsupported
  ) {
    return undefined;
  }

  return {
    sourceTag: node.sourceMeta.sourceTag === 'group' ? 'path' : node.sourceMeta.sourceTag,
    sourceNodeId: node.sourceMeta.sourceNodeId,
    sourceClassName: node.sourceMeta.sourceClassName,
    originalTransform: node.sourceMeta.originalTransform,
    unsupported,
  };
}

function cloneUnsupported(entry: SvgUnsupportedFeature): SvgUnsupportedFeature {
  return {
    kind: entry.kind,
    value: entry.value,
    refId: entry.refId,
    raw: entry.raw,
    attributes: entry.attributes ? { ...entry.attributes } : undefined,
  };
}

function geometryToPath(node: NormalizedNode): string {
  switch (node.geometry.kind) {
    case 'path':
      return node.geometry.d;
    case 'rect':
      return createRectPath(
        node.geometry.x,
        node.geometry.y,
        node.geometry.width,
        node.geometry.height,
        node.geometry.rx ?? node.geometry.ry ?? 0,
      );
    case 'circle':
      return createEllipsePath(
        node.geometry.cx - node.geometry.r,
        node.geometry.cy - node.geometry.r,
        node.geometry.r * 2,
        node.geometry.r * 2,
      );
    case 'ellipse':
      return createEllipsePath(
        node.geometry.cx - node.geometry.rx,
        node.geometry.cy - node.geometry.ry,
        node.geometry.rx * 2,
        node.geometry.ry * 2,
      );
    case 'line':
      return createLinePath(node.geometry.x1, node.geometry.y1, node.geometry.x2, node.geometry.y2);
    case 'polyline':
      return pointsToPath(node.geometry.points, false);
    case 'polygon':
      return pointsToPath(node.geometry.points, true);
    case 'group':
      return '';
    default:
      return '';
  }
}

function pointsToPath(points: number[], close: boolean): string {
  if (points.length < 2) return '';
  const segments: string[] = [`M${points[0]} ${points[1]}`];
  for (let i = 2; i + 1 < points.length; i += 2) {
    segments.push(`L${points[i]} ${points[i + 1]}`);
  }
  if (close) segments.push('Z');
  return segments.join(' ');
}

function inferVariantSize(viewBox: [number, number, number, number]): number {
  const size = Math.max(viewBox[2], viewBox[3]);
  return Number.isFinite(size) && size > 0 ? Math.round(size) : 24;
}

function stripSvgExtension(value: string): string {
  return value.replace(/\.svg$/i, '').trim() || 'Imported SVG';
}

function buildIconId(value: string): string {
  const sanitized = sanitizeSlug(value);
  return sanitized.startsWith('icon-') ? sanitized : `icon-${sanitized}`;
}

function sanitizeSlug(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'imported-svg';
}

function formatIconName(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function ensureUniqueId(candidate: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  if (!existing.has(candidate)) return candidate;

  let suffix = 2;
  let nextId = `${candidate}-${suffix}`;
  while (existing.has(nextId)) {
    suffix += 1;
    nextId = `${candidate}-${suffix}`;
  }
  return nextId;
}

function sanitizeLayerBaseId(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'layer';
}

function ensureUniqueLayerId(base: string, counts: Map<string, number>): string {
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

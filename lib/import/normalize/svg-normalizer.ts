/**
 * SVG Normalization Layer
 *
 * Parses a sanitized SVG string into the NormalizedIcon intermediate
 * representation. This is the bridge between raw SVG and the internal
 * schema conversion layer.
 *
 * Responsibilities:
 *   - Parse viewBox
 *   - Walk the SVG DOM tree in document order
 *   - Resolve style inheritance (fill, stroke, opacity, etc.)
 *   - Decompose transforms where possible
 *   - Extract geometry for each supported primitive
 *   - Collect unsupported features
 *   - Produce deterministically ordered NormalizedNode[]
 *
 * Strategy: primitives are preserved in their native form (rect stays rect,
 * circle stays circle). Path conversion is deferred to the schema conversion
 * layer, which can use the existing `importSvg` path normalization utilities.
 *
 * This module does NOT contain any adapter-specific assumptions.
 */

import type { PaintRef, SvgUnsupportedFeature } from '@/lib/schema/types';
import type {
  NormalizedIcon,
  NormalizedNode,
  NormalizedNodeKind,
  NormalizedGeometry,
  NormalizedStyle,
  NormalizedTransform,
} from '../normalized-ir/types';
import type { ExternalIconProvenance, ExternalIconWarning } from '../adapter-sdk/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Matrix = [number, number, number, number, number, number];

type ResolvedPresentation = {
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  fillRule?: 'nonzero' | 'evenodd';
  visible?: boolean;
};

type WalkContext = {
  presentation: ResolvedPresentation;
  transform: Matrix;
  unsupported: SvgUnsupportedFeature[];
};

type GradientRecord = {
  id: string;
  element: Element;
};

type DefRegistry = {
  gradients: Map<string, GradientRecord>;
  rawById: Map<string, string>;
  styles: string[];
};

type PaintResolution = {
  paint?: PaintRef;
  unsupported: SvgUnsupportedFeature[];
};

export type NormalizeSvgOptions = {
  name?: string;
  tags?: string[];
  provenance?: ExternalIconProvenance;
  /** Warnings from earlier pipeline stages (sanitizer, adapter). */
  upstreamWarnings?: ExternalIconWarning[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const EPSILON = 1e-6;

const SUPPORTED_SHAPE_TAGS = new Set<string>([
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a sanitized SVG string into a NormalizedIcon.
 */
export function normalizeSvg(
  svgString: string,
  options: NormalizeSvgOptions = {},
): NormalizedIcon {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('normalizeSvg: expected an <svg> root element');
  }

  const defs = collectDefs(root);
  const viewBox = parseViewBox(root);
  const warnings: ExternalIconWarning[] = [...(options.upstreamWarnings ?? [])];

  let nodeIndex = 0;
  const nodes: NormalizedNode[] = [];

  const rootContext: WalkContext = {
    presentation: readPresentation(root, {}),
    transform: parseTransformAttribute(root.getAttribute('transform')),
    unsupported: collectUnsupportedFeatures(root, defs, []),
  };

  for (const child of Array.from(root.children)) {
    nodeIndex = walkNode(child, rootContext, defs, nodes, nodeIndex, warnings);
  }

  return {
    name: options.name ?? 'Imported SVG',
    tags: options.tags ?? [],
    viewBox,
    nodes,
    provenance: options.provenance,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// DOM tree walker
// ---------------------------------------------------------------------------

function walkNode(
  element: Element,
  parentCtx: WalkContext,
  defs: DefRegistry,
  out: NormalizedNode[],
  nextIndex: number,
  warnings: ExternalIconWarning[],
): number {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'defs') return nextIndex;

  const presentation = readPresentation(element, parentCtx.presentation);
  const transform = multiplyMatrices(
    parentCtx.transform,
    parseTransformAttribute(element.getAttribute('transform')),
  );
  const unsupported = collectUnsupportedFeatures(element, defs, parentCtx.unsupported);

  if (SUPPORTED_SHAPE_TAGS.has(tagName)) {
    const node = createNodeFromElement(
      element,
      tagName as NormalizedNodeKind,
      presentation,
      transform,
      unsupported,
      defs,
      nextIndex,
      warnings,
    );
    out.push(node);
    return nextIndex + 1;
  }

  // <g> or other container — recurse
  if (tagName === 'g') {
    const children: NormalizedNode[] = [];
    let childIndex = 0;
    for (const child of Array.from(element.children)) {
      childIndex = walkNode(
        child,
        { presentation, transform, unsupported },
        defs,
        children,
        childIndex,
        warnings,
      );
    }

    // Flatten group — add children directly to output with top-level indices.
    // We preserve groups structurally only if they have children.
    for (const child of children) {
      out.push({ ...child, index: nextIndex });
      nextIndex += 1;
    }
    return nextIndex;
  }

  // Unknown container — try recursing into children
  for (const child of Array.from(element.children)) {
    nextIndex = walkNode(
      child,
      { presentation, transform, unsupported },
      defs,
      out,
      nextIndex,
      warnings,
    );
  }
  return nextIndex;
}

// ---------------------------------------------------------------------------
// Node construction
// ---------------------------------------------------------------------------

function createNodeFromElement(
  element: Element,
  kind: NormalizedNodeKind,
  presentation: ResolvedPresentation,
  transform: Matrix,
  inheritedUnsupported: SvgUnsupportedFeature[],
  defs: DefRegistry,
  index: number,
  warnings: ExternalIconWarning[],
): NormalizedNode {
  const unsupported = [...inheritedUnsupported];

  // Resolve paints
  const fillRes = resolvePaintValue(presentation.fill, presentation.color, defs);
  const strokeRes = resolvePaintValue(presentation.stroke, presentation.color, defs);
  unsupported.push(...fillRes.unsupported, ...strokeRes.unsupported);

  // Build style
  const style: NormalizedStyle = {};
  if (fillRes.paint) style.fill = fillRes.paint;
  if (strokeRes.paint) style.stroke = strokeRes.paint;
  if (presentation.strokeWidth !== undefined) style.strokeWidth = presentation.strokeWidth;

  const fillOpacity = combineOpacity(presentation.opacity, presentation.fillOpacity);
  const strokeOpacity = combineOpacity(presentation.opacity, presentation.strokeOpacity);
  if (fillOpacity !== undefined) style.fillOpacity = fillOpacity;
  if (strokeOpacity !== undefined) style.strokeOpacity = strokeOpacity;
  if (presentation.lineCap) style.lineCap = presentation.lineCap;
  if (presentation.lineJoin) style.lineJoin = presentation.lineJoin;
  if (presentation.visible === false) style.visible = false;

  // Extract geometry
  const geometry = extractGeometry(element, kind, presentation.fillRule);

  // Decompose transform
  const decomposed = decomposeSimpleTransform(transform);
  if (!decomposed && !isIdentity(transform)) {
    warnings.push(buildWarning('lossy_transform_flattening', 'Applied non-decomposable transform may lose fidelity', element, index));
    unsupported.push({ kind: 'transformFlattening', value: element.getAttribute('transform') ?? undefined });
  }
  const normalizedTransform: NormalizedTransform | undefined = decomposed ?? undefined;

  for (const feature of unsupported) {
    const mapped = mapUnsupportedFeatureToWarning(feature);
    if (mapped) {
      warnings.push(buildWarning(mapped.code, mapped.message, element, index));
    }
  }

  return {
    index,
    kind,
    geometry,
    style,
    transform: normalizedTransform,
    sourceMeta: {
      sourceTag: kind,
      sourceNodeId: element.getAttribute('id') ?? undefined,
      sourceClassName: element.getAttribute('class') ?? undefined,
      originalTransform: element.getAttribute('transform') ?? undefined,
      unsupported: dedupeUnsupported(unsupported),
    },
  };
}

// ---------------------------------------------------------------------------
// Geometry extraction — preserves primitives
// ---------------------------------------------------------------------------

function extractGeometry(
  element: Element,
  kind: NormalizedNodeKind,
  fillRule?: 'nonzero' | 'evenodd',
): NormalizedGeometry {
  switch (kind) {
    case 'path':
      return {
        kind: 'path',
        d: element.getAttribute('d') ?? '',
        fillRule,
      };
    case 'rect':
      return {
        kind: 'rect',
        x: parseNum(element.getAttribute('x')),
        y: parseNum(element.getAttribute('y')),
        width: parseNum(element.getAttribute('width')),
        height: parseNum(element.getAttribute('height')),
        rx: parseOptionalNum(element.getAttribute('rx')),
        ry: parseOptionalNum(element.getAttribute('ry')),
      };
    case 'circle':
      return {
        kind: 'circle',
        cx: parseNum(element.getAttribute('cx')),
        cy: parseNum(element.getAttribute('cy')),
        r: parseNum(element.getAttribute('r')),
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        cx: parseNum(element.getAttribute('cx')),
        cy: parseNum(element.getAttribute('cy')),
        rx: parseNum(element.getAttribute('rx')),
        ry: parseNum(element.getAttribute('ry')),
      };
    case 'line':
      return {
        kind: 'line',
        x1: parseNum(element.getAttribute('x1')),
        y1: parseNum(element.getAttribute('y1')),
        x2: parseNum(element.getAttribute('x2')),
        y2: parseNum(element.getAttribute('y2')),
      };
    case 'polyline':
      return {
        kind: 'polyline',
        points: parsePoints(element.getAttribute('points') ?? ''),
      };
    case 'polygon':
      return {
        kind: 'polygon',
        points: parsePoints(element.getAttribute('points') ?? ''),
      };
    default:
      return { kind: 'group' };
  }
}

// ---------------------------------------------------------------------------
// Presentation attribute resolution
// ---------------------------------------------------------------------------

function readPresentation(
  element: Element,
  inherited: Partial<ResolvedPresentation>,
): ResolvedPresentation {
  const result: ResolvedPresentation = { ...inherited };

  const color = readCssProperty(element, 'color');
  if (color) result.color = color;

  const fill = readCssProperty(element, 'fill');
  if (fill) result.fill = fill;

  const stroke = readCssProperty(element, 'stroke');
  if (stroke) result.stroke = stroke;

  const strokeWidth = parseOptionalNum(readCssProperty(element, 'stroke-width'));
  if (strokeWidth !== undefined) result.strokeWidth = strokeWidth;

  const opacity = parseOptionalNum(readCssProperty(element, 'opacity'));
  if (opacity !== undefined) result.opacity = opacity;

  const fillOpacity = parseOptionalNum(readCssProperty(element, 'fill-opacity'));
  if (fillOpacity !== undefined) result.fillOpacity = fillOpacity;

  const strokeOpacity = parseOptionalNum(readCssProperty(element, 'stroke-opacity'));
  if (strokeOpacity !== undefined) result.strokeOpacity = strokeOpacity;

  const lineCap = readCssProperty(element, 'stroke-linecap');
  if (lineCap === 'butt' || lineCap === 'round' || lineCap === 'square') {
    result.lineCap = lineCap;
  }

  const lineJoin = readCssProperty(element, 'stroke-linejoin');
  if (lineJoin === 'miter' || lineJoin === 'round' || lineJoin === 'bevel') {
    result.lineJoin = lineJoin;
  }

  const fillRule = readCssProperty(element, 'fill-rule');
  if (fillRule === 'nonzero' || fillRule === 'evenodd') {
    result.fillRule = fillRule;
  }

  const visibility = readCssProperty(element, 'visibility');
  if (visibility === 'hidden' || visibility === 'collapse') {
    result.visible = false;
  }

  const display = readCssProperty(element, 'display');
  if (display === 'none') {
    result.visible = false;
  }

  return result;
}

function readCssProperty(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

// ---------------------------------------------------------------------------
// Paint resolution
// ---------------------------------------------------------------------------

function resolvePaintValue(
  value: string | undefined,
  color: string | undefined,
  defs: DefRegistry,
): PaintResolution {
  if (!value || value === 'none') return { paint: undefined, unsupported: [] };
  if (value === 'currentColor') return { paint: { mode: 'currentColor' }, unsupported: [] };
  if (!value.startsWith('url(')) {
    return {
      paint: { mode: 'fixed', value: resolveCurrentColor(value, color) },
      unsupported: [],
    };
  }

  const refId = extractUrlReference(value);
  if (!refId) {
    return {
      paint: undefined,
      unsupported: [{ kind: 'unsupportedPaintReference', value }],
    };
  }

  const gradient = resolveGradient(refId, defs, new Set());
  if (gradient) return gradient;

  return {
    paint: undefined,
    unsupported: [{
      kind: 'unsupportedPaintReference',
      value,
      refId,
      raw: defs.rawById.get(refId),
    }],
  };
}

function resolveCurrentColor(value: string, color?: string): string {
  return value === 'currentColor' ? (color ?? 'currentColor') : value;
}

function resolveGradient(
  id: string,
  defs: DefRegistry,
  seen: Set<string>,
): PaintResolution | null {
  if (seen.has(id)) {
    return {
      paint: undefined,
      unsupported: [{ kind: 'gradientHref', refId: id, value: 'circular-reference' }],
    };
  }
  const record = defs.gradients.get(id);
  if (!record) return null;
  seen.add(id);

  const href = record.element.getAttribute('href') ?? record.element.getAttribute('xlink:href');
  const baseRefId = href ? extractUrlReference(href) ?? href.replace(/^#/, '') : null;
  const base = baseRefId ? resolveGradient(baseRefId, defs, seen) : null;
  const unsupported = [...(base?.unsupported ?? [])];
  if (baseRefId) {
    unsupported.push({ kind: 'gradientHref', refId: baseRefId, raw: defs.rawById.get(baseRefId) });
  }

  const tagName = record.element.tagName.toLowerCase();
  const gradientTransform = record.element.getAttribute('gradientTransform');
  if (gradientTransform) unsupported.push({ kind: 'gradientTransform', value: gradientTransform });
  const gradientUnits = record.element.getAttribute('gradientUnits');
  if (gradientUnits && gradientUnits !== 'objectBoundingBox') unsupported.push({ kind: 'gradientUnits', value: gradientUnits });
  const spreadMethod = record.element.getAttribute('spreadMethod');
  if (spreadMethod && spreadMethod !== 'pad') unsupported.push({ kind: 'gradientSpreadMethod', value: spreadMethod });
  if (tagName === 'lineargradient') {
    const baseAngle = base?.paint?.mode === 'linearGradient' ? base.paint.angle : 0;
    const x1 = parseCoordinate(record.element.getAttribute('x1'), 0);
    const y1 = parseCoordinate(record.element.getAttribute('y1'), 0);
    const x2 = parseCoordinate(record.element.getAttribute('x2'), 1);
    const y2 = parseCoordinate(record.element.getAttribute('y2'), 0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON
      ? baseAngle
      : roundNumber((Math.atan2(dy, dx) * 180) / Math.PI);
    const stops = parseGradientStops(record.element, base?.paint, baseRefId ? defs.gradients.get(baseRefId)?.element ?? null : null);
    return {
      paint: { mode: 'linearGradient', angle, stops },
      unsupported: dedupeUnsupported(unsupported),
    };
  }

  if (tagName === 'radialgradient') {
    const basePaint = base?.paint?.mode === 'radialGradient' ? base.paint : undefined;
    const cx = parseCoordinate(record.element.getAttribute('cx'), basePaint?.cx ?? 0.5);
    const cy = parseCoordinate(record.element.getAttribute('cy'), basePaint?.cy ?? 0.5);
    const r = parseCoordinate(record.element.getAttribute('r'), basePaint?.r ?? 0.5);
    const fx = record.element.getAttribute('fx');
    const fy = record.element.getAttribute('fy');
    if (fx || fy) unsupported.push({ kind: 'radialGradientFocus', value: [fx, fy].filter(Boolean).join(',') });
    const stops = parseGradientStops(record.element, base?.paint, baseRefId ? defs.gradients.get(baseRefId)?.element ?? null : null);
    return {
      paint: { mode: 'radialGradient', cx, cy, r, stops },
      unsupported: dedupeUnsupported(unsupported),
    };
  }

  return null;
}

function parseGradientStops(
  element: Element,
  basePaint: PaintRef | undefined,
  baseElement: Element | null,
): Array<{ offset: number; color: string; opacity?: number }> {
  const ownStops = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === 'stop',
  );
  if (ownStops.length === 0) {
    if (basePaint?.mode === 'linearGradient' || basePaint?.mode === 'radialGradient') {
      return basePaint.stops.map((s) => ({ ...s }));
    }
    if (baseElement) {
      return Array.from(baseElement.children)
        .filter((c) => c.tagName.toLowerCase() === 'stop')
        .map(parseStop);
    }
    return [];
  }
  return ownStops.map(parseStop);
}

function parseStop(stop: Element): { offset: number; color: string; opacity?: number } {
  const stopColor = readCssProperty(stop, 'stop-color') ?? '#000000';
  const opacity = parseOptionalNum(readCssProperty(stop, 'stop-opacity'));
  return {
    offset: clamp(parseCoordinate(stop.getAttribute('offset'), 0), 0, 1),
    color: stopColor,
    opacity: opacity === undefined ? undefined : clamp(opacity, 0, 1),
  };
}

// ---------------------------------------------------------------------------
// ViewBox parsing
// ---------------------------------------------------------------------------

function parseViewBox(svg: Element): [number, number, number, number] {
  const attr = svg.getAttribute('viewBox') ?? svg.getAttribute('viewbox');
  if (!attr) {
    const width = parseNum(svg.getAttribute('width'));
    const height = parseNum(svg.getAttribute('height'));
    return [0, 0, width || 24, height || 24];
  }
  const parts = attr.split(/[\s,]+/).map(Number);
  if (parts.length >= 4 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
  }
  return [0, 0, 24, 24];
}

// ---------------------------------------------------------------------------
// Defs collection
// ---------------------------------------------------------------------------

function collectDefs(svg: Element): DefRegistry {
  const gradients = new Map<string, GradientRecord>();
  const rawById = new Map<string, string>();
  const styles: string[] = [];

  const defsElements = svg.querySelectorAll('defs');
  for (const defs of Array.from(defsElements)) {
    for (const child of Array.from(defs.children)) {
      const id = child.getAttribute('id');
      if (id) rawById.set(id, (child as unknown as { outerHTML: string }).outerHTML);
      const tag = child.tagName.toLowerCase();
      if ((tag === 'lineargradient' || tag === 'radialgradient') && id) {
        gradients.set(id, { id, element: child });
      }
      if (tag === 'style') {
        styles.push(child.textContent ?? '');
      }
    }
  }

  return { gradients, rawById, styles };
}

// ---------------------------------------------------------------------------
// Unsupported feature collection
// ---------------------------------------------------------------------------

function collectUnsupportedFeatures(
  element: Element,
  defs: DefRegistry,
  inherited: SvgUnsupportedFeature[],
): SvgUnsupportedFeature[] {
  const next: SvgUnsupportedFeature[] = inherited.map((f): SvgUnsupportedFeature => ({
    kind: f.kind,
    value: f.value,
    refId: f.refId,
    raw: f.raw,
    attributes: f.attributes ? { ...f.attributes } : undefined,
  }));

  const clipPath = element.getAttribute('clip-path');
  if (clipPath) next.push(buildRefUnsupported('clipPath', clipPath, defs));

  const mask = element.getAttribute('mask');
  if (mask) next.push(buildRefUnsupported('mask', mask, defs));

  const filter = element.getAttribute('filter');
  if (filter) next.push(buildRefUnsupported('filter', filter, defs));

  const fill = readCssProperty(element, 'fill');
  if (fill?.startsWith('url(')) {
    const refId = extractUrlReference(fill);
    if (refId && defs.rawById.has(refId) && !defs.gradients.has(refId)) {
      next.push(buildRefUnsupported('pattern', fill, defs));
    }
  }

  if (element.hasAttribute('class') && defs.styles.length > 0) {
    next.push({
      kind: 'cssClass',
      value: element.getAttribute('class') ?? undefined,
      raw: defs.styles.join('\n'),
    });
  }

  const href = element.getAttribute('href') ?? element.getAttribute('xlink:href');
  if (href && !href.startsWith('#')) {
    next.push({ kind: 'externalHrefReference', value: href });
  }

  const unsupportedAttributes = collectUnsupportedAttributes(element);
  if (unsupportedAttributes.length > 0) {
    next.push({
      kind: 'unsupportedAttribute',
      attributes: Object.fromEntries(unsupportedAttributes.map((name) => [name, element.getAttribute(name) ?? ''])),
    });
  }

  return dedupeUnsupported(next);
}

function buildRefUnsupported(
  kind: string,
  value: string,
  defs: DefRegistry,
): SvgUnsupportedFeature {
  const refId = extractUrlReference(value);
  return {
    kind,
    value,
    refId: refId ?? undefined,
    raw: refId ? defs.rawById.get(refId) : undefined,
  };
}

function collectUnsupportedAttributes(element: Element): string[] {
  const supported = new Set([
    'id', 'class', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points',
    'transform', 'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap',
    'stroke-linejoin', 'fill-rule', 'display', 'visibility', 'clip-path', 'mask', 'filter', 'href', 'xlink:href',
  ]);
  const attrs = element.attributes;
  const names = (attrs && typeof attrs === 'object' && !(Symbol.iterator in attrs))
    ? Object.keys(attrs as unknown as Record<string, string>)
    : Array.from(attrs).map((a) => a.name);
  return names.filter((name) => !supported.has(name.toLowerCase()));
}

function mapUnsupportedFeatureToWarning(feature: SvgUnsupportedFeature): { code: ExternalIconWarning['code']; message: string } | null {
  switch (feature.kind) {
    case 'clipPath':
      return { code: 'clip_path_ignored', message: 'clipPath is not supported and was ignored' };
    case 'mask':
      return { code: 'mask_ignored', message: 'mask is not supported and was ignored' };
    case 'filter':
      return { code: 'filter_ignored', message: 'filter is not supported and was ignored' };
    case 'cssClass':
    case 'styleElement':
      return { code: 'style_dependency_removed', message: 'CSS class/style dependency was removed' };
    case 'gradientTransform':
    case 'gradientUnits':
    case 'gradientSpreadMethod':
    case 'gradientHref':
    case 'radialGradientFocus':
      return { code: 'gradient_simplified', message: 'Gradient was simplified due to unsupported features' };
    case 'pattern':
    case 'unsupportedPaintReference':
    case 'unsupportedAttribute':
    case 'externalHrefReference':
      return { code: 'unsupported_feature_dropped', message: `Unsupported feature dropped (${feature.kind})` };
    default:
      return null;
  }
}

function buildWarning(
  code: ExternalIconWarning['code'],
  message: string,
  element: Element,
  nodeIndex: number,
): ExternalIconWarning {
  return {
    code,
    message,
    severity: 'warning',
    context: element.tagName.toLowerCase(),
    nodeRef: {
      tagName: element.tagName.toLowerCase(),
      nodeId: element.getAttribute('id') ?? undefined,
      className: element.getAttribute('class') ?? undefined,
      nodeIndex,
    },
  };
}

// ---------------------------------------------------------------------------
// Transform handling
// ---------------------------------------------------------------------------

function parseTransformAttribute(attr: string | null): Matrix {
  if (!attr) return IDENTITY;

  const result: Matrix = [...IDENTITY] as Matrix;
  const functionRegex = /(\w+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(attr)) !== null) {
    const fn = match[1]!;
    const args = match[2]!.split(/[\s,]+/).map(Number);
    const m = parseSingleTransform(fn, args);
    const out = multiplyMatrices(result, m);
    result[0] = out[0]; result[1] = out[1]; result[2] = out[2];
    result[3] = out[3]; result[4] = out[4]; result[5] = out[5];
  }

  return result;
}

function parseSingleTransform(fn: string, args: number[]): Matrix {
  switch (fn) {
    case 'translate':
      return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    case 'scale': {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const angle = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (args.length >= 3) {
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;
        return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
      }
      return [cos, sin, -sin, cos, 0, 0];
    }
    case 'matrix':
      return [args[0] ?? 1, args[1] ?? 0, args[2] ?? 0, args[3] ?? 1, args[4] ?? 0, args[5] ?? 0];
    case 'skewX': {
      const angle = ((args[0] ?? 0) * Math.PI) / 180;
      return [1, 0, Math.tan(angle), 1, 0, 0];
    }
    case 'skewY': {
      const angle = ((args[0] ?? 0) * Math.PI) / 180;
      return [1, Math.tan(angle), 0, 1, 0, 0];
    }
    default:
      return IDENTITY;
  }
}

function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * Decompose a 2D affine matrix into translate + rotate + scale when possible.
 * Returns null if the matrix contains skew (not representable).
 */
function decomposeSimpleTransform(m: Matrix): NormalizedTransform | null {
  const [a, b, c, d, e, f] = m;

  // Check for skew: if the matrix has non-orthogonal axes, we can't decompose
  const det = a * d - b * c;
  if (Math.abs(det) < EPSILON) return null;

  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = det / scaleX;
  const rotate = Math.atan2(b, a);

  // Check for skew by verifying the matrix is a pure scale+rotate+translate
  const expectedC = -Math.sin(rotate) * scaleY;
  const expectedD = Math.cos(rotate) * scaleY;
  if (Math.abs(c - expectedC) > EPSILON || Math.abs(d - expectedD) > EPSILON) {
    return null; // Has skew — cannot decompose
  }

  const result: NormalizedTransform = {};
  if (Math.abs(e) > EPSILON) result.x = roundNumber(e);
  if (Math.abs(f) > EPSILON) result.y = roundNumber(f);

  const rotateDeg = roundNumber((rotate * 180) / Math.PI);
  if (Math.abs(rotateDeg) > EPSILON) result.rotate = rotateDeg;

  if (Math.abs(scaleX - 1) > EPSILON) result.scaleX = roundNumber(scaleX);
  if (Math.abs(scaleY - 1) > EPSILON) result.scaleY = roundNumber(scaleY);

  // If all fields are default, check if matrix is identity
  if (Object.keys(result).length === 0) {
    return isIdentity(m) ? null : result;
  }

  return result;
}

function isIdentity(m: Matrix): boolean {
  return (
    Math.abs(m[0] - 1) < EPSILON &&
    Math.abs(m[1]) < EPSILON &&
    Math.abs(m[2]) < EPSILON &&
    Math.abs(m[3] - 1) < EPSILON &&
    Math.abs(m[4]) < EPSILON &&
    Math.abs(m[5]) < EPSILON
  );
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

function parseNum(value: string | null): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalNum(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseCoordinate(value: string | null, fallback: number): number {
  if (!value) return fallback;
  // Handle percentage values (e.g., "50%")
  if (value.endsWith('%')) {
    const n = Number(value.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePoints(attr: string): number[] {
  const tokens = attr.match(/-?[\d.]+(?:e[+-]?\d+)?/gi);
  if (!tokens) return [];
  return tokens.map(Number).filter(Number.isFinite);
}

function combineOpacity(
  opacity: number | undefined,
  channelOpacity: number | undefined,
): number | undefined {
  if (opacity === undefined && channelOpacity === undefined) return undefined;
  const o = opacity ?? 1;
  const co = channelOpacity ?? 1;
  const combined = roundNumber(o * co);
  return combined === 1 ? undefined : combined;
}

function roundNumber(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function extractUrlReference(value: string): string | null {
  const match = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/i.exec(value);
  return match?.[1] ?? null;
}

function dedupeUnsupported(features: SvgUnsupportedFeature[]): SvgUnsupportedFeature[] {
  const seen = new Set<string>();
  const result: SvgUnsupportedFeature[] = [];
  for (const f of features) {
    const key = JSON.stringify([f.kind, f.value ?? null, f.refId ?? null, f.raw ?? null, f.attributes ?? null]);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(f);
    }
  }
  return result;
}

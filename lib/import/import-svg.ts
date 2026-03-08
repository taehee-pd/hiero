import {
  createEllipsePath,
  createLinePath,
  createRectPath,
} from '@/lib/editor-core/path-shapes';
import type {
  Layer,
  PaintRef,
  SvgImportLayerMeta,
  SvgUnsupportedFeature,
} from '@/lib/schema/types';

type ImportResult = {
  layers: Record<string, Layer>;
  viewBox: [number, number, number, number];
};

type Matrix = [number, number, number, number, number, number];

type SupportedShapeTag =
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'polyline';

type FillRule = 'nonzero' | 'evenodd';

type ResolvedPresentation = {
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: Layer['style']['lineCap'];
  lineJoin?: Layer['style']['lineJoin'];
  fillRule?: FillRule;
  visible?: boolean;
};

type TraverseContext = {
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

type NormalizedCommand =
  | { type: 'M'; values: [number, number] }
  | { type: 'L'; values: [number, number] }
  | { type: 'Q'; values: [number, number, number, number] }
  | { type: 'C'; values: [number, number, number, number, number, number] }
  | { type: 'Z'; values: [] };

const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];
const EPSILON = 1e-6;
const KAPPA = 0.5522847498;

export function importSvg(svgString: string): ImportResult {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Failed to parse SVG: ${parserError.textContent?.trim() ?? 'Unknown parser error'}`);
  }

  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error('Expected an <svg> root element.');
  }

  const defs = collectDefs(svg);
  const viewBox = parseViewBox(svg);
  const layers: Record<string, Layer> = {};
  const idCounts = new Map<string, number>();

  const rootContext: TraverseContext = {
    presentation: readPresentation(svg, {}),
    transform: parseTransformAttribute(svg.getAttribute('transform')),
    unsupported: collectUnsupportedFeatures(svg, defs, []),
  };

  for (const child of Array.from(svg.children)) {
    walkNode(child, rootContext, defs, layers, idCounts);
  }

  return { layers, viewBox };
}

function walkNode(
  element: Element,
  parentContext: TraverseContext,
  defs: DefRegistry,
  out: Record<string, Layer>,
  idCounts: Map<string, number>,
): void {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'defs') return;

  const presentation = readPresentation(element, parentContext.presentation);
  const transform = multiplyMatrices(
    parentContext.transform,
    parseTransformAttribute(element.getAttribute('transform')),
  );
  const unsupported = collectUnsupportedFeatures(element, defs, parentContext.unsupported);

  if (isSupportedShapeTag(tagName)) {
    const layer = createLayerFromElement(
      element,
      tagName,
      presentation,
      transform,
      unsupported,
      defs,
      idCounts,
    );
    out[layer.id] = layer;
    return;
  }

  for (const child of Array.from(element.children)) {
    walkNode(child, { presentation, transform, unsupported }, defs, out, idCounts);
  }
}

function createLayerFromElement(
  element: Element,
  sourceTag: SupportedShapeTag,
  presentation: ResolvedPresentation,
  transform: Matrix,
  inheritedUnsupported: SvgUnsupportedFeature[],
  defs: DefRegistry,
  idCounts: Map<string, number>,
): Layer {
  let d = normalizeShapeToPath(element, sourceTag);
  const unsupported = [...inheritedUnsupported];

  const transformAttr = element.getAttribute('transform') ?? undefined;
  const decomposedTransform = decomposeSimpleTransform(transform);
  if (!decomposedTransform) {
    d = applyMatrixToPath(d, transform);
  }

  const fillResolution = resolvePaintValue(
    presentation.fill,
    presentation.color,
    defs,
  );
  const strokeResolution = resolvePaintValue(
    presentation.stroke,
    presentation.color,
    defs,
  );
  unsupported.push(...fillResolution.unsupported, ...strokeResolution.unsupported);

  const style: Layer['style'] = {};
  if (fillResolution.paint) {
    style.fill = fillResolution.paint;
  }
  if (strokeResolution.paint) {
    style.stroke = strokeResolution.paint;
  }
  if (presentation.strokeWidth !== undefined) {
    style.strokeWidth = presentation.strokeWidth;
  }

  const fillOpacity = combineOpacity(presentation.opacity, presentation.fillOpacity);
  const strokeOpacity = combineOpacity(presentation.opacity, presentation.strokeOpacity);
  if (fillOpacity !== undefined) {
    style.fillOpacity = fillOpacity;
  }
  if (strokeOpacity !== undefined) {
    style.strokeOpacity = strokeOpacity;
  }
  if (presentation.lineCap) {
    style.lineCap = presentation.lineCap;
  }
  if (presentation.lineJoin) {
    style.lineJoin = presentation.lineJoin;
  }

  const importMeta = buildImportMeta(element, sourceTag, transformAttr, unsupported);

  return {
    id: buildLayerId(element, sourceTag, idCounts),
    visible: presentation.visible === false ? false : undefined,
    path: {
      d,
      fillRule: presentation.fillRule,
    },
    style,
    transform: decomposedTransform ?? undefined,
    importMeta,
  };
}

function buildImportMeta(
  element: Element,
  sourceTag: SupportedShapeTag,
  transformAttr: string | undefined,
  unsupported: SvgUnsupportedFeature[],
): SvgImportLayerMeta | undefined {
  const className = element.getAttribute('class') ?? undefined;
  if (!className && !transformAttr && unsupported.length === 0 && !element.getAttribute('id')) {
    return undefined;
  }

  return {
    sourceTag,
    sourceNodeId: element.getAttribute('id') ?? undefined,
    sourceClassName: className,
    originalTransform: transformAttr,
    unsupported: unsupported.length > 0 ? unsupported : undefined,
  };
}

function collectDefs(svg: Element): DefRegistry {
  const gradients = new Map<string, GradientRecord>();
  const rawById = new Map<string, string>();
  const styles: string[] = [];

  const defsElements = Array.from(svg.querySelectorAll('defs'));
  for (const defs of defsElements) {
    for (const child of Array.from(defs.children)) {
      const id = child.getAttribute('id');
      if (id) {
        rawById.set(id, child.outerHTML);
      }
      const tagName = child.tagName.toLowerCase();
      if ((tagName === 'lineargradient' || tagName === 'radialgradient') && id) {
        gradients.set(id, { id, element: child });
      }
      if (tagName === 'style') {
        styles.push(child.textContent ?? '');
      }
    }
  }

  return { gradients, rawById, styles };
}

function collectUnsupportedFeatures(
  element: Element,
  defs: DefRegistry,
  inherited: SvgUnsupportedFeature[],
): SvgUnsupportedFeature[] {
  const next = inherited.map(cloneUnsupportedFeature);

  const clipPath = element.getAttribute('clip-path');
  if (clipPath) {
    next.push(buildReferencedUnsupportedFeature('clipPath', clipPath, defs));
  }

  const mask = element.getAttribute('mask');
  if (mask) {
    next.push(buildReferencedUnsupportedFeature('mask', mask, defs));
  }

  const filter = element.getAttribute('filter');
  if (filter) {
    next.push(buildReferencedUnsupportedFeature('filter', filter, defs));
  }

  const fill = readCssProperty(element, 'fill');
  if (fill?.startsWith('url(')) {
    const refId = extractUrlReference(fill);
    if (refId && defs.rawById.has(refId) && !defs.gradients.has(refId)) {
      next.push(buildReferencedUnsupportedFeature('pattern', fill, defs));
    }
  }

  if (element.hasAttribute('class') && defs.styles.length > 0) {
    next.push({
      kind: 'cssClass',
      value: element.getAttribute('class') ?? undefined,
      raw: defs.styles.join('\n'),
    });
  }

  return dedupeUnsupported(next);
}

function buildReferencedUnsupportedFeature(
  kind: SvgUnsupportedFeature['kind'],
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

function cloneUnsupportedFeature(feature: SvgUnsupportedFeature): SvgUnsupportedFeature {
  return {
    ...feature,
    attributes: feature.attributes ? { ...feature.attributes } : undefined,
  };
}

function dedupeUnsupported(features: SvgUnsupportedFeature[]): SvgUnsupportedFeature[] {
  const seen = new Set<string>();
  const deduped: SvgUnsupportedFeature[] = [];

  for (const feature of features) {
    const key = JSON.stringify([
      feature.kind,
      feature.value ?? null,
      feature.refId ?? null,
      feature.raw ?? null,
      feature.attributes ?? null,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(feature);
  }

  return deduped;
}

function resolvePaintValue(
  value: string | undefined,
  color: string | undefined,
  defs: DefRegistry,
): PaintResolution {
  if (!value || value === 'none') {
    return { paint: undefined, unsupported: [] };
  }
  if (value === 'currentColor') {
    return { paint: { mode: 'currentColor' }, unsupported: [] };
  }
  if (!value.startsWith('url(')) {
    return { paint: { mode: 'fixed', value: resolveCurrentColor(value, color) }, unsupported: [] };
  }

  const refId = extractUrlReference(value);
  if (!refId) {
    return {
      paint: undefined,
      unsupported: [{ kind: 'unsupportedPaintReference', value }],
    };
  }

  const gradient = resolveGradient(refId, defs, new Set());
  if (gradient) {
    return gradient;
  }

  return {
    paint: undefined,
    unsupported: [
      {
        kind: 'unsupportedPaintReference',
        value,
        refId,
        raw: defs.rawById.get(refId),
      },
    ],
  };
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
    unsupported.push({
      kind: 'gradientHref',
      refId: baseRefId,
      raw: defs.rawById.get(baseRefId),
    });
  }

  const tagName = record.element.tagName.toLowerCase();
  if (tagName === 'lineargradient') {
    const angle = computeLinearGradientAngle(record.element, base?.paint);
    const stops = parseGradientStops(
      record.element,
      base?.paint,
      baseRefId ? defs.gradients.get(baseRefId)?.element ?? null : null,
    );
    unsupported.push(...collectGradientUnsupported(record.element));
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
    const stops = parseGradientStops(
      record.element,
      base?.paint,
      baseRefId ? defs.gradients.get(baseRefId)?.element ?? null : null,
    );
    unsupported.push(...collectGradientUnsupported(record.element));
    if (
      record.element.hasAttribute('fx') ||
      record.element.hasAttribute('fy') ||
      record.element.hasAttribute('fr')
    ) {
      unsupported.push({
        kind: 'radialGradientFocus',
        attributes: collectNamedAttributes(record.element, ['fx', 'fy', 'fr']),
      });
    }
    return {
      paint: { mode: 'radialGradient', cx, cy, r, stops },
      unsupported: dedupeUnsupported(unsupported),
    };
  }

  return null;
}

function collectGradientUnsupported(element: Element): SvgUnsupportedFeature[] {
  const unsupported: SvgUnsupportedFeature[] = [];
  const gradientTransform = element.getAttribute('gradientTransform');
  if (gradientTransform) {
    unsupported.push({ kind: 'gradientTransform', value: gradientTransform });
  }
  const gradientUnits = element.getAttribute('gradientUnits');
  if (gradientUnits && gradientUnits !== 'objectBoundingBox') {
    unsupported.push({ kind: 'gradientUnits', value: gradientUnits });
  }
  const spreadMethod = element.getAttribute('spreadMethod');
  if (spreadMethod && spreadMethod !== 'pad') {
    unsupported.push({ kind: 'gradientSpreadMethod', value: spreadMethod });
  }
  return unsupported;
}

function computeLinearGradientAngle(
  element: Element,
  basePaint: PaintRef | undefined,
): number {
  const baseAngle = basePaint?.mode === 'linearGradient' ? basePaint.angle : 0;
  const x1 = parseCoordinate(element.getAttribute('x1'), 0);
  const y1 = parseCoordinate(element.getAttribute('y1'), 0);
  const x2 = parseCoordinate(element.getAttribute('x2'), 1);
  const y2 = parseCoordinate(element.getAttribute('y2'), 0);
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return baseAngle;
  }
  return roundNumber((Math.atan2(dy, dx) * 180) / Math.PI);
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
    if (
      basePaint?.mode === 'linearGradient' ||
      basePaint?.mode === 'radialGradient'
    ) {
      return basePaint.stops.map((stop) => ({ ...stop }));
    }
    if (baseElement) {
      const nestedStops = Array.from(baseElement.children).filter(
        (child) => child.tagName.toLowerCase() === 'stop',
      );
      return nestedStops.map(parseStop);
    }
    return [];
  }
  return ownStops.map(parseStop);
}

function parseStop(stop: Element): { offset: number; color: string; opacity?: number } {
  const stopColor = readCssProperty(stop, 'stop-color') ?? '#000000';
  const opacity = parseNumber(readCssProperty(stop, 'stop-opacity'));
  return {
    offset: clamp(parseCoordinate(stop.getAttribute('offset'), 0), 0, 1),
    color: stopColor,
    opacity: opacity === undefined ? undefined : clamp(opacity, 0, 1),
  };
}

function normalizeShapeToPath(element: Element, tagName: SupportedShapeTag): string {
  switch (tagName) {
    case 'path':
      return normalizePathData(element.getAttribute('d') ?? '');
    case 'rect':
      return normalizeRectToPath(element);
    case 'circle': {
      const cx = parseCoordinate(element.getAttribute('cx'), 0);
      const cy = parseCoordinate(element.getAttribute('cy'), 0);
      const r = parseCoordinate(element.getAttribute('r'), 0);
      return createEllipsePath(cx, cy, r, r);
    }
    case 'ellipse': {
      const cx = parseCoordinate(element.getAttribute('cx'), 0);
      const cy = parseCoordinate(element.getAttribute('cy'), 0);
      const rx = parseCoordinate(element.getAttribute('rx'), 0);
      const ry = parseCoordinate(element.getAttribute('ry'), 0);
      return createEllipsePath(cx, cy, rx, ry);
    }
    case 'line':
      return createLinePath(
        parseCoordinate(element.getAttribute('x1'), 0),
        parseCoordinate(element.getAttribute('y1'), 0),
        parseCoordinate(element.getAttribute('x2'), 0),
        parseCoordinate(element.getAttribute('y2'), 0),
      );
    case 'polygon':
      return pointsToPath(element.getAttribute('points') ?? '', true);
    case 'polyline':
      return pointsToPath(element.getAttribute('points') ?? '', false);
  }
}

function normalizeRectToPath(element: Element): string {
  const x = parseCoordinate(element.getAttribute('x'), 0);
  const y = parseCoordinate(element.getAttribute('y'), 0);
  const width = parseCoordinate(element.getAttribute('width'), 0);
  const height = parseCoordinate(element.getAttribute('height'), 0);
  const rxAttr = element.getAttribute('rx');
  const ryAttr = element.getAttribute('ry');

  if (!rxAttr && !ryAttr) {
    return createRectPath(x, y, width, height);
  }

  const rx = parseCoordinate(rxAttr, parseCoordinate(ryAttr, 0));
  const ry = parseCoordinate(ryAttr, rx);
  const radiusX = clamp(Math.abs(rx), 0, Math.abs(width) / 2);
  const radiusY = clamp(Math.abs(ry), 0, Math.abs(height) / 2);
  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const top = Math.min(y, y + height);
  const bottom = Math.max(y, y + height);
  const ox = radiusX * KAPPA;
  const oy = radiusY * KAPPA;

  return serializeCommands([
    { type: 'M', values: [left + radiusX, top] },
    { type: 'L', values: [right - radiusX, top] },
    {
      type: 'C',
      values: [
        right - radiusX + ox,
        top,
        right,
        top + radiusY - oy,
        right,
        top + radiusY,
      ],
    },
    { type: 'L', values: [right, bottom - radiusY] },
    {
      type: 'C',
      values: [
        right,
        bottom - radiusY + oy,
        right - radiusX + ox,
        bottom,
        right - radiusX,
        bottom,
      ],
    },
    { type: 'L', values: [left + radiusX, bottom] },
    {
      type: 'C',
      values: [
        left + radiusX - ox,
        bottom,
        left,
        bottom - radiusY + oy,
        left,
        bottom - radiusY,
      ],
    },
    { type: 'L', values: [left, top + radiusY] },
    {
      type: 'C',
      values: [
        left,
        top + radiusY - oy,
        left + radiusX - ox,
        top,
        left + radiusX,
        top,
      ],
    },
    { type: 'Z', values: [] },
  ]);
}

function pointsToPath(pointsAttr: string, closed: boolean): string {
  const numbers = tokenizeNumbers(pointsAttr);
  if (numbers.length < 2) return '';
  const commands: NormalizedCommand[] = [
    { type: 'M', values: [numbers[0] ?? 0, numbers[1] ?? 0] },
  ];
  for (let index = 2; index < numbers.length; index += 2) {
    commands.push({
      type: 'L',
      values: [numbers[index] ?? 0, numbers[index + 1] ?? 0],
    });
  }
  if (closed) {
    commands.push({ type: 'Z', values: [] });
  }
  return serializeCommands(commands);
}

function normalizePathData(d: string): string {
  const tokens = tokenizePath(d);
  if (tokens.length === 0) return '';

  const commands: NormalizedCommand[] = [];
  let index = 0;
  let command = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevCommand = '';
  let cubicControlX = 0;
  let cubicControlY = 0;
  let quadControlX = 0;
  let quadControlY = 0;

  const readNumber = (): number => {
    const token = tokens[index++];
    return token ? Number(token) : 0;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (isCommandToken(token)) {
      command = token;
      index += 1;
    } else if (!command) {
      throw new Error('Invalid path data: missing command.');
    }

    switch (command) {
      case 'M':
      case 'm': {
        const isRelative = command === 'm';
        const x = readNumber() + (isRelative ? cx : 0);
        const y = readNumber() + (isRelative ? cy : 0);
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        commands.push({ type: 'M', values: [x, y] });
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const lx = readNumber() + (isRelative ? cx : 0);
          const ly = readNumber() + (isRelative ? cy : 0);
          cx = lx;
          cy = ly;
          commands.push({ type: 'L', values: [lx, ly] });
        }
        prevCommand = 'L';
        break;
      }
      case 'L':
      case 'l': {
        const isRelative = command === 'l';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          cx = x;
          cy = y;
          commands.push({ type: 'L', values: [x, y] });
        }
        prevCommand = 'L';
        break;
      }
      case 'H':
      case 'h': {
        const isRelative = command === 'h';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x = readNumber() + (isRelative ? cx : 0);
          cx = x;
          commands.push({ type: 'L', values: [x, cy] });
        }
        prevCommand = 'L';
        break;
      }
      case 'V':
      case 'v': {
        const isRelative = command === 'v';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const y = readNumber() + (isRelative ? cy : 0);
          cy = y;
          commands.push({ type: 'L', values: [cx, y] });
        }
        prevCommand = 'L';
        break;
      }
      case 'C':
      case 'c': {
        const isRelative = command === 'c';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          commands.push({ type: 'C', values: [x1, y1, x2, y2, x, y] });
          cubicControlX = x2;
          cubicControlY = y2;
          cx = x;
          cy = y;
        }
        prevCommand = 'C';
        break;
      }
      case 'S':
      case 's': {
        const isRelative = command === 's';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const reflectedX =
            prevCommand === 'C' || prevCommand === 'S'
              ? cx + (cx - cubicControlX)
              : cx;
          const reflectedY =
            prevCommand === 'C' || prevCommand === 'S'
              ? cy + (cy - cubicControlY)
              : cy;
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          commands.push({
            type: 'C',
            values: [reflectedX, reflectedY, x2, y2, x, y],
          });
          cubicControlX = x2;
          cubicControlY = y2;
          cx = x;
          cy = y;
        }
        prevCommand = 'S';
        break;
      }
      case 'Q':
      case 'q': {
        const isRelative = command === 'q';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          commands.push({ type: 'Q', values: [x1, y1, x, y] });
          quadControlX = x1;
          quadControlY = y1;
          cx = x;
          cy = y;
        }
        prevCommand = 'Q';
        break;
      }
      case 'T':
      case 't': {
        const isRelative = command === 't';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const controlX =
            prevCommand === 'Q' || prevCommand === 'T'
              ? cx + (cx - quadControlX)
              : cx;
          const controlY =
            prevCommand === 'Q' || prevCommand === 'T'
              ? cy + (cy - quadControlY)
              : cy;
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          commands.push({ type: 'Q', values: [controlX, controlY, x, y] });
          quadControlX = controlX;
          quadControlY = controlY;
          cx = x;
          cy = y;
        }
        prevCommand = 'T';
        break;
      }
      case 'A':
      case 'a': {
        const isRelative = command === 'a';
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const rx = readNumber();
          const ry = readNumber();
          const angle = readNumber();
          const largeArcFlag = readNumber();
          const sweepFlag = readNumber();
          const x = readNumber() + (isRelative ? cx : 0);
          const y = readNumber() + (isRelative ? cy : 0);
          const curves = arcToCubics(cx, cy, rx, ry, angle, largeArcFlag, sweepFlag, x, y);
          commands.push(...curves);
          cx = x;
          cy = y;
        }
        prevCommand = 'A';
        break;
      }
      case 'Z':
      case 'z':
        commands.push({ type: 'Z', values: [] });
        cx = sx;
        cy = sy;
        prevCommand = 'Z';
        break;
      default:
        throw new Error(`Unsupported path command: ${command}`);
    }
  }

  return serializeCommands(commands);
}

function tokenizePath(d: string): string[] {
  const matches = d.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  return matches ?? [];
}

function isCommandToken(token: string | undefined): boolean {
  return Boolean(token && /^[AaCcHhLlMmQqSsTtVvZz]$/.test(token));
}

function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number,
): NormalizedCommand[] {
  const curves = approximateArcToCubics(
    x1,
    y1,
    rx,
    ry,
    xAxisRotation,
    largeArcFlag,
    sweepFlag,
    x2,
    y2,
  );
  return curves.map((curve) => ({
    type: 'C',
    values: curve,
  }));
}

function approximateArcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angle: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number,
): Array<[number, number, number, number, number, number]> {
  const radiusX = Math.abs(rx);
  const radiusY = Math.abs(ry);
  if (radiusX < EPSILON || radiusY < EPSILON) {
    return [[x1, y1, x2, y2, x2, y2]];
  }
  if (Math.abs(x1 - x2) < EPSILON && Math.abs(y1 - y2) < EPSILON) {
    return [];
  }

  const phi = (angle * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1Prime = cosPhi * dx + sinPhi * dy;
  const y1Prime = -sinPhi * dx + cosPhi * dy;

  let adjustedRx = radiusX;
  let adjustedRy = radiusY;
  const lambda =
    (x1Prime * x1Prime) / (adjustedRx * adjustedRx) +
    (y1Prime * y1Prime) / (adjustedRy * adjustedRy);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    adjustedRx *= scale;
    adjustedRy *= scale;
  }

  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const numerator =
    adjustedRx * adjustedRx * adjustedRy * adjustedRy -
    adjustedRx * adjustedRx * y1Prime * y1Prime -
    adjustedRy * adjustedRy * x1Prime * x1Prime;
  const denominator =
    adjustedRx * adjustedRx * y1Prime * y1Prime +
    adjustedRy * adjustedRy * x1Prime * x1Prime;
  const factor = sign * Math.sqrt(Math.max(0, numerator / Math.max(denominator, EPSILON)));

  const cxPrime = (factor * adjustedRx * y1Prime) / adjustedRy;
  const cyPrime = (-factor * adjustedRy * x1Prime) / adjustedRx;
  const cx =
    cosPhi * cxPrime - sinPhi * cyPrime + (x1 + x2) / 2;
  const cy =
    sinPhi * cxPrime + cosPhi * cyPrime + (y1 + y2) / 2;

  const startAngle = angleBetween(
    1,
    0,
    (x1Prime - cxPrime) / adjustedRx,
    (y1Prime - cyPrime) / adjustedRy,
  );
  let deltaAngle = angleBetween(
    (x1Prime - cxPrime) / adjustedRx,
    (y1Prime - cyPrime) / adjustedRy,
    (-x1Prime - cxPrime) / adjustedRx,
    (-y1Prime - cyPrime) / adjustedRy,
  );

  if (!sweepFlag && deltaAngle > 0) {
    deltaAngle -= Math.PI * 2;
  } else if (sweepFlag && deltaAngle < 0) {
    deltaAngle += Math.PI * 2;
  }

  const segments = Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2));
  const step = deltaAngle / segments;
  const curves: Array<[number, number, number, number, number, number]> = [];

  for (let index = 0; index < segments; index += 1) {
    const theta1 = startAngle + step * index;
    const theta2 = theta1 + step;
    curves.push(
      arcSegmentToCubic(cx, cy, adjustedRx, adjustedRy, phi, theta1, theta2),
    );
  }

  return curves;
}

function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const magnitude = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const clamped = clamp(dot / Math.max(magnitude, EPSILON), -1, 1);
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  return sign * Math.acos(clamped);
}

function arcSegmentToCubic(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta1: number,
  theta2: number,
): [number, number, number, number, number, number] {
  const delta = theta2 - theta1;
  const alpha = (4 / 3) * Math.tan(delta / 4);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinTheta1 = Math.sin(theta1);
  const cosTheta1 = Math.cos(theta1);
  const sinTheta2 = Math.sin(theta2);
  const cosTheta2 = Math.cos(theta2);

  const x1 = cx + rx * cosPhi * cosTheta1 - ry * sinPhi * sinTheta1;
  const y1 = cy + rx * sinPhi * cosTheta1 + ry * cosPhi * sinTheta1;
  const x2 = cx + rx * cosPhi * cosTheta2 - ry * sinPhi * sinTheta2;
  const y2 = cy + rx * sinPhi * cosTheta2 + ry * cosPhi * sinTheta2;

  const dx1 = -rx * cosPhi * sinTheta1 - ry * sinPhi * cosTheta1;
  const dy1 = -rx * sinPhi * sinTheta1 + ry * cosPhi * cosTheta1;
  const dx2 = -rx * cosPhi * sinTheta2 - ry * sinPhi * cosTheta2;
  const dy2 = -rx * sinPhi * sinTheta2 + ry * cosPhi * cosTheta2;

  return [
    x1 + alpha * dx1,
    y1 + alpha * dy1,
    x2 - alpha * dx2,
    y2 - alpha * dy2,
    x2,
    y2,
  ];
}

function applyMatrixToPath(d: string, matrix: Matrix): string {
  const commands = parseNormalizedCommands(d).map((command) => transformCommand(command, matrix));
  return serializeCommands(commands);
}

function parseNormalizedCommands(d: string): NormalizedCommand[] {
  const tokens = tokenizePath(d);
  const commands: NormalizedCommand[] = [];
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index++];
    switch (command) {
      case 'M':
        commands.push({
          type: 'M',
          values: [Number(tokens[index++]), Number(tokens[index++])],
        });
        break;
      case 'L':
        commands.push({
          type: 'L',
          values: [Number(tokens[index++]), Number(tokens[index++])],
        });
        break;
      case 'Q':
        commands.push({
          type: 'Q',
          values: [
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
          ],
        });
        break;
      case 'C':
        commands.push({
          type: 'C',
          values: [
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
            Number(tokens[index++]),
          ],
        });
        break;
      case 'Z':
        commands.push({ type: 'Z', values: [] });
        break;
      default:
        throw new Error(`Expected normalized path command, received ${command}`);
    }
  }

  return commands;
}

function transformCommand(command: NormalizedCommand, matrix: Matrix): NormalizedCommand {
  switch (command.type) {
    case 'M':
    case 'L': {
      const point = transformPoint(command.values[0], command.values[1], matrix);
      return { type: command.type, values: [point.x, point.y] };
    }
    case 'Q': {
      const control = transformPoint(command.values[0], command.values[1], matrix);
      const point = transformPoint(command.values[2], command.values[3], matrix);
      return {
        type: 'Q',
        values: [control.x, control.y, point.x, point.y],
      };
    }
    case 'C': {
      const c1 = transformPoint(command.values[0], command.values[1], matrix);
      const c2 = transformPoint(command.values[2], command.values[3], matrix);
      const point = transformPoint(command.values[4], command.values[5], matrix);
      return {
        type: 'C',
        values: [c1.x, c1.y, c2.x, c2.y, point.x, point.y],
      };
    }
    case 'Z':
      return command;
  }
}

function serializeCommands(commands: NormalizedCommand[]): string {
  return commands
    .map((command) => {
      if (command.type === 'Z') return 'Z';
      return `${command.type}${command.values.map(formatNumber).join(' ')}`;
    })
    .join(' ');
}

function parseViewBox(svg: Element): [number, number, number, number] {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const values = tokenizeNumbers(viewBox);
    if (values.length === 4) {
      return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0];
    }
  }

  const width = parseCoordinate(svg.getAttribute('width'), 0);
  const height = parseCoordinate(svg.getAttribute('height'), 0);
  return [0, 0, width, height];
}

function readPresentation(
  element: Element,
  parent: ResolvedPresentation,
): ResolvedPresentation {
  const next: ResolvedPresentation = { ...parent };

  const color = readCssProperty(element, 'color');
  if (color) next.color = color;

  const fill = readCssProperty(element, 'fill');
  if (fill) next.fill = fill;

  const stroke = readCssProperty(element, 'stroke');
  if (stroke) next.stroke = stroke;

  const strokeWidth = parseNumber(readCssProperty(element, 'stroke-width'));
  if (strokeWidth !== undefined) next.strokeWidth = strokeWidth;

  const opacity = parseNumber(readCssProperty(element, 'opacity'));
  if (opacity !== undefined) next.opacity = opacity;

  const fillOpacity = parseNumber(readCssProperty(element, 'fill-opacity'));
  if (fillOpacity !== undefined) next.fillOpacity = fillOpacity;

  const strokeOpacity = parseNumber(readCssProperty(element, 'stroke-opacity'));
  if (strokeOpacity !== undefined) next.strokeOpacity = strokeOpacity;

  const lineCap = readCssProperty(element, 'stroke-linecap');
  if (lineCap === 'butt' || lineCap === 'round' || lineCap === 'square') {
    next.lineCap = lineCap;
  }

  const lineJoin = readCssProperty(element, 'stroke-linejoin');
  if (lineJoin === 'miter' || lineJoin === 'round' || lineJoin === 'bevel') {
    next.lineJoin = lineJoin;
  }

  const fillRule = readCssProperty(element, 'fill-rule');
  if (fillRule === 'nonzero' || fillRule === 'evenodd') {
    next.fillRule = fillRule;
  }

  const display = readCssProperty(element, 'display');
  const visibility = readCssProperty(element, 'visibility');
  if (display === 'none' || visibility === 'hidden') {
    next.visible = false;
  } else if (display || visibility) {
    next.visible = true;
  }

  return next;
}

function readCssProperty(element: Element, property: string): string | undefined {
  const attrName = property.toLowerCase();
  const direct = element.getAttribute(attrName);
  if (direct !== null) {
    return direct.trim();
  }

  const style = element.getAttribute('style');
  if (!style) return undefined;
  const declarations = style.split(';');
  for (const declaration of declarations) {
    const [rawName, rawValue] = declaration.split(':');
    if (!rawName || !rawValue) continue;
    if (rawName.trim().toLowerCase() === attrName) {
      return rawValue.trim();
    }
  }

  return undefined;
}

function parseTransformAttribute(transformAttr: string | null): Matrix {
  if (!transformAttr) return [...IDENTITY_MATRIX];
  const transformPattern = /([a-zA-Z]+)\(([^)]*)\)/g;
  let result = [...IDENTITY_MATRIX] as Matrix;
  let match: RegExpExecArray | null;
  while ((match = transformPattern.exec(transformAttr))) {
    const type = match[1]?.toLowerCase();
    const values = tokenizeNumbers(match[2] ?? '');
    const step = buildTransformMatrix(type ?? '', values);
    result = multiplyMatrices(result, step);
  }
  return result;
}

function buildTransformMatrix(type: string, values: number[]): Matrix {
  switch (type) {
    case 'matrix':
      return [
        values[0] ?? 1,
        values[1] ?? 0,
        values[2] ?? 0,
        values[3] ?? 1,
        values[4] ?? 0,
        values[5] ?? 0,
      ];
    case 'translate':
      return [1, 0, 0, 1, values[0] ?? 0, values[1] ?? 0];
    case 'scale': {
      const sx = values[0] ?? 1;
      const sy = values[1] ?? sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const angle = ((values[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cx = values[1] ?? 0;
      const cy = values[2] ?? 0;
      return multiplyMatrices(
        multiplyMatrices([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
        [1, 0, 0, 1, -cx, -cy],
      );
    }
    case 'skewx': {
      const angle = ((values[0] ?? 0) * Math.PI) / 180;
      return [1, 0, Math.tan(angle), 1, 0, 0];
    }
    case 'skewy': {
      const angle = ((values[0] ?? 0) * Math.PI) / 180;
      return [1, Math.tan(angle), 0, 1, 0, 0];
    }
    default:
      return [...IDENTITY_MATRIX];
  }
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function transformPoint(x: number, y: number, matrix: Matrix): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function decomposeSimpleTransform(matrix: Matrix): Layer['transform'] | null {
  if (isIdentityMatrix(matrix)) return undefined;

  const [a, b, c, d, e, f] = matrix;
  const scaleX = Math.hypot(a, b);
  if (scaleX < EPSILON) return null;
  const rotation = Math.atan2(b, a);
  const determinant = a * d - b * c;
  const scaleY = determinant / scaleX;
  const shear = a * c + b * d;

  if (Math.abs(shear) > 1e-4) {
    return null;
  }

  const transform: Layer['transform'] = {};
  if (Math.abs(e) > EPSILON) transform.x = roundNumber(e);
  if (Math.abs(f) > EPSILON) transform.y = roundNumber(f);
  if (Math.abs(rotation) > EPSILON) transform.rotate = roundNumber((rotation * 180) / Math.PI);
  if (Math.abs(scaleX - 1) > EPSILON) transform.scaleX = roundNumber(scaleX);
  if (Math.abs(scaleY - 1) > EPSILON) transform.scaleY = roundNumber(scaleY);
  return Object.keys(transform).length > 0 ? transform : undefined;
}

function isIdentityMatrix(matrix: Matrix): boolean {
  return (
    Math.abs(matrix[0] - 1) < EPSILON &&
    Math.abs(matrix[1]) < EPSILON &&
    Math.abs(matrix[2]) < EPSILON &&
    Math.abs(matrix[3] - 1) < EPSILON &&
    Math.abs(matrix[4]) < EPSILON &&
    Math.abs(matrix[5]) < EPSILON
  );
}

function buildLayerId(
  element: Element,
  sourceTag: SupportedShapeTag,
  idCounts: Map<string, number>,
): string {
  const base = sanitizeId(element.getAttribute('id') ?? sourceTag);
  const nextCount = (idCounts.get(base) ?? 0) + 1;
  idCounts.set(base, nextCount);
  return nextCount === 1 ? base : `${base}-${nextCount}`;
}

function sanitizeId(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'layer';
}

function isSupportedShapeTag(tagName: string): tagName is SupportedShapeTag {
  return (
    tagName === 'path' ||
    tagName === 'rect' ||
    tagName === 'circle' ||
    tagName === 'ellipse' ||
    tagName === 'line' ||
    tagName === 'polygon' ||
    tagName === 'polyline'
  );
}

function parseCoordinate(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return Number(trimmed.slice(0, -1)) / 100;
  }
  return Number.parseFloat(trimmed);
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tokenizeNumbers(value: string): number[] {
  const matches = value.match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  return (matches ?? []).map(Number);
}

function combineOpacity(
  opacity: number | undefined,
  channelOpacity: number | undefined,
): number | undefined {
  if (opacity === undefined && channelOpacity === undefined) return undefined;
  return roundNumber((opacity ?? 1) * (channelOpacity ?? 1));
}

function resolveCurrentColor(value: string, color: string | undefined): string {
  return value === 'currentColor' ? color ?? 'currentColor' : value;
}

function extractUrlReference(value: string): string | null {
  const match = value.match(/url\(\s*#([^)]+)\s*\)/);
  return match?.[1] ?? null;
}

function collectNamedAttributes(element: Element, names: string[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value !== null) {
      attributes[name] = value;
    }
  }
  return attributes;
}

function formatNumber(value: number): string {
  return String(roundNumber(value));
}

function roundNumber(value: number): number {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

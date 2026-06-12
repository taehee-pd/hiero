/**
 * Lottie static-shape import adapter.
 *
 * Converts a Lottie 5.x JSON document to a static SVG string by reading
 * the first-frame geometry from shape layers (type 4). Animation,
 * expressions, trim paths, gradients, masks, and precomps are
 * explicitly OUT OF SCOPE — unsupported features are skipped with a
 * warning string; they never throw.
 *
 * Entry point: `lottieToSvg(lottieJson)`
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LottieImportResult = {
  svg: string;
  name: string;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Internal Lottie shape types (subset — import-facing)
// ---------------------------------------------------------------------------

type LottieBezier = {
  v: number[][];
  i: number[][];
  o: number[][];
  c: boolean;
};

type AnyShape = Record<string, unknown> & { ty: string };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Convert a Lottie JSON document to a static SVG (first-frame shapes only).
 *
 * @throws `Error` with message starting "Not a Lottie document:" if the
 *   input is not a recognisable Lottie object.
 */
export function lottieToSvg(lottieJson: unknown): LottieImportResult {
  // --- Validate ---
  if (lottieJson === null || typeof lottieJson !== 'object' || Array.isArray(lottieJson)) {
    throw new Error('Not a Lottie document: expected a JSON object');
  }

  const doc = lottieJson as Record<string, unknown>;

  if (typeof doc['w'] !== 'number' || typeof doc['h'] !== 'number') {
    throw new Error('Not a Lottie document: missing numeric w/h dimensions');
  }

  if (!Array.isArray(doc['layers'])) {
    throw new Error('Not a Lottie document: missing layers array');
  }

  const w = doc['w'] as number;
  const h = doc['h'] as number;
  const nm = typeof doc['nm'] === 'string' ? doc['nm'] : 'Lottie import';
  const layers = doc['layers'] as unknown[];

  const warnings: string[] = [];
  const pathElements: string[] = [];

  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object' || Array.isArray(layer)) {
      continue;
    }
    const l = layer as Record<string, unknown>;
    const ty = l['ty'];

    if (ty !== 4) {
      // Non-shape layer — skip with warning
      warnings.push(`Skipped non-shape layer type ${String(ty)} (only type 4 shape layers are supported)`);
      continue;
    }

    const shapes = Array.isArray(l['shapes']) ? (l['shapes'] as unknown[]) : [];
    const els = processShapes(shapes, warnings);
    pathElements.push(...els);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    pathElements.join('') +
    `</svg>`;

  return { svg, name: nm, warnings };
}

// ---------------------------------------------------------------------------
// Shape processing
// ---------------------------------------------------------------------------

/**
 * Walk a flat list of shapes (from a layer or group `it`) and emit
 * `<path>` element strings.
 *
 * Lottie shape order (within a group) is bottom-to-top in the `it`
 * array; we iterate left-to-right and pick up sibling fill/stroke
 * items to attach to each path shape.
 */
function processShapes(shapes: unknown[], warnings: string[]): string[] {
  const elements: string[] = [];

  // Collect items as typed shapes
  const items: AnyShape[] = [];
  for (const s of shapes) {
    if (s !== null && typeof s === 'object' && !Array.isArray(s)) {
      const item = s as Record<string, unknown>;
      if (typeof item['ty'] === 'string') {
        items.push(item as AnyShape);
      }
    }
  }

  // Walk items; when we hit a 'gr' (group), recurse into it.
  // For top-level items, gather all path ('sh'), fill ('fl'), stroke ('st')
  // items and match them together.
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;

    if (item.ty === 'gr') {
      // Group — recurse into its `it` array
      const it = Array.isArray(item['it']) ? (item['it'] as unknown[]) : [];
      const groupEls = processGroupItems(it, warnings);
      elements.push(...groupEls);
      continue;
    }

    if (item.ty === 'tm') {
      warnings.push('Skipped trim path item (tm) — trim paths are not supported in static import');
      continue;
    }

    if (item.ty === 'gf' || item.ty === 'gs') {
      warnings.push('Skipped gradient fill/stroke (gf/gs) — gradients are not supported in static import');
      continue;
    }

    if (item.ty === 'mm') {
      warnings.push('Skipped merge paths (mm) — merge paths are not supported in static import');
      continue;
    }

    if (item.ty === 'rp') {
      warnings.push('Skipped repeater (rp) — repeaters are not supported in static import');
      continue;
    }

    // Top-level 'sh' items without a group: pair with sibling fill/stroke
    if (item.ty === 'sh') {
      // Look ahead for sibling fill/stroke (within the same layer items list)
      const fill = items.slice(i + 1).find((s) => s.ty === 'fl') ?? null;
      const stroke = items.slice(i + 1).find((s) => s.ty === 'st') ?? null;
      const el = buildPathElement(item, fill, stroke, null, warnings);
      if (el) elements.push(el);
    }

    // 'fl' and 'st' at top-level without a preceding 'sh' are ignored
    // (they'll be picked up by the 'sh' scan above)
  }

  return elements;
}

/**
 * Process the `it` array inside a Lottie group shape ('gr').
 * A group contains a mix of path ('sh'), fill ('fl'), stroke ('st'),
 * nested groups, and other shapes, plus a transform ('tr') at the end.
 */
function processGroupItems(items: unknown[], warnings: string[]): string[] {
  const elements: string[] = [];

  const typed: AnyShape[] = [];
  for (const s of items) {
    if (s !== null && typeof s === 'object' && !Array.isArray(s)) {
      const item = s as Record<string, unknown>;
      if (typeof item['ty'] === 'string') {
        typed.push(item as AnyShape);
      }
    }
  }

  // Extract group transform ('tr')
  const trItem = typed.find((s) => s.ty === 'tr') ?? null;
  const transform = trItem ? extractStaticTranslate(trItem, warnings) : null;

  // Collect paths, fills, strokes
  const pathItems = typed.filter((s) => s.ty === 'sh');
  const fillItem = typed.find((s) => s.ty === 'fl') ?? null;
  const strokeItem = typed.find((s) => s.ty === 'st') ?? null;

  // Handle unsupported items in the group
  for (const s of typed) {
    if (s.ty === 'tm') {
      warnings.push('Skipped trim path item (tm) in group — trim paths are not supported in static import');
    } else if (s.ty === 'gf' || s.ty === 'gs') {
      warnings.push('Skipped gradient fill/stroke (gf/gs) in group — gradients are not supported in static import');
    } else if (s.ty === 'mm') {
      warnings.push('Skipped merge paths (mm) in group — not supported in static import');
    } else if (s.ty === 'rp') {
      warnings.push('Skipped repeater (rp) in group — not supported in static import');
    } else if (s.ty === 'gr') {
      // Nested group — recurse
      const it = Array.isArray(s['it']) ? (s['it'] as unknown[]) : [];
      const nested = processGroupItems(it, warnings);
      elements.push(...nested);
    }
  }

  // Emit a <path> for each 'sh' in the group
  for (const pathItem of pathItems) {
    const el = buildPathElement(pathItem, fillItem, strokeItem, transform, warnings);
    if (el) elements.push(el);
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Path element builder
// ---------------------------------------------------------------------------

function buildPathElement(
  shapeItem: AnyShape,
  fillItem: AnyShape | null,
  strokeItem: AnyShape | null,
  transform: string | null,
  warnings: string[],
): string | null {
  const bezier = extractBezier(shapeItem, warnings);
  if (!bezier) return null;

  const d = bezierToSvgPath(bezier);
  if (!d) return null;

  const attrs: string[] = [`d="${d}"`];

  // Fill
  if (fillItem) {
    const fill = extractFillAttrs(fillItem, warnings);
    if (fill.color) attrs.push(`fill="${fill.color}"`);
    if (fill.opacity !== null) attrs.push(`fill-opacity="${fill.opacity}"`);
  } else {
    attrs.push('fill="none"');
  }

  // Stroke
  if (strokeItem) {
    const stroke = extractStrokeAttrs(strokeItem, warnings);
    if (stroke.color) attrs.push(`stroke="${stroke.color}"`);
    if (stroke.opacity !== null) attrs.push(`stroke-opacity="${stroke.opacity}"`);
    if (stroke.width !== null) attrs.push(`stroke-width="${stroke.width}"`);
  }

  // Transform
  if (transform) {
    attrs.push(`transform="${transform}"`);
  }

  return `<path ${attrs.join(' ')}/>`;
}

// ---------------------------------------------------------------------------
// Bezier extraction
// ---------------------------------------------------------------------------

function extractBezier(shapeItem: AnyShape, warnings: string[]): LottieBezier | null {
  const ks = shapeItem['ks'] as Record<string, unknown> | undefined;
  if (!ks) return null;

  const animated = ks['a'];
  const k = ks['k'];

  if (animated === 0 || animated === false) {
    // Static bezier
    return parseBezier(k);
  }

  if (animated === 1 || animated === true) {
    // Animated — use first keyframe
    if (Array.isArray(k) && k.length > 0) {
      const firstKf = k[0] as Record<string, unknown>;
      warnings.push(`Animated path "${String(shapeItem['nm'] ?? 'unnamed')}": using first keyframe only`);
      // Keyframe shape: { t, s: [LottieBezier], e?: [LottieBezier] }
      const s = firstKf['s'];
      if (Array.isArray(s) && s.length > 0) {
        return parseBezier(s[0]);
      }
    }
    return null;
  }

  return null;
}

function parseBezier(raw: unknown): LottieBezier | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;

  if (!Array.isArray(b['v']) || !Array.isArray(b['i']) || !Array.isArray(b['o'])) {
    return null;
  }

  return {
    v: b['v'] as number[][],
    i: b['i'] as number[][],
    o: b['o'] as number[][],
    c: b['c'] === true,
  };
}

// ---------------------------------------------------------------------------
// Bezier → SVG path
// ---------------------------------------------------------------------------

/**
 * Convert a Lottie bezier `{ v, i, o, c }` to an SVG path `d` string.
 *
 * Lottie convention:
 *   - `v[n]` — absolute vertex position
 *   - `o[n]` — out-tangent RELATIVE to `v[n]`
 *   - `i[n]` — in-tangent RELATIVE to `v[n]`
 *
 * SVG cubic bezier from vertex[n] to vertex[n+1]:
 *   C (v[n] + o[n])  (v[n+1] + i[n+1])  v[n+1]
 *
 * When closed, the wrap segment connects the last vertex back to the first.
 */
function bezierToSvgPath(bez: LottieBezier): string {
  const { v, i, o, c } = bez;
  const n = v.length;
  if (n === 0) return '';

  const fmt = (x: number) => +x.toFixed(4);

  const v0 = v[0]!;
  let d = `M ${fmt(v0[0] ?? 0)} ${fmt(v0[1] ?? 0)}`;

  for (let idx = 0; idx < n - 1; idx++) {
    const p0 = v[idx]!;
    const p1 = v[idx + 1]!;
    const cp1x = (p0[0] ?? 0) + (o[idx]?.[0] ?? 0);
    const cp1y = (p0[1] ?? 0) + (o[idx]?.[1] ?? 0);
    const cp2x = (p1[0] ?? 0) + (i[idx + 1]?.[0] ?? 0);
    const cp2y = (p1[1] ?? 0) + (i[idx + 1]?.[1] ?? 0);
    d += ` C ${fmt(cp1x)} ${fmt(cp1y)} ${fmt(cp2x)} ${fmt(cp2y)} ${fmt(p1[0] ?? 0)} ${fmt(p1[1] ?? 0)}`;
  }

  if (c) {
    // Wrap segment: last vertex → first vertex
    const pLast = v[n - 1]!;
    const pFirst = v[0]!;
    const cp1x = (pLast[0] ?? 0) + (o[n - 1]?.[0] ?? 0);
    const cp1y = (pLast[1] ?? 0) + (o[n - 1]?.[1] ?? 0);
    const cp2x = (pFirst[0] ?? 0) + (i[0]?.[0] ?? 0);
    const cp2y = (pFirst[1] ?? 0) + (i[0]?.[1] ?? 0);
    d += ` C ${fmt(cp1x)} ${fmt(cp1y)} ${fmt(cp2x)} ${fmt(cp2y)} ${fmt(pFirst[0] ?? 0)} ${fmt(pFirst[1] ?? 0)}`;
    d += ' Z';
  }

  return d;
}

// ---------------------------------------------------------------------------
// Fill/stroke attribute extraction
// ---------------------------------------------------------------------------

function extractFillAttrs(
  fillItem: AnyShape,
  _warnings: string[],
): { color: string | null; opacity: number | null } {
  const c = fillItem['c'] as Record<string, unknown> | undefined;
  const o = fillItem['o'] as Record<string, unknown> | undefined;

  let color: string | null = null;
  let opacity: number | null = null;

  if (c && Array.isArray(c['k'])) {
    const k = c['k'] as number[];
    color = rgba01ToHex(k[0] ?? 0, k[1] ?? 0, k[2] ?? 0);
    // Alpha channel from fill color (if present as 4th element)
    // but we also check the separate opacity field
  }

  if (o && typeof o['k'] === 'number') {
    // o.k is 0-100
    const op = (o['k'] as number) / 100;
    if (op < 1) opacity = Math.round(op * 1000) / 1000;
  }

  return { color, opacity };
}

function extractStrokeAttrs(
  strokeItem: AnyShape,
  _warnings: string[],
): { color: string | null; opacity: number | null; width: number | null } {
  const c = strokeItem['c'] as Record<string, unknown> | undefined;
  const o = strokeItem['o'] as Record<string, unknown> | undefined;
  const w = strokeItem['w'] as Record<string, unknown> | undefined;

  let color: string | null = null;
  let opacity: number | null = null;
  let width: number | null = null;

  if (c && Array.isArray(c['k'])) {
    const k = c['k'] as number[];
    color = rgba01ToHex(k[0] ?? 0, k[1] ?? 0, k[2] ?? 0);
  }

  if (o && typeof o['k'] === 'number') {
    const op = (o['k'] as number) / 100;
    if (op < 1) opacity = Math.round(op * 1000) / 1000;
  }

  if (w && typeof w['k'] === 'number') {
    width = w['k'] as number;
  }

  return { color, opacity, width };
}

// ---------------------------------------------------------------------------
// Transform extraction
// ---------------------------------------------------------------------------

/**
 * Extract a static translate from a Lottie transform item ('tr').
 * Only translates are baked in; any rotation, scale, skew, or animated
 * property gets a warning and is ignored (path emitted untransformed).
 */
function extractStaticTranslate(trItem: AnyShape, warnings: string[]): string | null {
  const p = trItem['p'] as Record<string, unknown> | undefined;
  const r = trItem['r'] as Record<string, unknown> | undefined;
  const s = trItem['s'] as Record<string, unknown> | undefined;
  const sk = trItem['sk'] as Record<string, unknown> | undefined;

  const hasRotation = r && (r['a'] === 1 || (r['a'] === 0 && typeof r['k'] === 'number' && (r['k'] as number) !== 0));
  const hasScale = s && (s['a'] === 1 || (s['a'] === 0 && Array.isArray(s['k']) && ((s['k'] as number[])[0] !== 100 || (s['k'] as number[])[1] !== 100)));
  const hasSkew = sk && (sk['a'] === 1 || (sk['a'] === 0 && typeof sk['k'] === 'number' && (sk['k'] as number) !== 0));

  if (hasRotation || hasScale || hasSkew) {
    warnings.push('Group transform has rotation/scale/skew — only static translate is applied; other transform components are ignored');
  }

  if (!p) return null;

  // Animated position
  if (p['a'] === 1) {
    warnings.push('Animated group position — transform ignored; path emitted at origin');
    return null;
  }

  // Static position — k is [x, y] or [x, y, z]
  if (Array.isArray(p['k'])) {
    const k = p['k'] as number[];
    const tx = k[0] ?? 0;
    const ty = k[1] ?? 0;
    if (tx === 0 && ty === 0) return null;
    return `translate(${tx} ${ty})`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function rgba01ToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

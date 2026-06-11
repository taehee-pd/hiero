/**
 * Sanitization rules — allowlists for SVG elements and attributes.
 *
 * Strategy: strict allowlist. Only explicitly permitted elements and
 * attributes survive. Everything else is stripped and reported as a warning.
 * This prevents XSS, script injection, and entity expansion attacks while
 * preserving all visual SVG content the normalisation pipeline can handle.
 */

// ---------------------------------------------------------------------------
// Element allowlist
// ---------------------------------------------------------------------------

/**
 * SVG elements that are permitted through sanitization.
 * Grouped by function for maintainability.
 */
export const ALLOWED_ELEMENTS = new Set<string>([
  // Root
  'svg',
  // Structural
  'g',
  'defs',
  'symbol',
  'use',
  // Shape primitives
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  // Text (preserved but flagged as unsupported downstream)
  'text',
  'tspan',
  // Paint servers
  'lineargradient',
  'radialgradient',
  'stop',
  // Clipping & masking
  'clippath',
  'mask',
  // Descriptive
  'title',
  'desc',
  'metadata',
]);

/**
 * Elements that are actively dangerous and must always be stripped.
 * These are called out explicitly for clarity; any element not in
 * ALLOWED_ELEMENTS is also stripped.
 */
export const DANGEROUS_ELEMENTS = new Set<string>([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'applet',
  'math',
  'annotation-xml',
  'set',
  'animate',
  'animatetransform',
  'animatemotion',
]);

// ---------------------------------------------------------------------------
// Attribute allowlist
// ---------------------------------------------------------------------------

/**
 * Attributes permitted on any SVG element.
 * Organised alphabetically within groups.
 */
export const ALLOWED_ATTRIBUTES = new Set<string>([
  // Identity
  'id',
  'class',
  // Geometry (shapes)
  'cx', 'cy', 'r', 'rx', 'ry',
  'd',
  'height', 'width',
  'points',
  'x', 'y',
  'x1', 'y1', 'x2', 'y2',
  // ViewBox
  'viewbox',
  'preserveaspectratio',
  // Namespace
  'xmlns',
  'xmlns:xlink',
  // Presentation
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'opacity',
  'color',
  'display',
  'visibility',
  'clip-path',
  'clip-rule',
  'mask',
  'transform',
  'transform-origin',
  // Gradient attributes
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'fx', 'fy', 'fr',
  // References
  'href',
  'xlink:href',
  // Markers
  'marker-start',
  'marker-mid',
  'marker-end',
  // Font (for text elements)
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
]);

// ---------------------------------------------------------------------------
// Dangerous attribute patterns
// ---------------------------------------------------------------------------

/** Attribute names that start with "on" are event handlers. */
export function isEventHandler(attrName: string): boolean {
  return /^on[a-z]/i.test(attrName);
}

/** URI schemes that must never appear in attribute values. */
const DANGEROUS_URI_SCHEMES = /^\s*(javascript|data|vbscript|file|blob)\s*:/i;

export function hasDangerousUri(value: string): boolean {
  return DANGEROUS_URI_SCHEMES.test(value);
}

/** Style attribute is handled specially — never passed through raw. */
export function isStyleAttribute(attrName: string): boolean {
  return attrName.toLowerCase() === 'style';
}

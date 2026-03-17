/**
 * Allowlist-based SVG sanitizer.
 *
 * Walks the parsed SVG DOM and strips any elements or attributes not on the
 * allowlist. Stripped content is reported as warnings — never silently dropped.
 *
 * The sanitizer works on a DOM tree (from DOMParser) and mutates it in place,
 * then serializes via `outerHTML`. This avoids regex-on-raw-string pitfalls
 * like namespace tricks and entity expansion.
 *
 * Compatible with both browser DOMParser and the node-html-parser shim used
 * in tests (which provides `attributes` as a plain object, not NamedNodeMap).
 */

import type { ExternalIconWarning } from '../adapter-sdk/types';
import {
  ALLOWED_ELEMENTS,
  ALLOWED_ATTRIBUTES,
  DANGEROUS_ELEMENTS,
  isEventHandler,
  hasDangerousUri,
  isStyleAttribute,
} from './rules';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SanitizeResult = {
  /** Sanitized SVG markup. */
  svg: string;
  /** Warnings about content that was stripped or modified. */
  warnings: ExternalIconWarning[];
};

/**
 * Sanitize an SVG string using strict allowlists.
 *
 * @param svgString Raw SVG markup from an adapter.
 * @returns Sanitized SVG string plus a list of warnings.
 * @throws Error if the input is not valid XML / not an SVG root.
 */
export function sanitizeSvg(svgString: string): SanitizeResult {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(
      `SVG sanitizer: failed to parse SVG — ${parserError.textContent?.trim() ?? 'unknown parse error'}`,
    );
  }

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('SVG sanitizer: expected an <svg> root element');
  }

  const warnings: ExternalIconWarning[] = [];
  sanitizeAttributes(root, warnings);
  walkAndSanitize(root, warnings);

  // Serialize via outerHTML (works in both browser DOM and node-html-parser)
  const svg = (root as unknown as { outerHTML: string }).outerHTML;

  return { svg, warnings };
}

// ---------------------------------------------------------------------------
// DOM walker
// ---------------------------------------------------------------------------

function walkAndSanitize(element: Element, warnings: ExternalIconWarning[]): void {
  // Collect children first to avoid mutation during iteration
  const children = Array.from(element.children);

  for (const child of children) {
    const tagName = child.tagName.toLowerCase();

    // Strip dangerous elements entirely (including children)
    if (DANGEROUS_ELEMENTS.has(tagName)) {
      warnings.push({
        code: 'STRIPPED_DANGEROUS_ELEMENT',
        message: `Stripped dangerous <${tagName}> element`,
        context: tagName,
      });
      child.remove();
      continue;
    }

    // Strip unknown elements entirely (including children)
    if (!ALLOWED_ELEMENTS.has(tagName)) {
      warnings.push({
        code: 'STRIPPED_UNKNOWN_ELEMENT',
        message: `Stripped unknown <${tagName}> element`,
        context: tagName,
      });
      child.remove();
      continue;
    }

    // Sanitize attributes on this element
    sanitizeAttributes(child, warnings);

    // Recurse into children
    walkAndSanitize(child, warnings);
  }
}

/**
 * Get attribute names from an element. Handles both real DOM (NamedNodeMap)
 * and node-html-parser (plain object).
 */
function getAttributeNames(element: Element): string[] {
  const attrs = element.attributes;
  // node-html-parser: attributes is a plain Record<string, string>
  if (attrs && typeof attrs === 'object' && !(Symbol.iterator in attrs)) {
    return Object.keys(attrs as unknown as Record<string, string>);
  }
  // Real DOM: attributes is a NamedNodeMap (iterable)
  return Array.from(attrs).map((a) => a.name);
}

function sanitizeAttributes(element: Element, warnings: ExternalIconWarning[]): void {
  const tagName = element.tagName.toLowerCase();
  // Collect attribute names first to avoid mutation during iteration
  const attrNames = getAttributeNames(element);

  for (const attrName of attrNames) {
    const attrLower = attrName.toLowerCase();

    // Event handlers (onclick, onload, onerror, etc.)
    if (isEventHandler(attrLower)) {
      warnings.push({
        code: 'STRIPPED_EVENT_HANDLER',
        message: `Stripped event handler "${attrName}" from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      element.removeAttribute(attrName);
      continue;
    }

    // Style attribute — strip entirely, do not execute embedded CSS
    if (isStyleAttribute(attrLower)) {
      warnings.push({
        code: 'STRIPPED_STYLE_ATTRIBUTE',
        message: `Stripped inline style from <${tagName}>`,
        context: `${tagName}[style]`,
      });
      element.removeAttribute(attrName);
      continue;
    }

    // Check attribute value for dangerous URIs
    const value = element.getAttribute(attrName) ?? '';
    if (hasDangerousUri(value)) {
      warnings.push({
        code: 'STRIPPED_DANGEROUS_URI',
        message: `Stripped attribute "${attrName}" with dangerous URI scheme from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      element.removeAttribute(attrName);
      continue;
    }

    // Not on the allowlist
    if (!ALLOWED_ATTRIBUTES.has(attrLower)) {
      warnings.push({
        code: 'STRIPPED_UNKNOWN_ATTRIBUTE',
        message: `Stripped unknown attribute "${attrName}" from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      element.removeAttribute(attrName);
      continue;
    }
  }
}

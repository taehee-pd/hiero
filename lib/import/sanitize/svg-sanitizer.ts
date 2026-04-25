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
        code: 'unsupported_feature_dropped',
        severity: 'warning',
        message: `Stripped dangerous <${tagName}> element`,
        context: tagName,
      });
      child.remove();
      continue;
    }

    // Strip unknown elements entirely (including children)
    if (!ALLOWED_ELEMENTS.has(tagName)) {
      warnings.push({
        code: 'unsupported_feature_dropped',
        severity: 'warning',
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
  const attrs = element.attributes as unknown;
  if (!attrs || typeof attrs !== 'object') return [];

  const namedNodeMap = attrs as { length?: number; item?: (index: number) => { name?: string } | null };
  if (typeof namedNodeMap.length === 'number' && typeof namedNodeMap.item === 'function') {
    const names: string[] = [];
    for (let i = 0; i < namedNodeMap.length; i += 1) {
      const name = namedNodeMap.item(i)?.name;
      if (typeof name === 'string') names.push(name);
    }
    if (names.length > 0) return names;
  }

  const iterable = attrs as Iterable<{ name?: string }>;
  if (Symbol.iterator in iterable) {
    return Array.from(iterable)
      .map((a) => a?.name)
      .filter((name): name is string => typeof name === 'string');
  }

  const record = attrs as Record<string, unknown>;
  const objectValueNames = Object.values(record)
    .map((value) => (value && typeof value === 'object' ? (value as { name?: unknown }).name : undefined))
    .filter((name): name is string => typeof name === 'string');
  if (objectValueNames.length > 0) return objectValueNames;

  return Object.keys(record).filter((key) => !/^\d+$/.test(key));
}

function removeAttributeCompat(element: Element, attrName: string, normalizedName: string): void {
  element.removeAttribute(attrName);
  if (normalizedName !== attrName) {
    element.removeAttribute(normalizedName);
  }
}

function sanitizeAttributes(element: Element, warnings: ExternalIconWarning[]): void {
  const tagName = element.tagName.toLowerCase();
  // Collect attribute names first to avoid mutation during iteration
  const attrNames = getAttributeNames(element);

  for (const attrName of attrNames) {
    const attrLower = attrName.toLowerCase();
    const normalizedLower = attrLower.replace(/^.*:/, '');

    // Event handlers (onclick, onload, onerror, etc.)
    if (isEventHandler(normalizedLower)) {
      warnings.push({
        code: 'unsupported_feature_dropped',
        severity: 'warning',
        message: `Stripped event handler "${attrName}" from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      removeAttributeCompat(element, attrName, normalizedLower);
      continue;
    }

    // Style attribute — strip entirely, do not execute embedded CSS
    if (isStyleAttribute(normalizedLower)) {
      warnings.push({
        code: 'style_dependency_removed',
        severity: 'warning',
        message: `Stripped inline style from <${tagName}>`,
        context: `${tagName}[style]`,
      });
      removeAttributeCompat(element, attrName, normalizedLower);
      continue;
    }

    // Check attribute value for dangerous URIs
    const value = element.getAttribute(attrName) ?? '';
    if (hasDangerousUri(value)) {
      warnings.push({
        code: 'unsupported_feature_dropped',
        severity: 'warning',
        message: `Stripped attribute "${attrName}" with dangerous URI scheme from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      removeAttributeCompat(element, attrName, normalizedLower);
      continue;
    }

    // Not on the allowlist. Check the full prefixed name first so namespaced
    // entries (e.g. `xmlns:xlink`, `xlink:href`) survive — falling back to the
    // normalized form covers parsers that drop the prefix.
    if (!ALLOWED_ATTRIBUTES.has(attrLower) && !ALLOWED_ATTRIBUTES.has(normalizedLower)) {
      warnings.push({
        code: 'unsupported_feature_dropped',
        severity: 'warning',
        message: `Stripped unknown attribute "${attrName}" from <${tagName}>`,
        context: `${tagName}[${attrName}]`,
      });
      removeAttributeCompat(element, attrName, normalizedLower);
      continue;
    }
  }
}

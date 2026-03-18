import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { sanitizeSvg } from '../lib/import/sanitize/svg-sanitizer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;
}

// ---------------------------------------------------------------------------
// Safe content passes through
// ---------------------------------------------------------------------------

describe('sanitizeSvg — safe content', () => {
  test('passes through basic shape elements', () => {
    const input = wrap(
      `<path d="M0 0 L10 10" fill="#000"/>` +
      `<rect x="0" y="0" width="24" height="24"/>` +
      `<circle cx="12" cy="12" r="5"/>` +
      `<ellipse cx="12" cy="12" rx="4" ry="2"/>` +
      `<line x1="0" y1="0" x2="24" y2="24"/>` +
      `<polyline points="0,0 10,5 20,0"/>` +
      `<polygon points="0,0 10,5 20,0"/>`,
    );
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('<path');
    expect(result.svg).toContain('<rect');
    expect(result.svg).toContain('<circle');
    expect(result.svg).toContain('<ellipse');
    expect(result.svg).toContain('<line');
    expect(result.svg).toContain('<polyline');
    expect(result.svg).toContain('<polygon');
  });

  test('preserves groups and defs with gradients', () => {
    const input = wrap(
      `<defs><linearGradient id="g1"><stop offset="0" stop-color="#f00"/></linearGradient></defs>` +
      `<g fill="url(#g1)"><rect x="0" y="0" width="24" height="24"/></g>`,
    );
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg.toLowerCase()).toContain('lineargradient');
    expect(result.svg).toContain('<g');
  });

  test('preserves presentation attributes', () => {
    const input = wrap(
      `<path d="M0 0" fill="#000" stroke="#fff" stroke-width="2" ` +
      `fill-opacity="0.5" stroke-opacity="0.8" stroke-linecap="round" ` +
      `stroke-linejoin="round" opacity="0.9" fill-rule="evenodd"/>`,
    );
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('fill-opacity');
    expect(result.svg).toContain('stroke-linecap');
  });

  test('preserves transform attribute', () => {
    const input = wrap(`<g transform="translate(2, 3) rotate(45)"><path d="M0 0"/></g>`);
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('translate(2, 3)');
  });

  test('preserves clip-path and mask references', () => {
    const input = wrap(
      `<defs><clipPath id="c1"><rect x="0" y="0" width="10" height="10"/></clipPath></defs>` +
      `<path d="M0 0 L24 24" clip-path="url(#c1)"/>`,
    );
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('clip-path');
    expect(result.svg.toLowerCase()).toContain('clippath');
  });
});

// ---------------------------------------------------------------------------
// Dangerous content is stripped
// ---------------------------------------------------------------------------

describe('sanitizeSvg — dangerous content stripped', () => {
  test('strips <script> elements', () => {
    const input = wrap(`<script>alert("xss")</script><path d="M0 0"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('script');
    expect(result.svg).not.toContain('alert');
    expect(result.svg).toContain('<path');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_feature_dropped', context: 'script' }),
      ]),
    );
  });

  test('strips <foreignObject> elements', () => {
    const input = wrap(
      `<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><div>hack</div></body></foreignObject>`,
    );
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('foreignObject');
    expect(result.svg).not.toContain('hack');
    expect(result.warnings.some((w) => w.code === 'unsupported_feature_dropped')).toBe(true);
  });

  test('strips event handler attributes', () => {
    const input = wrap(`<path d="M0 0" onclick="alert(1)" onload="fetch('/steal')"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('onclick');
    expect(result.svg).not.toContain('onload');
    expect(result.svg).not.toContain('alert');
    expect(result.svg).toContain('<path');
    expect(result.warnings.filter((w) => w.code === 'unsupported_feature_dropped')).toHaveLength(2);
  });

  test('strips javascript: URIs in href', () => {
    const input = wrap(`<use href="javascript:alert(1)"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('javascript');
    expect(result.warnings.some((w) => w.code === 'unsupported_feature_dropped')).toBe(true);
  });

  test('strips data: URIs', () => {
    const input = wrap(`<path d="M0 0" fill="url(data:image/svg+xml;base64,PHN2Zz4=)"/>`);
    // data: in a url() is not a dangerous URI on the attribute value itself,
    // but let's verify the fill attribute still passes (it's in the allowlist)
    // The real danger is data: in href
    const input2 = wrap(`<use href="data:image/svg+xml;base64,PHN2Zz4="/>`);
    const result = sanitizeSvg(input2);
    expect(result.svg).not.toContain('data:');
    expect(result.warnings.some((w) => w.code === 'unsupported_feature_dropped')).toBe(true);
  });

  test('strips inline style attributes', () => {
    const input = wrap(`<path d="M0 0" style="fill: red; background: url(javascript:alert(1))"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('style=');
    expect(result.svg).not.toContain('background');
    expect(result.warnings.some((w) => w.code === 'style_dependency_removed')).toBe(true);
  });

  test('strips <animate> and animation elements', () => {
    const input = wrap(`<rect x="0" y="0" width="10" height="10"><animate attributeName="x" to="100"/></rect>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('animate');
    expect(result.warnings.some((w) => w.context === 'animate')).toBe(true);
  });

  test('strips <iframe> and <embed>', () => {
    const input = wrap(`<iframe src="https://evil.com"/><embed src="evil.swf"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('iframe');
    expect(result.svg).not.toContain('embed');
    expect(result.warnings.filter((w) => w.code === 'unsupported_feature_dropped')).toHaveLength(2);
  });

  test('strips unknown/custom attributes', () => {
    const input = wrap(`<path d="M0 0" data-custom="foo" aria-label="bar"/>`);
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('data-custom');
    expect(result.svg).not.toContain('aria-label');
    expect(result.warnings.filter((w) => w.code === 'unsupported_feature_dropped')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Warning generation
// ---------------------------------------------------------------------------

describe('sanitizeSvg — warning quality', () => {
  test('each stripped element produces exactly one warning', () => {
    const input = wrap(`<script>a</script><script>b</script><path d="M0 0"/>`);
    const result = sanitizeSvg(input);
    const scriptWarnings = result.warnings.filter(
      (w) => w.code === 'unsupported_feature_dropped' && w.context === 'script',
    );
    expect(scriptWarnings).toHaveLength(2);
  });

  test('warnings include element context for attributes', () => {
    const input = wrap(`<rect x="0" y="0" width="10" height="10" onclick="alert(1)"/>`);
    const result = sanitizeSvg(input);
    const w = result.warnings.find((w) => w.code === 'unsupported_feature_dropped');
    expect(w?.context).toBe('rect[onclick]');
  });


  test('warnings use warning severity', () => {
    const input = wrap(`<path d="M0 0" onclick="alert(1)"/>`);
    const result = sanitizeSvg(input);
    expect(result.warnings.every((w) => w.severity === 'warning')).toBe(true);
  });

  test('clean SVG produces zero warnings', () => {
    const input = wrap(
      `<g transform="translate(1,1)">` +
      `<path d="M0 0 L10 10" fill="currentColor" stroke-width="2"/>` +
      `</g>`,
    );
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('sanitizeSvg — edge cases', () => {
  test('throws on non-SVG root', () => {
    expect(() => sanitizeSvg('<div>not svg</div>')).toThrow(/svg/i);
  });

  test('handles empty SVG', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
    const result = sanitizeSvg(input);
    expect(result.warnings).toEqual([]);
    expect(result.svg).toContain('svg');
  });

  test('strips nested dangerous elements inside allowed containers', () => {
    const input = wrap(
      `<g><script>evil()</script><path d="M0 0"/></g>`,
    );
    const result = sanitizeSvg(input);
    expect(result.svg).not.toContain('script');
    expect(result.svg).toContain('<path');
  });
});

import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { rawSvgAdapter } from '../lib/import/adapters/raw-svg-adapter';
import { ExternalIconImportError } from '../lib/import/adapter-sdk';

// ---------------------------------------------------------------------------
// Paste mode (raw-svg-string)
// ---------------------------------------------------------------------------

describe('rawSvgAdapter — paste mode', () => {
  test('accepts valid SVG paste and returns sanitized content', async () => {
    const svgInput = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 2L2 22h20Z" fill="currentColor"/>
    </svg>`;

    const result = await rawSvgAdapter.fetch({
      mode: 'raw-svg-string',
      svgContent: svgInput,
      name: 'Triangle',
    });

    expect(result.svgContent).toContain('<path');
    expect(result.svgContent).toContain('currentColor');
    expect(result.suggestedName).toBe('Triangle');
    expect(result.provenance.adapterId).toBe('raw-svg');
    expect(result.provenance.sourceLibrary).toBe('svg-paste');
    expect(result.provenance.importedAt).toBeTruthy();
    expect(result.warnings).toEqual([]);
  });

  test('uses default name when none provided', async () => {
    const result = await rawSvgAdapter.fetch({
      mode: 'raw-svg-string',
      svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
    });
    expect(result.suggestedName).toBe('Pasted SVG');
  });

  test('sanitizes dangerous content and returns warnings', async () => {
    const svgInput = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <script>alert("xss")</script>
      <path d="M0 0 L10 10" onclick="steal()"/>
    </svg>`;

    const result = await rawSvgAdapter.fetch({
      mode: 'raw-svg-string',
      svgContent: svgInput,
    });

    expect(result.svgContent).not.toContain('script');
    expect(result.svgContent).not.toContain('onclick');
    expect(result.svgContent).toContain('<path');
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  test('throws on empty SVG content', async () => {
    try {
      await rawSvgAdapter.fetch({
        mode: 'raw-svg-string',
        svgContent: '   ',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalIconImportError);
      expect((err as ExternalIconImportError).code).toBe('EMPTY_SVG');
    }
  });
});

// ---------------------------------------------------------------------------
// File mode (svg-file)
// ---------------------------------------------------------------------------

describe('rawSvgAdapter — file mode', () => {
  test('reads SVG file and returns sanitized content', async () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="4" y="4" width="24" height="24" rx="4" fill="#333"/>
    </svg>`;
    const file = new File([svgContent], 'rounded-square.svg', { type: 'image/svg+xml' });

    const result = await rawSvgAdapter.fetch({
      mode: 'svg-file',
      file,
    });

    expect(result.svgContent).toContain('<rect');
    expect(result.suggestedName).toBe('rounded-square');
    expect(result.provenance.adapterId).toBe('raw-svg');
    expect(result.provenance.sourceLibrary).toBe('svg-file');
    expect(result.warnings).toEqual([]);
  });

  test('uses name override when provided', async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>'],
      'ugly-filename.svg',
      { type: 'image/svg+xml' },
    );

    const result = await rawSvgAdapter.fetch({
      mode: 'svg-file',
      file,
      name: 'Pretty Name',
    });
    expect(result.suggestedName).toBe('Pretty Name');
  });

  test('strips .svg extension from filename', async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>'],
      'my-icon.SVG',
      { type: 'image/svg+xml' },
    );

    const result = await rawSvgAdapter.fetch({ mode: 'svg-file', file });
    expect(result.suggestedName).toBe('my-icon');
  });
});

// ---------------------------------------------------------------------------
// Unsupported mode
// ---------------------------------------------------------------------------

describe('rawSvgAdapter — unsupported mode', () => {
  test('rejects library-icon-name mode', async () => {
    try {
      await rawSvgAdapter.fetch({
        mode: 'library-icon-name',
        iconId: 'arrow-right',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalIconImportError);
      expect((err as ExternalIconImportError).code).toBe('UNSUPPORTED_MODE');
      expect((err as ExternalIconImportError).adapterId).toBe('raw-svg');
    }
  });
});

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

describe('rawSvgAdapter — descriptor', () => {
  test('declares correct capabilities', () => {
    const { descriptor } = rawSvgAdapter;
    expect(descriptor.id).toBe('raw-svg');
    expect(descriptor.capabilities.inputModes).toContain('raw-svg-string');
    expect(descriptor.capabilities.inputModes).toContain('svg-file');
    expect(descriptor.capabilities.searchable).toBe(false);
    expect(descriptor.capabilities.displayName).toBe('Raw SVG');
  });
});

/**
 * Figma adapter tests — unit tests for URL parsing, name formatting,
 * and component filtering. Network calls are not tested here (those
 * require actual Figma API access).
 */

import { describe, it, expect } from 'bun:test';
import { parseFigmaUrl, filterComponents, isAllowedFigmaCdnUrl } from '@/lib/import/adapters/figma-source';
import { formatFigmaName } from '@/lib/import/adapters/figma-adapter';
import type { FigmaComponent } from '@/lib/import/adapters/figma-source';

describe('parseFigmaUrl', () => {
  it('parses standard design URL', () => {
    const result = parseFigmaUrl('https://www.figma.com/design/ABC123/My-Icon-Set');
    expect(result).toEqual({ fileKey: 'ABC123' });
  });

  it('parses design URL with query params', () => {
    const result = parseFigmaUrl(
      'https://figma.com/design/XYZ789/Icons?node-id=1-2&t=abc',
    );
    expect(result).toEqual({ fileKey: 'XYZ789' });
  });

  it('parses legacy file URL', () => {
    const result = parseFigmaUrl('https://figma.com/file/DEF456/My-File');
    expect(result).toEqual({ fileKey: 'DEF456' });
  });

  it('parses branch URL (uses branchKey)', () => {
    const result = parseFigmaUrl(
      'https://figma.com/design/ABC123/branch/BRANCH456/My-Icons',
    );
    expect(result).toEqual({ fileKey: 'BRANCH456' });
  });

  it('returns null for invalid URL', () => {
    expect(parseFigmaUrl('https://example.com/design/X/Y')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFigmaUrl('')).toBeNull();
  });

  it('returns null for non-design Figma URL', () => {
    expect(parseFigmaUrl('https://figma.com/community/plugin/12345')).toBeNull();
  });

  // Tightened hostname check — exact/suffix match only
  it('rejects lookalike hostname evilfigma.com', () => {
    expect(parseFigmaUrl('https://evilfigma.com/design/X/Y')).toBeNull();
  });

  it('rejects subdomain-spoofing figma.com.attacker.com', () => {
    expect(parseFigmaUrl('https://figma.com.attacker.com/design/X/Y')).toBeNull();
  });

  it('accepts www.figma.com (subdomain)', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/ABC123/My-Icon-Set')).toEqual({
      fileKey: 'ABC123',
    });
  });
});

describe('isAllowedFigmaCdnUrl', () => {
  it('accepts figma.com', () => {
    expect(isAllowedFigmaCdnUrl('https://figma.com/foo')).toBe(true);
  });

  it('accepts *.figma.com subdomain', () => {
    expect(isAllowedFigmaCdnUrl('https://figma-alpha-api.figma.com/img/abc')).toBe(true);
    expect(isAllowedFigmaCdnUrl('https://cdn.figma.com/img/xyz')).toBe(true);
  });

  it('accepts figma- prefixed amazonaws.com S3 host', () => {
    expect(
      isAllowedFigmaCdnUrl('https://figma-alpha-api.s3.us-west-2.amazonaws.com/img/abc'),
    ).toBe(true);
  });

  it('rejects non-https protocol', () => {
    expect(isAllowedFigmaCdnUrl('http://figma.com/img/abc')).toBe(false);
  });

  it('rejects non-Figma S3 bucket', () => {
    expect(isAllowedFigmaCdnUrl('https://attacker.s3.us-east-1.amazonaws.com/evil')).toBe(false);
  });

  it('rejects evilfigma.com lookalike', () => {
    expect(isAllowedFigmaCdnUrl('https://evilfigma.com/img/abc')).toBe(false);
  });

  it('rejects figma.com.attacker.com spoofing', () => {
    expect(isAllowedFigmaCdnUrl('https://figma.com.attacker.com/img/abc')).toBe(false);
  });

  it('rejects arbitrary private/internal URL', () => {
    expect(isAllowedFigmaCdnUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isAllowedFigmaCdnUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(isAllowedFigmaCdnUrl('not-a-url')).toBe(false);
  });

  // "notfigma-" hostname starts with "notfigma-", not "figma-" — must be rejected
  it('rejects notfigma- prefixed amazonaws.com host', () => {
    expect(isAllowedFigmaCdnUrl('https://notfigma-x.amazonaws.com/img')).toBe(false);
  });

  it('accepts https://www.figma.com (www subdomain)', () => {
    expect(isAllowedFigmaCdnUrl('https://www.figma.com/foo')).toBe(true);
  });
});

describe('formatFigmaName', () => {
  it('formats kebab-case', () => {
    expect(formatFigmaName('arrow-right')).toBe('Arrow Right');
  });

  it('formats path-separated name (takes last segment)', () => {
    expect(formatFigmaName('icons/24px/arrow-right')).toBe('Arrow Right');
  });

  it('formats underscore-separated name', () => {
    expect(formatFigmaName('check_circle')).toBe('Check Circle');
  });

  it('handles single word', () => {
    expect(formatFigmaName('Home')).toBe('Home');
  });

  it('handles empty string', () => {
    expect(formatFigmaName('')).toBe('');
  });
});

describe('filterComponents', () => {
  const mockComponents: FigmaComponent[] = [
    {
      key: '1',
      name: 'arrow-right',
      description: '',
      node_id: '1:1',
      thumbnail_url: '',
      containing_frame: { name: 'Navigation', nodeId: '0:1' },
    },
    {
      key: '2',
      name: 'arrow-left',
      description: '',
      node_id: '1:2',
      thumbnail_url: '',
      containing_frame: { name: 'Navigation', nodeId: '0:1' },
    },
    {
      key: '3',
      name: 'check-circle',
      description: '',
      node_id: '1:3',
      thumbnail_url: '',
      containing_frame: { name: 'Status', nodeId: '0:2' },
    },
    {
      key: '4',
      name: 'home',
      description: '',
      node_id: '1:4',
      thumbnail_url: '',
      containing_frame: null,
    },
  ];

  it('returns all components for empty query', () => {
    expect(filterComponents(mockComponents, '')).toHaveLength(4);
    expect(filterComponents(mockComponents, '  ')).toHaveLength(4);
  });

  it('filters by component name', () => {
    const results = filterComponents(mockComponents, 'arrow');
    expect(results).toHaveLength(2);
    expect(results.map((c) => c.name)).toEqual(['arrow-right', 'arrow-left']);
  });

  it('filters by frame name', () => {
    const results = filterComponents(mockComponents, 'navigation');
    expect(results).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    expect(filterComponents(mockComponents, 'zzz')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(filterComponents(mockComponents, 'HOME')).toHaveLength(1);
  });
});

/**
 * Phase 4 PR enrichment tests.
 *
 * The existing PR body shape is unchanged for callers that don't pass
 * the new options (regression covered by metadata-generators.test.ts).
 * These tests cover the *new* fields:
 *   - version → header line + JSON metadata.version
 *   - releaseNotes → "Release notes" section
 *   - targetResults → "Publish targets" section + JSON metadata.targetResults
 *   - JSON metadata block always present at the tail, fenced + tagged
 */

import { describe, it, expect } from 'bun:test';
import { generatePrBody } from '@/lib/sync-service/metadata';

const baseChanges = {
  added: ['hiero/icons/play/path.json'],
  updated: [],
  deleted: [],
};

describe('generatePrBody enrichment', () => {
  it('always emits the machine-readable metadata block', () => {
    const body = generatePrBody(baseChanges, 'taehee');
    expect(body).toContain('<!-- hiero:metadata:start -->');
    expect(body).toContain('<!-- hiero:metadata:end -->');
    expect(body).toContain('"schema": "hiero.pr.metadata/v1"');
  });

  it('metadata.version is null without version option', () => {
    const body = generatePrBody(baseChanges, 'taehee');
    const json = extractMetadata(body);
    expect(json.version).toBeNull();
  });

  it('header includes the release version when provided', () => {
    const body = generatePrBody(baseChanges, 'taehee', { version: '1.2.0' });
    expect(body).toContain('release **v1.2.0**');
    const json = extractMetadata(body);
    expect(json.version).toBe('1.2.0');
  });

  it('renders a "Release notes" blockquote when notes are non-empty', () => {
    const body = generatePrBody(baseChanges, 'taehee', {
      releaseNotes: 'Added play and pause icons.\nFixed stroke-width on chevron.',
    });
    expect(body).toContain('### Release notes');
    expect(body).toContain('> Added play and pause icons.');
    expect(body).toContain('> Fixed stroke-width on chevron.');
  });

  it('omits "Release notes" when notes are empty or whitespace', () => {
    const empty = generatePrBody(baseChanges, 'taehee', { releaseNotes: '   ' });
    expect(empty).not.toContain('### Release notes');
  });

  it('renders "Publish targets" with status icons and links', () => {
    const body = generatePrBody(baseChanges, 'taehee', {
      targetResults: [
        { kind: 'git-pr', status: 'success', url: 'https://example.com/pr/1' },
        { kind: 'npm-registry', status: 'failed' },
      ],
    });
    expect(body).toContain('### Publish targets');
    expect(body).toContain('✅ `git-pr` — https://example.com/pr/1');
    expect(body).toContain('❌ `npm-registry`');
  });

  it('metadata.targetResults serializes target outcomes', () => {
    const body = generatePrBody(baseChanges, 'taehee', {
      targetResults: [
        { kind: 'git-pr', status: 'success', url: 'https://pr/1' },
        { kind: 'npm-registry', status: 'failed' },
      ],
    });
    const json = extractMetadata(body);
    expect(json.targetResults).toEqual([
      { kind: 'git-pr', status: 'success', url: 'https://pr/1' },
      { kind: 'npm-registry', status: 'failed', url: null },
    ]);
  });

  it('omits "Publish targets" section when no targetResults are passed', () => {
    const body = generatePrBody(baseChanges, 'taehee');
    expect(body).not.toContain('### Publish targets');
  });

  it('metadata block uses fenced json for github code-block rendering safety', () => {
    const body = generatePrBody(baseChanges, 'taehee');
    const start = body.indexOf('<!-- hiero:metadata:start -->');
    const end = body.indexOf('<!-- hiero:metadata:end -->');
    const block = body.slice(start, end);
    expect(block).toMatch(/```json\n[\s\S]+\n```/);
  });
});

function extractMetadata(body: string): {
  schema: string;
  version: string | null;
  actor: string;
  counts: {
    iconsChanged: number;
    filesAdded: number;
    filesUpdated: number;
    filesDeleted: number;
  };
  iconChanges: Array<{ iconDir: string; kind: string }>;
  targetResults: Array<{ kind: string; status: string; url: string | null }>;
} {
  const start = body.indexOf('<!-- hiero:metadata:start -->');
  const end = body.indexOf('<!-- hiero:metadata:end -->');
  const block = body.slice(start, end);
  const match = block.match(/```json\n([\s\S]+?)\n```/);
  if (!match) throw new Error('metadata block not found or malformed');
  return JSON.parse(match[1]);
}

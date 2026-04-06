/**
 * Tests for the upgraded PR metadata generators:
 * - generatePrBody (enriched with icon deltas, schema version, validation)
 * - generatePrSummaryComment (CI-posted review comment)
 * - generateJobSummaryMarkdown (GitHub Actions step summary)
 */

import { describe, expect, test } from 'bun:test';

import {
  generatePrBody,
  generatePrTitle,
  generatePrSummaryComment,
  generateJobSummaryMarkdown,
} from '../lib/sync-service/metadata';
import type {
  PrSummaryCommentOptions,
  JobSummaryOptions,
} from '../lib/sync-service/metadata';
import type { ChangedFileSummary } from '../lib/sync-service/contracts';
import type { IconChange } from '../lib/sync-service/diff-source';

// ===========================================================================
// generatePrBody — enriched
// ===========================================================================

describe('generatePrBody (enriched)', () => {
  const baseChanges: ChangedFileSummary = {
    added: ['icons/play/icon.json', 'icons/play/preview.svg'],
    updated: ['icons/chevron/icon.json'],
    deleted: ['icons/old/icon.json', 'icons/old/preview.svg'],
  };

  test('includes icon count in summary table', () => {
    const body = generatePrBody(baseChanges, 'Alice');
    expect(body).toContain('| Icons changed | 3 |');
  });

  test('includes total file count', () => {
    const body = generatePrBody(baseChanges, 'Alice');
    expect(body).toContain('| Total files changed | 5 |');
  });

  test('marks validation checklist as CI-pending when no validation provided', () => {
    const body = generatePrBody(baseChanges, 'Alice');
    expect(body).toContain('- [ ] Schema compliance — *will be verified by CI*');
  });

  test('marks validation checklist as passed when validation.ok is true', () => {
    const body = generatePrBody(baseChanges, 'Alice', {
      validation: { ok: true, errors: [] },
    });
    expect(body).toContain('- [x] Schema compliance');
    expect(body).toContain('- [x] Compile pipeline');
  });

  test('marks validation checklist as failed with errors', () => {
    const body = generatePrBody(baseChanges, 'Alice', {
      validation: { ok: false, errors: ['Schema check failed'] },
    });
    expect(body).toContain('- [ ] Schema compliance');
    expect(body).toContain('**Errors:**');
    expect(body).toContain('- Schema check failed');
  });

  test('renders icon change table sorted by name', () => {
    const body = generatePrBody(baseChanges, 'Alice', {
      iconChanges: [
        { iconDir: 'play', kind: 'added' },
        { iconDir: 'chevron', kind: 'updated' },
        { iconDir: 'old', kind: 'removed' },
      ],
    });
    expect(body).toContain('| `play` | 🟢 Added |');
    expect(body).toContain('| `chevron` | 🟡 Updated |');
    expect(body).toContain('| `old` | 🔴 Removed |');
  });

  test('omits icon change table when no iconChanges provided', () => {
    const body = generatePrBody(baseChanges, 'Alice');
    expect(body).not.toContain('### Icon Changes');
  });

  test('renders preview-only and metadata-only change kinds', () => {
    const body = generatePrBody(
      { added: [], updated: ['icons/a/preview.svg', 'icons/b/icon.json'], deleted: [] },
      'Alice',
      {
        iconChanges: [
          { iconDir: 'a', kind: 'preview-only' },
          { iconDir: 'b', kind: 'metadata-only' },
        ],
      },
    );
    expect(body).toContain('Preview only');
    expect(body).toContain('Metadata only');
  });
});

// ===========================================================================
// generatePrSummaryComment
// ===========================================================================

describe('generatePrSummaryComment', () => {
  const allPassChecks = [
    { name: 'Schema compliance', passed: true, errors: [], warnings: [] },
    { name: 'Manifest consistency', passed: true, errors: [], warnings: [] },
    { name: 'Compile pipeline', passed: true, errors: [], warnings: [] },
  ];

  const failingChecks = [
    { name: 'Schema compliance', passed: false, errors: ['Missing schemaVersion'], warnings: [] },
    { name: 'Manifest consistency', passed: true, errors: [], warnings: ['Deprecated field'] },
  ];

  const baseOpts: PrSummaryCommentOptions = {
    iconChanges: [
      { iconDir: 'chevron', kind: 'updated' },
      { iconDir: 'play', kind: 'added' },
    ],
    changes: {
      added: ['icons/play/icon.json', 'icons/play/preview.svg'],
      updated: ['icons/chevron/icon.json'],
      deleted: [],
    },
    validationChecks: allPassChecks,
  };

  test('shows Passed header when all checks pass', () => {
    const comment = generatePrSummaryComment(baseOpts);
    expect(comment).toContain('Validation Passed');
    expect(comment).toContain('✅');
  });

  test('shows Failed header when any check fails', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      validationChecks: failingChecks,
    });
    expect(comment).toContain('Validation Failed');
    expect(comment).toContain('❌');
  });

  test('includes icon delta table', () => {
    const comment = generatePrSummaryComment(baseOpts);
    expect(comment).toContain('### Icon Delta');
    expect(comment).toContain('`chevron`');
    expect(comment).toContain('`play`');
  });

  test('includes validation check list', () => {
    const comment = generatePrSummaryComment(baseOpts);
    expect(comment).toContain('### Validation');
    expect(comment).toContain('Schema compliance');
    expect(comment).toContain('Compile pipeline');
  });

  test('shows error details for failed checks', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      validationChecks: failingChecks,
    });
    expect(comment).toContain('Missing schemaVersion');
  });

  test('shows warnings', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      validationChecks: failingChecks,
    });
    expect(comment).toContain('Deprecated field');
  });

  test('truncates errors to 3 with overflow note', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      validationChecks: [
        {
          name: 'Schema',
          passed: false,
          errors: ['err1', 'err2', 'err3', 'err4', 'err5'],
          warnings: [],
        },
      ],
    });
    expect(comment).toContain('err1');
    expect(comment).toContain('err3');
    expect(comment).not.toContain('err4');
    expect(comment).toContain('and 2 more');
  });

  test('includes compiled icon count when provided', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      compiledIconCount: 42,
    });
    expect(comment).toContain('42');
    expect(comment).toContain('compiled');
  });

  test('includes preview artifact hint when provided', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      hasPreviewArtifacts: true,
    });
    expect(comment).toContain('icon-previews');
    expect(comment).toContain('artifact');
  });

  test('includes schema version', () => {
    const comment = generatePrSummaryComment({
      ...baseOpts,
      schemaVersion: '2.0.0',
    });
    expect(comment).toContain('`2.0.0`');
  });

  test('ends with auto-generated footer', () => {
    const comment = generatePrSummaryComment(baseOpts);
    expect(comment).toContain('Auto-generated by Contour CI');
  });
});

// ===========================================================================
// generateJobSummaryMarkdown
// ===========================================================================

describe('generateJobSummaryMarkdown', () => {
  const baseOpts: JobSummaryOptions = {
    iconChanges: [
      { iconDir: 'chevron', kind: 'updated' },
      { iconDir: 'star', kind: 'added' },
    ],
    changes: {
      added: ['icons/star/icon.json', 'icons/star/preview.svg'],
      updated: ['icons/chevron/icon.json', 'icons/chevron/preview.svg'],
      deleted: [],
    },
    validationChecks: [
      { name: 'Schema compliance', passed: true, errors: [], warnings: [] },
      { name: 'Manifest consistency', passed: true, errors: [], warnings: [] },
    ],
  };

  test('includes heading with status', () => {
    const md = generateJobSummaryMarkdown(baseOpts);
    expect(md).toContain('# ✅ Icon Source Validation');
  });

  test('includes fail heading when checks fail', () => {
    const md = generateJobSummaryMarkdown({
      ...baseOpts,
      validationChecks: [
        { name: 'Schema', passed: false, errors: ['bad'], warnings: [] },
      ],
    });
    expect(md).toContain('# ❌ Icon Source Validation');
  });

  test('includes metrics table with icon count and schema version', () => {
    const md = generateJobSummaryMarkdown(baseOpts);
    expect(md).toContain('| Icons changed | 2 |');
    expect(md).toContain('| Files changed | 4 |');
    expect(md).toContain('Schema version');
  });

  test('includes compiled icon count when provided', () => {
    const md = generateJobSummaryMarkdown({
      ...baseOpts,
      compiledIconCount: 15,
    });
    expect(md).toContain('| Compiled icons | 15 |');
  });

  test('includes icon change table', () => {
    const md = generateJobSummaryMarkdown(baseOpts);
    expect(md).toContain('## Icon Changes');
    expect(md).toContain('`chevron`');
    expect(md).toContain('`star`');
  });

  test('includes validation check results', () => {
    const md = generateJobSummaryMarkdown(baseOpts);
    expect(md).toContain('## Validation Checks');
    expect(md).toContain('✅');
    expect(md).toContain('Schema compliance');
  });

  test('includes preview artifacts section when provided', () => {
    const md = generateJobSummaryMarkdown({
      ...baseOpts,
      previewPaths: ['chevron.svg', 'star.svg'],
    });
    expect(md).toContain('## Preview Artifacts');
    expect(md).toContain('2 preview SVG(s)');
    expect(md).toContain('chevron.svg');
    expect(md).toContain('star.svg');
  });

  test('omits preview section when no paths', () => {
    const md = generateJobSummaryMarkdown(baseOpts);
    expect(md).not.toContain('## Preview Artifacts');
  });
});

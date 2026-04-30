/**
 * Tests for deriveSaveState — the four-state badge taxonomy.
 *
 * Precedence rules (from save-state.ts):
 *   1. dirty wins (always 'unsaved')
 *   2. when clean: published vs draft-saved decided by max timestamp
 *      (ties favor 'published' — stronger durability guarantee)
 *   3. only autosave is 'autosaved'
 *   4. nothing happened yet → 'autosaved' (clean freshly-loaded workspace)
 */

import { describe, it, expect } from 'bun:test';
import {
  deriveSaveState,
  formatSaveStateLabel,
} from '@/lib/persistence/save-state';

describe('deriveSaveState', () => {
  describe('dirty wins', () => {
    const dirtyCases: Array<[number | null, number | null, number | null]> = [
      [null, null, null],
      [1, null, null],
      [null, 1, null],
      [null, null, 1],
      [10, 20, 30],
    ];
    for (const [lastAutosaveAt, lastCheckpointAt, lastPublishedAt] of dirtyCases) {
      it(`returns unsaved when isDirty=true (autosave=${lastAutosaveAt}, checkpoint=${lastCheckpointAt}, published=${lastPublishedAt})`, () => {
        expect(
          deriveSaveState({
            isDirty: true,
            lastAutosaveAt,
            lastCheckpointAt,
            lastPublishedAt,
          }),
        ).toBe('unsaved');
      });
    }
  });

  describe('clean state precedence', () => {
    it('returns published when only publish timestamp is present', () => {
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: null,
          lastCheckpointAt: null,
          lastPublishedAt: 100,
        }),
      ).toBe('published');
    });

    it('returns draft-saved when only checkpoint timestamp is present', () => {
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: null,
          lastCheckpointAt: 100,
          lastPublishedAt: null,
        }),
      ).toBe('draft-saved');
    });

    it('returns autosaved when only autosave timestamp is present', () => {
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: 100,
          lastCheckpointAt: null,
          lastPublishedAt: null,
        }),
      ).toBe('autosaved');
    });

    it('returns autosaved when nothing has happened yet', () => {
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: null,
          lastCheckpointAt: null,
          lastPublishedAt: null,
        }),
      ).toBe('autosaved');
    });

    it('returns published when publish is more recent than checkpoint', () => {
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: 50,
          lastCheckpointAt: 100,
          lastPublishedAt: 200,
        }),
      ).toBe('published');
    });

    it('returns draft-saved when checkpoint is more recent than publish', () => {
      // User published v1.0, then edited and saved a draft after.
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: 50,
          lastCheckpointAt: 200,
          lastPublishedAt: 100,
        }),
      ).toBe('draft-saved');
    });

    it('favors published over draft-saved on equal timestamps', () => {
      // Same instant → publish is the stronger guarantee.
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: 50,
          lastCheckpointAt: 100,
          lastPublishedAt: 100,
        }),
      ).toBe('published');
    });

    it('ignores autosave timestamp when stronger tier exists', () => {
      // Autosave runs every 500ms — it would otherwise dominate.
      expect(
        deriveSaveState({
          isDirty: false,
          lastAutosaveAt: 999,
          lastCheckpointAt: 100,
          lastPublishedAt: null,
        }),
      ).toBe('draft-saved');
    });
  });

  describe('full 16-combination matrix (binary presence)', () => {
    // Each input is either present (timestamp = 100) or absent (null).
    // 4 inputs × 2 states = 16 combinations.
    const cases: Array<{
      label: string;
      input: Parameters<typeof deriveSaveState>[0];
      expected: 'unsaved' | 'autosaved' | 'draft-saved' | 'published';
    }> = [
      // dirty=true: always unsaved (8 cases collapsed into 4 representative)
      {
        label: 'dirty + nothing',
        input: { isDirty: true, lastAutosaveAt: null, lastCheckpointAt: null, lastPublishedAt: null },
        expected: 'unsaved',
      },
      {
        label: 'dirty + autosave',
        input: { isDirty: true, lastAutosaveAt: 100, lastCheckpointAt: null, lastPublishedAt: null },
        expected: 'unsaved',
      },
      {
        label: 'dirty + checkpoint',
        input: { isDirty: true, lastAutosaveAt: null, lastCheckpointAt: 100, lastPublishedAt: null },
        expected: 'unsaved',
      },
      {
        label: 'dirty + published',
        input: { isDirty: true, lastAutosaveAt: null, lastCheckpointAt: null, lastPublishedAt: 100 },
        expected: 'unsaved',
      },
      {
        label: 'dirty + all',
        input: { isDirty: true, lastAutosaveAt: 100, lastCheckpointAt: 100, lastPublishedAt: 100 },
        expected: 'unsaved',
      },
      // clean cases
      {
        label: 'clean + nothing',
        input: { isDirty: false, lastAutosaveAt: null, lastCheckpointAt: null, lastPublishedAt: null },
        expected: 'autosaved',
      },
      {
        label: 'clean + autosave only',
        input: { isDirty: false, lastAutosaveAt: 100, lastCheckpointAt: null, lastPublishedAt: null },
        expected: 'autosaved',
      },
      {
        label: 'clean + checkpoint only',
        input: { isDirty: false, lastAutosaveAt: null, lastCheckpointAt: 100, lastPublishedAt: null },
        expected: 'draft-saved',
      },
      {
        label: 'clean + published only',
        input: { isDirty: false, lastAutosaveAt: null, lastCheckpointAt: null, lastPublishedAt: 100 },
        expected: 'published',
      },
      {
        label: 'clean + autosave + checkpoint',
        input: { isDirty: false, lastAutosaveAt: 100, lastCheckpointAt: 100, lastPublishedAt: null },
        expected: 'draft-saved',
      },
      {
        label: 'clean + autosave + published',
        input: { isDirty: false, lastAutosaveAt: 100, lastCheckpointAt: null, lastPublishedAt: 100 },
        expected: 'published',
      },
      {
        label: 'clean + checkpoint + published (same time)',
        input: { isDirty: false, lastAutosaveAt: null, lastCheckpointAt: 100, lastPublishedAt: 100 },
        expected: 'published',
      },
      {
        label: 'clean + all (same time)',
        input: { isDirty: false, lastAutosaveAt: 100, lastCheckpointAt: 100, lastPublishedAt: 100 },
        expected: 'published',
      },
    ];

    for (const c of cases) {
      it(`${c.label} → ${c.expected}`, () => {
        expect(deriveSaveState(c.input)).toBe(c.expected);
      });
    }
  });
});

describe('formatSaveStateLabel', () => {
  it('uses fixed copy for unsaved (no relative time, no version)', () => {
    expect(formatSaveStateLabel('unsaved', '5s ago', '1.0.0')).toBe(
      'Unsaved changes',
    );
    expect(formatSaveStateLabel('unsaved', null, null)).toBe('Unsaved changes');
  });

  it('formats published with version when available', () => {
    expect(formatSaveStateLabel('published', '2m ago', '1.2.0')).toBe(
      'Published v1.2.0',
    );
  });

  it('falls back to bare "Published" without a version', () => {
    expect(formatSaveStateLabel('published', '2m ago', null)).toBe('Published');
  });

  it('formats draft-saved with relative time', () => {
    expect(formatSaveStateLabel('draft-saved', 'just now', null)).toBe(
      'Saved draft just now',
    );
    expect(formatSaveStateLabel('draft-saved', null, null)).toBe('Saved draft');
  });

  it('formats autosaved with relative time, falls back to "Autosaved locally"', () => {
    expect(formatSaveStateLabel('autosaved', '30s ago', null)).toBe(
      'Autosaved 30s ago',
    );
    expect(formatSaveStateLabel('autosaved', null, null)).toBe(
      'Autosaved locally',
    );
  });
});

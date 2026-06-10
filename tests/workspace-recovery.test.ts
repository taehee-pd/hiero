/**
 * D5 — last-known-good workspace recovery
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * `save()` carries the previous well-formed payload as `backupData`;
 * `load()` resolves through these helpers so a corrupted primary write
 * surfaces the prior snapshot instead of garbage.
 */
import { describe, expect, test } from 'bun:test';

import {
  isWorkspaceShaped,
  resolveStoredWorkspace,
} from '../lib/persistence/indexeddb-adapter';
import { SAMPLE_WORKSPACE } from '../lib/schema/sample-project';

describe('workspace recovery helpers (D5)', () => {
  test('isWorkspaceShaped accepts a real workspace and rejects junk', () => {
    expect(isWorkspaceShaped(SAMPLE_WORKSPACE)).toBe(true);
    expect(isWorkspaceShaped(null)).toBe(false);
    expect(isWorkspaceShaped(undefined)).toBe(false);
    expect(isWorkspaceShaped('{"truncated":')).toBe(false);
    expect(isWorkspaceShaped({})).toBe(false);
    expect(isWorkspaceShaped({ iconSets: {} })).toBe(false); // missing meta
  });

  test('healthy primary payload wins, not flagged as recovered', () => {
    const resolved = resolveStoredWorkspace({
      data: SAMPLE_WORKSPACE,
      backupData: undefined,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.recovered).toBe(false);
    expect(resolved!.data).toBe(SAMPLE_WORKSPACE);
  });

  test('corrupted primary falls back to the backup and flags recovery', () => {
    const resolved = resolveStoredWorkspace({
      data: { half: 'written' },
      backupData: SAMPLE_WORKSPACE,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.recovered).toBe(true);
    expect(resolved!.data).toBe(SAMPLE_WORKSPACE);
  });

  test('both payloads corrupted resolves to null (treated as not found)', () => {
    expect(
      resolveStoredWorkspace({ data: null, backupData: 42 }),
    ).toBeNull();
  });
});

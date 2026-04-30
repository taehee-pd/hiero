/**
 * Version History view (Phase 3).
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Navbar                                                    │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Version History                                           │
 *   │ ┌──────────────┐ ┌──────────────────────────────────┐    │
 *   │ │ v1.2.0 ●     │ │ v1.2.0 by taehee · Apr 30, 2026  │    │
 *   │ │ Apr 30, 2026 │ │ Targets: PR ✓  npm ✓             │    │
 *   │ │ 3↑ 1↓ 0×     │ │ Notes: ...                        │    │
 *   │ ├──────────────┤ │ [Compare with…] [Restore to draft]│   │
 *   │ │ v1.1.0       │ │                                   │   │
 *   │ │ Apr 20, 2026 │ │ Restore audit:                    │   │
 *   │ └──────────────┘ │   2026-04-25 by taehee            │   │
 *   │                  └──────────────────────────────────┘    │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The compare picker is a second snapshot dropdown that calls
 * `diffWorkspaces` over the two snapshots' embedded workspaces.
 *
 * Restore-to-draft is gated by the dirty-work confirm dialog
 * (Save & Restore / Discard & Restore / Cancel) per eng-review must-fix
 * #2. The restore is recorded in the audit log via appendRestoreEvent.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/ds/status-badge';
import { Tag } from '@/components/ds/tag';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import {
  saveDraftCheckpoint,
} from '@/lib/persistence/use-persistence';
import { IndexedDBAdapter } from '@/lib/persistence/indexeddb-adapter';
import type {
  RestoreEvent,
  VersionSnapshot,
  VersionSnapshotMeta,
} from '@/lib/sync-service/version-snapshot';
import {
  restoreSnapshotIntoDraft,
  type DirtyWorkResolution,
} from '@/lib/sync-ui/restore-to-draft';
import { diffWorkspaces, type WorkspaceDiff } from '@/lib/sync-ui/version-compare';

const adapter = new IndexedDBAdapter();

export function HistoryView() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Hiero');

  const [snapshots, setSnapshots] = useState<VersionSnapshotMeta[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFull, setSelectedFull] = useState<VersionSnapshot | null>(null);
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  const [compareDiff, setCompareDiff] = useState<WorkspaceDiff | null>(null);
  const [restoreEvents, setRestoreEvents] = useState<RestoreEvent[]>([]);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreBanner, setRestoreBanner] = useState<string | null>(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void adapter.listVersionSnapshots().then((list) => {
      if (cancelled) return;
      setSnapshots(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate the selected snapshot's full workspace + audit log.
  useEffect(() => {
    if (!selectedId) {
      setSelectedFull(null);
      setRestoreEvents([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      adapter.loadVersionSnapshot(selectedId),
      adapter.listRestoreEvents(selectedId),
    ]).then(([snap, events]) => {
      if (cancelled) return;
      setSelectedFull(snap);
      setRestoreEvents(events);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Recompute compare diff whenever either side changes.
  useEffect(() => {
    if (!selectedFull || !compareWithId) {
      setCompareDiff(null);
      return;
    }
    let cancelled = false;
    void adapter.loadVersionSnapshot(compareWithId).then((other) => {
      if (cancelled || !other) return;
      // Order: older → newer for natural added/removed semantics.
      const older =
        other.publishedAt < selectedFull.publishedAt ? other : selectedFull;
      const newer = older === other ? selectedFull : other;
      setCompareDiff(
        diffWorkspaces(older.workspaceSnapshot, newer.workspaceSnapshot),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFull, compareWithId]);

  const compareCandidates = useMemo(
    () => (snapshots ?? []).filter((s) => s.id !== selectedId),
    [snapshots, selectedId],
  );

  const handleRestoreClick = useCallback(() => {
    setRestoreError(null);
    if (isDirty) {
      setConfirmRestoreOpen(true);
    } else {
      void runRestore('no-dirty-work');
    }
    // runRestore declared below; the closure captures it via reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const runRestore = useCallback(
    async (resolution: DirtyWorkResolution) => {
      if (!selectedFull) return;
      setConfirmRestoreOpen(false);
      try {
        if (resolution === 'checkpoint') {
          // Snapshot the current dirty work as an explicit checkpoint
          // BEFORE we overwrite the editor with the historical workspace.
          await saveDraftCheckpoint(
            `Auto-saved before restore from v${selectedFull.version}`,
          );
        }
        await restoreSnapshotIntoDraft(selectedFull.id, {
          persistence: adapter,
          restoredBy: projectName,
          dirtyWorkResolution: resolution,
          projectId: editorStore.getState().activeIconSetId ?? null,
          applyToEditor: async (workspace) => {
            editorStore.getState().loadWorkspace(workspace, { markDirty: true });
          },
        });
        setRestoreBanner(
          `Restored v${selectedFull.version} into draft. Publish to release.`,
        );
        // Refresh audit log inline.
        const events = await adapter.listRestoreEvents(selectedFull.id);
        setRestoreEvents(events);
      } catch (err) {
        setRestoreError(
          err instanceof Error ? err.message : 'Restore failed.',
        );
      }
    },
    [projectName, selectedFull],
  );

  return (
    <div className="flex flex-col gap-4 p-6" data-testid="history-view">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          Version History
        </h1>
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to studio →
        </a>
      </header>

      {restoreBanner && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {restoreBanner}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-1 border-r pr-3">
          {snapshots === null && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {snapshots !== null && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No published versions yet. Publish from the studio to start
              your history.
            </p>
          )}
          {snapshots?.map((s) => (
            <button
              key={s.id}
              type="button"
              data-snapshot-row={s.id}
              data-selected={s.id === selectedId ? 'true' : undefined}
              onClick={() => setSelectedId(s.id)}
              className={`flex flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors ${
                s.id === selectedId
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/40'
              }`}
            >
              <span className="font-medium">v{s.version}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(s.publishedAt).toLocaleString()}
              </span>
              <span className="mt-1 flex gap-1 text-[10px] text-muted-foreground">
                {s.changesSummary.added.length}↑ ·{' '}
                {s.changesSummary.modified.length}↕ ·{' '}
                {s.changesSummary.removed.length}↓
              </span>
            </button>
          ))}
        </aside>

        <section className="flex flex-col gap-4">
          {!selectedFull && (
            <p className="text-sm text-muted-foreground">
              Select a version to inspect.
            </p>
          )}
          {selectedFull && (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">v{selectedFull.version}</h2>
                <StatusBadge variant="neutral">
                  {new Date(selectedFull.publishedAt).toLocaleString()}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  by {selectedFull.publishedBy}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedFull.targetResults.map((r, i) => (
                  <StatusBadge
                    key={i}
                    variant={r.status === 'success' ? 'success' : 'danger'}
                  >
                    {r.kind} · {r.status}
                  </StatusBadge>
                ))}
              </div>

              {selectedFull.releaseNotes && (
                <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs">
                  {selectedFull.releaseNotes}
                </pre>
              )}

              <div className="flex items-center gap-2 text-xs">
                <span>Compare with:</span>
                <Select
                  value={compareWithId ?? undefined}
                  onValueChange={(v) => setCompareWithId(v || null)}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-56"
                    data-testid="history-compare-select"
                  >
                    <SelectValue placeholder="— pick a version —" />
                  </SelectTrigger>
                  <SelectContent>
                    {compareCandidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        v{s.version} ·{' '}
                        {new Date(s.publishedAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {compareDiff && (
                <div className="rounded-md border p-3 text-xs">
                  {compareDiff.isIdentical ? (
                    <p className="text-muted-foreground">
                      Workspaces are byte-identical.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag variant="success">
                          {compareDiff.added.length} added
                        </Tag>
                        <Tag variant="default">
                          {compareDiff.modified.length} modified
                        </Tag>
                        <Tag variant="warning">
                          {compareDiff.removed.length} removed
                        </Tag>
                      </div>
                      <details>
                        <summary className="cursor-pointer">Show icons</summary>
                        <ul className="mt-2 space-y-1 font-mono text-[11px]">
                          {compareDiff.added.map((id) => (
                            <li key={`a-${id}`}>+ {id}</li>
                          ))}
                          {compareDiff.modified.map((id) => (
                            <li key={`m-${id}`}>~ {id}</li>
                          ))}
                          {compareDiff.removed.map((id) => (
                            <li key={`r-${id}`}>- {id}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleRestoreClick}>
                  Restore to draft
                </Button>
                {restoreError && (
                  <span className="text-xs text-destructive">
                    {restoreError}
                  </span>
                )}
              </div>

              {restoreEvents.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer">
                    Restore audit ({restoreEvents.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {restoreEvents.map((ev) => (
                      <li key={ev.id} className="text-muted-foreground">
                        {new Date(ev.restoredAt).toLocaleString()} · by{' '}
                        {ev.restoredBy} · pre-restore work:{' '}
                        {ev.preservedDirtyWorkAs}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog
        open={confirmRestoreOpen}
        onOpenChange={(o) => setConfirmRestoreOpen(o)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You have unsaved changes</DialogTitle>
            <DialogDescription>
              Restoring v{selectedFull?.version ?? ''} will overwrite the
              workspace. Save your current changes as a draft checkpoint
              first?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmRestoreOpen(false)}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void runRestore('discarded')}
              >
                Discard &amp; restore
              </Button>
              <Button onClick={() => void runRestore('checkpoint')}>
                Save &amp; restore
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Unified Publish flow.
 *
 *   ┌────────────────────────────────────────┐
 *   │  Publish dialog                         │
 *   ├────────────────────────────────────────┤
 *   │  Version: [1.2.0]   [patch][minor][maj] │
 *   │  Release notes:  ┌──────────────────┐   │
 *   │                  │                  │   │
 *   │                  └──────────────────┘   │
 *   │  Targets:                               │
 *   │    [x] Local directory  (./out)         │
 *   │    [x] GitHub PR        (org/repo)      │
 *   │    [ ] npm registry     (@hiero/icons)  │
 *   │  Changes: 3 added · 2 modified · 0 rem  │
 *   │                                         │
 *   │           [Cancel]   [Publish]          │
 *   └────────────────────────────────────────┘
 *
 * Replaces the orphaned PublishPanel + ReleasePanel surfaces (per the
 * Phase 2 spec, B2: "unify PublishPanel + ReleasePanel into one
 * orchestrated publish flow"). The dialog gathers user intent and hands
 * off to `executePublishTransaction`, which drives per-target transport
 * and writes a VersionSnapshot if anything succeeds.
 *
 * The transport callbacks are caller-provided so this component does NOT
 * import sync-pr.ts / npm-publish-client.ts directly — keeps the bundle
 * graph clean and the dialog unit-testable.
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ds/status-badge';
import { Tag } from '@/components/ds/tag';
import {
  executePublishTransaction,
  type PublishOutcome,
  type PublishTargetSpec,
  type TargetExecutor,
} from '@/lib/sync-service/publish-transaction';
import type {
  ChangesSummary,
  ReleaseTargetKind,
} from '@/lib/sync-service/version-snapshot';
import type { Workspace } from '@/lib/schema/types';
import type { PersistenceAdapter } from '@/lib/persistence/adapter';
import { editorStore } from '@/lib/editor-store/store';

export type PublishTargetOption = {
  spec: PublishTargetSpec;
  /** Display label (e.g. "GitHub PR · org/repo"). */
  label: string;
  /** Pre-checked by default. */
  defaultEnabled?: boolean;
};

export type PublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  publishedBy: string;
  /** Suggested next version. The dialog lets the user override. */
  suggestedVersion: string;
  changesSummary: ChangesSummary;
  /** Available release targets to render as a checklist. */
  targetOptions: PublishTargetOption[];
  /** Caller-supplied per-target transport. */
  execute: TargetExecutor;
  persistence: PersistenceAdapter;
  /** Optional callback fired after a successful publish. */
  onPublished?: (outcome: PublishOutcome) => void;
};

type DialogState =
  | { phase: 'compose' }
  | { phase: 'publishing' }
  | { phase: 'done'; outcome: PublishOutcome };

function bumpSemver(version: string, kind: 'patch' | 'minor' | 'major'): string {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return version;
  }
  const [major, minor, patch] = parts;
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function targetKindLabel(kind: ReleaseTargetKind): string {
  switch (kind) {
    case 'git-pr':
      return 'GitHub PR';
    case 'npm-registry':
      return 'npm registry';
    case 'local-directory':
      return 'Local directory';
  }
}

export function PublishDialog({
  open,
  onOpenChange,
  workspace,
  publishedBy,
  suggestedVersion,
  changesSummary,
  targetOptions,
  execute,
  persistence,
  onPublished,
}: PublishDialogProps) {
  const [version, setVersion] = useState(suggestedVersion);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [enabled, setEnabled] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    targetOptions.forEach((t, i) => {
      init[i] = t.defaultEnabled !== false;
    });
    return init;
  });
  const [state, setState] = useState<DialogState>({ phase: 'compose' });

  const selectedTargets = useMemo(
    () => targetOptions.filter((_, i) => enabled[i]).map((t) => t.spec),
    [enabled, targetOptions],
  );

  const totalChanges =
    changesSummary.added.length +
    changesSummary.modified.length +
    changesSummary.removed.length;

  const handlePublish = useCallback(async () => {
    setState({ phase: 'publishing' });
    const outcome = await executePublishTransaction(
      {
        version,
        releaseNotes,
        publishedBy,
        workspace,
        changesSummary,
        targets: selectedTargets,
      },
      { execute, persistence },
    );
    if (outcome.kind !== 'all-failed') {
      editorStore.getState().markPublished(outcome.snapshot.version);
    }
    setState({ phase: 'done', outcome });
    onPublished?.(outcome);
  }, [
    changesSummary,
    execute,
    onPublished,
    persistence,
    publishedBy,
    releaseNotes,
    selectedTargets,
    version,
    workspace,
  ]);

  const reset = useCallback(() => {
    setState({ phase: 'compose' });
    setReleaseNotes('');
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-lg" data-publish-dialog-phase={state.phase}>
        <DialogHeader>
          <DialogTitle>Publish</DialogTitle>
          <DialogDescription>
            Records a version snapshot and pushes the source to selected targets.
          </DialogDescription>
        </DialogHeader>

        {state.phase === 'compose' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" htmlFor="publish-version">
                Version
              </label>
              <Input
                id="publish-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVersion((v) => bumpSemver(v, 'patch'))}
              >
                patch
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVersion((v) => bumpSemver(v, 'minor'))}
              >
                minor
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVersion((v) => bumpSemver(v, 'major'))}
              >
                major
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="publish-notes">
                Release notes
              </label>
              <Textarea
                id="publish-notes"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={4}
                placeholder="What changed in this release?"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Targets</span>
              {targetOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No release targets configured. Add one in hiero.config.ts.
                </p>
              ) : (
                targetOptions.map((opt, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={enabled[i] ?? false}
                      onChange={(e) =>
                        setEnabled((prev) => ({ ...prev, [i]: e.target.checked }))
                      }
                    />
                    <Tag variant="outline">{targetKindLabel(opt.spec.kind)}</Tag>
                    <span className="text-muted-foreground">{opt.label}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Changes:</span>
              <Tag variant="success">{changesSummary.added.length} added</Tag>
              <Tag variant="default">{changesSummary.modified.length} modified</Tag>
              <Tag variant="warning">{changesSummary.removed.length} removed</Tag>
              {totalChanges === 0 && (
                <span className="text-muted-foreground/80">
                  no source changes detected
                </span>
              )}
            </div>
          </div>
        )}

        {state.phase === 'publishing' && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Publishing v{version}…
          </div>
        )}

        {state.phase === 'done' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {state.outcome.kind === 'success' &&
                `Published v${state.outcome.snapshot.version}.`}
              {state.outcome.kind === 'partial-failure' &&
                `Published v${state.outcome.snapshot.version} with ${state.outcome.failedTargets.length} target(s) failed.`}
              {state.outcome.kind === 'all-failed' &&
                'Publish failed — every target returned an error. Nothing was recorded.'}
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {(state.outcome.kind === 'all-failed'
                ? state.outcome.targetResults
                : state.outcome.snapshot.targetResults
              ).map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <StatusBadge variant={r.status === 'success' ? 'success' : 'danger'}>
                    {r.status}
                  </StatusBadge>
                  <span>{targetKindLabel(r.kind)}</span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      open
                    </a>
                  )}
                  {r.error && <span className="text-destructive">{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {state.phase === 'compose' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handlePublish()}
                disabled={selectedTargets.length === 0 || version.trim() === ''}
              >
                Publish
              </Button>
            </>
          )}
          {state.phase === 'publishing' && (
            <Button disabled>Publishing…</Button>
          )}
          {state.phase === 'done' && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

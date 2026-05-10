'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ds/status-badge';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { useSyncPr } from '@/lib/sync-ui/use-sync-pr';
import { isInProgress, canRetry } from '@/lib/sync-ui/sync-state';
import { SyncDiffPreview } from './SyncDiffPreview';
import { SyncConflictPanel } from './SyncConflictPanel';

type SyncPrPanelProps = {
  iconSetId?: string | null;
  triggerLabel?: ReactNode;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  triggerSize?: 'default' | 'sm' | 'icon-sm';
  className?: string;
};

export function SyncPrPanel({
  iconSetId,
  triggerLabel = 'Create PR',
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  className,
}: SyncPrPanelProps) {
  const resolvedIconSetId = useEditorStore((s) => iconSetId ?? s.activeIconSetId);
  const iconSet = useEditorStore((s) =>
    resolvedIconSetId ? s.workspace?.iconSets[resolvedIconSetId] ?? null : null,
  );
  const { state, connect, previewChanges, createPullRequest, retry, dismiss } = useSyncPr();

  const [open, setOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // Local form state
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [packagePath, setPackagePath] = useState('');

  const settingsComplete = useMemo(
    () => Boolean(owner && repo && baseBranch),
    [owner, repo, baseBranch],
  );

  const saveSettings = () => {
    connect({ owner, repo, baseBranch, packagePath });
  };

  const handlePreview = () => {
    if (!iconSet) return;
    saveSettings();
    previewChanges(iconSet);
    setShowDiff(true);
  };

  const handleCreatePr = async () => {
    if (!iconSet) return;
    saveSettings();
    await createPullRequest(iconSet);
  };

  const handleRetry = async () => {
    if (!iconSet) return;
    await retry(iconSet);
  };

  const handleDismiss = () => {
    dismiss();
    setShowDiff(false);
  };

  const busy = isInProgress(state);
  const retriable = canRetry(state);

  // Badge for status
  const statusBadge = (() => {
    switch (state.phase) {
      case 'pr_created':
        return <StatusBadge variant="info">PR created</StatusBadge>;
      case 'conflict_detected':
        return <StatusBadge variant="danger">Conflict</StatusBadge>;
      case 'validation_failed':
        return <StatusBadge variant="danger">Failed</StatusBadge>;
      case 'auth_expired':
        return <StatusBadge variant="danger">Auth expired</StatusBadge>;
      case 'changes_not_synced':
        return <StatusBadge variant="accent">{state.iconChanges.length} changes</StatusBadge>;
      default:
        return null;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={className}>
          {triggerLabel}
          {statusBadge && <span className="ml-1.5">{statusBadge}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.phase === 'pr_created'
              ? 'Pull Request Created'
              : `Create Pull Request`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* --- Settings --- */}
          {state.phase !== 'pr_created' && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner">
                  <Input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="acme"
                    disabled={busy}
                  />
                </Field>
                <Field label="Repository">
                  <Input
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="icon-pack"
                    disabled={busy}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base branch">
                  <Input
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    placeholder="main"
                    disabled={busy}
                  />
                </Field>
                <Field label="Package path">
                  <Input
                    value={packagePath}
                    onChange={(e) => setPackagePath(e.target.value)}
                    placeholder="packages/icons"
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* --- Progress --- */}
          {busy && state.statusMessage && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {state.statusMessage}
            </p>
          )}

          {/* --- Error / Conflict --- */}
          {state.phase === 'conflict_detected' && (
            <SyncConflictPanel conflicts={state.conflicts} />
          )}

          {(state.phase === 'validation_failed' || state.phase === 'auth_expired') &&
            state.errorMessage && (
              <p className="text-sm text-destructive">{state.errorMessage}</p>
            )}

          {/* --- Diff preview --- */}
          {showDiff && state.iconChanges.length > 0 && state.phase !== 'pr_created' && (
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground tracking-tight">
                  Changed icons
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDiff(false)}
                >
                  Hide
                </button>
              </div>
              <SyncDiffPreview
                iconChanges={state.iconChanges}
                fileCount={state.fileCount}
              />
            </div>
          )}

          {/* --- PR result --- */}
          {state.phase === 'pr_created' && state.prResult && (
            <div className="space-y-2">
              <p className="text-sm">
                Your changes are ready for review.
              </p>
              <a
                href={state.prResult.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border p-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium">
                  #{state.prResult.number}
                </span>
                <span className="text-muted-foreground ml-2">
                  on branch {state.prResult.branch}
                </span>
                <span className="block text-xs text-muted-foreground mt-1 underline">
                  {state.prResult.url}
                </span>
              </a>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {/* Preview button */}
          {!busy && state.phase !== 'pr_created' && settingsComplete && !showDiff && (
            <Button variant="outline" size="sm" onClick={handlePreview}>
              Preview changes
            </Button>
          )}

          {/* Create PR button */}
          {!busy && state.phase !== 'pr_created' && !retriable && (
            <Button
              disabled={!settingsComplete}
              onClick={handleCreatePr}
            >
              Create pull request
            </Button>
          )}

          {/* Retry */}
          {retriable && !busy && (
            <>
              {state.phase === 'conflict_detected' && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Force sync
                </Button>
              )}
              <Button onClick={handleRetry}>
                {state.phase === 'conflict_detected' ? 'Re-export & retry' : 'Retry'}
              </Button>
            </>
          )}

          {/* Dismiss */}
          {state.phase === 'pr_created' && (
            <Button variant="outline" onClick={handleDismiss}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </label>
  );
}

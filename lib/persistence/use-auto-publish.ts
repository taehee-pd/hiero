/**
 * React hook that wires pendingPublish store state to the auto-publish manager.
 *
 * When pendingPublish is set, schedules a 5-minute countdown.
 * When countdown expires, calls the npm connector's push() method.
 * When cancelPendingPublish is called, cancels the timer.
 */

'use client';

import { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor-store/store';
import { createAutoPublishManager } from '@/lib/sync-service/auto-publish';
import { toast } from '@/components/ui/use-toast';

const manager = createAutoPublishManager();

export function useAutoPublish(): void {
  const prevTargetId = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = editorStore.subscribe(() => {
      const { pendingPublish, project } = editorStore.getState();

      // Cancelled — clear timer
      if (!pendingPublish && prevTargetId.current) {
        manager.cancel(prevTargetId.current);
        prevTargetId.current = null;
        return;
      }

      // New or changed pending publish
      if (pendingPublish && pendingPublish.targetId !== prevTargetId.current) {
        prevTargetId.current = pendingPublish.targetId;

        const target = project?.syncTargets?.find((t) => t.id === pendingPublish.targetId);
        if (!target?.npmRegistry) {
          editorStore.getState().cancelPendingPublish();
          return;
        }

        manager.schedule(pendingPublish.targetId, async () => {
          // Clear the pending state
          editorStore.getState().cancelPendingPublish();

          try {
            const currentProject = editorStore.getState().project;
            const currentTarget = currentProject?.syncTargets?.find(
              (t) => t.id === pendingPublish.targetId,
            );
            if (!currentProject || !currentTarget?.npmRegistry) return;

            // Determine next version
            const lastVersion = currentTarget.npmRegistry.lastPublishedVersion ?? '0.0.0';
            const nextVersion = bumpVersion(lastVersion, pendingPublish.semver);

            // Create a minimal connector (web environment — no filesystem publisher)
            // On web, we dispatch to the /api/publish-npm route instead
            const res = await fetch('/api/publish-npm', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                targetId: pendingPublish.targetId,
                version: nextVersion,
                dryRun: currentTarget.dryRun ?? false,
              }),
            });

            if (res.ok) {
              // Update the target with the new version
              editorStore.getState().updateSyncTarget(pendingPublish.targetId, {
                npmRegistry: {
                  ...currentTarget.npmRegistry,
                  lastPublishedVersion: nextVersion,
                },
              });
              toast({
                title: currentTarget.dryRun ? 'Dry run complete' : 'Published',
                description: `${currentTarget.npmRegistry.packageName}@${nextVersion}`,
              });
            } else {
              const error = await res.json().catch(() => ({ error: 'Unknown error' }));
              toast({
                title: 'Publish failed',
                description: (error as { error?: string }).error ?? 'Unknown error',
                variant: 'destructive',
              });
            }
          } catch (error) {
            toast({
              title: 'Publish failed',
              description: error instanceof Error ? error.message : 'Unknown error',
              variant: 'destructive',
            });
          }
        });
      }
    });

    return () => {
      unsubscribe();
      manager.cancelAll();
    };
  }, []);
}

function bumpVersion(version: string, bump: 'patch' | 'minor' | 'major'): string {
  const parts = version.split('.').map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

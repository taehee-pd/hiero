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
import { getNextPublishVersion, publishNpmTarget } from '@/lib/sync-service/npm-publish-client';
import { toast } from '@/components/ui/use-toast';
import type { Project, SyncTarget } from '@/lib/schema/types';

function getProjectSyncTargets(project: Project | null): SyncTarget[] {
  return project?.syncTargets ?? [];
}

const manager = createAutoPublishManager();

export function useAutoPublish(): void {
  const prevLastSavedAt = useRef<number | null>(null);
  const pendingKeysRef = useRef(new Map<string, string>());

  useEffect(() => {
    const pendingKeys = pendingKeysRef.current;

    const unsubscribe = editorStore.subscribe(() => {
      const state = editorStore.getState();

      if (state.lastSavedAt !== prevLastSavedAt.current) {
        prevLastSavedAt.current = state.lastSavedAt;

        if (state.lastSavedAt && state.skipNextAutoPublish) {
          state.clearAutoPublishSkip();
        } else if (state.lastSavedAt && state.project) {
          for (const target of getProjectSyncTargets(state.project)) {
            if (
              target.deliveryMode === 'npm-registry' &&
              target.npmRegistry &&
              target.autoPublish?.on === 'save'
            ) {
              state.schedulePendingPublish(
                target.id,
                target.autoPublish.semver ?? 'patch',
              );
            }
          }
        }
      }

      const pendingById = new Map(
        state.pendingPublishes.map((pending) => [
          pending.targetId,
          `${pending.scheduledAt}:${pending.semver}`,
        ]),
      );

      for (const [targetId] of pendingKeys) {
        if (!pendingById.has(targetId)) {
          manager.cancel(targetId);
          pendingKeys.delete(targetId);
        }
      }

      for (const pending of state.pendingPublishes) {
        const pendingKey = `${pending.scheduledAt}:${pending.semver}`;
        if (pendingKeys.get(pending.targetId) === pendingKey) {
          continue;
        }

        const target = getProjectSyncTargets(state.project).find((item: SyncTarget) => item.id === pending.targetId);
        if (!target?.npmRegistry || !state.project) {
          editorStore.getState().cancelPendingPublish(pending.targetId);
          continue;
        }

        pendingKeys.set(pending.targetId, pendingKey);
        manager.schedule(pending.targetId, async () => {
          const latestState = editorStore.getState();
          const currentProject = latestState.project;
          const currentTarget = getProjectSyncTargets(currentProject).find(
            (item: SyncTarget) => item.id === pending.targetId,
          );

          latestState.cancelPendingPublish(pending.targetId);

          if (!currentProject || !currentTarget?.npmRegistry) return;

          try {
            const nextVersion = getNextPublishVersion(currentTarget, pending.semver);
            const result = await publishNpmTarget({
              project: currentProject,
              target: currentTarget,
              version: nextVersion,
              dryRun: currentTarget.dryRun ?? false,
            });

            if (result.kind === 'error') {
              toast({
                title: 'Publish failed',
                description: result.message,
                variant: 'destructive',
              });
              return;
            }

            if (result.kind === 'success') {
              // recordPublishedVersion was removed from EditorStore during migration.
              // Version tracking is now handled externally.
            }

            toast({
              title: result.kind === 'dry-run' ? 'Preview publish complete' : 'Published',
              description: `${currentTarget.npmRegistry.packageName}@${nextVersion}`,
            });
          } catch (error) {
            toast({
              title: 'Publish failed',
              description: error instanceof Error ? error.message : 'Unknown error',
              variant: 'destructive',
            });
          } finally {
            pendingKeys.delete(pending.targetId);
          }
        });
      }
    });

    return () => {
      unsubscribe();
      manager.cancelAll();
      pendingKeys.clear();
    };
  }, []);
}

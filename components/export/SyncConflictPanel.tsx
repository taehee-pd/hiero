'use client';

import type { Conflict } from '@/lib/sync-service/conflicts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tag } from '@/components/ds/tag';

type SyncConflictPanelProps = {
  conflicts: Conflict[];
};

const CONFLICT_TITLES: Record<string, string> = {
  'base-sha-drift': 'Repository has newer changes',
  'icon-changed-remotely': 'Icons modified by someone else',
  'icon-deleted-remotely': 'Icons deleted from repository',
  'manifest-changed-remotely': 'Manifest modified externally',
  'branch-already-exists': 'Branch name already taken',
};

export function SyncConflictPanel({ conflicts }: SyncConflictPanelProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      {conflicts.map((conflict, i) => (
        <Alert key={i} variant="destructive">
          <AlertTitle className="text-sm font-medium">
            {CONFLICT_TITLES[conflict.kind] ?? 'Conflict detected'}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {conflict.message}
          </AlertDescription>
          {conflict.iconDirs && conflict.iconDirs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {conflict.iconDirs.map((dir) => (
                <Tag key={dir}>
                  {dir}
                </Tag>
              ))}
            </div>
          )}
        </Alert>
      ))}
    </div>
  );
}

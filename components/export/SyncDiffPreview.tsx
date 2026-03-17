'use client';

import type { IconChange } from '@/lib/sync-service/diff-source';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type SyncDiffPreviewProps = {
  iconChanges: IconChange[];
  fileCount: number;
};

const KIND_LABELS: Record<IconChange['kind'], string> = {
  added: 'Added',
  removed: 'Removed',
  updated: 'Updated',
  'preview-only': 'Preview updated',
  'metadata-only': 'Metadata updated',
};

const KIND_VARIANTS: Record<IconChange['kind'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  added: 'default',
  removed: 'destructive',
  updated: 'secondary',
  'preview-only': 'outline',
  'metadata-only': 'outline',
};

export function SyncDiffPreview({ iconChanges, fileCount }: SyncDiffPreviewProps) {
  if (iconChanges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No icon-level changes detected.{' '}
        {fileCount > 0 ? `${fileCount} file(s) will be synced.` : ''}
      </p>
    );
  }

  const added = iconChanges.filter((c) => c.kind === 'added');
  const updated = iconChanges.filter((c) => c.kind === 'updated' || c.kind === 'preview-only' || c.kind === 'metadata-only');
  const removed = iconChanges.filter((c) => c.kind === 'removed');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{iconChanges.length} icon(s) changed</span>
        <span className="text-xs">{fileCount} file(s)</span>
      </div>

      <ScrollArea className="max-h-48">
        <div className="space-y-1">
          {[...added, ...updated, ...removed].map((change) => (
            <div
              key={change.iconDir}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <span className="font-mono text-xs">{change.iconDir}</span>
              <Badge variant={KIND_VARIANTS[change.kind]} className="text-[10px]">
                {KIND_LABELS[change.kind]}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

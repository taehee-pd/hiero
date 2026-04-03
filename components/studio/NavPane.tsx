'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

export function NavPane() {
  const workspace = useEditorStore((s) => s.workspace);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const navExpanded = useEditorStore((s) => s.navPaneExpanded);
  const { addIconSet, removeIconSet, renameIconSet, setActiveIconSet, toggleNavPane } = useEditorActions();

  const [inlineNew, setInlineNew] = useState(false);
  const [inlineNewValue, setInlineNewValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; iconCount: number } | null>(null);

  const iconSets = useMemo(
    () =>
      Object.entries(workspace?.iconSets ?? {})
        .map(([id, iconSet]) => ({
          id,
          name: iconSet.meta.name,
          iconCount: Object.keys(iconSet.icons).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [workspace?.iconSets],
  );

  const handleSelectProject = useCallback(
    (iconSetId: string) => {
      setActiveIconSet(iconSetId);
    },
    [setActiveIconSet],
  );

  const handleCreateProject = useCallback(() => {
    const name = inlineNewValue.trim();
    if (!name) { setInlineNew(false); return; }
    addIconSet(name);
    setInlineNew(false);
    setInlineNewValue('');
  }, [addIconSet, inlineNewValue]);

  const handleDeleteProject = useCallback(() => {
    if (!deleteTarget) return;
    removeIconSet(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, removeIconSet]);

  return (
    <>
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border/70 bg-background transition-[width] duration-200',
          navExpanded ? 'w-[200px]' : 'w-14',
        )}
        role="region"
        aria-label="Projects"
      >
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border/40 px-2">
          {navExpanded && <span className="truncate px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projects</span>}
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={toggleNavPane} aria-label={navExpanded ? 'Collapse sidebar' : 'Expand sidebar'}>
            {navExpanded ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        </div>

        {/* Project list */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1.5">
            {iconSets.map((iconSet) => (
              <Tooltip key={iconSet.id} delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleSelectProject(iconSet.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setDeleteTarget(iconSet);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition',
                      activeIconSetId === iconSet.id
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <FolderOpen className="size-3.5 shrink-0" />
                    {navExpanded && (
                      <>
                        <span className="min-w-0 truncate">{iconSet.name}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{iconSet.iconCount}</span>
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                {!navExpanded && (
                  <TooltipContent side="right">{iconSet.name} ({iconSet.iconCount})</TooltipContent>
                )}
              </Tooltip>
            ))}

            {/* New project inline */}
            {inlineNew ? (
              <div className="px-1">
                <Input
                  autoFocus
                  className="h-7 text-xs"
                  placeholder="Project name"
                  value={inlineNewValue}
                  onChange={(e) => setInlineNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateProject(); }
                    if (e.key === 'Escape') setInlineNew(false);
                  }}
                  onBlur={handleCreateProject}
                />
              </div>
            ) : (
              <Tooltip delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setInlineNew(true)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    {navExpanded && <span>New Project</span>}
                  </button>
                </TooltipTrigger>
                {!navExpanded && <TooltipContent side="right">New Project</TooltipContent>}
              </Tooltip>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Delete project dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `Delete "${deleteTarget.name}" with ${deleteTarget.iconCount} icon${deleteTarget.iconCount === 1 ? '' : 's'}?` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteProject}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

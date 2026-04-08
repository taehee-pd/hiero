'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleStartRename = useCallback((iconSet: { id: string; name: string }) => {
    setRenamingId(iconSet.id);
    setRenameValue(iconSet.name);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) renameIconSet(renamingId, trimmed);
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, renameIconSet]);

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
          navExpanded ? 'w-[200px]' : 'w-10',
        )}
        style={{ boxShadow: 'var(--shadow-inset-edge)' }}
        role="region"
        aria-label="Projects"
      >
        {/* Header */}
        <div className={cn('flex h-10 items-center border-b border-border/40', navExpanded ? 'justify-between px-2' : 'justify-center')}>
          {navExpanded && <span className="studio-kicker truncate px-1">Projects</span>}
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-md" onClick={toggleNavPane} aria-label={navExpanded ? 'Collapse sidebar' : 'Expand sidebar'}>
            {navExpanded ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        </div>

        {/* Vertical label when collapsed */}
        {!navExpanded && (
          <button
            type="button"
            onClick={toggleNavPane}
            className="flex flex-1 items-start justify-center pt-3"
          >
            <span className="text-[length:var(--text-caption)] font-medium tracking-tight text-muted-foreground [writing-mode:vertical-lr]">
              Projects
            </span>
          </button>
        )}

        {/* Project list */}
        {navExpanded && <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1.5">
            {iconSets.map((iconSet) => (
              <Tooltip key={iconSet.id} delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'group/item flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all duration-[160ms]',
                      activeIconSetId === iconSet.id
                        ? 'bg-primary-soft text-primary shadow-[inset_0_0_0_0.5px_var(--primary)]'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-[var(--shadow-outline)]',
                    )}
                    style={activeIconSetId === iconSet.id ? { fontWeight: 500 } : undefined}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2"
                      onClick={() => handleSelectProject(iconSet.id)}
                      onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(iconSet); }}
                      onKeyDown={(e) => {
                        if (renamingId) return; // Don't intercept keys while renaming
                        if (e.key === 'F2') { e.preventDefault(); handleStartRename(iconSet); }
                        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setDeleteTarget(iconSet); }
                      }}
                    >
                      <FolderOpen className="size-3.5 shrink-0" />
                      {navExpanded && renamingId === iconSet.id ? (
                        <Input
                          autoFocus
                          className="h-5 min-w-0 flex-1 text-xs"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleCommitRename(); }
                            if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null); }
                          }}
                          onBlur={handleCommitRename}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : navExpanded ? (
                        <>
                          <span className="min-w-0 truncate">{iconSet.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{iconSet.iconCount}</span>
                        </>
                      ) : null}
                    </button>
                    {navExpanded && renamingId !== iconSet.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                            aria-label={`Actions for ${iconSet.name}`}
                          >
                            <MoreHorizontal className="size-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="right">
                          <DropdownMenuItem onSelect={() => handleStartRename(iconSet)}>
                            <Pencil className="size-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleteTarget(iconSet)} className="text-destructive focus:text-destructive">
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
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
                    className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-all duration-[160ms] hover:border-border hover:bg-accent hover:text-foreground hover:shadow-[var(--shadow-outline)]"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    {navExpanded && <span>New Project</span>}
                  </button>
                </TooltipTrigger>
                {!navExpanded && <TooltipContent side="right">New Project</TooltipContent>}
              </Tooltip>
            )}
          </div>
        </ScrollArea>}
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

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
          navExpanded ? 'w-[230px]' : 'w-10',
        )}
        style={{ boxShadow: 'var(--shadow-inset-edge)' }}
        role="region"
        aria-label="Projects"
      >
        {/* Header */}
        <div className={cn('flex h-10 items-center border-b border-border/40', navExpanded ? 'justify-between px-2' : 'justify-center')}>
          {navExpanded && <span className="studio-kicker truncate px-1">Projects</span>}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 shrink-0 rounded-lg"
                onClick={toggleNavPane}
                aria-label={navExpanded ? 'Close projects' : 'Open projects'}
                aria-expanded={navExpanded}
                aria-controls="nav-pane-content"
              >
                {navExpanded ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{navExpanded ? 'Close projects' : 'Open projects'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Vertical label when collapsed */}
        {!navExpanded && (
          <button
            type="button"
            onClick={toggleNavPane}
            className="flex flex-1 items-start justify-center pt-3"
            aria-label="Expand projects sidebar"
          >
            <span className="text-[length:var(--text-caption)] font-medium tracking-tight text-muted-foreground [writing-mode:vertical-lr]">
              Projects
            </span>
          </button>
        )}

        {/* Project list */}
        {navExpanded && <ScrollArea id="nav-pane-content" className="flex-1">
          <div className="flex flex-col gap-0.5 p-1.5">
            {iconSets.map((iconSet) => (
              <Tooltip key={iconSet.id} delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'group/item flex h-7 items-center gap-2 rounded-lg px-2 text-left text-xs transition-all duration-[160ms]',
                      activeIconSetId === iconSet.id
                        ? 'bg-muted/50 text-foreground font-medium'
                        : 'text-foreground/70 hover:bg-accent hover:text-foreground hover:shadow-[var(--shadow-outline)]',
                    )}
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
                          <span className="ml-auto shrink-0 rounded bg-black/[0.06] px-1 text-[10px] text-muted-foreground dark:bg-white/[0.08]">{iconSet.iconCount}</span>
                        </>
                      ) : null}
                    </button>
                    {navExpanded && renamingId !== iconSet.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-5 -ml-2 w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover/item:ml-0 group-hover/item:w-5 group-hover/item:overflow-visible group-hover/item:opacity-100 data-[state=open]:ml-0 data-[state=open]:w-5 data-[state=open]:overflow-visible data-[state=open]:opacity-100 focus-visible:ml-0 focus-visible:w-5 focus-visible:overflow-visible focus-visible:opacity-100"
                            aria-label={`Actions for ${iconSet.name}`}
                          >
                            <MoreHorizontal className="size-3" />
                          </Button>
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
                  <Button
                    variant="ghost"
                    onClick={() => setInlineNew(true)}
                    className="h-auto w-full justify-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs text-foreground/70 transition-all duration-[160ms] hover:border-border hover:text-foreground hover:shadow-[var(--shadow-outline)]"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    {navExpanded && <span>New Project</span>}
                  </Button>
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

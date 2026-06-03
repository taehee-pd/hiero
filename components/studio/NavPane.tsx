'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useMemo, useState } from 'react';

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
import { IconButton } from '@/components/ds/icon-button';
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
  const totalIconCount = useMemo(
    () => iconSets.reduce((sum, iconSet) => sum + iconSet.iconCount, 0),
    [iconSets],
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
          'studio-pane flex shrink-0 flex-col border-r border-border/70 transition-[width] duration-200',
          navExpanded ? 'w-[230px]' : 'w-10',
        )}
	        role="region"
        aria-label="Projects"
      >
        {/* Header */}
        <div className={cn('flex h-10 items-center border-b border-border/40', navExpanded ? 'justify-between px-2' : 'justify-center')}>
          {navExpanded && <span className="studio-kicker truncate px-1">Projects</span>}
          <IconButton
            icon={<UiIcon name={navExpanded ? 'chevron-left' : 'chevron-right'} />}
            aria-label={navExpanded ? 'Close projects' : 'Open projects'}
            tooltip={navExpanded ? 'Close projects' : 'Open projects'}
            tooltipSide="right"
            onClick={toggleNavPane}
            aria-expanded={navExpanded}
            aria-controls="nav-pane-content"
          />
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
            <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
              <span className="studio-kicker">{iconSets.length} project{iconSets.length === 1 ? '' : 's'}</span>
              <span className="ml-auto rounded bg-muted px-1.5 text-[10px] font-medium leading-4 text-muted-foreground tabular-nums">
                {totalIconCount} icon{totalIconCount === 1 ? '' : 's'}
              </span>
            </div>

            {iconSets.length === 0 && (
              <div className="mx-1 mb-1 rounded-md border border-dashed border-border/70 bg-background/70 px-2 py-2 text-[11px] leading-4 text-muted-foreground">
                No projects yet. Create one to start your icon library.
              </div>
            )}

            {iconSets.map((iconSet) => (
              <Tooltip key={iconSet.id} delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
	                  <div
	                    className={cn(
	                      'group/item relative flex h-7 select-none items-center gap-2 rounded-md border border-transparent px-2 text-left text-xs transition-colors duration-[160ms]',
	                      activeIconSetId === iconSet.id
	                        ? 'border-primary/35 bg-primary/10 text-foreground font-medium'
	                        : 'text-foreground/70 hover:border-border/70 hover:bg-accent/70 hover:text-foreground',
	                    )}
	                  >
                    {/*
                      Rename input is rendered as a SIBLING of the row
                      button, not inside it. Previously the <Input> was
                      nested inside a <button>, which is invalid HTML
                      (interactive-in-interactive) and broke focus/blur
                      on some browsers. Now the row button hosts the
                      label; when renaming, the button is replaced by a
                      bare input sharing the row's box via `h-7` to keep
                      the height/padding consistent with the label.
                    */}
                    {navExpanded && renamingId === iconSet.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <UiIcon name="folder-open" size={14} className="size-3.5 shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          className="flex h-7 min-w-0 flex-1 items-center rounded-sm border border-[color:color-mix(in_srgb,var(--primary)_55%,transparent)] bg-background px-1 text-xs text-foreground outline-none focus:border-ring focus:ring-[2px] focus:ring-ring/30"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleCommitRename(); }
                            if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null); }
                          }}
                          onBlur={handleCommitRename}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onClick={() => handleSelectProject(iconSet.id)}
                        onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(iconSet); }}
                        onKeyDown={(e) => {
                          if (e.key === 'F2') { e.preventDefault(); handleStartRename(iconSet); }
                          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setDeleteTarget(iconSet); }
                        }}
                      >
                        <UiIcon name="folder-open" size={14} className="size-3.5 shrink-0" />
                        {navExpanded ? (
                          <>
                            <span className="min-w-0 truncate">{iconSet.name}</span>
                            <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 text-[10px] font-medium leading-4 text-muted-foreground tabular-nums">{iconSet.iconCount}</span>
                          </>
                        ) : null}
                      </button>
                    )}
                    {navExpanded && renamingId !== iconSet.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-5 -ml-2 w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover/item:ml-0 group-hover/item:w-5 group-hover/item:overflow-visible group-hover/item:opacity-100 data-[state=open]:ml-0 data-[state=open]:w-5 data-[state=open]:overflow-visible data-[state=open]:opacity-100 focus-visible:ml-0 focus-visible:w-5 focus-visible:overflow-visible focus-visible:opacity-100"
                            aria-label={`Actions for ${iconSet.name}`}
                          >
                            <UiIcon name="more-horizontal" size={12} className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="right">
                          <DropdownMenuItem onSelect={() => handleStartRename(iconSet)}>
                            <UiIcon name="pencil" size={16} className="size-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleteTarget(iconSet)} className="text-destructive focus:text-destructive">
                            <UiIcon name="trash-2" size={16} className="size-4" /> Delete
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

          </div>
        </ScrollArea>}

        {navExpanded && (
          <div className="border-t border-border/40 p-1.5">
            {inlineNew ? (
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
            ) : (
              <Tooltip delayDuration={navExpanded ? 1000 : 200}>
                <TooltipTrigger asChild>
	                  <Button
	                    variant="ghost"
	                    onClick={() => setInlineNew(true)}
	                    className="h-auto w-full justify-start gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-xs text-foreground/80 transition-colors duration-[160ms] hover:border-border hover:bg-background hover:text-foreground"
	                  >
                    <UiIcon name="plus" size={14} className="size-3.5 shrink-0" />
                    <span>New Project</span>
                  </Button>
                </TooltipTrigger>
                {!navExpanded && <TooltipContent side="right">New Project</TooltipContent>}
              </Tooltip>
            )}
          </div>
        )}
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronRight,
  Ellipsis,
  FolderOpen,
  Grid3X3,
  Import,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { SyncPrPanel } from '@/components/export/SyncPrPanel';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import { exportSvgString } from '@/lib/export/export-svg';
import { clearCurrentProjectPath, isDesktop, showNativeContextMenu } from '@/lib/platform/bridge';
import { buildEditorRoute } from '@/lib/platform/routes';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { createImportedIcon, isSvgFile } from '@/lib/import/import-svg-file';
import { replaceWorkspaceIconSet } from '@/lib/schema/workspace';
import { TitleTabBar } from '@/components/platform/TitleTabBar';
import { cn } from '@/lib/utils';
import type { Collection, Icon, Project } from '@/lib/schema/types';
import { IconGridItem } from './IconGridItem';

export type ExplorerIcon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
};

type ActiveFilter =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'category'; id: string }
  | { kind: 'collection'; id: string };

type ExplorerView = { level: 'workspace' } | { level: 'project'; iconSetId: string };

export function filterIconsByQuery(icons: ExplorerIcon[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return icons;

  return icons.filter((icon) => {
    if (icon.name.toLowerCase().includes(normalized)) return true;
    if (icon.id.toLowerCase().includes(normalized)) return true;
    if (icon.category?.toLowerCase().includes(normalized)) return true;
    if (icon.tags?.some((tag) => tag.toLowerCase().includes(normalized))) return true;
    return false;
  });
}

function categorizeIcons(icons: ExplorerIcon[]) {
  const map = new Map<string, ExplorerIcon[]>();
  for (const icon of icons) {
    const key = icon.category || 'uncategorized';
    map.set(key, [...(map.get(key) ?? []), icon]);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function ExplorerShell() {
  const workspace = useEditorStore((s) => s.workspace);
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const favorites = useEditorStore((s) => s.favorites);
  const {
    addCollection,
    removeCollection,
    renameCollection,
    toggleFavorite,
    addIconSet,
    createBlankIcon,
    removeIconSet,
    renameIconSet,
    setActiveIconSet,
    openIconTab,
  } = useEditorActions();
  const router = useRouter();

  const [view, setView] = useState<ExplorerView>({ level: 'workspace' });
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ kind: 'all' });
  const [desktop, setDesktop] = useState(false);
  const [importMode, setImportMode] = useState<'current-project' | 'new-project'>(
    'current-project',
  );
  const [renameDialog, setRenameDialog] = useState<
    | { kind: 'project'; id: string; value: string }
    | { kind: 'collection'; id: string; value: string }
    | null
  >(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<WorkspaceIconSet | null>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [inlineNewCollection, setInlineNewCollection] = useState(false);
  const [inlineNewCollectionValue, setInlineNewCollectionValue] = useState('');
  const [inlineNewProject, setInlineNewProject] = useState(false);
  const [inlineNewProjectValue, setInlineNewProjectValue] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDesktop(isDesktop());
  }, []);

  useEffect(() => {
    const state = editorStore.getState();
    if (!state.workspace) {
      clearCurrentProjectPath();
      state.loadWorkspace(SAMPLE_WORKSPACE);
    }
  }, []);

  const workspaceName = workspace?.meta.name ?? 'Coniva Workspace';

  const iconSets = useMemo(
    () =>
      Object.entries(workspace?.iconSets ?? {})
        .map(([id, iconSet]) => ({
          id,
          name: iconSet.meta.name,
          iconCount: Object.keys(iconSet.icons).length,
          syncLabel: iconSet.sync ? `${iconSet.sync.owner}/${iconSet.sync.repo}` : null,
          updatedAt: iconSet.meta.updatedAt,
          icons: Object.values(iconSet.icons).slice(0, 6),
          tokenColors: iconSet.tokenSet?.colors,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [workspace?.iconSets],
  );

  const icons = useMemo(
    () =>
      Object.values(project?.icons ?? {}).map((icon) => ({
        id: icon.id,
        name: icon.name,
        category: icon.category,
        tags: icon.tags,
      })),
    [project],
  );

  const filtered = useMemo(() => filterIconsByQuery(icons, query), [icons, query]);
  const groups = useMemo(() => categorizeIcons(filtered), [filtered]);
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const projectName = project?.meta.name ?? 'Untitled Set';
  const collections = useMemo(
    () => Object.values(project?.collections ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [project?.collections],
  );

  const visibleIcons = useMemo(() => {
    if (activeFilter.kind === 'all') return filtered;
    if (activeFilter.kind === 'favorites') {
      return filtered.filter((icon) => favoritesSet.has(icon.id));
    }
    if (activeFilter.kind === 'category') {
      return filtered.filter((icon) => (icon.category || 'uncategorized') === activeFilter.id);
    }
    const collection = project?.collections?.[activeFilter.id];
    if (!collection) return filtered;
    const include = new Set(collection.iconIds);
    return filtered.filter((icon) => include.has(icon.id));
  }, [activeFilter, favoritesSet, filtered, project?.collections]);

  useEffect(() => {
    if (activeFilter.kind === 'collection' && !project?.collections?.[activeFilter.id]) {
      setActiveFilter({ kind: 'all' });
    }
  }, [activeFilter, project?.collections]);

  useEffect(() => {
    setSelection([]);
    setActiveFilter({ kind: 'all' });
  }, [activeIconSetId]);

  const enterProject = useCallback(
    (iconSetId: string) => {
      setActiveIconSet(iconSetId);
      setView({ level: 'project', iconSetId });
      setQuery('');
      setSelection([]);
      setActiveFilter({ kind: 'all' });
    },
    [setActiveIconSet],
  );

  const goBackToWorkspace = useCallback(() => {
    setView({ level: 'workspace' });
    setQuery('');
    setSelection([]);
    setActiveFilter({ kind: 'all' });
  }, []);

  const exportIconsToZip = (iconIds: string[], suffix: string) => {
    if (!project || iconIds.length === 0) return;
    const files: Record<string, string> = {};
    for (const iconId of iconIds) {
      const icon = project.icons[iconId];
      if (!icon) continue;
      const variantId = Object.keys(icon.variants)[0];
      const variant = variantId ? icon.variants[variantId] : undefined;
      const stateId = variant?.defaultState;
      if (!variant || !stateId) continue;
      files[`icons/${toKebab(icon.name || icon.id)}.svg`] = exportSvgString(
        icon,
        variant.id,
        stateId,
        project.tokenSet?.colors,
        variant.renderingMode,
      );
    }
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toKebab(workspaceName)}-${toKebab(project.meta.name)}-${suffix}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const assignCategory = () => {
    const state = editorStore.getState();
    const nextCategory = categoryInput.trim();
    if (!project || !workspace || !activeIconSetId || !nextCategory || selection.length === 0) {
      return;
    }

    const nextProject = structuredClone(project);
    for (const iconId of selection) {
      const icon = nextProject.icons[iconId];
      if (icon) icon.category = nextCategory;
    }

    const nextWorkspace = replaceWorkspaceIconSet(workspace, activeIconSetId, nextProject);
    if (!nextWorkspace) return;
    state.loadWorkspace(nextWorkspace, { resetHistory: false, markDirty: true, keepTabs: true });
    state.setActiveIconSet(activeIconSetId);
    setSelection([]);
    setCategoryInput('');
  };

  const toggleSelection = (iconId: string) => {
    setSelection((prev) =>
      prev.includes(iconId) ? prev.filter((id) => id !== iconId) : [...prev, iconId],
    );
  };

  const handleImportSvgFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    let targetIconSetId = activeIconSetId;
    if (importMode === 'new-project' || !targetIconSetId) {
      const suggestedName =
        files.length === 1
          ? buildProjectNameFromFile(files[0]?.name ?? 'Imported Icons')
          : 'Imported Icons';
      targetIconSetId = addIconSet(suggestedName) ?? editorStore.getState().activeIconSetId;
      if (targetIconSetId) {
        setActiveIconSet(targetIconSetId);
        setView({ level: 'project', iconSetId: targetIconSetId });
        setQuery('');
        setSelection([]);
        setActiveFilter({ kind: 'all' });
      }
    }

    const state = editorStore.getState();
    const existingIds = new Set(
      Object.keys(
        state.workspace?.iconSets[targetIconSetId ?? '']?.icons ?? state.project?.icons ?? {},
      ),
    );

    for (const file of files) {
      if (!isSvgFile(file)) continue;
      try {
        const icon = createImportedIcon(await file.text(), {
          existingIconIds: existingIds,
          sourceName: file.name,
        });

        existingIds.add(icon.id);
        editorStore.getState().insertIcon(icon);
        toast({ title: `Imported ${icon.name}`, description: icon.id });
      } catch (error) {
        toast({
          title: `Failed to import ${file.name}`,
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        });
      }
    }

    setImportMode('current-project');
    event.target.value = '';
  };

  const handleExportSelected = () => exportIconsToZip(selection, 'selected-icons');
  const handleExportIconSet = () => exportIconsToZip(Object.keys(project?.icons ?? {}), 'icon-set');

  const createCollection = () => {
    setInlineNewCollection(true);
    setInlineNewCollectionValue('');
  };

  const confirmCreateCollection = () => {
    const name = inlineNewCollectionValue.trim();
    if (!name) {
      setInlineNewCollection(false);
      return;
    }
    const id = toKebab(name);
    addCollection({ id, name, iconIds: [] });
    setInlineNewCollection(false);
    setInlineNewCollectionValue('');
  };

  const createIconSet = () => {
    setInlineNewProject(true);
    setInlineNewProjectValue('');
  };

  const confirmCreateIconSet = () => {
    const name = inlineNewProjectValue.trim();
    if (!name) {
      setInlineNewProject(false);
      return;
    }
    addIconSet(name);
    setInlineNewProject(false);
    setInlineNewProjectValue('');
  };

  const openImportIntoCurrentProject = useCallback(() => {
    setImportMode('current-project');
    importRef.current?.click();
  }, []);

  const openImportIntoNewProject = useCallback(() => {
    setImportMode('new-project');
    importRef.current?.click();
  }, []);

  const handleCreateBlankIcon = useCallback(() => {
    if (!activeIconSetId) return;
    const iconId = createBlankIcon();
    if (!iconId) return;
    openIconTab(activeIconSetId, iconId);
    router.push(buildEditorRoute(iconId, activeIconSetId));
  }, [activeIconSetId, createBlankIcon, openIconTab, router]);

  const handleRenameSubmit = useCallback(() => {
    if (!renameDialog) return;
    const nextValue = renameDialog.value.trim();
    if (!nextValue) return;

    if (renameDialog.kind === 'project') {
      renameIconSet(renameDialog.id, nextValue);
    } else {
      renameCollection(renameDialog.id, nextValue);
    }
    setRenameDialog(null);
  }, [renameCollection, renameDialog, renameIconSet]);

  const handleDeleteProject = useCallback(() => {
    if (!deleteProjectTarget) return;
    removeIconSet(deleteProjectTarget.id);
    if (activeIconSetId === deleteProjectTarget.id) {
      setView({ level: 'workspace' });
    }
    setDeleteProjectTarget(null);
    setDeleteConfirmValue('');
  }, [activeIconSetId, deleteProjectTarget, removeIconSet]);

  const filteredIconSets = useMemo(() => {
    if (!query.trim()) return iconSets;
    const q = query.trim().toLowerCase();
    return iconSets.filter(
      (iconSet) =>
        iconSet.name.toLowerCase().includes(q) || iconSet.syncLabel?.toLowerCase().includes(q),
    );
  }, [iconSets, query]);

  return (
    <div
      className="swift-surface flex h-full flex-col overflow-hidden text-foreground"
      style={{ position: 'fixed', inset: 0 }}
    >
      {desktop && <TitleTabBar onNavigateExplorer={goBackToWorkspace} />}
      <header
        className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--border-separator)] px-4"
        style={{ fontFamily: 'var(--font-system)' }}
      >
        <nav className="flex min-w-0 items-center gap-1 text-[length:var(--text-heading)]">
          <button
            type="button"
            onClick={goBackToWorkspace}
            className={cn(
              'truncate rounded-md px-1.5 py-0.5 font-medium transition',
              view.level === 'workspace'
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {workspaceName}
          </button>
          {view.level === 'project' && (
            <>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              <span className="truncate font-medium text-foreground">{projectName}</span>
            </>
          )}
        </nav>

        <div className="flex-1" />

        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view.level === 'workspace' ? 'Search projects…' : 'Search icons…'}
            className="h-7 rounded-lg border-border/70 bg-background/60 pl-8 text-xs shadow-none"
          />
        </div>

        {view.level === 'workspace' && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={openImportIntoNewProject}
            >
              <Import className="size-3.5" />
              Import SVGs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={createIconSet}
            >
              <Plus className="size-3.5" />
              New project
            </Button>
          </div>
        )}
        {view.level === 'project' && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={handleCreateBlankIcon}
            >
              <Plus className="size-3.5" />
              New Icon
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring/60"
              onClick={openImportIntoCurrentProject}
            >
              <Import className="size-3.5" />
              Import
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg px-2.5 text-xs"
              onClick={handleExportIconSet}
              disabled={!project || icons.length === 0}
            >
              Export
            </Button>
            <SyncPrPanel
              iconSetId={activeIconSetId}
              triggerLabel="Create PR"
              triggerVariant="ghost"
              triggerSize="sm"
              className="h-7 rounded-lg px-2.5 text-xs"
            />
            {selection.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-lg px-2.5 text-xs"
                onClick={handleExportSelected}
              >
                Export {selection.length}
              </Button>
            )}
          </div>
        )}
      </header>

      {view.level === 'workspace' ? (
        <WorkspaceView
          iconSets={filteredIconSets}
          onEnterProject={enterProject}
          onImport={openImportIntoNewProject}
          onCreateProject={createIconSet}
          inlineNewProject={inlineNewProject}
          inlineNewProjectValue={inlineNewProjectValue}
          onInlineNewProjectChange={setInlineNewProjectValue}
          onInlineNewProjectConfirm={confirmCreateIconSet}
          onInlineNewProjectCancel={() => setInlineNewProject(false)}
          onRenameProject={(iconSetId) => {
            const iconSet = workspace?.iconSets[iconSetId];
            if (!iconSet) return;
            setRenameDialog({ kind: 'project', id: iconSetId, value: iconSet.meta.name });
          }}
          onDeleteProject={(iconSetId) => {
            const target = iconSets.find((iconSet) => iconSet.id === iconSetId) ?? null;
            setDeleteProjectTarget(target);
            setDeleteConfirmValue('');
          }}
        />
      ) : (
        <ProjectDetailView
          project={project}
          activeIconSetId={activeIconSetId}
          visibleIcons={visibleIcons}
          groups={groups}
          filtered={filtered}
          collections={collections}
          selectionSet={selectionSet}
          favoritesSet={favoritesSet}
          activeFilter={activeFilter}
          selection={selection}
          categoryInput={categoryInput}
          query={query}
          onSetActiveFilter={setActiveFilter}
          onToggleSelection={toggleSelection}
          onToggleFavorite={toggleFavorite}
          onSetCategoryInput={setCategoryInput}
          onAssignCategory={assignCategory}
          onCreateCollection={createCollection}
          inlineNewCollection={inlineNewCollection}
          inlineNewCollectionValue={inlineNewCollectionValue}
          onInlineNewCollectionChange={setInlineNewCollectionValue}
          onInlineNewCollectionConfirm={confirmCreateCollection}
          onInlineNewCollectionCancel={() => setInlineNewCollection(false)}
          onCreateBlankIcon={handleCreateBlankIcon}
          onImportSvg={openImportIntoCurrentProject}
          onRenameCollection={(collectionId) => {
            const collection = collections.find((item) => item.id === collectionId);
            if (!collection) return;
            setRenameDialog({ kind: 'collection', id: collectionId, value: collection.name });
          }}
          onDeleteCollection={(collectionId) => removeCollection(collectionId)}
          onOpenIconTab={openIconTab}
        />
      )}

      <input
        ref={importRef}
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        className="sr-only"
        onChange={handleImportSvgFiles}
        aria-label="Import SVG files"
      />

      <Dialog open={renameDialog !== null} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {renameDialog?.kind === 'project' ? 'Rename project' : 'Rename collection'}
            </DialogTitle>
            <DialogDescription>
              Update the name shown in the workspace and explorer sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameDialog?.value ?? ''}
              onChange={(event) =>
                setRenameDialog((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              placeholder="Enter a name"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleRenameSubmit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={!renameDialog?.value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteProjectTarget !== null}
        onOpenChange={(open) => !open && setDeleteProjectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProjectTarget
                ? `${deleteProjectTarget.name} contains ${deleteProjectTarget.iconCount} icon${deleteProjectTarget.iconCount === 1 ? '' : 's'}${deleteProjectTarget.syncLabel ? ` and is linked to ${deleteProjectTarget.syncLabel}` : ''}.`
                : 'This action removes the project from the workspace.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteProjectTarget && deleteProjectTarget.iconCount > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Type{' '}
                <span className="font-medium text-foreground">{deleteProjectTarget.name}</span> to
                confirm.
              </p>
              <Input
                value={deleteConfirmValue}
                onChange={(event) => setDeleteConfirmValue(event.target.value)}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteProjectTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                deleteProjectTarget?.iconCount
                  ? deleteConfirmValue.trim() !== deleteProjectTarget.name
                  : false
              }
              onClick={handleDeleteProject}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type WorkspaceIconSet = {
  id: string;
  name: string;
  iconCount: number;
  syncLabel: string | null;
  updatedAt: string;
  icons: Icon[];
  tokenColors?: Record<string, string>;
};

function WorkspaceView({
  iconSets,
  onEnterProject,
  onImport,
  onCreateProject,
  inlineNewProject,
  inlineNewProjectValue,
  onInlineNewProjectChange,
  onInlineNewProjectConfirm,
  onInlineNewProjectCancel,
  onRenameProject,
  onDeleteProject,
}: {
  iconSets: WorkspaceIconSet[];
  onEnterProject: (id: string) => void;
  onImport: () => void;
  onCreateProject: () => void;
  inlineNewProject: boolean;
  inlineNewProjectValue: string;
  onInlineNewProjectChange: (v: string) => void;
  onInlineNewProjectConfirm: () => void;
  onInlineNewProjectCancel: () => void;
  onRenameProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}) {
  return (
    <ScrollArea className="workspace-scroll flex-1">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="size-4 text-muted-foreground" />
            <h2 className="text-[length:var(--text-heading)] font-semibold text-foreground">Projects</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[length:var(--text-caption)] font-medium text-muted-foreground">
              {iconSets.length}
            </span>
          </div>
        </div>

        {iconSets.length === 0 ? (
          <div className="workspace-empty-state flex flex-col items-center justify-center rounded-xl px-6 py-20 text-center">
            <FolderOpen className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              Start a fresh project or import SVGs and we&apos;ll create one for you.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" className="rounded-lg" onClick={onImport}>
                <Import className="size-3.5" />
                Import SVGs
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={onCreateProject}>
                <Plus className="size-3.5" />
                Create a new project
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
            aria-label="Projects"
          >
            {iconSets.map((iconSet) => (
              <ProjectCard
                key={iconSet.id}
                iconSet={iconSet}
                onOpen={() => onEnterProject(iconSet.id)}
                onRename={() => onRenameProject(iconSet.id)}
                onDelete={() => onDeleteProject(iconSet.id)}
              />
            ))}
          </div>
        )}

        {inlineNewProject && (
          <div className="mt-4">
            <Input
              autoFocus
              placeholder="Project name"
              value={inlineNewProjectValue}
              onChange={(e) => onInlineNewProjectChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onInlineNewProjectConfirm();
                if (e.key === 'Escape') onInlineNewProjectCancel();
              }}
              onBlur={onInlineNewProjectConfirm}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ProjectCard({
  iconSet,
  onOpen,
  onRename,
  onDelete,
}: {
  iconSet: WorkspaceIconSet;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const thumbnailIcons = iconSet.icons.slice(0, 6);

  return (
    <article
      className="studio-card group relative flex flex-col rounded-xl text-left transition-all duration-150"
      role="listitem"
    >
      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-lg border-border/70 bg-background/90"
              onClick={(event) => event.stopPropagation()}
              aria-label={`Project actions for ${iconSet.name}`}
            >
              <Ellipsis className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onOpen();
              }}
            >
              <ArrowUpRight className="size-4" />
              Open project
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onRename();
              }}
            >
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <div className="studio-preview flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-xl border-b border-border/70">
          {thumbnailIcons.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-4 p-5">
              {thumbnailIcons.map((icon) => {
                const firstVariantId = Object.keys(icon.variants)[0];
                const variant = firstVariantId ? icon.variants[firstVariantId] : undefined;
                const stateId = variant?.defaultState;
                const svg =
                  firstVariantId && stateId
                    ? exportSvgString(icon, firstVariantId, stateId, iconSet.tokenColors)
                    : '';
                return (
                  <div
                    key={icon.id}
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden text-foreground/80 transition-transform duration-100 group-hover:scale-105"
                  >
                    {svg ? (
                      <div
                        className="size-8 [&>svg]:h-full [&>svg]:w-full"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    ) : (
                      <Grid3X3 className="size-5 text-muted-foreground/40" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FolderOpen className="size-6 text-muted-foreground/30" />
              <span className="text-[length:var(--text-caption)] text-muted-foreground/50">Empty</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5 px-3.5 py-3">
          <span className="truncate text-sm font-medium text-foreground">{iconSet.name}</span>
          <span className="flex items-center gap-2 text-[length:var(--text-label)] text-muted-foreground">
            <span>
              {iconSet.iconCount} icon{iconSet.iconCount !== 1 ? 's' : ''}
            </span>
            {iconSet.syncLabel && (
              <>
                <span className="text-border">·</span>
                <span className="truncate">{iconSet.syncLabel}</span>
              </>
            )}
          </span>
          <span className="mt-1 inline-flex items-center gap-1 text-[length:var(--text-label)] font-medium text-muted-foreground transition group-hover:text-foreground">
            Open
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </button>
    </article>
  );
}

function ProjectDetailView({
  project,
  activeIconSetId,
  visibleIcons,
  groups,
  filtered,
  collections,
  selectionSet,
  favoritesSet,
  activeFilter,
  selection,
  categoryInput,
  query,
  onSetActiveFilter,
  onToggleSelection,
  onToggleFavorite,
  onSetCategoryInput,
  onAssignCategory,
  onCreateCollection,
  inlineNewCollection,
  inlineNewCollectionValue,
  onInlineNewCollectionChange,
  onInlineNewCollectionConfirm,
  onInlineNewCollectionCancel,
  onCreateBlankIcon,
  onImportSvg,
  onRenameCollection,
  onDeleteCollection,
  onOpenIconTab,
}: {
  project: Project | null;
  activeIconSetId: string | null;
  visibleIcons: ExplorerIcon[];
  groups: [string, ExplorerIcon[]][];
  filtered: ExplorerIcon[];
  collections: Collection[];
  selectionSet: Set<string>;
  favoritesSet: Set<string>;
  activeFilter: ActiveFilter;
  selection: string[];
  categoryInput: string;
  query: string;
  onSetActiveFilter: (f: ActiveFilter) => void;
  onToggleSelection: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSetCategoryInput: (v: string) => void;
  onAssignCategory: () => void;
  onCreateCollection: () => void;
  inlineNewCollection: boolean;
  inlineNewCollectionValue: string;
  onInlineNewCollectionChange: (v: string) => void;
  onInlineNewCollectionConfirm: () => void;
  onInlineNewCollectionCancel: () => void;
  onCreateBlankIcon: () => void;
  onImportSvg: () => void;
  onRenameCollection: (id: string) => void;
  onDeleteCollection: (id: string) => void;
  onOpenIconTab: (iconSetId: string, iconId: string) => void;
}) {
  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside
        className="hidden min-h-0 overflow-y-auto border-r border-[var(--border-separator)] bg-[var(--bg-sidebar)] backdrop-blur-xl lg:block"
        style={{ fontFamily: 'var(--font-system)' }}
      >
        <div className="space-y-4 px-2.5 py-3">
          <section>
            <h3 className="mb-1 px-1.5 text-[length:var(--text-label)] font-semibold uppercase tracking-wider text-[var(--system-gray)]">
              Filter
            </h3>
            <div className="grid gap-0.5">
              <SidebarButton
                label="All"
                count={filtered.length}
                active={activeFilter.kind === 'all'}
                onClick={() => onSetActiveFilter({ kind: 'all' })}
              />
              <SidebarButton
                label="Favorites"
                count={filtered.filter((icon) => favoritesSet.has(icon.id)).length}
                active={activeFilter.kind === 'favorites'}
                onClick={() => onSetActiveFilter({ kind: 'favorites' })}
              />
            </div>
          </section>

          {groups.length > 0 && (
            <section>
              <h3 className="mb-1 px-1.5 text-[length:var(--text-label)] font-semibold uppercase tracking-wider text-[var(--system-gray)]">
                Categories
              </h3>
              <div className="grid gap-0.5">
                {groups.map(([category, groupIcons]) => (
                  <SidebarButton
                    key={category}
                    label={formatCategoryLabel(category)}
                    count={groupIcons.length}
                    active={activeFilter.kind === 'category' && activeFilter.id === category}
                    onClick={() => onSetActiveFilter({ kind: 'category', id: category })}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-1 flex items-center justify-between px-1.5">
              <h3 className="text-[length:var(--text-label)] font-semibold uppercase tracking-wider text-[var(--system-gray)]">
                Collections
              </h3>
              <button
                type="button"
                onClick={onCreateCollection}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3" />
              </button>
            </div>
            <div className="grid gap-0.5">
              {collections.length === 0 && (
                <p className="px-1 text-[length:var(--text-caption)] text-muted-foreground/60">None</p>
              )}
              {collections.map((collection) => (
                <SidebarButton
                  key={collection.id}
                  label={collection.name}
                  count={collection.iconIds.length}
                  active={activeFilter.kind === 'collection' && activeFilter.id === collection.id}
                  onClick={() => onSetActiveFilter({ kind: 'collection', id: collection.id })}
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Collection actions for ${collection.name}`}
                        >
                          <Ellipsis className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onRenameCollection(collection.id)}>
                          <Pencil className="size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDeleteCollection(collection.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))}
              {inlineNewCollection && (
                <div className="mt-1 px-1">
                  <Input
                    autoFocus
                    placeholder="Collection name"
                    value={inlineNewCollectionValue}
                    onChange={(e) => onInlineNewCollectionChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onInlineNewCollectionConfirm();
                      if (e.key === 'Escape') onInlineNewCollectionCancel();
                    }}
                    onBlur={onInlineNewCollectionConfirm}
                    className="h-7 text-xs"
                  />
                </div>
              )}
            </div>
          </section>

          {selection.length > 0 && (
            <section className="space-y-1.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
              <p className="text-[length:var(--text-caption)] font-semibold uppercase tracking-wider text-muted-foreground">
                Assign category
              </p>
              <Input
                value={categoryInput}
                onChange={(event) => onSetCategoryInput(event.target.value)}
                placeholder="e.g. social"
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full rounded-lg text-xs"
                onClick={onAssignCategory}
                disabled={!categoryInput.trim()}
              >
                Assign to {selection.length}
              </Button>
            </section>
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-hidden">
        <div className="flex h-9 items-center justify-between border-b border-border/70 px-4">
          <span className="text-xs text-muted-foreground">
            {visibleIcons.length} icon{visibleIcons.length !== 1 ? 's' : ''}
            {selection.length > 0 && (
              <span className="ml-2 text-foreground">{selection.length} selected</span>
            )}
          </span>
          {project?.sync && (
            <span className="text-[length:var(--text-caption)] text-muted-foreground/70">
              {project.sync.owner}/{project.sync.repo}
            </span>
          )}
        </div>

        <ScrollArea className="workspace-scroll h-full">
          <div
            className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
            role="list"
            aria-label="Icons"
          >
            {visibleIcons.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <Grid3X3 className="mb-2 size-6 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">
                  {query ? 'No matching icons' : 'No icons in this project'}
                </p>
                {!query ? (
                  <>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Import existing SVGs or start a blank icon and draw directly in the editor.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Button size="sm" className="rounded-lg" onClick={onImportSvg}>
                        <Import className="size-3.5" />
                        Import SVGs
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={onCreateBlankIcon}
                      >
                        <Plus className="size-3.5" />
                        New icon
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
            {visibleIcons.map((icon) => {
              const iconDef = project?.icons[icon.id];
              const firstVariantId = iconDef ? Object.keys(iconDef.variants)[0] : null;
              const svg =
                iconDef && firstVariantId
                  ? exportSvgString(
                      iconDef,
                      firstVariantId,
                      iconDef.variants[firstVariantId]?.defaultState,
                      project?.tokenSet?.colors,
                    )
                  : '';
              const active = selectionSet.has(icon.id);
              const favorite = favoritesSet.has(icon.id);

              return (
                <IconGridItem
                  key={icon.id}
                  iconId={icon.id}
                  iconName={icon.name}
                  activeIconSetId={activeIconSetId}
                  svg={svg}
                  active={active}
                  favorite={favorite}
                  onOpen={() => {
                    editorStore.getState().setCurrentIcon(icon.id);
                    if (activeIconSetId) {
                      onOpenIconTab(activeIconSetId, icon.id);
                    }
                  }}
                  onToggleFavorite={() => onToggleFavorite(icon.id)}
                  onToggleSelection={() => onToggleSelection(icon.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    void showNativeContextMenu('explorerIcon', {
                      iconId: icon.id,
                      favorite,
                    });
                  }}
                />
              );
            })}
          </div>
        </ScrollArea>
      </section>
    </main>
  );
}

function SidebarButton({
  label,
  count,
  active,
  onClick,
  actions,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1 text-[length:var(--text-heading)] transition-colors',
        active
          ? 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]'
          : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-foreground',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="truncate">{label}</span>
      </button>
      <span className="ml-auto flex items-center gap-2">
        <span className="shrink-0 tabular-nums text-[length:var(--text-caption)] text-muted-foreground">{count}</span>
        {actions}
      </span>
    </div>
  );
}

function formatCategoryLabel(value: string) {
  if (value === 'all') return 'All';
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildProjectNameFromFile(fileName: string) {
  const baseName = fileName.replace(/\.svg$/i, '').trim();
  if (!baseName) return 'Imported Icons';
  return formatCategoryLabel(baseName);
}

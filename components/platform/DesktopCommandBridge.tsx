'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import { exportSvgString } from '@/lib/export/export-svg';
import { importSvgContentIntoEditor } from '@/lib/import';
import {
  clearCurrentProjectPath,
  compileExportBundle,
  confirmUnsavedChanges,
  consumePendingQuitReason,
  consumePendingStartupProject,
  consumePendingUpdateInfo,
  exportReactLibrary,
  exportSvg,
  exportSvgPackage,
  getCurrentProjectPath,
  getDesktopSettings,
  importSvgFiles,
  installUpdate,
  isDesktop,
  openExternal,
  openProject,
  resolveQuitDecision,
  saveProject,
  saveProjectAs,
  setWindowTitle,
  subscribeToMenuActions,
  type DesktopCommand,
} from '@/lib/platform/bridge';
import { isProject, isWorkspace } from '@/lib/schema/guards';
import type { Layer, Project } from '@/lib/schema/types';
import { buildEditorRoute } from '@/lib/platform/routes';
import { replaceWorkspaceIconSet } from '@/lib/schema/workspace';

const DOCUMENTATION_URL = 'https://github.com/taehee-pd/icon-authoring-tool#readme';

export function DesktopCommandBridge() {
  const router = useRouter();
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string } | null>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;

    const unsubscribeMenu = subscribeToMenuActions((command) => {
      void handleDesktopCommand(command, router);
    });

    const handleStartupProject = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string; data?: string }>).detail;
      if (!detail?.data) return;

      if (!loadProjectFromJson(detail.data)) {
        clearCurrentProjectPath();
        return;
      }

      router.push(getEditorRoute());
    };

    const handleConfirmQuitEvent = () => {
      void handleQuitConfirmation();
    };

    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ version?: string; releaseNotes?: string }>).detail;
      if (!detail?.version) return;
      setUpdateInfo({
        version: detail.version,
        releaseNotes: detail.releaseNotes ?? '',
      });
    };

    window.addEventListener('coniva:project-opened-from-disk', handleStartupProject);
    window.addEventListener('coniva:confirm-quit', handleConfirmQuitEvent);
    window.addEventListener('coniva:update-available', handleUpdateAvailable);
    const initialStartupProject = consumePendingStartupProject();
    if (initialStartupProject) {
      handleStartupProject(
        new CustomEvent('coniva:project-opened-from-disk', { detail: initialStartupProject }),
      );
    }
    if (consumePendingQuitReason()) {
      handleConfirmQuitEvent();
    }
    const initialUpdateInfo = consumePendingUpdateInfo();
    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
    }

    let cancelled = false;
    let autoSaveEnabled = false;
    let lastTitleKey = '';

    const syncTitle = () => {
      const { project, isDirty } = editorStore.getState();
      const projectName = project?.meta.name ?? 'Coniva';
      const nextKey = `${projectName}::${isDirty}`;
      if (nextKey === lastTitleKey) return;

      lastTitleKey = nextKey;
      void setWindowTitle(projectName, isDirty);
    };

    const unsubscribeStore = editorStore.subscribe(syncTitle);
    syncTitle();

    void getDesktopSettings().then((settings) => {
      if (!cancelled) {
        autoSaveEnabled = settings.autoSaveEnabled;
      }
    });

    const autoSaveInterval = window.setInterval(() => {
      if (!autoSaveEnabled) return;
      void autoSaveIfNeeded();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribeMenu();
      unsubscribeStore();
      window.removeEventListener('coniva:project-opened-from-disk', handleStartupProject);
      window.removeEventListener('coniva:confirm-quit', handleConfirmQuitEvent);
      window.removeEventListener('coniva:update-available', handleUpdateAvailable);
      window.clearInterval(autoSaveInterval);
    };
  }, [router]);

  const handleInstallUpdate = async () => {
    setIsInstallingUpdate(true);
    const installed = await installUpdate();
    if (!installed) {
      setIsInstallingUpdate(false);
      window.alert('The update is not ready to install yet.');
    }
  };

  return updateInfo ? (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-border/70 bg-background/95 px-4 py-3 shadow-[0_18px_55px_rgba(17,13,9,0.18)] backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Update available: v{updateInfo.version}. Restart to update.
          </p>
          {updateInfo.releaseNotes ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{updateInfo.releaseNotes}</p>
          ) : null}
        </div>
        <Button size="sm" className="rounded-full" onClick={() => void handleInstallUpdate()} disabled={isInstallingUpdate}>
          {isInstallingUpdate ? 'Restarting…' : 'Restart'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setUpdateInfo(null)}
          disabled={isInstallingUpdate}
        >
          Later
        </Button>
      </div>
    </div>
  ) : null;
}

async function handleDesktopCommand(
  command: DesktopCommand,
  router: ReturnType<typeof useRouter>,
) {
  switch (command.action) {
    case 'file.new':
      clearCurrentProjectPath();
      editorStore.getState().newProject();
      router.push('/editor');
      return;
    case 'file.open': {
      const result = await openProject();
      if (!result) return;
      if (!loadProjectFromJson(result.data)) {
        clearCurrentProjectPath();
        return;
      }
      router.push(getEditorRoute());
      return;
    }
    case 'file.save': {
      await saveCurrentProject();
      return;
    }
    case 'file.saveAs': {
      await saveCurrentProject({ saveAs: true });
      return;
    }
    case 'file.importSvg': {
      const result = await importSvgFiles();
      if (!result) return;

      let lastImportedIconId: string | null = null;
      for (const file of result.files) {
        lastImportedIconId = await importSvgContentIntoEditor(file.content, file.name);
      }

      if (lastImportedIconId) {
        const activeIconSetId = editorStore.getState().activeIconSetId;
        if (activeIconSetId) {
          editorStore.getState().openIconTab(activeIconSetId, lastImportedIconId);
        }
        router.push(buildEditorRoute(lastImportedIconId, activeIconSetId));
      }
      return;
    }
    case 'file.exportSvg':
      await exportCurrentIconSvg();
      return;
    case 'file.exportReactLibrary': {
      const files = await buildCompiledFileMap(true);
      if (!files) return;
      await exportReactLibrary(files);
      return;
    }
    case 'file.exportSvgPackage': {
      const files = await buildCompiledFileMap(false);
      if (!files) return;
      await exportSvgPackage(files);
      return;
    }
    case 'edit.undo':
      undo();
      return;
    case 'edit.redo':
      redo();
      return;
    case 'edit.cut':
      document.execCommand('cut');
      return;
    case 'edit.copy':
      document.execCommand('copy');
      return;
    case 'edit.paste':
    case 'context.canvas.paste':
      document.execCommand('paste');
      return;
    case 'edit.selectAll':
      document.execCommand('selectAll');
      return;
    case 'view.zoomIn':
    case 'context.canvas.zoomIn': {
      const { viewport, setViewport } = editorStore.getState();
      setViewport({ zoom: Math.min(viewport.zoom * 1.25, 32) });
      return;
    }
    case 'view.zoomOut':
    case 'context.canvas.zoomOut': {
      const { viewport, setViewport } = editorStore.getState();
      setViewport({ zoom: Math.max(viewport.zoom / 1.25, 0.1) });
      return;
    }
    case 'view.fitCanvas':
    case 'context.canvas.fitCanvas':
      window.dispatchEvent(new CustomEvent('editor:fit-canvas'));
      return;
    case 'view.toggleGrid':
      editorStore.getState().toggleSnap();
      return;
    case 'view.toggleGuides':
      editorStore.getState().toggleGuidesVisible();
      return;
    case 'view.reload':
      window.location.reload();
      return;
    case 'tool.select':
      editorStore.getState().setTool('select');
      return;
    case 'tool.directSelect':
      editorStore.getState().setTool('direct-select');
      return;
    case 'tool.pen':
      editorStore.getState().setTool('pen');
      return;
    case 'window.explorer':
      router.push('/');
      return;
    case 'window.editor':
      router.push(getEditorRoute());
      return;
    case 'help.documentation':
      await openExternal(DOCUMENTATION_URL);
      return;
    case 'help.about':
      window.alert('Coniva\nIcon design studio for stateful, animated SVG icons.');
      return;
    case 'context.layer.rename':
      renameLayer(command.payload);
      return;
    case 'context.layer.duplicate':
      duplicateLayer(command.payload);
      return;
    case 'context.layer.delete':
      deleteLayer(command.payload);
      return;
    case 'context.layer.moveUp':
      moveLayer(command.payload, -1);
      return;
    case 'context.layer.moveDown':
      moveLayer(command.payload, 1);
      return;
    case 'context.explorer.openEditor': {
      const iconId = getStringPayload(command.payload, 'iconId');
      if (!iconId) return;
      editorStore.getState().setCurrentIcon(iconId);
      const activeIconSetId = editorStore.getState().activeIconSetId;
      if (activeIconSetId) {
        editorStore.getState().openIconTab(activeIconSetId, iconId);
      }
      router.push(buildEditorRoute(iconId, activeIconSetId));
      return;
    }
    case 'context.explorer.addCollection':
      addIconToCollection(command.payload);
      return;
    case 'context.explorer.favorite':
      toggleFavoriteIcon(command.payload);
      return;
    case 'context.explorer.exportSvg':
      await exportExplorerIconSvg(command.payload);
      return;
    case 'context.explorer.delete':
      deleteExplorerIcon(command.payload, router);
      return;
    default:
      return;
  }
}

function serializeCurrentProject() {
  const workspace = editorStore.getState().workspace;
  if (!workspace) return null;

  const updatedAt = new Date().toISOString();
  const updated = {
    ...workspace,
    meta: {
      ...workspace.meta,
      updatedAt,
    },
  };
  return {
    data: JSON.stringify(updated, null, 2),
    updatedAt,
  };
}

function loadProjectFromJson(data: string) {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (isWorkspace(parsed)) {
      editorStore.getState().loadWorkspace(parsed);
      return true;
    }
    if (!isProject(parsed)) {
      throw new Error('Invalid project');
    }
    editorStore.getState().loadProject(parsed);
    return true;
  } catch {
    window.alert('Failed to open project.');
    return false;
  }
}

async function saveCurrentProject(options?: { saveAs?: boolean }) {
  const payload = serializeCurrentProject();
  if (!payload) return null;

  const result = options?.saveAs ? await saveProjectAs(payload.data) : await saveProject(payload.data);
  if (result?.path) {
    editorStore.getState().markSaved(payload.updatedAt);
  }
  return result;
}

async function autoSaveIfNeeded() {
  const state = editorStore.getState();
  if (!state.project || !state.isDirty || !getCurrentProjectPath()) return;

  await saveCurrentProject();
}

async function handleQuitConfirmation() {
  consumePendingQuitReason();
  const state = editorStore.getState();
  if (!state.isDirty) {
    await resolveQuitDecision('quit');
    return;
  }

  const choice = await confirmUnsavedChanges();
  if (choice === 'cancel') {
    await resolveQuitDecision('cancel');
    return;
  }

  if (choice === 'discard') {
    await resolveQuitDecision('discard');
    return;
  }

  const result = await saveCurrentProject();
  await resolveQuitDecision(result?.path ? 'quit' : 'cancel');
}

function getEditorRoute(iconId?: string | null) {
  const state = editorStore.getState();
  if (iconId) return buildEditorRoute(iconId, state.activeIconSetId);
  const currentIconId = state.currentIconId ?? Object.keys(state.project?.icons ?? {})[0];
  return buildEditorRoute(currentIconId ?? null, state.activeIconSetId);
}

async function exportCurrentIconSvg() {
  const state = editorStore.getState();
  const current = getCurrentIconContext();
  if (!current) return;

  const svg = exportSvgString(
    current.icon,
    current.variant.id,
    current.stateId,
    state.project?.tokenSet?.colors,
  );
  await exportSvg(svg, `${slugify(current.icon.name)}.svg`);
}

async function exportExplorerIconSvg(payload?: Record<string, unknown>) {
  const iconId = getStringPayload(payload, 'iconId');
  if (!iconId) return;

  const project = editorStore.getState().project;
  const icon = project?.icons[iconId];
  if (!project || !icon) return;

  const variantId = Object.keys(icon.variants)[0];
  const variant = variantId ? icon.variants[variantId] : null;
  const stateId = variant ? Object.keys(variant.states)[0] : null;
  if (!variant || !stateId) return;

  const svg = exportSvgString(icon, variant.id, stateId, project.tokenSet?.colors);
  await exportSvg(svg, `${slugify(icon.name)}.svg`);
}

async function buildCompiledFileMap(generateReact: boolean) {
  const project = editorStore.getState().project;
  if (!project) return null;

  return await compileExportBundle(JSON.stringify(project), generateReact);
}

function getCurrentIconContext() {
  const state = editorStore.getState();
  const project = state.project;
  if (!project || !state.currentIconId || !state.currentVariantId || !state.currentStateId) {
    return null;
  }

  const icon = project.icons[state.currentIconId];
  const variant = icon?.variants[state.currentVariantId];
  const currentState = variant?.states[state.currentStateId];
  if (!icon || !variant || !currentState) return null;

  return { icon, variant, stateId: currentState.id };
}

function renameLayer(payload?: Record<string, unknown>) {
  const layerId = getStringPayload(payload, 'layerId');
  if (!layerId) return;

  const nextId = window.prompt('Rename layer', layerId)?.trim();
  if (!nextId || nextId === layerId) return;

  mutateCurrentStateLayers((layers) => {
    if (!layers[layerId] || layers[nextId]) return layers;

    const nextLayers: Record<string, Layer> = {};
    for (const [key, layer] of Object.entries(layers)) {
      if (key === layerId) {
        nextLayers[nextId] = { ...layer, id: nextId };
      } else {
        nextLayers[key] = patchLayerReferences(layer, layerId, nextId);
      }
    }
    return nextLayers;
  }, nextId);
}

function duplicateLayer(payload?: Record<string, unknown>) {
  const layerId = getStringPayload(payload, 'layerId');
  if (!layerId) return;

  mutateCurrentStateLayers((layers) => {
    const sourceLayer = layers[layerId];
    if (!sourceLayer) return layers;

    const nextId = ensureUniqueLayerId(`${layerId}-copy`, layers);
    const nextLayers: Record<string, Layer> = {};
    for (const [key, layer] of Object.entries(layers)) {
      nextLayers[key] = layer;
      if (key === layerId) {
        nextLayers[nextId] = {
          ...structuredClone(sourceLayer),
          id: nextId,
        };
      }
    }
    return nextLayers;
  });
}

function deleteLayer(payload?: Record<string, unknown>) {
  const layerId = getStringPayload(payload, 'layerId');
  if (!layerId) return;

  mutateCurrentStateLayers((layers) => {
    if (!layers[layerId]) return layers;

    return Object.fromEntries(
      Object.entries(layers)
        .filter(([key]) => key !== layerId)
        .map(([key, layer]) => [key, stripDeletedLayerReferences(layer, layerId)] as const),
    );
  });
}

function moveLayer(payload: Record<string, unknown> | undefined, delta: -1 | 1) {
  const layerId = getStringPayload(payload, 'layerId');
  if (!layerId) return;

  mutateCurrentStateLayers((layers) => {
    const entries = Object.entries(layers);
    const index = entries.findIndex(([key]) => key === layerId);
    if (index === -1) return layers;

    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= entries.length) return layers;

    const reordered = [...entries];
    const [entry] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, entry);
    return Object.fromEntries(reordered);
  });
}

function addIconToCollection(payload?: Record<string, unknown>) {
  const iconId = getStringPayload(payload, 'iconId');
  if (!iconId) return;

  const collectionName = window.prompt('Collection name');
  if (!collectionName) return;

  mutateProject((project) => {
    const icon = project.icons[iconId];
    if (!icon) return;

    const tag = `collection:${slugify(collectionName)}`;
    const tags = new Set(icon.tags ?? []);
    tags.add(tag);
    icon.tags = [...tags].sort((left, right) => left.localeCompare(right));
  });
}

function toggleFavoriteIcon(payload?: Record<string, unknown>) {
  const iconId = getStringPayload(payload, 'iconId');
  if (!iconId) return;

  mutateProject((project) => {
    const icon = project.icons[iconId];
    if (!icon) return;

    const tags = new Set(icon.tags ?? []);
    if (tags.has('favorite')) {
      tags.delete('favorite');
    } else {
      tags.add('favorite');
    }
    icon.tags = [...tags].sort((left, right) => left.localeCompare(right));
  });
}

function deleteExplorerIcon(
  payload: Record<string, unknown> | undefined,
  router: ReturnType<typeof useRouter>,
) {
  const iconId = getStringPayload(payload, 'iconId');
  if (!iconId || !window.confirm(`Delete ${iconId}?`)) return;

  mutateProject((project) => {
    delete project.icons[iconId];
  });

  const nextIconId = editorStore.getState().currentIconId;
  router.push(nextIconId ? buildEditorRoute(nextIconId, editorStore.getState().activeIconSetId) : '/');
}

function mutateProject(mutator: (project: Project) => void, nextIconId?: string | null) {
  const state = editorStore.getState();
  const project = state.project;
  if (!project || !state.workspace || !state.activeIconSetId) return;

  const nextProject = structuredClone(project);
  mutator(nextProject);
  const nextWorkspace = replaceWorkspaceIconSet(state.workspace, state.activeIconSetId, nextProject);
  if (!nextWorkspace) return;
  state.loadWorkspace(nextWorkspace, { resetHistory: false, markDirty: true, keepTabs: true });
  editorStore.getState().setActiveIconSet(state.activeIconSetId);

  const preferredIconId =
    nextIconId ??
    (state.currentIconId && nextProject.icons[state.currentIconId] ? state.currentIconId : null) ??
    Object.keys(nextProject.icons)[0] ??
    null;

  if (preferredIconId) {
    editorStore.getState().setCurrentIcon(preferredIconId);
  }
}

function mutateCurrentStateLayers(
  mutate: (layers: Record<string, Layer>) => Record<string, Layer>,
  nextSelectedLayerId?: string,
) {
  const state = editorStore.getState();
  const project = state.project;
  if (
    !project ||
    !state.workspace ||
    !state.activeIconSetId ||
    !state.currentIconId ||
    !state.currentVariantId ||
    !state.currentStateId
  ) {
    return;
  }

  const nextProject = structuredClone(project);
  const currentState =
    nextProject.icons[state.currentIconId]?.variants[state.currentVariantId]?.states[state.currentStateId];
  if (!currentState) return;

  currentState.layers = mutate(currentState.layers);
  const nextWorkspace = replaceWorkspaceIconSet(state.workspace, state.activeIconSetId, nextProject);
  if (!nextWorkspace) return;
  state.loadWorkspace(nextWorkspace, { resetHistory: false, markDirty: true, keepTabs: true });
  editorStore.getState().setActiveIconSet(state.activeIconSetId);

  const nextState = editorStore.getState();
  nextState.setCurrentIcon(state.currentIconId);
  nextState.setCurrentVariant(state.currentVariantId);
  nextState.setCurrentState(state.currentStateId);
  if (nextSelectedLayerId) {
    nextState.setSelection({ layerIds: [nextSelectedLayerId], pointIds: [] });
  }
}

function patchLayerReferences(layer: Layer, previousId: string, nextId: string): Layer {
  return {
    ...layer,
    clipPathLayerId: layer.clipPathLayerId === previousId ? nextId : layer.clipPathLayerId,
  };
}

function stripDeletedLayerReferences(layer: Layer, deletedId: string): Layer {
  return {
    ...layer,
    clipPathLayerId: layer.clipPathLayerId === deletedId ? undefined : layer.clipPathLayerId,
  };
}

function ensureUniqueLayerId(candidate: string, layers: Record<string, Layer>) {
  if (!layers[candidate]) return candidate;

  let index = 2;
  let nextId = `${candidate}-${index}`;
  while (layers[nextId]) {
    index += 1;
    nextId = `${candidate}-${index}`;
  }
  return nextId;
}

function getStringPayload(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' ? value : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

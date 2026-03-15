'use client';

export type ProjectOpenResult = { path: string; data: string } | null;
export type ProjectSaveResult = { path: string } | null;
export type SvgImportResult =
  | { files: Array<{ name: string; content: string }> }
  | null;
export type RecentProject = { path: string; name: string; updatedAt: string };
export type DesktopSettings = { autoSaveEnabled: boolean };
export type DesktopUpdateInfo = { version: string; releaseNotes: string };
export type DesktopContextMenuKind = 'layerPanel' | 'canvas' | 'explorerIcon';
export type DesktopAction =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.saveAs'
  | 'file.importSvg'
  | 'file.exportSvg'
  | 'file.exportReactLibrary'
  | 'file.exportSvgPackage'
  | 'file.quit'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.selectAll'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.fitCanvas'
  | 'view.toggleGrid'
  | 'view.toggleGuides'
  | 'tool.select'
  | 'tool.directSelect'
  | 'tool.pen'
  | 'window.minimize'
  | 'window.maximize'
  | 'window.explorer'
  | 'window.editor'
  | 'help.documentation'
  | 'help.about'
  | 'context.layer.rename'
  | 'context.layer.duplicate'
  | 'context.layer.delete'
  | 'context.layer.moveUp'
  | 'context.layer.moveDown'
  | 'context.canvas.paste'
  | 'context.canvas.zoomIn'
  | 'context.canvas.zoomOut'
  | 'context.canvas.fitCanvas'
  | 'context.explorer.openEditor'
  | 'context.explorer.addCollection'
  | 'context.explorer.favorite'
  | 'context.explorer.exportSvg'
  | 'context.explorer.delete';

export type DesktopCommand = {
  action: DesktopAction | string;
  payload?: Record<string, unknown>;
};

type ElectrobunPacket =
  | { type: 'request'; id: number; method: string; params: unknown }
  | { type: 'response'; id: number; success: true; payload: unknown }
  | { type: 'response'; id: number; success: false; error?: string }
  | { type: 'message'; id: string; payload: unknown };

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type ElectrobunHostBridge = {
  receiveMessageFromBun: (msg: unknown) => void;
  receiveInternalMessageFromBun: (msg: unknown) => void;
};

type MessageHandler = {
  postMessage: (message: string) => void;
};

declare global {
  interface Window {
    electrobun?: ElectrobunHostBridge;
    __electrobun?: ElectrobunHostBridge;
    __electrobunBunBridge?: MessageHandler;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

let nextRequestId = 0;
let currentProjectPath: string | undefined;
let electrobunInitialized = false;
let pendingStartupProject: { path: string; data: string } | null = null;
let pendingQuitReason: 'quit' | 'windowClose' | null = null;
let pendingUpdateInfo: DesktopUpdateInfo | null = null;
const pendingRequests = new Map<number, PendingRequest>();
const menuListeners = new Set<(command: DesktopCommand) => void>();

export function isDesktop() {
  return ensureElectrobunClient();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function parseProjectName(data: string) {
  try {
    const parsed = JSON.parse(data) as { meta?: { name?: string } };
    return parsed.meta?.name?.trim() || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

function defaultProjectFileName(data: string) {
  return `${slugify(parseProjectName(data))}.icophone.json`;
}

function isElectrobunEnvironment() {
  if (typeof window === 'undefined') return false;

  if (!window.electrobun && window.__electrobun) {
    window.electrobun = window.__electrobun;
  }

  return Boolean(window.electrobun && window.__electrobunBunBridge);
}

function emitMenuAction(command: DesktopCommand) {
  for (const listener of menuListeners) {
    listener(command);
  }

  window.dispatchEvent(new CustomEvent('icophone:desktop-command', { detail: command }));
  window.dispatchEvent(new CustomEvent('icophone:menu', { detail: command }));
}

function emitProjectSaved(path: string) {
  currentProjectPath = path;
  window.dispatchEvent(new CustomEvent('icophone:project-saved', { detail: { path } }));
}

function handleIncomingPacket(packet: ElectrobunPacket) {
  if (packet.type === 'response') {
    const pending = pendingRequests.get(packet.id);
    if (!pending) return;

    pendingRequests.delete(packet.id);
    clearTimeout(pending.timeout);

    if (packet.success) {
      pending.resolve(packet.payload);
    } else {
      pending.reject(new Error(packet.error ?? 'Electrobun request failed.'));
    }
    return;
  }

  if (packet.type !== 'message') return;

  if (packet.id === 'menuTriggered') {
    const payload = packet.payload as DesktopCommand;
    if (payload.action) {
      emitMenuAction(payload);
    }
    return;
  }

  if (packet.id === 'projectSaved') {
    const payload = packet.payload as { path?: string };
    if (payload.path) {
      emitProjectSaved(payload.path);
    }
    return;
  }

  if (packet.id === 'projectOpenedFromDisk') {
    const payload = packet.payload as { path?: string; data?: string };
    if (payload.path && payload.data) {
      currentProjectPath = payload.path;
      pendingStartupProject = { path: payload.path, data: payload.data };
      window.dispatchEvent(new CustomEvent('icophone:project-opened-from-disk', { detail: payload }));
    }
    return;
  }

  if (packet.id === 'confirmQuit') {
    const payload = packet.payload as { reason?: 'quit' | 'windowClose' };
    pendingQuitReason = payload.reason ?? 'quit';
    window.dispatchEvent(new CustomEvent('icophone:confirm-quit', { detail: payload }));
    return;
  }

  if (packet.id === 'updateAvailable') {
    const payload = packet.payload as Partial<DesktopUpdateInfo>;
    if (typeof payload.version === 'string' && typeof payload.releaseNotes === 'string') {
      pendingUpdateInfo = {
        version: payload.version,
        releaseNotes: payload.releaseNotes,
      };
      window.dispatchEvent(new CustomEvent('icophone:update-available', { detail: pendingUpdateInfo }));
    }
  }
}

function ensureElectrobunClient() {
  if (!isElectrobunEnvironment()) return false;
  if (electrobunInitialized) return true;

  const hostBridge = window.electrobun!;
  hostBridge.receiveMessageFromBun = (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    handleIncomingPacket(message as ElectrobunPacket);
  };

  electrobunInitialized = true;
  window.__electrobunBunBridge?.postMessage(
    JSON.stringify({
      type: 'message',
      id: 'webviewReady',
      payload: undefined,
    } satisfies ElectrobunPacket),
  );
  return true;
}

async function electrobunRequest<T>(method: string, params: unknown): Promise<T> {
  if (!ensureElectrobunClient()) {
    throw new Error('Electrobun bridge is unavailable.');
  }

  const id = ++nextRequestId;
  const payload = JSON.stringify({
    type: 'request',
    id,
    method,
    params,
  } satisfies ElectrobunPacket);

  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timed out waiting for Electrobun request: ${method}`));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timeout });
    window.__electrobunBunBridge?.postMessage(payload);
  });
}

async function pickFiles(options: { accept: string; multiple?: boolean }) {
  const { accept, multiple = false } = options;

  return await new Promise<Array<{ name: string; content: string }> | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.className = 'sr-only';

    input.onchange = async () => {
      const selected = Array.from(input.files ?? []);
      input.remove();

      if (selected.length === 0) {
        resolve(null);
        return;
      }

      const files = await Promise.all(
        selected.map(async (file) => ({
          name: file.name,
          content: await file.text(),
        })),
      );
      resolve(files);
    };

    document.body.appendChild(input);
    input.click();
  });
}

function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { path: fileName };
}

export function subscribeToMenuActions(listener: (command: DesktopCommand) => void) {
  menuListeners.add(listener);
  return () => {
    menuListeners.delete(listener);
  };
}

export async function openProject(): Promise<ProjectOpenResult> {
  if (isElectrobunEnvironment()) {
    const result = await electrobunRequest<ProjectOpenResult>('openProject', {});
    currentProjectPath = result?.path;
    return result;
  }

  const files = await pickFiles({ accept: '.icophone.json,.json' });
  const file = files?.[0];
  if (!file) return null;

  currentProjectPath = file.name;
  return {
    path: file.name,
    data: file.content,
  };
}

export async function saveProject(
  data: string,
  path = currentProjectPath,
): Promise<ProjectSaveResult> {
  if (isElectrobunEnvironment()) {
    const result = await electrobunRequest<ProjectSaveResult>('saveProject', { data, path });
    if (result?.path) {
      emitProjectSaved(result.path);
    }
    return result;
  }

  const result = downloadTextFile(data, path ?? defaultProjectFileName(data), 'application/json');
  emitProjectSaved(result.path);
  return result;
}

export async function saveProjectAs(data: string): Promise<ProjectSaveResult> {
  if (isElectrobunEnvironment()) {
    const result = await electrobunRequest<ProjectSaveResult>('saveProjectAs', { data });
    if (result?.path) {
      emitProjectSaved(result.path);
    }
    return result;
  }

  const result = downloadTextFile(data, defaultProjectFileName(data), 'application/json');
  emitProjectSaved(result.path);
  return result;
}

export async function exportSvg(svg: string, defaultName: string): Promise<ProjectSaveResult> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<ProjectSaveResult>('exportSvg', {
      svg,
      defaultName,
    });
  }

  return downloadTextFile(svg, defaultName, 'image/svg+xml');
}

export async function exportReactLibrary(files: Record<string, string>): Promise<ProjectSaveResult> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<ProjectSaveResult>('exportReactLibrary', { files });
  }

  return null;
}

export async function exportSvgPackage(files: Record<string, string>): Promise<ProjectSaveResult> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<ProjectSaveResult>('exportSvgPackage', { files });
  }

  return null;
}

export async function importSvgFiles(): Promise<SvgImportResult> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<SvgImportResult>('importSvgFiles', {});
  }

  const files = await pickFiles({
    accept: '.svg,image/svg+xml',
    multiple: true,
  });

  return files ? { files } : null;
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<RecentProject[]>('getRecentProjects', {});
  }

  return [];
}

export async function compileExportBundle(
  project: string,
  generateReact: boolean,
): Promise<Record<string, string> | null> {
  if (!isElectrobunEnvironment()) {
    return null;
  }

  const result = await electrobunRequest<{ files: Record<string, string> } | null>(
    'compileExportBundle',
    { project, generateReact },
  );
  return result?.files ?? null;
}

export async function openExternal(url: string): Promise<boolean> {
  if (isElectrobunEnvironment()) {
    return await electrobunRequest<boolean>('openExternal', { url });
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export async function showNativeContextMenu(
  menu: DesktopContextMenuKind,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (!isElectrobunEnvironment()) return;
  await electrobunRequest<null>('showContextMenu', { menu, payload });
}

export function getCurrentProjectPath() {
  return currentProjectPath;
}

export function setCurrentProjectPath(path?: string | null) {
  currentProjectPath = path ?? undefined;
}

export function clearCurrentProjectPath() {
  currentProjectPath = undefined;
}

export function consumePendingStartupProject() {
  const next = pendingStartupProject;
  pendingStartupProject = null;
  return next;
}

export function consumePendingQuitReason() {
  const next = pendingQuitReason;
  pendingQuitReason = null;
  return next;
}

export function consumePendingUpdateInfo() {
  const next = pendingUpdateInfo;
  pendingUpdateInfo = null;
  return next;
}

export async function setWindowTitle(projectName: string | null | undefined, isDirty: boolean) {
  if (!isElectrobunEnvironment()) return;
  await electrobunRequest<null>('setWindowTitle', { projectName, isDirty });
}

export async function confirmUnsavedChanges(): Promise<'save' | 'discard' | 'cancel'> {
  if (!isElectrobunEnvironment()) {
    return window.confirm('You have unsaved changes. Save before quitting?') ? 'save' : 'cancel';
  }

  return await electrobunRequest<'save' | 'discard' | 'cancel'>('confirmUnsavedChanges', {});
}

export async function resolveQuitDecision(decision: 'quit' | 'discard' | 'cancel') {
  if (!isElectrobunEnvironment()) return;
  await electrobunRequest<null>('resolveQuitDecision', { decision });
}

export async function getDesktopSettings(): Promise<DesktopSettings> {
  if (!isElectrobunEnvironment()) {
    return { autoSaveEnabled: false };
  }

  return await electrobunRequest<DesktopSettings>('getDesktopSettings', {});
}

export async function installUpdate() {
  if (!isElectrobunEnvironment()) return false;
  return await electrobunRequest<boolean>('installUpdate', {});
}

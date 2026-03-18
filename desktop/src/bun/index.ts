import { mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { compileProject } from '../../../lib/export/compile-pipeline';
import { isProject } from '../../../lib/schema/guards';
import Electrobun, {
  ApplicationMenu,
  BuildConfig,
  BrowserWindow,
  ContextMenu,
  Updater,
  Utils,
  defineElectrobunRPC,
} from 'electrobun/bun';
import {
  addRecent,
  getRecent,
} from './recent-projects';
import { buildContextMenu } from './context-menus';
import type { ConivaRPC, DesktopContextMenuKind } from '../shared/rpc-types';
import {
  DESKTOP_PRODUCT_NAME,
  getProjectFileName,
  isProjectFilePath,
  slugify,
} from '../shared/naming';

type DesktopSettings = {
  autoSaveEnabled: boolean;
};

type PendingLaunchProject = {
  path: string;
  data: string;
};

type SaveProjectRequest = {
  data: string;
  path?: string;
};

type SaveProjectAsRequest = {
  data: string;
};

type ExportSvgRequest = {
  svg: string;
  defaultName: string;
};

type ExportFilesRequest = {
  files: Record<string, string>;
};

type CompileExportBundleRequest = {
  project: string;
  generateReact: boolean;
};

type OpenExternalRequest = {
  url: string;
};

type ShowContextMenuRequest = {
  menu: DesktopContextMenuKind;
  payload?: Record<string, unknown>;
};

type SetWindowTitleRequest = {
  projectName?: string | null;
  isDirty: boolean;
};

type ResolveQuitDecisionRequest = {
  decision: 'quit' | 'discard' | 'cancel';
};

type ResizeEvent = {
  data?: {
    width?: number;
    height?: number;
  };
};

const SETTINGS_FILE = join(Utils.paths.userData, 'settings.json');
const DEFAULT_SETTINGS: DesktopSettings = {
  autoSaveEnabled: false,
};
const DEFAULT_WINDOW_FRAME = {
  x: 80,
  y: 72,
  width: 1360,
  height: 880,
};

const runtimeMode =
  process.env['ELECTROBUN_BUILD_ENV'] ??
  process.env['CONIVA_DESKTOP_MODE'] ??
  process.env['ICOPHONE_DESKTOP_MODE'] ??
  'dev';
const isDev = runtimeMode === 'dev';
let webviewIsReady = false;
let allowNextQuit = false;
let quitFlowInProgress = false;
let updateCheckStarted = false;
let updateInstallInProgress = false;
let correctingWindowFrame = false;
let pendingQuitResolver: ((decision: 'quit' | 'discard' | 'cancel') => void) | null = null;
let pendingLaunchProject = await readLaunchProjectFromArgv(process.argv);
const windowState = {
  projectName: DESKTOP_PRODUCT_NAME,
  isDirty: false,
};

const rpc = defineElectrobunRPC<ConivaRPC>('bun', {
  handlers: {
    requests: {
      openProject: async () => {
        const selectedPath = await chooseProjectFile();
        if (!selectedPath) return null;

        const data = await Bun.file(selectedPath).text();
        await addRecent(selectedPath, parseProjectName(data));
        return { path: selectedPath, data };
      },
      saveProject: async ({ data, path }: SaveProjectRequest) => {
        if (!path) {
          return await saveProjectAs(data);
        }

        await writeFile(path, data);
        await addRecent(path, parseProjectName(data));
        sendToWebview('projectSaved', { path });
        return { path };
      },
      saveProjectAs: async ({ data }: SaveProjectAsRequest) => {
        return await saveProjectAs(data);
      },
      exportSvg: async ({ svg, defaultName }: ExportSvgRequest) => {
        const targetDirectory = await chooseDirectory(Utils.paths.documents);
        if (!targetDirectory) return null;

        const filePath = join(targetDirectory, ensureExtension(defaultName, '.svg'));
        await writeFile(filePath, svg);
        return { path: filePath };
      },
      exportReactLibrary: async ({ files }: ExportFilesRequest) => {
        const targetDirectory = await chooseDirectory(Utils.paths.documents);
        if (!targetDirectory) return null;

        await writeFiles(targetDirectory, files);
        return { path: targetDirectory };
      },
      exportSvgPackage: async ({ files }: ExportFilesRequest) => {
        const targetDirectory = await chooseDirectory(Utils.paths.documents);
        if (!targetDirectory) return null;

        await writeFiles(targetDirectory, files);
        return { path: targetDirectory };
      },
      importSvgFiles: async () => {
        const paths = await Utils.openFileDialog({
          startingFolder: Utils.paths.documents,
          allowedFileTypes: 'svg',
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: true,
        });
        const selectedPaths = paths.filter(Boolean);
        if (selectedPaths.length === 0) return null;

        const files = await Promise.all(
          selectedPaths.map(async (path) => ({
            name: basename(path),
            content: await Bun.file(path).text(),
          })),
        );
        return { files };
      },
      getRecentProjects: async () => {
        return await getRecent();
      },
      compileExportBundle: async ({ project, generateReact }: CompileExportBundleRequest) => {
        const parsed = JSON.parse(project) as unknown;
        if (!isProject(parsed)) {
          return null;
        }

        const result = compileProject(parsed, {
          package: {
            name: `@coniva/${slugify(parsed.meta.name)}`,
            version: '1.0.0',
            builtAt: new Date().toISOString(),
          },
          generateReact,
        });

        return {
          files: Object.fromEntries(result.files.map((file) => [file.path, file.contents])),
        };
      },
      openExternal: async ({ url }: OpenExternalRequest) => {
        return Utils.openExternal(url);
      },
      showContextMenu: async ({ menu, payload }: ShowContextMenuRequest) => {
        ContextMenu.showContextMenu(buildContextMenu(menu, payload));
        return null;
      },
      setWindowTitle: async ({ projectName, isDirty }: SetWindowTitleRequest) => {
        windowState.projectName = projectName?.trim() || DESKTOP_PRODUCT_NAME;
        windowState.isDirty = isDirty;
        updateWindowTitle();
        return null;
      },
      confirmUnsavedChanges: async () => {
        const { response } = await Utils.showMessageBox({
          type: 'question',
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Save before quitting?',
          buttons: ['Save & Quit', 'Quit Without Saving', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
        });
        return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel';
      },
      resolveQuitDecision: async ({ decision }: ResolveQuitDecisionRequest) => {
        pendingQuitResolver?.(decision);
        return null;
      },
      getDesktopSettings: async () => {
        return await readDesktopSettings();
      },
      installUpdate: async () => {
        return await installReadyUpdate();
      },
    },
    messages: {
      webviewReady: () => {
        webviewIsReady = true;
        revealMainWindow();
        void flushPendingLaunchProject();
        void checkForUpdatesInBackground();
      },
    },
  },
});
const sendToWebview = rpc.send as (channel: string, payload?: unknown) => void;

const mainWindow = new BrowserWindow({
  title: '',
  frame: DEFAULT_WINDOW_FRAME,
  renderer: 'native',
  titleBarStyle: 'hiddenInset',
  url: isDev ? 'http://localhost:3000' : 'views://mainview/index.html',
  rpc,
});

setApplicationMenu();
ContextMenu.on('context-menu-clicked', (event) => {
  const item = readMenuEvent(event);
  if (!item) return;
  dispatchMenuAction(item.action, item.payload);
});
Electrobun.events.on('before-quit', (event) => {
  if (allowNextQuit) {
    allowNextQuit = false;
    event.response = { allow: true };
    return;
  }

  event.response = { allow: false };
  void requestQuitWithGuard('quit');
});
mainWindow.on('resize', (event: ResizeEvent) => {
  const { width, height } = event?.data ?? {};
  if (correctingWindowFrame) return;
  if (typeof width !== 'number' || typeof height !== 'number') return;
  if (width >= 600 && height >= 300) return;

  correctingWindowFrame = true;
  try {
    revealMainWindow();
  } finally {
    correctingWindowFrame = false;
  }
});
revealMainWindow();
updateWindowTitle();
if (webviewIsReady) {
  void flushPendingLaunchProject();
  void checkForUpdatesInBackground();
}
setTimeout(revealMainWindow, 150);
setTimeout(revealMainWindow, 600);

function setApplicationMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      label: 'File',
      submenu: [
        { label: 'New Project', action: 'file.new', accelerator: 'CmdOrCtrl+N' },
        { label: 'Open', action: 'file.open', accelerator: 'CmdOrCtrl+O' },
        { label: 'Save', action: 'file.save', accelerator: 'CmdOrCtrl+S' },
        { label: 'Save As', action: 'file.saveAs', accelerator: 'CmdOrCtrl+Shift+S' },
        { type: 'separator' },
        { label: 'Import SVG', action: 'file.importSvg', accelerator: 'CmdOrCtrl+I' },
        { type: 'separator' },
        { label: 'Export SVG', action: 'file.exportSvg', accelerator: 'CmdOrCtrl+E' },
        { label: 'Export React Library', action: 'file.exportReactLibrary' },
        { label: 'Export SVG Package', action: 'file.exportSvgPackage' },
        { type: 'separator' },
        { label: 'Quit', action: 'file.quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', action: 'edit.undo', accelerator: 'CmdOrCtrl+Z' },
        { label: 'Redo', action: 'edit.redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: 'Cut', action: 'edit.cut' },
        { label: 'Copy', action: 'edit.copy' },
        { label: 'Paste', action: 'edit.paste' },
        { type: 'separator' },
        { label: 'Select All', action: 'edit.selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', action: 'view.zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Zoom Out', action: 'view.zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: 'Fit to Canvas', action: 'view.fitCanvas', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        { label: 'Reload', action: 'view.reload', accelerator: 'CmdOrCtrl+R' },
        { type: 'separator' },
        { label: 'Toggle Grid', action: 'view.toggleGrid', accelerator: 'G' },
        { label: 'Toggle Guides', action: 'view.toggleGuides', accelerator: ';' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Select', action: 'tool.select', accelerator: 'V' },
        { label: 'Direct Select', action: 'tool.directSelect', accelerator: 'A' },
        { label: 'Pen', action: 'tool.pen', accelerator: 'P' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', action: 'window.minimize' },
        { label: 'Maximize', action: 'window.maximize' },
        { type: 'separator' },
        { label: 'Explorer', action: 'window.explorer', accelerator: 'CmdOrCtrl+1' },
        { label: 'Editor', action: 'window.editor', accelerator: 'CmdOrCtrl+2' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', action: 'help.documentation' },
        { label: `About ${DESKTOP_PRODUCT_NAME}`, action: 'help.about' },
      ],
    },
  ]);

  ApplicationMenu.on('application-menu-clicked', (event) => {
    const item = readMenuEvent(event);
    if (!item) return;
    dispatchMenuAction(item.action, item.payload);
  });
}

function readMenuEvent(event: unknown): { action: string; payload?: Record<string, unknown> } | null {
  if (!event || typeof event !== 'object') return null;
  const data = (event as { data?: { action?: string; data?: Record<string, unknown> } }).data;
  if (!data?.action) return null;
  return { action: data.action, payload: data.data };
}

function dispatchMenuAction(action: string, payload?: Record<string, unknown>) {
  sendToWebview('menuTriggered', { action, payload });

  switch (action) {
    case 'file.quit':
      void requestQuitWithGuard('quit');
      break;
    case 'window.minimize':
      mainWindow.minimize();
      break;
    case 'window.maximize':
      mainWindow.maximize();
      break;
    default:
      break;
  }
}

async function chooseProjectFile() {
  const paths = await Utils.openFileDialog({
    startingFolder: Utils.paths.documents,
    allowedFileTypes: 'json,coniva.json,icophone.json',
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
  });
  return paths.filter(Boolean)[0] ?? null;
}

async function chooseDirectory(startingFolder: string) {
  const paths = await Utils.openFileDialog({
    startingFolder,
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });
  return paths.filter(Boolean)[0] ?? null;
}

async function saveProjectAs(data: string) {
  const targetDirectory = await chooseDirectory(Utils.paths.documents);
  if (!targetDirectory) return null;

  // Electrobun currently exposes an open dialog, so we pick a directory and
  // write a default file name inside it until a native save dialog lands.
  const filePath = join(targetDirectory, getProjectFileName(parseProjectName(data)));
  await writeFile(filePath, data);
  await addRecent(filePath, parseProjectName(data));
  sendToWebview('projectSaved', { path: filePath });
  return { path: filePath };
}

async function writeFile(path: string, data: string) {
  mkdirSync(dirname(path), { recursive: true });
  await Bun.write(path, data);
}

function ensureExtension(fileName: string, extension: string) {
  return fileName.endsWith(extension) ? fileName : `${fileName}${extension}`;
}

async function writeFiles(targetDirectory: string, files: Record<string, string>) {
  const root = resolve(targetDirectory);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const outputPath = resolve(root, relativePath);
      if (outputPath !== root && !outputPath.startsWith(`${root}${sep}`)) {
        throw new Error(`Refusing to write outside the selected directory: ${relativePath}`);
      }

      mkdirSync(dirname(outputPath), { recursive: true });
      await Bun.write(outputPath, content);
    }),
  );
}

async function flushPendingLaunchProject() {
  if (!webviewIsReady || !pendingLaunchProject) return;

  sendToWebview('projectOpenedFromDisk', pendingLaunchProject);
  pendingLaunchProject = null;
}

async function requestQuitWithGuard(reason: 'quit' | 'windowClose') {
  if (quitFlowInProgress) return;

  if (!windowState.isDirty) {
    allowNextQuit = true;
    Utils.quit();
    return;
  }

  quitFlowInProgress = true;

  try {
    if (!webviewIsReady) {
      const { response } = await Utils.showMessageBox({
        type: 'warning',
        title: 'Unsaved Changes',
        message: 'You have unsaved changes that cannot be saved right now.',
        buttons: ['Quit Without Saving', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      });

      if (response === 0) {
        allowNextQuit = true;
        Utils.quit();
      }
      return;
    }

    const decision = await new Promise<'quit' | 'discard' | 'cancel'>((resolve) => {
      pendingQuitResolver = resolve;
      sendToWebview('confirmQuit', { reason });
    });

    if (decision === 'quit' || decision === 'discard') {
      allowNextQuit = true;
      Utils.quit();
    }
  } finally {
    pendingQuitResolver = null;
    quitFlowInProgress = false;
  }
}

function updateWindowTitle() {
  // With hiddenInset title bar, keep the title empty so native title text
  // doesn't overlap the custom TitleTabBar. The app name ("Coniva") shows
  // in the Dock and Cmd+Tab via the Electrobun app config.
  mainWindow.setTitle('');
}

function revealMainWindow() {
  // Electrobun occasionally leaves the initial macOS window collapsed to a
  // title-bar strip. Reapplying the full frame during startup keeps it visible.
  mainWindow.setFrame(
    DEFAULT_WINDOW_FRAME.x,
    DEFAULT_WINDOW_FRAME.y,
    DEFAULT_WINDOW_FRAME.width,
    DEFAULT_WINDOW_FRAME.height,
  );
  mainWindow.unminimize();
  mainWindow.show();
  mainWindow.focus();
}

async function readLaunchProjectFromArgv(argv: string[]): Promise<PendingLaunchProject | null> {
  const candidate = argv.find((arg) => isProjectFilePath(arg));
  if (!candidate) return null;

  try {
    return {
      path: candidate,
      data: await Bun.file(candidate).text(),
    };
  } catch {
    return null;
  }
}

function parseProjectName(data: string) {
  try {
    const parsed = JSON.parse(data) as { meta?: { name?: string } };
    return parsed.meta?.name?.trim() || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

async function readDesktopSettings(): Promise<DesktopSettings> {
  try {
    const file = Bun.file(SETTINGS_FILE);
    if (!(await file.exists())) {
      await writeDesktopSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const parsed = await file.json();
    return {
      autoSaveEnabled:
        parsed && typeof parsed === 'object' && typeof parsed.autoSaveEnabled === 'boolean'
          ? parsed.autoSaveEnabled
          : DEFAULT_SETTINGS.autoSaveEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeDesktopSettings(settings: DesktopSettings) {
  mkdirSync(Utils.paths.userData, { recursive: true });
  await Bun.write(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

async function checkForUpdatesInBackground() {
  if (isDev || updateCheckStarted) return;

  updateCheckStarted = true;

  try {
    const updateInfo = await Updater.checkForUpdate();
    if (!updateInfo.updateAvailable) {
      return;
    }

    await Updater.downloadUpdate();
    const readyInfo = Updater.updateInfo();
    if (!readyInfo?.updateReady) {
      return;
    }

    const releaseNotes = await readLatestReleaseNotes(updateInfo.version);
    sendToWebview('updateAvailable', {
      version: updateInfo.version || 'unknown',
      releaseNotes,
    });
  } catch (error) {
    console.error('Background update check failed:', error);
  }
}

async function installReadyUpdate() {
  if (updateInstallInProgress || isDev) {
    return false;
  }

  updateInstallInProgress = true;

  try {
    const info = Updater.updateInfo();
    if (!info?.updateReady) {
      const updateInfo = await Updater.checkForUpdate();
      if (!updateInfo.updateAvailable) {
        return false;
      }
      await Updater.downloadUpdate();
    }

    await Updater.applyUpdate();
    return true;
  } catch (error) {
    console.error('Failed to install update:', error);
    return false;
  } finally {
    updateInstallInProgress = false;
  }
}

async function readLatestReleaseNotes(fallbackVersion: string) {
  try {
    const buildConfig = await BuildConfig.get();
    const endpoint =
      process.env['CONIVA_UPDATE_ENDPOINT'] ??
      process.env['ICOPHONE_UPDATE_ENDPOINT'] ??
      (typeof buildConfig.runtime?.updateEndpoint === 'string'
        ? buildConfig.runtime.updateEndpoint
        : null);

    if (!endpoint) {
      return `Version ${fallbackVersion} is ready to install.`;
    }

    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      return `Version ${fallbackVersion} is ready to install.`;
    }

    const manifest = (await response.json()) as {
      version?: string;
      releaseNotes?: string;
    };

    return manifest.releaseNotes?.trim() || `Version ${manifest.version ?? fallbackVersion} is ready to install.`;
  } catch {
    return `Version ${fallbackVersion} is ready to install.`;
  }
}

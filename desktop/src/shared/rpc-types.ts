import type { RPCSchema } from 'electrobun/bun';

export type DesktopContextMenuKind = 'layerPanel' | 'canvas' | 'explorerIcon';

export type IcophoneRPC = {
  bun: RPCSchema<{
    requests: {
      openProject: { params: {}; response: { path: string; data: string } | null };
      saveProject: { params: { data: string; path?: string }; response: { path: string } | null };
      saveProjectAs: { params: { data: string }; response: { path: string } | null };
      exportSvg: { params: { svg: string; defaultName: string }; response: { path: string } | null };
      exportReactLibrary: { params: { files: Record<string, string> }; response: { path: string } | null };
      exportSvgPackage: { params: { files: Record<string, string> }; response: { path: string } | null };
      importSvgFiles: { params: {}; response: { files: Array<{ name: string; content: string }> } | null };
      getRecentProjects: { params: {}; response: Array<{ path: string; name: string; updatedAt: string }> };
      compileExportBundle: { params: { project: string; generateReact: boolean }; response: { files: Record<string, string> } | null };
      openExternal: { params: { url: string }; response: boolean };
      showContextMenu: { params: { menu: DesktopContextMenuKind; payload?: Record<string, unknown> }; response: null };
      setWindowTitle: { params: { projectName?: string | null; isDirty: boolean }; response: null };
      confirmUnsavedChanges: { params: {}; response: 'save' | 'discard' | 'cancel' };
      resolveQuitDecision: { params: { decision: 'quit' | 'discard' | 'cancel' }; response: null };
      getDesktopSettings: { params: {}; response: { autoSaveEnabled: boolean } };
      installUpdate: { params: {}; response: boolean };
    };
    messages: {
      webviewReady: undefined;
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      projectSaved: { path: string };
      menuTriggered: { action: string; payload?: Record<string, unknown> };
      projectOpenedFromDisk: { path: string; data: string };
      confirmQuit: { reason: 'quit' | 'windowClose' };
      updateAvailable: { version: string; releaseNotes: string };
    };
  }>;
};

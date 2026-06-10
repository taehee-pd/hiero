'use client';

/**
 * D1 (slice 1) — shared export actions
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * EditorShell and the studio Navbar previously each owned a copy of
 * the download-export handlers; the Navbar copy swallowed failures.
 * This hook is now the single implementation: every export reads the
 * live store, reports failure as a destructive toast (A3), and exposes
 * `exporting` / `exportMessage` for inline status UI.
 */

import { useCallback, useRef, useState } from 'react';

import { toast } from '@/components/ui/use-toast';
import { editorStore } from '@/lib/editor-store/store';
import { exportSvg, saveProject } from '@/lib/platform/bridge';
import { exportSvgString } from '@/lib/export/export-svg';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { exportRuntimeJson } from '@/lib/export/export-runtime-json';
import { generateIconLibrary } from '@/lib/export/export-react/generate-library';
import { createZipBlob } from '@/lib/export/export-react/zip';

export function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useExportActions() {
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((message: string, ms: number) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setExportMessage(message);
    messageTimerRef.current = setTimeout(() => setExportMessage(null), ms);
  }, []);

  const runExport = useCallback(
    async (label: string, fn: () => void | Promise<void>) => {
      setExporting(true);
      setExportMessage(null);
      try {
        await fn();
        showMessage(`${label} exported`, 2000);
      } catch (error) {
        console.error(`[export] ${label} export failed:`, error);
        showMessage(`${label} export failed`, 3000);
        toast({
          title: `${label} export failed`,
          description:
            error instanceof Error ? error.message : 'Unexpected error during export.',
          variant: 'destructive',
        });
      } finally {
        setExporting(false);
      }
    },
    [showMessage],
  );

  const handleExportCurrentSvg = useCallback(
    () =>
      runExport('SVG', async () => {
        const state = editorStore.getState();
        const icon = state.currentIconId
          ? state.project?.icons[state.currentIconId]
          : null;
        if (!icon || !state.currentVariantId) return;

        const svg = exportSvgString(
          icon,
          state.currentVariantId,
          'default',
          state.project?.tokenSet?.colors,
          state.renderingMode,
        );
        await exportSvg(svg, `${slugifyName(icon.name)}.svg`);
      }),
    [runExport],
  );

  const handleExportSvgPackage = useCallback(
    () =>
      runExport('SVG package', () => {
        const { project } = editorStore.getState();
        if (!project) return;
        const fileMap = exportSvgPackage(project);
        downloadBlob(
          createZipBlob(fileMap),
          `${slugifyName(project.meta.name)}-svg-package.zip`,
        );
      }),
    [runExport],
  );

  // C3 (scoped): bulk export of the list pane's multi-selection,
  // falling back to the open icon when nothing is selected.
  const handleExportSelectedSvgs = useCallback(
    () =>
      runExport('Selected SVGs', () => {
        const state = editorStore.getState();
        const project = state.project;
        if (!project) return;
        const ids =
          state.selectedIconIds.length > 0
            ? state.selectedIconIds
            : state.currentIconId
              ? [state.currentIconId]
              : [];
        if (ids.length === 0) return;
        const fileMap = exportSvgPackage(project, { icons: ids });
        downloadBlob(
          createZipBlob(fileMap),
          `${slugifyName(project.meta.name)}-selected-svgs.zip`,
        );
      }),
    [runExport],
  );

  const handleExportRuntimeJson = useCallback(
    () =>
      runExport('Runtime JSON', () => {
        const state = editorStore.getState();
        const icon = state.currentIconId
          ? state.project?.icons[state.currentIconId]
          : null;
        if (!icon || !state.project) return;
        const runtimeJson = exportRuntimeJson({
          ...icon,
          tokenSet: state.project.tokenSet,
        });
        downloadBlob(
          new Blob([runtimeJson], { type: 'application/json' }),
          `${slugifyName(icon.name)}.runtime.json`,
        );
      }),
    [runExport],
  );

  const handleExportReactLibrary = useCallback(
    () =>
      runExport('React library', () => {
        const { project } = editorStore.getState();
        if (!project) return;
        const fileMap = generateIconLibrary(project, {
          packageName: `${slugifyName(project.meta.name)}-react-icons`,
          typescript: true,
        });
        downloadBlob(
          createZipBlob(fileMap),
          `${slugifyName(project.meta.name)}-react-library.zip`,
        );
      }),
    [runExport],
  );

  const handleExportProjectFile = useCallback(async () => {
    const { workspace } = editorStore.getState();
    if (!workspace) return;
    const updatedAt = new Date().toISOString();
    const payload = JSON.stringify(
      { ...workspace, meta: { ...workspace.meta, updatedAt } },
      null,
      2,
    );
    try {
      const result = await saveProject(payload);
      if (result) {
        editorStore.getState().markSaved(updatedAt);
      }
    } catch (error) {
      console.error('[export] project file export failed:', error);
      toast({
        title: 'Project file export failed',
        description:
          error instanceof Error ? error.message : 'Could not write the project file.',
        variant: 'destructive',
      });
    }
  }, []);

  return {
    exporting,
    exportMessage,
    handleExportCurrentSvg,
    handleExportSvgPackage,
    handleExportSelectedSvgs,
    handleExportRuntimeJson,
    handleExportReactLibrary,
    handleExportProjectFile,
  };
}

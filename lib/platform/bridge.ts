/**
 * Platform bridge — web-only API surface.
 *
 * Provides file open/save/export operations using browser primitives
 * (file picker, Blob download, `window.open`).
 *
 * @module
 */
'use client';

export type ProjectOpenResult = { path: string; data: string } | null;
export type ProjectSaveResult = { path: string } | null;
export type SvgImportResult =
  | { files: Array<{ name: string; content: string }> }
  | null;

let currentProjectPath: string | undefined;

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
  return `${slugify(parseProjectName(data))}.cuneiform.json`;
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

export async function openProject(): Promise<ProjectOpenResult> {
  const files = await pickFiles({ accept: '.cuneiform.json,.json' });
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
  const result = downloadTextFile(data, path ?? defaultProjectFileName(data), 'application/json');
  currentProjectPath = result.path;
  return result;
}

export async function exportSvg(svg: string, defaultName: string): Promise<ProjectSaveResult> {
  return downloadTextFile(svg, defaultName, 'image/svg+xml');
}

export async function importSvgFiles(): Promise<SvgImportResult> {
  const files = await pickFiles({
    accept: '.svg,image/svg+xml',
    multiple: true,
  });

  return files ? { files } : null;
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

import { existsSync } from 'node:fs';
import { basename } from 'node:path';

export const DESKTOP_PRODUCT_NAME = 'Coniva';
export const LEGACY_DESKTOP_PRODUCT_NAME = 'Icophone';
export const PROJECT_FILE_ASSOCIATION_NAME = 'Coniva Project';

export const PRIMARY_PROJECT_FILE_EXTENSION = '.coniva.json';
export const LEGACY_PROJECT_FILE_EXTENSION = '.icophone.json';
export const PROJECT_FILE_EXTENSIONS = [
  PRIMARY_PROJECT_FILE_EXTENSION,
  LEGACY_PROJECT_FILE_EXTENSION,
] as const;

export function isProjectFilePath(value: string) {
  return PROJECT_FILE_EXTENSIONS.some((extension) => value.endsWith(extension)) && existsSync(value);
}

export function getProjectFileName(projectName: string) {
  return ensureExtension(slugify(projectName), PRIMARY_PROJECT_FILE_EXTENSION);
}

export function getProjectNameFromPath(path: string) {
  return stripProjectFileExtension(basename(path));
}

export function stripProjectFileExtension(fileName: string) {
  for (const extension of PROJECT_FILE_EXTENSIONS) {
    if (fileName.endsWith(extension)) {
      return fileName.slice(0, -extension.length);
    }
  }

  if (fileName.endsWith('.json')) {
    return fileName.slice(0, -'.json'.length);
  }

  return fileName;
}

export function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

function ensureExtension(fileName: string, extension: string) {
  return fileName.endsWith(extension) ? fileName : `${fileName}${extension}`;
}

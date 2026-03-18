/**
 * Validation for sync-source export payloads.
 *
 * Checks:
 * 1. Icon names are valid for use as directory names
 * 2. No path traversal in generated paths
 * 3. Manifest consistency (icon count matches, every icon has source + preview)
 * 4. Duplicate icon detection (by id and by directory name)
 */

import type { Icon } from '@/lib/schema/types';
import type { SourcePayload } from './types';

// ---------------------------------------------------------------------------
// Icon name validation
// ---------------------------------------------------------------------------

/**
 * Valid icon directory name: lowercase alphanumeric, hyphens, must start and
 * end with an alphanumeric character, max 128 chars.
 */
const VALID_ICON_DIR_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_ICON_DIR_NAME_LENGTH = 128;

export function toIconDirName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidIconDirName(dirName: string): boolean {
  return (
    dirName.length > 0 &&
    dirName.length <= MAX_ICON_DIR_NAME_LENGTH &&
    VALID_ICON_DIR_NAME.test(dirName)
  );
}

// ---------------------------------------------------------------------------
// Path traversal check
// ---------------------------------------------------------------------------

export function containsPathTraversal(filePath: string): boolean {
  const segments = filePath.split('/');
  return segments.some(
    (segment) => segment === '..' || segment === '.' || segment === '',
  );
}

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

export type ValidationError = {
  kind:
    | 'invalid-icon-name'
    | 'path-traversal'
    | 'duplicate-icon-id'
    | 'duplicate-icon-dir'
    | 'manifest-count-mismatch'
    | 'manifest-missing-icon'
    | 'empty-icon-id'
    | 'empty-icon-name';
  message: string;
};

// ---------------------------------------------------------------------------
// Pre-export validation (runs on source icons before export)
// ---------------------------------------------------------------------------

export function validateIconsForExport(
  icons: Record<string, Icon>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();
  const seenDirNames = new Map<string, string>(); // dirName -> iconId

  for (const [iconId, icon] of Object.entries(icons)) {
    // Empty id
    if (!iconId || iconId.trim() === '') {
      errors.push({ kind: 'empty-icon-id', message: 'Icon has an empty id.' });
      continue;
    }

    // Empty name
    if (!icon.name || icon.name.trim() === '') {
      errors.push({
        kind: 'empty-icon-name',
        message: `Icon "${iconId}" has an empty name.`,
      });
      continue;
    }

    // Duplicate id
    if (seenIds.has(iconId)) {
      errors.push({
        kind: 'duplicate-icon-id',
        message: `Duplicate icon id: "${iconId}".`,
      });
    }
    seenIds.add(iconId);

    // Directory name validation
    const dirName = toIconDirName(icon.name);
    if (!isValidIconDirName(dirName)) {
      errors.push({
        kind: 'invalid-icon-name',
        message: `Icon "${iconId}" produces invalid directory name: "${dirName}".`,
      });
    }

    // Duplicate directory name (two different icons map to the same dir)
    const existingIdForDir = seenDirNames.get(dirName);
    if (existingIdForDir && existingIdForDir !== iconId) {
      errors.push({
        kind: 'duplicate-icon-dir',
        message: `Icons "${existingIdForDir}" and "${iconId}" both map to directory name "${dirName}".`,
      });
    }
    seenDirNames.set(dirName, iconId);

    // Path traversal on generated path
    const testPath = `icons/${dirName}/icon.json`;
    if (containsPathTraversal(testPath)) {
      errors.push({
        kind: 'path-traversal',
        message: `Icon "${iconId}" would produce a path with traversal: "${testPath}".`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Post-export validation (runs on the generated payload)
// ---------------------------------------------------------------------------

export function validateSourcePayload(payload: SourcePayload): ValidationError[] {
  const errors: ValidationError[] = [];

  // Manifest icon count matches actual files
  if (payload.manifest.iconCount !== payload.iconCount) {
    errors.push({
      kind: 'manifest-count-mismatch',
      message: `Manifest declares ${payload.manifest.iconCount} icons but payload contains ${payload.iconCount}.`,
    });
  }

  // Every manifest entry has matching files
  const filePaths = new Set(payload.files.map((f) => f.path));
  for (const entry of Object.values(payload.manifest.icons)) {
    if (!filePaths.has(entry.sourcePath)) {
      errors.push({
        kind: 'manifest-missing-icon',
        message: `Manifest references "${entry.sourcePath}" but no file was generated.`,
      });
    }
    if (!filePaths.has(entry.previewPath)) {
      errors.push({
        kind: 'manifest-missing-icon',
        message: `Manifest references "${entry.previewPath}" but no file was generated.`,
      });
    }
  }

  // Path traversal on all generated files
  for (const file of payload.files) {
    if (file.path.includes('..')) {
      errors.push({
        kind: 'path-traversal',
        message: `Generated file path contains traversal: "${file.path}".`,
      });
    }
  }

  return errors;
}

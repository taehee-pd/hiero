/**
 * Main orchestrator — converts a Project (or active IconSet) into a
 * deterministic source-of-truth payload suitable for GitHub PR sync.
 *
 * Output structure:
 *   icons/{icon-dir-name}/icon.json      — canonical source schema
 *   icons/{icon-dir-name}/preview.svg    — preview SVG of default state
 *   manifest.json                        — index of all icons
 */

import type { Project } from '@/lib/schema/types';
import { isProject } from '@/lib/schema/guards';
import type { SourcePayload, SourcePayloadFile } from './types';
import { exportIconSource } from './export-icon-source';
import { generateSyncSourceManifest, type ManifestInput } from './export-manifest';
import { generatePreviewSvg } from './export-preview';
import { serializeSourceJson } from './serialize';
import { toIconDirName, validateIconsForExport, validateSourcePayload } from './validate';

export type ExportSourcePayloadOptions = {
  /** ISO-8601 timestamp for manifest.generatedAt */
  generatedAt?: string;
};

export function exportSourcePayload(
  project: Project,
  options?: ExportSourcePayloadOptions,
): SourcePayload {
  if (!isProject(project)) {
    throw new Error('Invalid project input for source export.');
  }

  // Pre-export validation
  const preErrors = validateIconsForExport(project.icons);
  if (preErrors.length > 0) {
    const messages = preErrors.map((e) => `  - [${e.kind}] ${e.message}`).join('\n');
    throw new Error(`Source export validation failed:\n${messages}`);
  }

  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const tokens = project.tokenSet?.colors;

  const files: SourcePayloadFile[] = [];
  const manifestInputs: ManifestInput[] = [];

  // Process icons in stable sorted order (by icon id)
  const iconEntries = Object.entries(project.icons).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [, icon] of iconEntries) {
    const dirName = toIconDirName(icon.name);
    const sourcePath = `icons/${dirName}/icon.json`;
    const previewPath = `icons/${dirName}/preview.svg`;

    // Canonical source
    const source = exportIconSource(icon);
    files.push({ path: sourcePath, contents: serializeSourceJson(source) });

    // Preview SVG
    const previewSvg = generatePreviewSvg(icon, tokens);
    if (previewSvg) {
      files.push({ path: previewPath, contents: `${previewSvg}\n` });
    }

    manifestInputs.push({ source, sourcePath, previewPath });
  }

  // Manifest
  const manifest = generateSyncSourceManifest(manifestInputs, generatedAt);
  files.push({ path: 'manifest.json', contents: serializeSourceJson(manifest) });

  // Sort all files by path for deterministic output
  files.sort((a, b) => a.path.localeCompare(b.path));

  const payload: SourcePayload = {
    files,
    manifest,
    iconCount: iconEntries.length,
  };

  // Post-export validation
  const postErrors = validateSourcePayload(payload);
  if (postErrors.length > 0) {
    const messages = postErrors.map((e) => `  - [${e.kind}] ${e.message}`).join('\n');
    throw new Error(`Source payload validation failed:\n${messages}`);
  }

  return payload;
}

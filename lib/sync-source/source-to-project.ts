/**
 * Merge-to-build adapter: reconstructs a Project from merged source export files.
 *
 * After a PR sync merges icon.json + manifest.json into a target repo, this
 * module reads those files and produces a valid Project that the existing
 * compile pipeline can consume without modification.
 *
 * Design decision: source export files are the canonical repo source after merge.
 * The adapter layer bridges the gap so existing compile/package/release tooling
 * works unchanged.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Icon, Layer, Project, State, Variant } from '@/lib/schema/types';
import { isProject } from '@/lib/schema/guards';
import type {
  IconSourceFile,
  SourceLayer,
  SourceVariant,
  SyncSourceManifest,
} from './types';

// ---------------------------------------------------------------------------
// Core adapter: IconSourceFile → Icon (editor-compatible)
// ---------------------------------------------------------------------------

/**
 * Converts a canonical IconSourceFile back into an editor-compatible Icon.
 *
 * The roundtrip is intentionally lossy for editor-only metadata (importMeta,
 * isClipMask, groupId, guideMasterId, customGuides, components) — that data
 * is only needed inside the editor, not for compilation or packaging.
 */
export function iconFromSource(source: IconSourceFile): Icon {
  const variants: Record<string, Variant> = {};

  for (const [variantId, sv] of Object.entries(source.variants)) {
    const states: Record<string, State> = {};
    for (const [stateId, ss] of Object.entries(sv.states)) {
      const layers: Record<string, Layer> = {};
      for (const [layerId, sl] of Object.entries(ss.layers)) {
        layers[layerId] = layerFromSource(sl);
      }
      states[stateId] = {
        id: ss.id,
        layers,
        ...(ss.topology ? { topology: ss.topology } : {}),
      };
    }

    variants[variantId] = variantFromSource(sv, states);
  }

  return {
    id: source.id,
    name: source.name,
    ...(source.category ? { category: source.category } : {}),
    ...(source.tags && source.tags.length > 0 ? { tags: source.tags } : {}),
    variants,
    transitions: source.transitions,
    ...(source.effects && Object.keys(source.effects).length > 0
      ? { effects: source.effects }
      : {}),
  };
}

function variantFromSource(
  sv: SourceVariant,
  states: Record<string, State>,
): Variant {
  return {
    id: sv.id,
    ...(sv.name ? { name: sv.name } : {}),
    size: sv.size,
    viewBox: sv.viewBox,
    ...(sv.renderingMode ? { renderingMode: sv.renderingMode } : {}),
    ...(sv.weight ? { weight: sv.weight } : {}),
    ...(sv.scale ? { scale: sv.scale } : {}),
    defaultState: sv.defaultState,
    states,
  };
}

function layerFromSource(sl: SourceLayer): Layer {
  return {
    id: sl.id,
    ...(sl.role ? { role: sl.role } : {}),
    ...(sl.visible === false ? { visible: false } : {}),
    ...(sl.clipPathLayerId ? { clipPathLayerId: sl.clipPathLayerId } : {}),
    ...(sl.path ? { path: sl.path } : {}),
    style: sl.style,
    ...(sl.transform ? { transform: sl.transform } : {}),
  };
}

// ---------------------------------------------------------------------------
// Project reconstruction from source export files
// ---------------------------------------------------------------------------

export type ProjectFromSourceOptions = {
  /** Project name (defaults to manifest-derived or "Source Export") */
  name?: string;
  /** Token colors to resolve token paint references during compilation */
  tokenColors?: Record<string, string>;
  /** ISO-8601 timestamp for meta.updatedAt (defaults to manifest.generatedAt) */
  updatedAt?: string;
};

/**
 * Reconstructs a Project from an in-memory set of source files.
 *
 * Accepts the same `SourcePayloadFile[]` shape that the sync pipeline produces,
 * making it suitable for both disk-loaded and in-memory roundtrip scenarios.
 */
export function projectFromSourceFiles(
  files: Array<{ path: string; contents: string }>,
  options?: ProjectFromSourceOptions,
): Project {
  let manifest: SyncSourceManifest | null = null;
  const iconSources: IconSourceFile[] = [];

  for (const file of files) {
    if (file.path === 'manifest.json') {
      manifest = JSON.parse(file.contents) as SyncSourceManifest;
    } else if (file.path.endsWith('/icon.json')) {
      iconSources.push(JSON.parse(file.contents) as IconSourceFile);
    }
    // preview.svg files are intentionally skipped — not needed for compilation
  }

  if (!manifest) {
    throw new Error('Missing manifest.json in source files.');
  }

  const icons: Record<string, Icon> = {};
  for (const source of iconSources) {
    icons[source.id] = iconFromSource(source);
  }

  const now = options?.updatedAt ?? manifest.generatedAt ?? new Date().toISOString();
  const project: Project = {
    version: '1.0',
    meta: {
      name: options?.name ?? 'Source Export',
      createdAt: now,
      updatedAt: now,
    },
    icons,
    ...(options?.tokenColors
      ? { tokenSet: { colors: options.tokenColors } }
      : {}),
  };

  if (!isProject(project)) {
    throw new Error('Reconstructed project failed validation.');
  }

  return project;
}

/**
 * Reads a merged source export directory from disk and reconstructs a Project.
 *
 * Expected directory structure (matches sync PR output):
 *   <sourceDir>/
 *     manifest.json
 *     icons/<icon-dir>/icon.json
 *     icons/<icon-dir>/preview.svg  (ignored)
 */
export async function projectFromSourceDir(
  sourceDir: string,
  options?: ProjectFromSourceOptions,
): Promise<Project> {
  const files: Array<{ path: string; contents: string }> = [];

  // Read manifest
  const manifestPath = path.join(sourceDir, 'manifest.json');
  const manifestContents = await readFile(manifestPath, 'utf8');
  files.push({ path: 'manifest.json', contents: manifestContents });

  // Read icon directories
  const iconsDir = path.join(sourceDir, 'icons');
  try {
    const iconDirs = await readdir(iconsDir);
    for (const dirName of iconDirs.sort()) {
      const dirPath = path.join(iconsDir, dirName);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) continue;

      const iconJsonPath = path.join(dirPath, 'icon.json');
      try {
        const iconContents = await readFile(iconJsonPath, 'utf8');
        files.push({ path: `icons/${dirName}/icon.json`, contents: iconContents });
      } catch {
        // Skip directories without icon.json
      }
    }
  } catch {
    // No icons directory — will produce an empty project
  }

  return projectFromSourceFiles(files, options);
}

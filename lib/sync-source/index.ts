// Public API for sync-source module.

export { exportSourcePayload, type ExportSourcePayloadOptions } from './export-source-payload';
export { exportIconSource } from './export-icon-source';
export { generateSyncSourceManifest, type ManifestInput } from './export-manifest';
export { generatePreviewSvg } from './export-preview';
export { serializeSourceJson } from './serialize';
export {
  iconFromSource,
  projectFromSourceFiles,
  projectFromSourceDir,
  type ProjectFromSourceOptions,
} from './source-to-project';
export {
  toIconDirName,
  isValidIconDirName,
  containsPathTraversal,
  validateIconsForExport,
  validateSourcePayload,
  type ValidationError,
} from './validate';
export {
  ICON_SOURCE_SCHEMA_VERSION,
  SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
  type IconSourceFile,
  type SourceLayer,
  type SourceVariant,
  type SourceEffect,
  type SyncSourceManifest,
  type SyncSourceManifestEntry,
  type SourcePayload,
  type SourcePayloadFile,
} from './types';

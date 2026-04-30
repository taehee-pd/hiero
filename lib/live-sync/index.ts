/**
 * lib/live-sync — Lane 1 (Live Integration) public API.
 *
 * Browser-safe exports (safe to import from React components):
 *   publishSourceFiles, pingDevServer
 *
 * Node.js-only exports (CLI, dev server, scripts):
 *   fullRebuild, incrementalRebuild, watchSourceDir,
 *   startDevServer, writeCompiledToHostTarget
 *
 * React components should import only from the specific files they need,
 * or from this index with tree-shaking enabled by the bundler.
 */

// Browser-safe — used by the editor's PublishDialog
export { publishSourceFiles, pingDevServer } from './publish-transport';

// Node.js only — used by the CLI and dev server
export { fullRebuild, incrementalRebuild } from './incremental-rebuild';
export { watchSourceDir } from './file-watcher';
export { startDevServer } from './dev-server';
export { writeCompiledToHostTarget } from './output-writer';

// Types
export type {
  LiveBuildResult,
  LiveBuildSuccess,
  LiveBuildNoOp,
  LiveBuildError,
  WriteHostOutputResult,
  DevServerConfig,
  DevServerState,
  DevServerStatus,
  DevServerIconEntry,
  SourceIngestRequest,
  PublishTransportMode,
  PublishRequest,
  PublishResult,
} from './types';

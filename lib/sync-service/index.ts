// Public API for sync-service module.

export { syncPr, type SyncPrOptions, type SyncPrResult } from './sync-pr';
export {
  type SyncConnector,
  type SyncPrRequest,
  type SyncPrResponse,
  type SyncConflictResponse,
  type SyncErrorResponse,
  type ChangedFileSummary,
  validateSyncPrRequest,
} from './contracts';
export {
  type GitProvider,
  type GitRef,
  type FileCommitResult,
  type PullRequestResult,
} from './git-provider';
export { GitHubProvider } from './github-provider';
export {
  generateBranchName,
  generateCommitMessage,
  generatePrTitle,
  generatePrBody,
} from './metadata';
export {
  diffSourcePayloads,
  extractIconDir,
  type ChangeKind,
  type FileChange,
  type SourceDiffResult,
  type IconChange,
} from './diff-source';
export {
  checkConflicts,
  resolveUniqueBranch,
  type ConflictKind,
  type Conflict,
  type ConflictCheckResult,
  type ConflictCheckInput,
} from './conflicts';
export {
  SyncError,
  AuthFailureError,
  RepoPermissionError,
  BranchCreationError,
  FileWriteError,
  FileDeleteError,
  PrCreationError,
  ValidationFailureError,
  ProviderError,
  classifyGitHubError,
  NpmPublishError,
  NpmAuthError,
  NpmRegistryError,
  type SyncErrorCode,
} from './errors';
export {
  REQUIRED_PERMISSIONS,
  METHOD_PERMISSION_MAP,
  preflightPermissionCheck,
  validateTokenFormat,
  type PreflightResult,
  type PreflightCheck,
} from './permissions';
export {
  readSyncFlags,
  checkSyncAllowed,
  type SyncFeatureFlags,
  type FlagCheckResult,
} from './feature-flags';

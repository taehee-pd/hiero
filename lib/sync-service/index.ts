// Public API for sync-service module.

export { syncPr, type SyncPrOptions, type SyncPrResult } from './sync-pr';
export {
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
  type SyncErrorCode,
} from './errors';

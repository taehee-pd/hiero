/**
 * Typed error classes for the GitHub PR sync pipeline.
 *
 * Each error class maps to a distinct failure mode so callers can
 * discriminate by `instanceof` or by the `code` property.
 */

export type SyncErrorCode =
  | 'AUTH_FAILURE'
  | 'REPO_PERMISSION_FAILURE'
  | 'BRANCH_CREATION_FAILURE'
  | 'FILE_WRITE_FAILURE'
  | 'FILE_DELETE_FAILURE'
  | 'PR_CREATION_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'PROVIDER_ERROR';

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor(code: SyncErrorCode, message: string, statusCode: number, cause?: unknown) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

export class AuthFailureError extends SyncError {
  constructor(message = 'GitHub authentication failed.', cause?: unknown) {
    super('AUTH_FAILURE', message, 401, cause);
    this.name = 'AuthFailureError';
  }
}

export class RepoPermissionError extends SyncError {
  constructor(message = 'Insufficient permissions on target repository.', cause?: unknown) {
    super('REPO_PERMISSION_FAILURE', message, 403, cause);
    this.name = 'RepoPermissionError';
  }
}

export class BranchCreationError extends SyncError {
  constructor(message = 'Failed to create branch.', cause?: unknown) {
    super('BRANCH_CREATION_FAILURE', message, 502, cause);
    this.name = 'BranchCreationError';
  }
}

export class FileWriteError extends SyncError {
  constructor(message = 'Failed to write file to repository.', cause?: unknown) {
    super('FILE_WRITE_FAILURE', message, 502, cause);
    this.name = 'FileWriteError';
  }
}

export class FileDeleteError extends SyncError {
  constructor(message = 'Failed to delete file from repository.', cause?: unknown) {
    super('FILE_DELETE_FAILURE', message, 502, cause);
    this.name = 'FileDeleteError';
  }
}

export class PrCreationError extends SyncError {
  constructor(message = 'Failed to create pull request.', cause?: unknown) {
    super('PR_CREATION_FAILURE', message, 502, cause);
    this.name = 'PrCreationError';
  }
}

export class ValidationFailureError extends SyncError {
  constructor(message = 'Request payload validation failed.', cause?: unknown) {
    super('VALIDATION_FAILURE', message, 400, cause);
    this.name = 'ValidationFailureError';
  }
}

export class ProviderError extends SyncError {
  constructor(message = 'Git provider request failed.', cause?: unknown) {
    super('PROVIDER_ERROR', message, 502, cause);
    this.name = 'ProviderError';
  }
}

/**
 * Classify a raw GitHub API error into the appropriate SyncError subclass.
 */
export function classifyGitHubError(
  err: unknown,
  context: 'auth' | 'branch' | 'file-write' | 'file-delete' | 'pr' | 'generic',
): SyncError {
  const message = err instanceof Error ? err.message : String(err);

  // Check for HTTP status codes embedded in error messages
  if (message.includes('401') || message.includes('Bad credentials')) {
    return new AuthFailureError(`Authentication failed: ${message}`, err);
  }
  if (message.includes('403') || message.includes('forbidden')) {
    return new RepoPermissionError(`Permission denied: ${message}`, err);
  }
  if (message.includes('404') && context === 'branch') {
    return new BranchCreationError(`Base branch not found: ${message}`, err);
  }

  switch (context) {
    case 'auth':
      return new AuthFailureError(message, err);
    case 'branch':
      return new BranchCreationError(message, err);
    case 'file-write':
      return new FileWriteError(message, err);
    case 'file-delete':
      return new FileDeleteError(message, err);
    case 'pr':
      return new PrCreationError(message, err);
    default:
      return new ProviderError(message, err);
  }
}

import type {
  ConivaConfig,
  ConfigValidationError,
  ConfigValidationResult,
  HostTarget,
  ReleaseTarget,
} from './types';

const ALLOWED_HOST_KINDS = new Set(['react-app', 'reference-app']);
const ALLOWED_RUNTIME_MODES = new Set(['in-memory', 'cache-dir', 'vendored']);
const ALLOWED_RELEASE_KINDS = new Set(['local-directory', 'git-pr', 'npm-registry']);

export function validateConfig(config: unknown): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];

  if (!isObject(config)) {
    return { valid: false, errors: [{ field: 'config', message: 'Config must be a non-null object.' }] };
  }

  validateSourceDir(config, errors);
  validateHostTargets(config, errors);
  validateReleaseTargets(config, errors);

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function validateSourceDir(config: Record<string, unknown>, errors: ConfigValidationError[]): void {
  const { sourceDir } = config;
  if (typeof sourceDir !== 'string' || sourceDir.trim() === '') {
    errors.push({ field: 'sourceDir', message: 'sourceDir is required and must be a non-empty string.' });
    return;
  }
  validateRepoRelativePath('sourceDir', sourceDir, errors);
}

function validateHostTargets(config: Record<string, unknown>, errors: ConfigValidationError[]): void {
  const { hostTargets } = config;
  if (!Array.isArray(hostTargets)) {
    errors.push({ field: 'hostTargets', message: 'hostTargets must be an array.' });
    return;
  }

  hostTargets.forEach((target: unknown, i: number) => {
    const prefix = `hostTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: 'Each host target must be a non-null object.' });
      return;
    }
    validateHostTarget(target as Record<string, unknown>, prefix, errors);
  });
}

function validateHostTarget(
  target: Record<string, unknown>,
  prefix: string,
  errors: ConfigValidationError[],
): void {
  const { kind, mode, runtimeMode, cacheDir } = target as Partial<HostTarget & Record<string, unknown>>;

  if (!kind || !ALLOWED_HOST_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_HOST_KINDS].join(', ')}.`,
    });
  }

  if (mode !== 'live') {
    errors.push({ field: `${prefix}.mode`, message: "mode must be 'live'." });
  }

  if (!runtimeMode || !ALLOWED_RUNTIME_MODES.has(String(runtimeMode))) {
    errors.push({
      field: `${prefix}.runtimeMode`,
      message: `runtimeMode must be one of: ${[...ALLOWED_RUNTIME_MODES].join(', ')}.`,
    });
  }

  if (runtimeMode === 'cache-dir') {
    if (!cacheDir || typeof cacheDir !== 'string' || (cacheDir as string).trim() === '') {
      errors.push({
        field: `${prefix}.cacheDir`,
        message: "cacheDir is required when runtimeMode is 'cache-dir'.",
      });
    } else {
      validateRepoRelativePath(`${prefix}.cacheDir`, cacheDir as string, errors);
    }
  }

  rejectInlineCredentials(target, prefix, errors);
}

function validateReleaseTargets(config: Record<string, unknown>, errors: ConfigValidationError[]): void {
  const { releaseTargets } = config;
  if (releaseTargets === undefined || releaseTargets === null) {
    return; // optional
  }
  if (!Array.isArray(releaseTargets)) {
    errors.push({ field: 'releaseTargets', message: 'releaseTargets must be an array when present.' });
    return;
  }

  releaseTargets.forEach((target: unknown, i: number) => {
    const prefix = `releaseTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: 'Each release target must be a non-null object.' });
      return;
    }
    validateReleaseTarget(target as Record<string, unknown>, prefix, errors);
  });
}

function validateReleaseTarget(
  target: Record<string, unknown>,
  prefix: string,
  errors: ConfigValidationError[],
): void {
  const { kind } = target as Partial<ReleaseTarget>;

  if (!kind || !ALLOWED_RELEASE_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_RELEASE_KINDS].join(', ')}.`,
    });
    return;
  }

  if (kind === 'local-directory') {
    const { outputMode, outputDir } = target as Record<string, unknown>;
    if (outputMode !== 'snapshot') {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!outputDir || typeof outputDir !== 'string' || (outputDir as string).trim() === '') {
      errors.push({ field: `${prefix}.outputDir`, message: 'outputDir is required and must be a non-empty string.' });
    }
  }

  if (kind === 'git-pr') {
    const { outputMode, owner, repo, baseBranch } = target as Record<string, unknown>;
    if (outputMode !== 'snapshot') {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!owner || typeof owner !== 'string' || (owner as string).trim() === '') {
      errors.push({ field: `${prefix}.owner`, message: 'owner is required and must be a non-empty string.' });
    }
    if (!repo || typeof repo !== 'string' || (repo as string).trim() === '') {
      errors.push({ field: `${prefix}.repo`, message: 'repo is required and must be a non-empty string.' });
    }
    if (!baseBranch || typeof baseBranch !== 'string' || (baseBranch as string).trim() === '') {
      errors.push({ field: `${prefix}.baseBranch`, message: 'baseBranch is required and must be a non-empty string.' });
    }
  }

  if (kind === 'npm-registry') {
    const { outputMode, packageName } = target as Record<string, unknown>;
    if (outputMode !== 'snapshot') {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!packageName || typeof packageName !== 'string' || (packageName as string).trim() === '') {
      errors.push({ field: `${prefix}.packageName`, message: 'packageName is required and must be a non-empty string.' });
    }
  }

  // Credentials must not appear in any target config regardless of kind —
  // tokens and secrets belong in the platform keychain only.
  rejectInlineCredentials(target, prefix, errors);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Reject a path that escapes the repo root or is absolute.
 * Tracks cumulative depth so that `a/../../b` is caught even though it does
 * not literally start with `..`.
 */
function validateRepoRelativePath(
  field: string,
  value: string,
  errors: ConfigValidationError[],
): void {
  if (path.isAbsolute(value)) {
    errors.push({ field, message: `${field} must be a relative path.` });
    return;
  }
  if (escapesRoot(value)) {
    errors.push({ field, message: `${field} must not escape the repo root.` });
  }
}

/**
 * Reject any field whose name looks like a secret or credential.
 * Applies to every target kind — credentials belong in the platform keychain.
 */
function rejectInlineCredentials(
  target: Record<string, unknown>,
  prefix: string,
  errors: ConfigValidationError[],
): void {
  const secretLike = ['token', 'secret', 'password', 'key', 'auth'];
  for (const [field, value] of Object.entries(target)) {
    if (
      secretLike.some((s) => field.toLowerCase().includes(s)) &&
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      errors.push({
        field: `${prefix}.${field}`,
        message: `Config must not store credentials. Move "${field}" to the platform keychain.`,
      });
    }
  }
}

/**
 * Returns true if traversing `p` relative to a root would go above that root
 * at any point. Handles both posix and Windows separators.
 * Examples: '../foo' → true, 'a/../../b' → true, 'a/../b' → false.
 */
function escapesRoot(p: string): boolean {
  const parts = p.replace(/\\/g, '/').split('/');
  let depth = 0;
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      depth--;
      if (depth < 0) return true;
    } else {
      depth++;
    }
  }
  return false;
}

// Minimal path helpers — avoids importing Node 'path' at type-check time in browser contexts.
const path = {
  isAbsolute(p: string): boolean {
    return p.startsWith('/') || /^[A-Za-z]:[/\\]/.test(p);
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Install Config Types — defines the cuneiform.config.ts contract for repo-native icon authoring.
// This config lives at the host repository root and tells Cuneiform:
//   - where canonical icon source lives
//   - which host surfaces should update live during development
//   - which release outputs should be produced for CI, review, or publishing
//
// Design rule: hostTargets are dev-time only; releaseTargets are transport/snapshot outputs.

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

export type CuneiformConfig = {
  /** Relative path to committed canonical icon source (e.g. 'cuneiform'). */
  sourceDir: string;
  /** Dev-time integrations that react to icon changes. */
  hostTargets: HostTarget[];
  /** Release transport or snapshot outputs for CI and publishing. Optional. */
  releaseTargets?: ReleaseTarget[];
};

// ---------------------------------------------------------------------------
// Host targets (dev-time only)
// ---------------------------------------------------------------------------

export type HostTarget = ReactAppHostTarget;

export type ReactAppHostTarget = {
  kind: 'react-app' | 'reference-app';
  mode: 'live';
  /** How live runtime artifacts are surfaced to the host. */
  runtimeMode: 'in-memory' | 'cache-dir' | 'vendored';
  /** Required when runtimeMode is 'cache-dir'. Must be inside the repo. */
  cacheDir?: string;
};

// ---------------------------------------------------------------------------
// Release targets (snapshot / transport outputs)
// ---------------------------------------------------------------------------

export type ReleaseTarget =
  | LocalDirectoryReleaseTarget
  | GitPrReleaseTarget
  | NpmRegistryReleaseTarget;

export type LocalDirectoryReleaseTarget = {
  kind: 'local-directory';
  outputMode: 'snapshot';
  /** Relative path where snapshot outputs are written. */
  outputDir: string;
};

export type GitPrReleaseTarget = {
  kind: 'git-pr';
  outputMode: 'snapshot';
  owner: string;
  repo: string;
  baseBranch: string;
  /** Relative path inside the target repo where the icon package lives. */
  packagePath?: string;
};

export type NpmRegistryReleaseTarget = {
  kind: 'npm-registry';
  outputMode: 'snapshot';
  packageName: string;
  /** Defaults to 'https://registry.npmjs.org'. */
  registry?: string;
  scope?: string;
};

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ConfigValidationError = {
  field: string;
  message: string;
};

export type ConfigValidationResult =
  | { valid: true }
  | { valid: false; errors: ConfigValidationError[] };

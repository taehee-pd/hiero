# Setup Health

**Status:** Reviewed
**Primary files:** `lib/install-config/health-checks.ts`, `packages/hiero-cli/src/commands/init.ts`, `components/studio/SetupHealthPanel.tsx`

## Overview

Setup Health splits into two surfaces by **trust boundary**, so that credential-side checks never enter the client bundle and config-shape checks can render safely in the studio.

The Hiero Self-Hosted Studio Spec Sheet defines (§C7 + §C8) a guided-setup wizard and a health dashboard. Phase 4 ships both, plus PR enrichment (§C9).

## Goals

- Developers can `npx hiero init` interactively and get a valid `hiero.config.ts`
- `hiero init --check` runs validity + credential checks without writing files
- The studio can render config-side health (validity, host targets, release targets) without leaking server-only code
- Generated PRs are review-friendly with an embedded JSON metadata block

## Non-Goals

- No automatic credential provisioning — tokens are still set by the developer in `.env.local`
- No GUI wizard inside the studio — the wizard lives in the CLI
- No remote health probes (e.g. "can we reach the npm registry?") in the first pass

## Trust boundary

```text
                         ┌─────────────────────────────┐
                         │        hiero.config.ts      │
                         │  (committed to host repo)   │
                         └────────────┬────────────────┘
                                      │
                  ┌───────────────────┼─────────────────────────────────┐
                  ▼                                                     ▼
       runConfigHealthChecks                                runHealthChecks
       (browser-safe, shape-only)                           (server-only, file system + env)
                  │                                                     │
                  ▼                                                     ▼
       SetupHealthPanel.tsx                                hiero init [--check]
       (studio UI)                                         (CLI)
                  │                                                     │
                  ▼                                                     ▼
       reports: schema, sourceDir,                         reports: config presence,
                hostTargets, releaseTargets                          .env.local gitignore status,
                                                                     GitHub token, npm credentials
```

The two functions deliberately do not share code. The browser-safe one **must not** import anything that touches `process.env` or the filesystem. CI's `scripts/check-public-bundle.ts` is the gate that enforces this — if a server-only import sneaks in, the public bundle check fails.

## Browser-safe API

```typescript
type ConfigHealthCheck = {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
};

function runConfigHealthChecks(config: unknown): ConfigHealthCheck[];
```

Reports:

- **Config schema** — runs `validateConfig` from `lib/install-config/validate-config.ts`; fail → bail with errors flattened
- **Source directory** — `cfg.sourceDir` non-empty
- **Host targets** — count > 0 (warn when empty: "`hiero dev` will not surface live updates")
- **Release targets** — count > 0 (warn when empty: "Publish has nothing to push to")

## Server-side API

```typescript
type HealthCheck = ConfigHealthCheck;

async function runHealthChecks(cwd: string): Promise<HealthCheck[]>;
```

Reports the browser-safe checks, plus:

- **`.env.local`** — if present but not in `.gitignore` → **fail** ("present but NOT in .gitignore — risk of leaking credentials")
- **GitHub token** — `process.env.HIERO_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN` → ok / warn
- **npm credentials** — `process.env.NPM_TOKEN` OR an `_authToken` line in `./.npmrc` or `~/.npmrc` → ok / warn

`hiero init --check` exits 1 if any `fail` is returned; warns are informational.

## CLI wizard

`hiero init` resolves three modes by stdin/flags:

```text
flags['check'] === true       ─── run health checks, no writes, exit code reflects outcome
flags['yes']  === true        ─── non-interactive scaffold (regression-preserving)
process.stdin.isTTY === false ─── treat as --yes (CI / pipes)
otherwise                     ─── interactive prompts
```

The interactive prompts ask, in order:

1. **Source directory** (default `'hiero'`)
2. **Release target** — `local-directory` | `git-pr` | `npm-registry`
3. **Output directory** — only when release target is `local-directory`

Templates differ by release target. None of them ever embed credentials in `hiero.config.ts`. The `git-pr` and `npm-registry` templates include a comment instructing the user to set `HIERO_GITHUB_TOKEN` or `NPM_TOKEN` in `.env.local` (and verify `.env.local` is gitignored) before running `hiero build`.

After scaffolding, `runHealthChecks` runs and prints the results to the user — typical output flags missing tokens immediately.

## Existing files are never overwritten

Any existing `hiero.config.ts`, source directory, icons subdirectory, or manifest is preserved. Re-running `hiero init` reports them as "exists" rather than "created."

## IO abstraction (testability)

```typescript
type InitIO = {
  log: (message: string) => void;
  prompt: (question: string, defaultValue?: string) => Promise<string>;
};

async function runInit(
  cwd: string,
  flags: Record<string, string | boolean>,
  io?: InitIO,
): Promise<void>;
```

Tests inject a deterministic `io` that captures logs and pre-stages prompt answers. Production constructs a TTY-backed io with `node:readline`.

## PR enrichment (related)

When `executePublishTransaction` writes a `VersionSnapshot` after a `git-pr` target succeeds, the resulting PR body — produced by `generatePrBody` — contains a `<!-- hiero:metadata:start -->` ... `<!-- hiero:metadata:end -->` JSON block keyed by `"schema": "hiero.pr.metadata/v1"`. CI bots can parse the block deterministically without reading prose. See `specs/export/publish-transaction.md` for the full payload shape.

## Test contract

- `tests/install-config-health.test.ts` — validity, hostTargets/releaseTargets warnings, all-ok happy path
- `tests/hiero-init-wizard.test.ts` — `--yes` regression (writes the same files as before), interactive sourceDir + release-target choice, `--check` exits 1 when config is missing, `.env.local` without gitignore fails health, generated config never embeds credentials (even if `HIERO_GITHUB_TOKEN` is set in env)
- `tests/pr-body-enrichment.test.ts` — metadata block always present, additive options, JSON parses out clean

## Open future work

- **Wire `SetupHealthPanel` into the studio chrome** — currently the component exists but no studio surface mounts it. P1 follow-up identified by design review.
- Backticks in panel copy render literally; switch to `<code>` tags or drop the backticks.
- Remote health probes (npm reachability, GitHub API rate-limit headroom) — best done at dev-server level so they reuse the same auth path that publish uses.

## Related specs

- `specs/schema/install-config.md` — the `hiero.config.ts` contract
- `specs/export/publish-transaction.md` — how the publish flow consumes config + credentials
- `specs/export/repo-native-distribution.md` — the broader distribution model

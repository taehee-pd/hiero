# Hiero — Deployment

**Last verified:** 2026-04-27
**Companion docs:** `CLAUDE.md` (Build channels section), `lib/build-flags.ts`,
`scripts/check-public-bundle.ts`.

This file is the deployment runbook for the Hiero web app. Update it
when materially changed.

## Topology

Hiero ships from one Git repo as **two Vercel projects**, each pinned
to a different build channel:

| Vercel project | Channel | Audience | Auth |
|---|---|---|---|
| `hiero` | `public` | End users (anyone on the internet) | Open |
| `hiero-internal` | `internal` | Maintainers dogfooding `@hiero/ui-icons` | **Vercel Access** (team-only) |

Both projects point at the same GitHub repo. Both build from `main`.
Per-project differences live in **environment variables** set in each
Vercel project's dashboard, not in `vercel.json` (which is shared).

## Why two projects, not one project with two environments

Vercel's per-environment env vars (Production / Preview / Development)
let one project deploy multiple variants — but they don't give you
two **separate domains** for the variants, and they don't let you
auth-gate one without auth-gating both. The two-project pattern keeps
the public domain open and the internal domain locked, with no shared
auth surface.

## `vercel.json` — what's in it, what isn't

The committed `vercel.json` only encodes the project-agnostic settings:

- `framework: "nextjs"` — defensive, so a misconfigured project can't
  accidentally pick a different builder.
- `installCommand: "bun install --frozen-lockfile"` — matches CI;
  fails loudly if the lockfile drifted.
- `buildCommand: "bun run build"` — matches CI.
- `outputDirectory: ".next"` — Next.js default; pinned for clarity.
- `github.silent: true` — suppresses the per-deploy comment spam on PRs
  (the Vercel Preview Comments check still runs).

Everything else — env vars, custom domains, branch deployment rules,
auth-gating — lives in **each Vercel project's dashboard** because it's
inherently per-project.

## Env vars to set per project

CI populates these for the GitHub Actions matrix build. **Vercel
deployments need them set in the dashboard** under each project's
Settings → Environment Variables. Pin to all three environments
(Production / Preview / Development) for the `BUILD_CHANNEL` so
preview deployments match production behaviour.

### `hiero` (public project)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_BUILD_CHANNEL` | `public` | Default; could be omitted. Setting explicitly is defense-in-depth. |
| `NEXT_PUBLIC_APP_VERSION` | (auto) | Vercel injects `package.json#version` if not set; CI also passes this. |
| `NEXT_PUBLIC_HIERO_UI_ICONS_VERSION` | (auto) | Read from `packages/hiero-ui-icons/package.json` by `next.config.mjs` if not set. |
| `NEXT_PUBLIC_BUILD_COMMIT` | `$VERCEL_GIT_COMMIT_SHA` | Pin to Vercel's built-in. |
| `NEXT_PUBLIC_BUILD_TIME` | (omit) | Defaults to `new Date().toISOString()` at build time. |

### `hiero-internal` (internal project)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_BUILD_CHANNEL` | `internal` | **Required** — turns on the dogfood toolbar actions and bundles `icons.json`. |
| Other vars | Same as public | Same population strategy. |

## Auth-gating the internal project

The internal project ships maintainer-only features. Lock it down via
**Vercel Access** (dashboard → Settings → Deployment Protection →
Vercel Access). Grant access only to the team. Without this, anyone
guessing the URL gets the dogfood UI plus the bundled icon source.

Vercel Access is a paid (Pro/Enterprise) feature. If unavailable,
Password Protection is a weaker alternative.

## Pre-deploy gates (CI)

`.github/workflows/web-app-ci.yml` runs **before** any Vercel deploy:

1. `validate` job — lint, type-check, format, test:phase-a coverage,
   page-registry consistency, icons-determinism gate, Storybook build.
2. `build` matrix — builds **both** `public` and `internal` channels.
3. `Bundle isolation check` (`scripts/check-public-bundle.ts`) runs on
   the `public` arm only and fails CI if any internal-data fingerprints
   appear in `.next/static/`.

A green CI is a prerequisite for either Vercel project to deploy.
Vercel's Git integration auto-deploys on push to `main` only after CI
status is favourable (configurable per project under Settings →
Git → Deploy Hooks / Ignore Build Step).

## Verifying a deployed build

Three independent ways to confirm which channel a deployed URL is
serving:

1. **HTTP header.** `curl -sI https://<domain> | grep -i hiero` should
   show:
   ```
   X-Hiero-Build-Channel: public
   X-Hiero-App-Version: 0.1.0
   X-Hiero-Build-Commit: abc1234
   ```
   Set in `next.config.mjs` `headers()`. Skipped in static-export mode.

2. **Navbar chip.** Public builds show `v0.1.0`. Internal builds show
   `internal · v0.1.0 · abc1234` in amber, plus the full version triple
   in the hover tooltip. See `components/studio/BuildBadge.tsx`.

3. **Browser console.** `window.__HIERO_BUILD__` (planned, not yet
   wired — see STATUS.md) returns the `BuildVersion` object for use by
   Playwright smoke tests + bug reports.

## Rollback

Vercel's "Promote to Production" lets you roll back to a previous
deployment without re-running CI. Both projects support this
independently — rolling back `hiero` doesn't affect `hiero-internal`
or vice versa.

For codebase-level rollback, `git revert` the offending commit on
`main`. Vercel auto-deploys the revert.

## Adding a new internal-only feature

1. Gate the dynamic import on `process.env.NEXT_PUBLIC_BUILD_CHANNEL
   === 'internal'` (a literal string the bundler can constant-fold —
   **not** the imported `IS_INTERNAL_BUILD` constant, which doesn't
   fold across module boundaries; see commit `1bbca3b`).
2. Gate the JSX render on the same literal so the menu item itself
   doesn't ship in the public bundle.
3. Add a fingerprint to `scripts/check-public-bundle.ts` for any
   distinctive string the new feature inlines (an error message, a
   data file's envelope marker). The check then enforces the boundary
   on every PR.
4. Locally: `NEXT_PUBLIC_BUILD_CHANNEL=public bun run build` followed
   by `bun scripts/check-public-bundle.ts` should exit 0. Repeat with
   `=internal` and confirm the build succeeds (the script will fail
   against the internal build — that's the control test).

## Open questions / future work

- **Single Vercel project, env-toggled deploy.** If Vercel ships a
  per-environment auth-gating feature, the two-project topology could
  collapse to one. Not currently possible.
- **Preview deploys for the internal project.** Today preview deploys
  on the public project use `=public` (matching production). If we
  want PR previews of internal-only features, the internal project
  needs PR-preview enabled with auth — paid feature.
- **`window.__HIERO_BUILD__` global.** Planned in commit 1's body but
  not yet wired. Add when the first Playwright spec or telemetry
  consumer needs it.

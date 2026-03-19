# Desktop Code Signing & Notarization

This document describes the environment variables and CI secrets required to
produce signed and notarized desktop builds. Code signing is only enabled
when `ELECTROBUN_BUILD_ENV=stable` is set. Without this variable, builds
skip signing entirely (safe for local development and CI validation).

## Required CI Secrets

### macOS

| Variable | Description |
|---|---|
| `APPLE_TEAM_ID` | Apple Developer Team ID (10-character alphanumeric) |
| `APPLE_DEVELOPER_IDENTITY` | Code-signing certificate identity, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_NOTARIZATION_APPLE_ID` | Apple ID email used for notarization submissions |
| `APPLE_NOTARIZATION_PASSWORD` | App-specific password for the Apple ID (generate at appleid.apple.com) |

### Windows

| Variable | Description |
|---|---|
| `WINDOWS_CERT_SUBJECT` | Certificate subject name for Authenticode signing |
| `WINDOWS_TIMESTAMP_SERVER` | *(Optional)* Timestamp server URL. Defaults to `https://timestamp.digicert.com` |

## Build Modes

- **Development** (`ELECTROBUN_BUILD_ENV` unset or any value other than `stable`):
  Signing is skipped. Builds target the current platform only.

- **Stable** (`ELECTROBUN_BUILD_ENV=stable`):
  All signing environment variables above are required — the build will fail
  with a clear error if any are missing. Builds target all platforms.

## Release Configuration

| Variable | Default | Description |
|---|---|---|
| `CONIVA_RELEASE_BASE_URL` | `https://updates.coniva.app/releases` | Base URL for release artifacts and `latest.json` manifest |
| `CONIVA_UPDATE_ENDPOINT` | `${CONIVA_RELEASE_BASE_URL}/latest.json` | Endpoint the desktop app polls for update checks |

## Safety Guards

The `requireSigningEnv()` function in `electrobun.config.ts` throws a
descriptive error if any required signing variable is missing during a
stable build. This prevents unsigned artifacts from accidentally being
released. The guard does **not** validate credential correctness — only
that the variables are set.

## CI Workflow

For CI validation (`desktop-ci.yml`), the desktop app is built without
`ELECTROBUN_BUILD_ENV`, so signing is skipped entirely. The stable-build
release pipeline should set `ELECTROBUN_BUILD_ENV=stable` and provide all
secrets listed above.

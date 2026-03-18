# Desktop Signing and Notarization

This document describes the release-time signing requirements for the
Electrobun desktop shell.

## When signing happens

Signing and notarization are only enabled for stable distribution builds:

- `ELECTROBUN_BUILD_ENV=stable` turns on the release signing path in
  `desktop/electrobun.config.ts`
- non-stable builds skip signing and are safe to run with local/dev
  credentials absent

If a stable build is requested without the required secrets, the build
fails fast instead of silently producing an unsigned release artifact.

## Required macOS secrets

Set these environment variables for signed macOS builds:

- `APPLE_TEAM_ID`
- `APPLE_DEVELOPER_IDENTITY`
- `APPLE_NOTARIZATION_APPLE_ID`
- `APPLE_NOTARIZATION_PASSWORD`

The config treats the developer identity as both the signing certificate
name and the macOS code-signing gate.

## Required Windows secret

Set this environment variable for signed Windows builds:

- `WINDOWS_CERT_SUBJECT`

Optional:

- `WINDOWS_TIMESTAMP_SERVER` defaults to `https://timestamp.digicert.com`

## Release flow

The desktop release script is:

```bash
bun run desktop/scripts/release.ts --version <semver> --notes "<notes>"
```

That script:

- bumps `desktop/package.json`
- rebuilds the web export
- stages the desktop mainview
- runs the desktop distribution build
- validates the generated `latest.json` manifest before writing it

## Update manifest validation

The release manifest is validated by:

```bash
bun run desktop/scripts/validate-latest-json.ts
```

Pass `--file <path>` to validate an existing manifest outside the default
`desktop/artifacts/latest.json` location.

The validator checks:

- top-level `version`, `releaseDate`, and `releaseNotes` fields
- the `platforms` map
- each platform entry's `downloadUrl` and `files` array

## Compatibility notes

- Legacy `ICOPHONE_*` environment variables still work as fallbacks
  while the new `CONIVA_*` names are preferred.
- Legacy `.icophone.json` project files remain loadable so older desktop
  files still open in the renamed shell.

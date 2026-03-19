# Desktop Release Workflow

Icon Authoring Tool desktop releases are built from the staged Next.js export plus the Electrobun wrapper.

## Release Steps

1. Choose the release version.
2. Run:

```bash
bun run desktop/scripts/release.ts --version 0.1.1 --notes "Bug fixes and desktop update support."
```

3. The script will:
   - update [`desktop/package.json`](../desktop/package.json)
   - build the static desktop webview bundle
   - run the Electrobun stable/dist build
   - generate installer/update artifacts
   - write [`desktop/artifacts/latest.json`](../desktop/artifacts/latest.json)

Electrobun also emits the native per-platform updater manifests that the built-in updater consumes:

- `stable-macos-arm64-update.json`
- `stable-win-x64-update.json`
- `stable-linux-x64-update.json`

## Hosting Update Artifacts

Recommended hosting targets:

- S3
- Cloudflare R2
- GitHub Releases

The host must serve:

- installer artifacts such as `.dmg`, `.zip`, `.deb`, `.AppImage`, or `.exe`
- Electrobun per-platform `*-update.json` manifests
- any generated `.patch` delta files
- the human-friendly `latest.json` summary manifest

Use immutable, versioned artifact URLs and HTTPS.

## Code Signing

The desktop config reads signing placeholders from environment variables in [`desktop/electrobun.config.ts`](../desktop/electrobun.config.ts).

macOS:

- `APPLE_TEAM_ID`
- `APPLE_DEVELOPER_IDENTITY`
- `APPLE_NOTARIZATION_APPLE_ID`
- `APPLE_NOTARIZATION_PASSWORD`

When those values are present, Electrobun enables code signing and notarization for macOS builds.

Windows:

- `WINDOWS_CERT_SUBJECT`
- `WINDOWS_TIMESTAMP_SERVER`

Electrobun 1.15.1 does not yet expose a full typed Authenticode configuration block, so the current config documents the intended signing metadata and timestamp server while keeping the runtime build compatible.

## Updater Notes

At runtime, the app uses Electrobun’s built-in updater API:

- `checkForUpdate()`
- `downloadUpdate()`
- `applyUpdate()`

Release notes for the in-app banner are read from the summary endpoint configured by:

- `CONIVA_UPDATE_ENDPOINT`

If unset, the desktop config defaults to:

- `https://updates.coniva.app/releases/latest.json`

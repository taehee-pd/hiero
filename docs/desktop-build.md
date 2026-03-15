# Desktop Build Pipeline

Icophone ships as two targets:

- Web: the standard Next.js app.
- Desktop: a static Next.js export packaged into Electrobun and served from `views://mainview/index.html`.

## Build Flow

The production desktop pipeline lives in [`desktop/scripts/build-production.ts`](/Users/taehee/IconStudio/desktop/scripts/build-production.ts).

1. Run the Next.js build in export mode with `NEXT_OUTPUT_MODE=export`.
2. Copy the generated `out/` directory into [`desktop/.generated/mainview`](/Users/taehee/IconStudio/desktop/.generated/mainview).
3. Inject the Electroview bootstrap script into every exported HTML file so the webview can talk to the Bun process.
4. Run the Electrobun package step.

Root commands:

- `corepack pnpm desktop:dev`
- `corepack pnpm desktop:build`
- `corepack pnpm desktop:dist`

## Static Export Notes

- Export mode is toggled in [`next.config.mjs`](/Users/taehee/IconStudio/next.config.mjs) with `NEXT_OUTPUT_MODE=export`.
- In export mode, the exported app is loaded from `views://mainview/index.html`.
- Next.js 16 does not currently accept a custom-scheme `assetPrefix` during export, so the desktop bundle uses root-relative URLs that resolve against the `views://mainview` host at runtime.
- Desktop-export navigation stays on `/editor` and passes the current icon as a query string, so the desktop build does not depend on generating arbitrary `/editor/[iconId]` files.

## Code Signing

The current Electrobun config keeps signing disabled by default in [`desktop/electrobun.config.ts`](/Users/taehee/IconStudio/desktop/electrobun.config.ts).

macOS:

- Set `build.mac.codesign` to `true`.
- Set `build.mac.notarize` to `true` once your Apple Developer notarization credentials are available.
- Add real entitlements and signing environment variables in CI before producing release artifacts.

Windows:

- Electrobun 1.15.1 does not yet expose a rich installer-signing block in its typed config.
- Plan to add certificate thumbprint or signtool integration in CI once the release packaging flow is finalized.

Linux:

- The current config includes placeholder Debian package metadata in comments/config extensions.
- Add the final package maintainer, dependency metadata, and signing flow in the release pipeline if distribution requires it.

## Update Server

The placeholder release/update endpoints live in [`desktop/electrobun.config.ts`](/Users/taehee/IconStudio/desktop/electrobun.config.ts):

- `release.baseUrl`
- `runtime.updateEndpoint`

The update server should provide:

- stable artifact downloads for each platform
- version metadata the desktop app can poll
- patch artifacts if delta updates are enabled later

Use HTTPS and immutable versioned artifact URLs for every published release.

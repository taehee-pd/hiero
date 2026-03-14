# Desktop Architecture

Icophone now targets two environments from the same product codebase:

- Web: the existing Next.js app continues to run independently for browser users and Vercel deployments.
- Desktop: an Electrobun shell wraps the same editor experience to add native capabilities such as file system access, menus, and future updater/tray integrations.

## Process Boundary

Electrobun splits the desktop app into two execution contexts:

- `desktop/src/bun/`: the Bun-powered main process. This layer owns native menus, file dialogs, direct file I/O, recent-project persistence, and any future OS integrations.
- `desktop/src/mainview/`: the webview bootstrap layer. In development it points at the Next.js dev server; in production it will eventually host the exported app bundle. This layer should stay focused on UI bootstrapping and RPC wiring.

The existing editor UI, state store, schema, and rendering logic remain in the shared web app under `app/`, `components/`, and `lib/`.

## RPC Contract Pattern

Desktop-only capabilities cross the Bun/webview boundary through a typed RPC contract in `desktop/src/shared/rpc-types.ts`.

- Bun-side `requests` define native operations the UI can call, such as `openProject`, `saveProject`, `exportSvg`, and `importSvgFiles`.
- Webview-side `messages` let the Bun process push UI events back into the editor, such as menu triggers and save notifications.
- The web app consumes these capabilities through `lib/platform/bridge.ts`, which hides the environment detection and falls back to browser file APIs when Electrobun is unavailable.

This keeps the toolbar and editor features shared across web and desktop without scattering `if (desktop)` checks through the UI code.

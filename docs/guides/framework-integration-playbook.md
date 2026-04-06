# Framework Integration Playbook

How to get Contour icons into your product — from compiled artifacts to rendering in production.

This guide helps you **choose the right integration path** and covers cross-cutting concerns (delivery, CI, versioning, platform capabilities) that the per-framework guides don't. For API details, see the framework-specific guide linked in each section.

---

## Quick decision matrix

| Your stack | Integration path | API surface | Guide |
|------------|-----------------|-------------|-------|
| React / Next.js | `<ContourIcon>` component | Full (transitions, effects, gestures, variable draw) | [React guide](./react-integration.md) |
| Vue / Nuxt | `createIcon()` driver | Full (transitions, effects, variable draw) | [Vanilla JS API](#vanilla-js--vue--angular--svelte) |
| Angular | `createIcon()` driver | Full | [Vanilla JS API](#vanilla-js--vue--angular--svelte) |
| Svelte / SvelteKit | `createIcon()` driver | Full | [Vanilla JS API](#vanilla-js--vue--angular--svelte) |
| Vanilla JS / Web Components | `createIcon()` driver | Full | [Vanilla JS API](#vanilla-js--vue--angular--svelte) |
| iOS (Swift) | Generated SwiftUI / UIKit views | Reduced (morph → crossfade, variable draw omitted) | [Swift guide](./swift-integration.md) |
| Flutter | Generated Dart widgets | Reduced (morph → crossfade, variable draw omitted) | [Flutter guide](./flutter-integration.md) |

---

## Delivery modes

Contour supports three ways to deliver compiled icons to consumer apps. Configure these in the editor's **Sync Targets** panel (Explorer → sidebar → Sync Targets → Add Target).

### Local directory

Best for monorepos and local development. Writes compiled artifacts directly to a path on disk.

```
Editor → compile → write to targetDir
```

No auth required. Manifest-based diffing removes stale files automatically.

### Git PR sync

Best for team workflows. Pushes icon source files to a GitHub repo via automated Pull Requests with conflict detection and structured PR bodies.

```
Editor → exportSourcePayload → POST /api/github-sync/pr → feature branch → PR
```

Requires a fine-grained GitHub PAT with `contents:write` + `pull_requests:write`. See [Sync Troubleshooting](../../docs_canonical/SYNC_TROUBLESHOOTING.md) for auth setup.

### npm registry

Best for versioned distribution. Publishes a complete package with compiled icons, React components, and barrel exports.

```bash
# Build locally
ICONS_PACKAGE_VERSION=1.2.3 bun run build:icons:package

# Validate
bun run validate:icons:package --package-name @contour/icons --package-version 1.2.3

# Dry-run release
bun run release:icons:dry-run --package-version 1.2.3 --package-name @contour/icons
```

CI workflow: `.github/workflows/icons-package-release.yml` — builds and validates on push to `main`, publishes on manual dispatch with `publish=true`.

---

## Platform capability matrix

Not all features are available on all platforms. The adapter codegen applies automatic fallbacks for unsupported capabilities.

| Capability | Web (React / vanilla JS) | Swift (iOS/macOS) | Flutter |
|-----------|--------------------------|-------------------|---------|
| State transitions | Animated | Animated | Animated |
| Morph interpolation | Path morph | Crossfade fallback | Crossfade fallback |
| Track transitions | CSS transitions | Snap to final | Snap to final |
| Effects (bounce, pulse, etc.) | Full | Custom spring | AnimationController |
| Gradients (linear + radial) | SVG gradients | Native gradients | Native gradients |
| Draw effects (line on/off) | strokeDasharray | strokeEnd | pathMetrics |
| Variable draw (progress fill) | 0–1 range | Not supported | Not supported |
| Clip paths | SVG clip-path | Native clip | Not supported |
| Multiple variants | By name or size | By name or size | By name or size |
| Accessibility labels | aria-label / aria-hidden | accessibilityLabel | Semantics widget |
| Reduced motion | prefers-reduced-motion | isReduceMotionEnabled | disableAnimations |

---

## Compile pipeline (consumer perspective)

The pipeline is linear and deterministic:

```
Editor project → source export → compile → adapters → package
```

### Compile from canonical source

```bash
corepack pnpm compile:from-source \
  --source <source-dir> \
  --out <out-dir> \
  --package-name @contour/icons \
  --package-version 1.0.0 \
  --generate-react
```

### Validate source export

```bash
corepack pnpm validate:source-export -- --source <source-dir>
```

### Compiled output structure

```
<out-dir>/
├── icons/
│   ├── home.compiled.json      # CompiledIcon JSON per icon
│   └── ...
├── icons.manifest.json          # Package manifest
├── src/                         # Generated React components (if --generate-react)
│   ├── IcHome.tsx
│   └── index.ts                 # Barrel export
└── package.json                 # Consumer package metadata
```

Each `.compiled.json` file follows the `CompiledIcon` schema (see `lib/compiler-contracts/types.ts`).

---

## Cross-icon transitions

If you need animation between two different icons (e.g., play → pause, bell-off → bell-on), author a **cross-icon transition** before export.

### Authoring in the editor

1. Open the source icon and navigate to the **Transition** panel.
2. Click **Add Transition** → set mode to **Cross-Icon**.
3. Configure source endpoint (icon, variant, state) and target endpoint (icon, variant, state).
4. Choose a transition strategy:
   - `strictMorph` — layer-by-layer path interpolation (requires matching topology)
   - `bestGuessMorph` — automatic layer matching with heuristic pairing
   - `track` — animate transform/opacity properties between matched layers
   - `replace` — crossfade between source and target
5. Set duration, easing, and optional direction (`automatic`, `downUp`, `upUp`, `offUp`).
6. Preview and check the compatibility badge: **Compatible**, **Best Guess**, or **Incompatible** (falls back to crossfade).
7. Save and re-export.

### Consuming in code

Cross-icon transitions are embedded in the compiled output. In product code, trigger them the same way as any state transition — the runtime resolves the authored endpoints automatically.

**React (via generated components):**
```tsx
// Import the generated wrapper — it includes the compiled icon payload
import IcPlay from '@contour/icons/icons/IcPlay';

// State change triggers the authored cross-icon transition
<IcPlay state={isPlaying ? 'pause' : 'play'} animate />
```

**Vanilla JS:**
```ts
driver.transitionTo('pause'); // Runtime resolves cross-icon endpoint
```

---

## React / Next.js

Install the published package and use the `<ContourIcon>` component.

```bash
npm install @contour/icons
```

```tsx
import { IcChevronRight } from '@contour/icons';
// Or per-icon import for tree-shaking:
import IcChevronRight from '@contour/icons/icons/IcChevronRight';
// Or by size:
import Play24 from '@contour/icons/sizes/24/IcPlay';
```

Generated components wrap `<ContourIcon>` with embedded payloads and typed prop unions for variants, states, and effects.

For **Next.js App Router**: icon components must render in client components (`'use client'`).

**Full API reference:** [React Integration Guide](./react-integration.md) — covers props, imperative handle, gesture states, animation callbacks, variable values, reduced motion, and styling.

---

## Vanilla JS / Vue / Angular / Svelte

Use `createIcon()` from the `@contour/runtime-dom` package to mount icons in any DOM container. Icon data is the `Icon` schema object — your build pipeline (or the icons package's generated TypeScript) provides it.

```ts
import { createIcon } from '@contour/runtime-dom';

// iconData is the Icon schema object, typically embedded in generated components
// or loaded from your own artifact pipeline
const container = document.getElementById('bell-icon')!;
const driver = createIcon(container, iconData, {
  initialState: 'default',
  reduceMotion: 'system',
  label: 'Notifications',
});

// State transitions
driver.transitionTo('active');

// Effects
driver.triggerEffect('bounce');
driver.cancelEffect('bounce');
driver.cancelAllEffects();

// Variable draw (0–1 progress)
driver.setVariableDrawProgress(0.75);

// Cleanup
driver.destroy();
```

### Framework integration patterns

**Vue** — call `createIcon()` in `onMounted`, `driver.destroy()` in `onUnmounted`. Use a template ref for the container.

**Angular** — call `createIcon()` in `ngAfterViewInit`, `driver.destroy()` in `ngOnDestroy`. Use `@ViewChild` for the container.

**Svelte** — call `createIcon()` in `onMount`, return `driver.destroy` as cleanup. Use `bind:this` for the container.

In all cases, call `driver.transitionTo()` or `driver.triggerEffect()` in response to your framework's state/prop changes.

---

## iOS (Swift)

Generated Swift adapter output ships as an SPM package.

```swift
import ContourIcons

// SwiftUI
ContourIcon("home", size: 24)
ContourIcon("home", state: iconState, animate: true)
ContourIcon("bell", effect: "bounce")

// UIKit
let iconView = ContourIconView(name: "home", size: 24)
iconView.setState("active", animated: true)
```

Requires iOS 16+ / macOS 13+. Some web-only features (morph, variable draw) are downgraded — see the [capability matrix](#platform-capability-matrix).

**Full API reference:** [Swift Integration Guide](./swift-integration.md)

---

## Flutter

Generated Dart adapter output ships as a pub package.

```dart
import 'package:contour_icons/contour_icons.dart';

ContourIcon(name: 'home', size: 24)
ContourIcon(name: 'home', state: _state, animate: true)
ContourIcon(name: 'bell', effect: 'bounce')
```

Requires Flutter 3.0+ / Dart 2.17+. Same capability downgrades as Swift — see the [capability matrix](#platform-capability-matrix).

**Full API reference:** [Flutter Integration Guide](./flutter-integration.md)

---

## CI integration checklist

1. **Validate source export** — `corepack pnpm validate:source-export` in PR checks
2. **Compile dry-run** — verify compiled output is deterministic and schema-valid
3. **Bundle size budget** — `bun run check:runtime-size` enforces <10KB gzipped runtime, <2KB gzipped per icon
4. **Visual regression** — snapshot key state transitions in CI (Storybook stories are auto-generated)
5. **Versioning discipline** — explicit semver via `--package-version` (no auto-version)

### CI environment variables for sync

| Variable | Default | Purpose |
|----------|---------|---------|
| `SYNC_ENABLED` | `true` | Kill switch for sync pipeline |
| `SYNC_DRY_RUN_ONLY` | `false` | Validate without creating PRs |
| `SYNC_MAX_FILES` | `500` | Payload size limit |
| `SYNC_ALLOWED_REPOS` | all | Repo allow-list |
| `SYNC_PREFLIGHT_CHECK` | `true` | Pre-sync permission verification |

---

## Troubleshooting

- **Sync/delivery errors** — [Sync Troubleshooting](../../docs_canonical/SYNC_TROUBLESHOOTING.md)
- **Architecture boundaries** — [Architecture](../../docs_canonical/ARCHITECTURE.md)
- **Build and CI commands** — [Workflows](../../docs_canonical/WORKFLOWS.md)

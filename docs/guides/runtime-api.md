# Hiero Runtime API Reference

The consumer-side API for rendering Hiero icons in a React app. This is
the reference companion to the workflow-oriented
[React integration guide](./react-integration.md); if you have never
rendered a Hiero icon before, start there.

Everything below ships in `lib/runtime-react` (exported from generated
icon libraries as the package's runtime).

---

## `<HieroIcon />`

Client component. Renders an authored icon and animates variant
transitions and effects through the DOM driver.

```tsx
import { HieroIcon, type HieroIconHandle } from '@hiero/runtime-react';

<HieroIcon
  icon={playIcon}
  variant="v24"
  size={24}
  label="Play"
  hoverState="hover"
  reduceMotion="system"
/>;
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `Icon` | required | The authored icon (from a compiled package or runtime JSON). |
| `variant` | `string \| number` | first variant | Variant id (or size) to render. Changing it animates a transition. |
| `state` | `string` | — | Controlled state id. Takes precedence over gesture states. |
| `animate` | `boolean` | `true` | Disable to snap between states without animation. |
| `effect` | `string \| null` | — | Controlled effect trigger; set to an effect id to play it. |
| `label` | `string` | — | Accessible name. Sets `role="img"` + `aria-label`; omit for decorative icons (`aria-hidden`). |
| `reduceMotion` | `boolean \| 'system'` | `'system'` | `true` skips animations, `'system'` honors `prefers-reduced-motion`. |
| `size` | `number` | variant size | Rendered size in px. |
| `color` | `string` | `currentColor` | Stroke/fill color override. |
| `hoverState` / `tapState` | `string` | — | Gesture-driven state targets (uncontrolled). |
| `onHoverStart/End`, `onTapStart/End` | `() => void` | — | Gesture callbacks. |
| `onTransitionStart/Complete` | `(from, to) => void` | — | Transition lifecycle callbacks. |
| `onEffectStart/Complete` | `(effectId) => void` | — | Effect lifecycle callbacks. |
| `onFrame` | `(progress, stateId) => void` | — | Per-frame progress (0–1). |

### Imperative handle (`ref`)

```tsx
const ref = useRef<HieroIconHandle>(null);
ref.current?.transitionTo('v32');     // animate to a variant
ref.current?.triggerEffect('draw-on'); // play a named effect
ref.current?.cancelEffect('draw-on');
ref.current?.cancelAllEffects();
```

---

## `<HieroIconServer />`

Server component (no client JS). Serializes the icon's default state to
static SVG — for RSC layouts, emails, and og-images. No animation,
gestures, or effects; use `HieroIcon` for interactive surfaces.

```tsx
import { HieroIconServer } from '@hiero/runtime-react';

<HieroIconServer icon={logo} size={32} label="Logo" />;
```

Props: `icon` (required), `size`, `label`, `className`, `style`.

---

## Hooks

### `useIconState(initialState)`

Minimal controlled-state helper:

```tsx
const { state, transitionTo } = useIconState('default');
<HieroIcon icon={icon} state={state} />;
<button onClick={() => transitionTo('active')}>Activate</button>;
```

### `useAnimationProgress(driver)`

Subscribes to per-frame progress from an `IconDriver` via
`useSyncExternalStore`. Returns
`{ progress: number; isAnimating: boolean; currentState: string }` —
use it to sync surrounding UI (progress rings, scrub bars) with icon
playback.

---

## Lower layers

| Layer | Module | Use when |
|-------|--------|----------|
| DOM driver | `lib/runtime-dom` (`createIconDriver`) | Non-React apps; imperative playback against an SVG element. |
| Core math | `lib/runtime-core` | Custom renderers; morphing/interpolation without the DOM. |
| Compiled payloads | `lib/runtime-sdk` | Rendering pre-compiled icon artifacts (`hiero build` output). |

Size budget: runtime-core targets ~10 KB gzipped; a typical per-icon
payload is ~2 KB. See
[`framework-integration-playbook.md`](./framework-integration-playbook.md)
for Swift/Flutter/Web-Component capability downgrades.

---

## Read-only sharing

Any authored icon can be shared as a `/share#…` link from the Studio
(⌘K → "Copy preview link"). The recipient's browser decodes the icon
from the URL fragment and plays variants/effects with this same runtime
— no account or server storage involved.

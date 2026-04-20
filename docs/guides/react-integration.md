# React Integration Guide

Install your published Hiero icon package and render animated, stateful icons in any React app.

This guide assumes your compiled package exposes:

- compiled icon JSON under `icons/`
- React bindings under `react/`
- the shared runtime package expected by the generated components

## Install

```bash
npm install @your-scope/icons
```

## Basic Usage

```tsx
import { HieroIcon } from '@your-scope/icons/react';
import homeIcon from '@your-scope/icons/icons/home.compiled.json';

function App() {
  return <HieroIcon icon={homeIcon} size={24} />;
}
```

If your package generator emits named wrappers instead of raw JSON imports, the generated barrel file is the preferred entrypoint.

## Accessibility

Pass `label` for a visible icon with an accessible name. Omit `label` for decorative icons (`aria-hidden` is set automatically).

```tsx
<HieroIcon icon={homeIcon} label="Home" />
<HieroIcon icon={homeIcon} /> {/* decorative, aria-hidden */}
```

## Variants & States

Icons can have multiple variants (sizes/weights) and states (default, active, hover, etc.).

```tsx
{/* Select a variant by name or size */}
<HieroIcon icon={homeIcon} variant="24px" />
<HieroIcon icon={homeIcon} variant={32} />

{/* Set the active state */}
<HieroIcon icon={homeIcon} state="active" />
```

## State Transitions (Animation)

Enable `animate` to transition between states with the icon's authored animation.

```tsx
const [isActive, setIsActive] = useState(false);

<HieroIcon
  icon={homeIcon}
  state={isActive ? 'active' : 'default'}
  animate
  onTransitionComplete={(from, to) => console.log(`${from} -> ${to}`)}
/>
```

## Gesture-Driven States

Use `hoverState` and `tapState` for automatic hover/press interactions:

```tsx
<HieroIcon
  icon={homeIcon}
  hoverState="hover"
  tapState="active"
  animate
/>
```

## Effects

Trigger named effects (bounce, shake, pulse, etc.) independently from state:

```tsx
<HieroIcon
  icon={homeIcon}
  effect="bounce"
  onEffectComplete={(id) => console.log(`effect ${id} done`)}
/>
```

## Imperative API

Use a ref for programmatic control:

```tsx
import { useRef } from 'react';
import type { HieroIconHandle } from '@your-scope/icons/react';

function App() {
  const ref = useRef<HieroIconHandle>(null);

  return (
    <>
      <HieroIcon icon={homeIcon} ref={ref} animate />
      <button onClick={() => ref.current?.transitionTo('active')}>
        Activate
      </button>
      <button onClick={() => ref.current?.triggerEffect('bounce')}>
        Bounce
      </button>
    </>
  );
}
```

### HieroIconHandle Methods

| Method | Description |
|--------|-------------|
| `transitionTo(stateId)` | Animate to a state |
| `triggerEffect(effectId)` | Play an effect animation |
| `cancelEffect(effectId)` | Cancel a running effect |
| `cancelAllEffects()` | Cancel all running effects |
| `getCurrentState()` | Get the current state ID |
| `setVariableDrawProgress(0-1)` | Set variable value (e.g. Wi-Fi signal strength) |

## Variable Value

For icons with variable rendering (like Wi-Fi signal bars):

```tsx
<HieroIcon icon={wifiIcon} variableValue={0.75} />
```

## Reduced Motion

Respects `prefers-reduced-motion` by default. Override per-icon:

```tsx
<HieroIcon icon={homeIcon} reduceMotion={false} animate />
<HieroIcon icon={homeIcon} reduceMotion="system" /> {/* default */}
```

## Animation Callbacks

```tsx
<HieroIcon
  icon={homeIcon}
  animate
  onTransitionStart={(from, to) => {}}
  onTransitionComplete={(from, to) => {}}
  onEffectStart={(effectId) => {}}
  onEffectComplete={(effectId) => {}}
  onFrame={(progress, stateId) => {}}
/>
```

## Styling

```tsx
<HieroIcon
  icon={homeIcon}
  size={32}
  color="currentColor"
  className="my-icon"
  style={{ opacity: 0.8 }}
/>
```

## Recommended Package Shape

For consumer apps, the easiest package structure is:

- `@your-scope/icons/react` for React components and types
- `@your-scope/icons/icons/*.compiled.json` for raw compiled payloads

That keeps the runtime flexible while still allowing direct low-level access when needed.

## TypeScript

All types are exported:

```tsx
import type {
  HieroIconProps,
  HieroIconHandle,
} from '@your-scope/icons/react';
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `Icon` | required | Compiled icon data |
| `variant` | `string \| number` | first | Variant to display |
| `state` | `string` | `'default'` | Active state |
| `animate` | `boolean` | `false` | Enable animated transitions |
| `effect` | `string \| null` | `null` | Trigger a named effect |
| `label` | `string` | — | Accessible label |
| `reduceMotion` | `boolean \| 'system'` | `'system'` | Motion preference |
| `size` | `number` | icon default | Render size in px |
| `color` | `string` | `'currentColor'` | Icon color |
| `hoverState` | `string` | — | State on hover |
| `tapState` | `string` | — | State on press |
| `className` | `string` | — | CSS class |
| `style` | `CSSProperties` | — | Inline styles |

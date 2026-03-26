# React Integration Guide

Install your published Coniva icon package and render animated, stateful icons in any React app.

## Install

```bash
npm install @your-scope/icons
```

## Basic Usage

```tsx
import { ConivaIcon } from '@your-scope/icons/react';
import homeIcon from '@your-scope/icons/icons/home.compiled.json';

function App() {
  return <ConivaIcon icon={homeIcon} size={24} />;
}
```

## Accessibility

Pass `label` for a visible icon with an accessible name. Omit `label` for decorative icons (`aria-hidden` is set automatically).

```tsx
<ConivaIcon icon={homeIcon} label="Home" />
<ConivaIcon icon={homeIcon} /> {/* decorative, aria-hidden */}
```

## Variants & States

Icons can have multiple variants (sizes/weights) and states (default, active, hover, etc.).

```tsx
{/* Select a variant by name or size */}
<ConivaIcon icon={homeIcon} variant="24px" />
<ConivaIcon icon={homeIcon} variant={32} />

{/* Set the active state */}
<ConivaIcon icon={homeIcon} state="active" />
```

## State Transitions (Animation)

Enable `animate` to transition between states with the icon's authored animation.

```tsx
const [isActive, setIsActive] = useState(false);

<ConivaIcon
  icon={homeIcon}
  state={isActive ? 'active' : 'default'}
  animate
  onTransitionComplete={(from, to) => console.log(`${from} -> ${to}`)}
/>
```

## Gesture-Driven States

Use `hoverState` and `tapState` for automatic hover/press interactions:

```tsx
<ConivaIcon
  icon={homeIcon}
  hoverState="hover"
  tapState="active"
  animate
/>
```

## Effects

Trigger named effects (bounce, shake, pulse, etc.) independently from state:

```tsx
<ConivaIcon
  icon={homeIcon}
  effect="bounce"
  onEffectComplete={(id) => console.log(`effect ${id} done`)}
/>
```

## Imperative API

Use a ref for programmatic control:

```tsx
import { useRef } from 'react';
import type { ConivaIconHandle } from '@your-scope/icons/react';

function App() {
  const ref = useRef<ConivaIconHandle>(null);

  return (
    <>
      <ConivaIcon icon={homeIcon} ref={ref} animate />
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

### ConivaIconHandle Methods

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
<ConivaIcon icon={wifiIcon} variableValue={0.75} />
```

## Reduced Motion

Respects `prefers-reduced-motion` by default. Override per-icon:

```tsx
<ConivaIcon icon={homeIcon} reduceMotion={false} animate />
<ConivaIcon icon={homeIcon} reduceMotion="system" /> {/* default */}
```

## Animation Callbacks

```tsx
<ConivaIcon
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
<ConivaIcon
  icon={homeIcon}
  size={32}
  color="currentColor"
  className="my-icon"
  style={{ opacity: 0.8 }}
/>
```

## TypeScript

All types are exported:

```tsx
import type {
  ConivaIconProps,
  ConivaIconHandle,
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

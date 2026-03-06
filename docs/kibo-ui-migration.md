# kibo-ui incremental migration plan

Because UI packages may be blocked in constrained environments, this project uses a swap layer under `components/kibo-ui/*`.

## How to migrate component-by-component

Use shadcn registry syntax for each component:

```bash
npx shadcn@latest add @kibo-ui/<component>
```

Examples:

```bash
npx shadcn@latest add @kibo-ui/button
npx shadcn@latest add @kibo-ui/input
npx shadcn@latest add @kibo-ui/tooltip
npx shadcn@latest add @kibo-ui/separator
npx shadcn@latest add @kibo-ui/scroll-area
npx shadcn@latest add @kibo-ui/resizable
npx shadcn@latest add @kibo-ui/gantt
```

## Current app-facing mapping

The editor and explorer import only from:

- `@/components/kibo-ui/button`
- `@/components/kibo-ui/input`
- `@/components/kibo-ui/tooltip`
- `@/components/kibo-ui/separator`
- `@/components/kibo-ui/scroll-area`
- `@/components/kibo-ui/label`
- `@/components/kibo-ui/resizable`

So each wrapper can be replaced independently without touching product screens.

## Replacement workflow

1. Add one kibo component with shadcn CLI.
2. Replace the corresponding file under `components/kibo-ui/*` with the generated implementation.
3. Run:

```bash
bun test
corepack pnpm build
```

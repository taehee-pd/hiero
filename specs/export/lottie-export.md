# Lottie Export Spec

**Phase:** M
**Module:** `lib/export/export-lottie.ts`

Converts a Coniva `Icon` + `variantId` to a
[Lottie 5.x JSON](https://lottiefiles.github.io/lottie-docs/) object
suitable for playback by `lottie-web`, dotLottie, or the native
platform Lottie runtimes.

---

## Entry Point

```ts
export function exportLottie(
  icon: Icon,
  variantId: string,
  options?: LottieExportOptions,
): LottieJson;

export type LottieExportOptions = {
  /** Frame rate. Default 60. */
  fps?: number;
  /** Morph approximation step count (default 10). */
  morphSteps?: number;
  /** Feature flag: embed lottie-web preview data URL. Default false. */
  embedPreview?: boolean;
};
```

---

## Type Mapping

### Root object (`LottieJson`)

| Lottie field | Source |
|---|---|
| `v` | `"5.12.1"` (fixed) |
| `fr` | `options.fps ?? 60` |
| `ip` | `0` |
| `op` | `Math.round(longestTransitionMs / 1000 * fr)` or `2 * fr` for static icons (must be integer) |
| `w` | `variant.viewBox[2]` |
| `h` | `variant.viewBox[3]` |
| `nm` | `icon.name` |
| `layers` | See Layer Mapping below |
| `assets` | `[]` (no external assets in v1) |

### Layer mapping

Each `Layer` in the variant's `defaultState` maps to a Lottie **shape
layer** (`ty: 4`):

```
LottieShapeLayer {
  ty: 4,
  nm: layer.id,
  ind: <index>,
  ks: {                         // Layer transform (static unless track)
    a: 0,                       // anchor (static)
    p: staticValue(x, y),
    r: staticValue(rotate ?? 0),
    s: staticValue([scaleX, scaleY] * 100),
    o: staticValue(opacity ?? 100)
  },
  shapes: [pathShape, paintShape, trimShape?]
}
```

#### Path shape (`sh`)

Convert `layer.path.d` to Lottie bezier format via
`svgDToLottieBezier(d: string): LottieBezier`.

```ts
type LottieBezier = {
  v: number[][];   // vertices   [[x,y], ...]
  i: number[][];   // in-tangents (relative)
  o: number[][];   // out-tangents (relative)
  c: boolean;      // closed
};
```

- Parse `d` using the already-normalised cubic path commands from
  `path-normalization.ts`.
- All commands must be absolute cubic (`C`) or line (`L`) after
  normalisation.
- For `M x y C c1x c1y c2x c2y ex ey`: vertex = `[ex,ey]`, in-tangent
  = `[c2x-ex, c2y-ey]`, out-tangent = `[c1x-prevX, c1y-prevY]`.
- For `Z` (close): set `c: true`.

#### Paint shapes

| Coniva `PaintRef.mode` | Lottie shape |
|---|---|
| `'currentColor'` | `fl` with color `[0,0,0,1]` (black placeholder) |
| `'fixed'` | `fl` with decoded hex → `[r,g,b,1]` |
| `'token'` | `fl` with resolved token color |
| `'linearGradient'` | `gf` Lottie gradient fill (see below) |
| `'radialGradient'` | `gf` with `t: 2` (radial) — approximated |

Lottie `gf` gradient fill:
```
{
  ty: "gf",
  g: { p: stops.length, k: { k: flattenedColorStops } },
  s: { k: [x1, y1] },   // start point (gradient angle derived)
  e: { k: [x2, y2] },   // end point
  t: 1,                  // linear
}
```

---

## Animation Mapping

### TimelineTrack → Lottie animated property

| `TimelineTrack.property` | Lottie `ks` field | Value transform |
|---|---|---|
| `opacity` | `ks.o` | `value * 100` |
| `rotate` | `ks.r` | degrees, no change |
| `translateX` | `ks.p` (x component) | merge with translateY |
| `translateY` | `ks.p` (y component) | merge with translateX |
| `scale` | `ks.s` | `[value*100, value*100]` |
| `fill` | `shapes[fill].c` | hex → `[r,g,b,1]` |
| `stroke` | `shapes[stroke].c` | hex → `[r,g,b,1]` |
| `strokeWidth` | `shapes[stroke].w` | no change |
| `fillOpacity` | `shapes[fill].o` | `value * 100` |
| `strokeOpacity` | `shapes[stroke].o` | `value * 100` |
| `trimStart` | `shapes[trim].s` | `value * 100` |
| `trimEnd` | `shapes[trim].e` | `value * 100` |
| `trimOffset` | `shapes[trim].o` | `value * 360` (degrees) |

Keyframe timing: `t = keyframeIndex * (op / (keyframes.length - 1))`.
Easing: map cubic-bezier string `"cubic-bezier(x1,y1,x2,y2)"` →
Lottie `"o": {"x":[x1],"y":[y1]}, "i": {"x":[x2],"y":[y2]}`.
Spring easing: approximate as `ease-in-out` cubic (spring params not
representable in Lottie).

### Morph → shape-path keyframes

When a `LayerBinding` uses `strictMorph` or `bestGuessMorph`:

1. Construct an interpolator closure:
   - For `strictMorph`: `const interpolate = strictMorph(fromD, toD);`
   - For `bestGuessMorph`: `const interpolate = bestGuessMorph(fromD, toD);`
     (returns `null` if paths are incompatible — fall back to crossfade).
2. Sample `interpolate(t)` at `t = [0, 1/morphSteps, 2/morphSteps, ..., 1.0]`
   where `morphSteps` defaults to 10 (controlled by `options.morphSteps`).
3. Emit each sample as a `sh` keyframe at the corresponding frame
   time.
4. Set easing handles to linear between keyframes (Lottie will
   interpolate the bezier vertices).

### Trim path

Emit a Lottie `tm` (trim path) modifier in the shape group:
```
{ ty: "tm", s: {...}, e: {...}, o: {...}, m: 1 | 2 }
```
`m: 1` = `simultaneously`, `m: 2` = `individually`.

---

## Downgrade Rules (Lottie)

| Coniva feature | Lottie behaviour | Diagnostic |
|---|---|---|
| `variableValue` | Emitted as static opacity at `value=0.5` | `warn: variableValue-not-representable` |
| `spring` easing | Approximated as `ease-in-out` (0.42,0,0.58,1) | `info: spring-easing-approximated` |
| `radialGradient` | Emitted with `t:2` (may not render on all players) | `info: radial-gradient-limited-support` |
| `crossfade` strategy | Emitted as opacity crossfade (no path morph) | `info: crossfade-strategy-used` |
| `bestGuessMorph` + mismatched count | Crossfade fallback | `warn: morph-fallback-crossfade` |
| Weight interpolation | Emitted at `regular` weight only | `warn: weight-interpolation-not-representable` |

---

## Files

| File | Purpose |
|---|---|
| `lib/export/export-lottie.ts` | Main exporter |
| `lib/export/lottie-types.ts` | TypeScript types for Lottie 5.x JSON |
| `tests/lottie-export.test.ts` | Snapshot + determinism tests |

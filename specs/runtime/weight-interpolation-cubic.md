# Cubic Weight Interpolation Spec

**Phase:** O
**Module:** `lib/runtime-core/weight-interpolation.ts`

Upgrades `interpolateWeight()` from piecewise linear (3-point, kink at
regular=400) to Fritsch-Carlson cubic monotone spline interpolation
supporting up to 9 control points.

---

## Motivation

The current linear implementation produces a slope discontinuity at the
`regular` (400) control point: paths interpolated at weight 390 and 410
move at different speeds, making weight transitions look mechanical.
Cubic monotone interpolation removes this artefact while guaranteeing
no overshoot (monotone constraint) — important so letter forms don't
"invert" stroke width at intermediate weights.

---

## Algorithm: Fritsch-Carlson Monotone Cubic

Given N sorted control points `(x_i, y_i)` where `x` = weight numeric
(100–900) and `y` = a single coordinate value:

### Step 1 — Compute secants

```
d_i = (y_{i+1} - y_i) / (x_{i+1} - x_i)   for i = 0..N-2
```

### Step 2 — Compute tangents at each interior point

```
m_0 = d_0
m_{N-1} = d_{N-2}
m_i = (d_{i-1} + d_i) / 2   for i = 1..N-2
```

### Step 3 — Enforce monotone constraint

For each segment `[i, i+1]` where `d_i = 0`: set `m_i = m_{i+1} = 0`.
Otherwise compute `α_i = m_i / d_i`, `β_i = m_{i+1} / d_i`.
If `α² + β² > 9`, scale: `τ = 3 / sqrt(α² + β²)`,
`m_i = τ * m_i`, `m_{i+1} = τ * m_{i+1}`.

### Step 4 — Hermite interpolation

For target `x` in segment `[x_i, x_{i+1}]`:
```
h = x_{i+1} - x_i
t = (x - x_i) / h
y = (2t³ - 3t² + 1) * y_i
  + (t³ - 2t² + t) * h * m_i
  + (-2t³ + 3t²) * y_{i+1}
  + (t³ - t²) * h * m_{i+1}
```

---

## Updated API

### `WeightControlPoints` (extended)

```ts
export type WeightControlPoints = {
  ultralight?: string;
  thin?: string;
  light?: string;
  regular?: string;   // was required; now optional (but recommended)
  medium?: string;
  semibold?: string;
  bold?: string;
  heavy?: string;
  black?: string;
};
```

Minimum 2 control points required (any two weights).

### `validateWeightControlPoints()`

```ts
export function validateWeightControlPoints(
  cps: WeightControlPoints,
): { valid: boolean; reason?: string; populatedWeights: SymbolWeight[] }
```

- `valid: false` if fewer than 2 control points are populated.
- `valid: false` if any two populated paths have mismatched command
  signatures (same check as before, now over all populated paths).
- `populatedWeights`: sorted list of populated weight names.

### `interpolateWeight()` (upgraded)

```ts
export function interpolateWeight(
  controlPoints: WeightControlPoints,
  targetWeight: SymbolWeight | number,
): string | null
```

Behaviour unchanged from the caller's perspective. Internally:
1. Extract populated `(numericWeight, pathCommands)` pairs, sorted by
   weight.
2. For each coordinate index across all commands, build a cubic
   monotone spline from the control-point values.
3. Evaluate the spline at `targetWeight` to get the interpolated
   coordinate.
4. Reconstruct the SVG `d` string from interpolated commands.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| 2 control points | Falls back to linear (cubic needs ≥3 to add value; degenerate case) |
| Target equals a control-point weight | Returns exact control-point path (no floating-point error) |
| Target outside `[minWeight, maxWeight]` | Clamps to nearest endpoint (same as before) |
| Non-monotone values (stroke widens then narrows) | Cubic respects the shape; monotone constraint avoids wild oscillation |

---

## Schema change — `Variant.weightControlPoints`

Update in `lib/schema/types.ts`:

```ts
weightControlPoints?: {
  ultralight?: string;
  thin?: string;
  light?: string;
  regular?: string;
  medium?: string;
  semibold?: string;
  bold?: string;
  heavy?: string;
  black?: string;
};
```

Backward-compatible: existing 3-point records (`ultralight`,
`regular`, `black` all present) continue to work.

---

## Files

| File | Purpose |
|---|---|
| `lib/runtime-core/weight-interpolation.ts` | Algorithm upgrade |
| `lib/schema/types.ts` | `weightControlPoints` type expansion |
| `components/editor/InspectorPanel.tsx` | Multi-slot weight editor (O4) |
| `tests/weight-interpolation-cubic.test.ts` | Correctness tests |

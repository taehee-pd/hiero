/**
 * Linear RGB color interpolation.
 *
 * Colors are parsed from hex, linearized (undo sRGB gamma), interpolated in
 * linear space, then gamma-encoded back to sRGB hex. This produces perceptually
 * smoother transitions than naive sRGB interpolation.
 */

type RGB = [number, number, number];

/**
 * Parse a hex color string to sRGB [0-255] components.
 * Supports #RGB, #RRGGBB, and #RRGGBBAA (alpha is ignored).
 */
export function parseHex(hex: string): RGB | null {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0], 16);
    const g = parseInt(h[1]! + h[1], 16);
    const b = parseInt(h[2]! + h[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

/** Format [0-255] RGB to hex string. */
export function formatHex(rgb: RGB): string {
  const r = Math.round(clamp(rgb[0], 0, 255)).toString(16).padStart(2, '0');
  const g = Math.round(clamp(rgb[1], 0, 255)).toString(16).padStart(2, '0');
  const b = Math.round(clamp(rgb[2], 0, 255)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Interpolate two hex colors in linear RGB space.
 * Returns a hex color string at progress t (0-1).
 */
export function lerpLinearRGB(colorA: string, colorB: string, t: number): string {
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  if (!a || !b) return t < 0.5 ? colorA : colorB;

  // sRGB → linear (approximate gamma 2.2)
  const la = srgbToLinear(a);
  const lb = srgbToLinear(b);

  // Lerp in linear space
  const lerped: RGB = [
    la[0] + (lb[0] - la[0]) * t,
    la[1] + (lb[1] - la[1]) * t,
    la[2] + (lb[2] - la[2]) * t,
  ];

  // Linear → sRGB
  return formatHex(linearToSrgb(lerped));
}

/**
 * Interpolate through a palette of hex colors at progress t (0-1).
 * Colors are evenly spaced. Returns a hex color string.
 */
export function lerpPalette(palette: string[], t: number): string {
  if (palette.length === 0) return '#000000';
  if (palette.length === 1) return palette[0]!;

  const clamped = clamp(t, 0, 1);
  const scaled = clamped * (palette.length - 1);
  const index = Math.min(Math.floor(scaled), palette.length - 2);
  const localT = scaled - index;
  return lerpLinearRGB(palette[index]!, palette[index + 1]!, localT);
}

// --- Internal ---

function srgbToLinear(rgb: RGB): RGB {
  return [
    Math.pow(rgb[0] / 255, 2.2),
    Math.pow(rgb[1] / 255, 2.2),
    Math.pow(rgb[2] / 255, 2.2),
  ];
}

function linearToSrgb(linear: RGB): RGB {
  return [
    Math.pow(linear[0], 1 / 2.2) * 255,
    Math.pow(linear[1], 1 / 2.2) * 255,
    Math.pow(linear[2], 1 / 2.2) * 255,
  ];
}

function clamp(value: number, min: number, max: number): number {
  if (value <= min) return min;
  if (value >= max) return max;
  return value;
}

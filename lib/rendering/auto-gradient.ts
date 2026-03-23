// ── Auto-Gradient Rendering Mode ──────────────────────────────────────
// Generates SF Symbols 7-style subtle gradients from a single source color.
// This is a modifier layer on top of existing RenderingModes — it does NOT
// extend the RenderingMode union, so existing switch statements stay intact.

export type GradientStop = {
  offset: number;
  color: string;
  opacity: number;
};

// ── Color space helpers ───────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  let r: number;
  let g: number;
  let b: number;

  if (h.length === 3) {
    r = parseInt(h[0]! + h[0]!, 16);
    g = parseInt(h[1]! + h[1]!, 16);
    b = parseInt(h[2]! + h[2]!, 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }

  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;

  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }

  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Lighten a hex color by adjusting HSL lightness upward.
 * @param hex   Hex color string (e.g. '#3b82f6')
 * @param amount  Fraction to lighten (0–1, e.g. 0.2 = 20%)
 */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = Math.min(1, l + amount);
  const rgb = hslToRgb(h, s, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Darken a hex color by adjusting HSL lightness downward.
 * @param hex   Hex color string (e.g. '#3b82f6')
 * @param amount  Fraction to darken (0–1, e.g. 0.2 = 20%)
 */
function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = Math.max(0, l - amount);
  const rgb = hslToRgb(h, s, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate gradient stops from a single source color.
 * Creates a subtle light-to-dark gradient matching SF Symbols 7 style.
 *
 * @param sourceColor - hex color string (e.g., '#3b82f6')
 * @param steps       - number of gradient stops (default 3)
 * @returns Array of gradient stops from lighter to darker
 */
export function generateAutoGradient(
  sourceColor: string,
  steps: number = 3,
): GradientStop[] {
  if (steps < 2) {
    return [{ offset: 0, color: sourceColor, opacity: 1 }];
  }

  if (steps === 2) {
    return [
      { offset: 0, color: lighten(sourceColor, 0.2), opacity: 1 },
      { offset: 1, color: darken(sourceColor, 0.2), opacity: 1 },
    ];
  }

  // Default 3-stop gradient: lighten → original → darken
  const stops: GradientStop[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0 … 1
    let color: string;

    if (t < 0.5) {
      // Blend from lightened toward original
      const blend = t * 2; // 0 at start, 1 at midpoint
      color = blend === 1
        ? sourceColor
        : lighten(sourceColor, 0.2 * (1 - blend));
    } else {
      // Blend from original toward darkened
      const blend = (t - 0.5) * 2; // 0 at midpoint, 1 at end
      color = blend === 0
        ? sourceColor
        : darken(sourceColor, 0.2 * blend);
    }

    stops.push({ offset: t, color, opacity: 1 });
  }

  return stops;
}

/**
 * Apply auto-gradient to a resolved layer style.
 * Replaces solid fills with linear gradient fills.
 *
 * @param fillColor - hex color string for the solid fill
 * @param angle     - gradient angle in degrees (default 180 = top-to-bottom)
 * @returns Gradient specification with stops and angle
 */
export function applyAutoGradient(
  fillColor: string,
  angle: number = 180,
): { stops: GradientStop[]; angle: number } {
  return {
    stops: generateAutoGradient(fillColor),
    angle,
  };
}

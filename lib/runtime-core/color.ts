type ParsedColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export function interpolateColor(from: string, to: string, t: number): string {
  const start = parseHexColor(from);
  const end = parseHexColor(to);
  if (!start || !end) {
    return t < 0.5 ? from : to;
  }

  const progress = clamp01(t);
  const red = lerp(start.red, end.red, progress);
  const green = lerp(start.green, end.green, progress);
  const blue = lerp(start.blue, end.blue, progress);
  const alpha = lerp(start.alpha, end.alpha, progress);

  if (Math.abs(alpha - 1) < 1e-4) {
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}${toHex(alpha * 255)}`;
}

export function parseHexColor(value: string): ParsedColor | null {
  const hex = value.trim();
  if (!hex.startsWith('#')) {
    return null;
  }

  const body = hex.slice(1);
  if (body.length === 3) {
    return {
      red: Number.parseInt(body[0]!.repeat(2), 16),
      green: Number.parseInt(body[1]!.repeat(2), 16),
      blue: Number.parseInt(body[2]!.repeat(2), 16),
      alpha: 1,
    };
  }

  if (body.length === 6 || body.length === 8) {
    const red = Number.parseInt(body.slice(0, 2), 16);
    const green = Number.parseInt(body.slice(2, 4), 16);
    const blue = Number.parseInt(body.slice(4, 6), 16);
    const alpha =
      body.length === 8 ? Number.parseInt(body.slice(6, 8), 16) / 255 : 1;

    if (![red, green, blue, alpha].every(Number.isFinite)) {
      return null;
    }

    return { red, green, blue, alpha };
  }

  return null;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

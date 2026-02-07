// Coordinate, color, and font conversion helpers for PptxGenJS export.
// Canvas: 1920×1080 px → LAYOUT_WIDE: 13.3" × 7.5"

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const SLIDE_W = 13.3;
const SLIDE_H = 7.5;

/** Convert layout px to PowerPoint inches (x-axis). */
export function pxToInchesX(px: number): number {
  return (px / CANVAS_W) * SLIDE_W;
}

/** Convert layout px to PowerPoint inches (y-axis). */
export function pxToInchesY(px: number): number {
  return (px / CANVAS_H) * SLIDE_H;
}

/** Convert layout px dimensions to { x, y, w, h } in inches. */
export function rectToInches(rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  return {
    x: pxToInchesX(rect.x),
    y: pxToInchesY(rect.y),
    w: pxToInchesX(rect.w),
    h: pxToInchesY(rect.h),
  };
}

/** Convert layout px font size to PowerPoint points. */
export function pxToPoints(px: number): number {
  return px * (SLIDE_W / CANVAS_W) * 72;
}

/** Convert borderRadius in px to inches. */
export function radiusToInches(px: number): number {
  return pxToInchesX(px);
}

/**
 * Parse any CSS color string to 6-char uppercase hex WITHOUT '#'.
 * Handles: #RGB, #RRGGBB, rgb(r,g,b), rgba(r,g,b,a), named colors (limited).
 * Returns "000000" as fallback.
 */
export function hexColor(color: string): string {
  if (!color) return "000000";

  const s = color.trim();

  // #RRGGBB or #RGB
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 6) return hex.toUpperCase();
    if (hex.length === 3) {
      return (hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]).toUpperCase();
    }
    // 8-char hex (#RRGGBBAA) — strip alpha
    if (hex.length === 8) return hex.slice(0, 6).toUpperCase();
    return "000000";
  }

  // rgb(r,g,b) or rgba(r,g,b,a)
  const rgbaMatch = s.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/,
  );
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1])));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2])));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3])));
    return (
      r.toString(16).padStart(2, "0") +
      g.toString(16).padStart(2, "0") +
      b.toString(16).padStart(2, "0")
    ).toUpperCase();
  }

  // Common named colors
  const named: Record<string, string> = {
    white: "FFFFFF",
    black: "000000",
    red: "FF0000",
    green: "008000",
    blue: "0000FF",
    transparent: "000000",
  };
  if (named[s.toLowerCase()]) return named[s.toLowerCase()];

  return "000000";
}

/**
 * Extract transparency percentage (0-100) from rgba colors.
 * PptxGenJS uses transparency where 0 = fully opaque, 100 = fully transparent.
 * Returns undefined for fully opaque colors.
 */
export function colorAlpha(color: string): number | undefined {
  if (!color) return undefined;

  const s = color.trim();

  // rgba(r,g,b,a)
  const rgbaMatch = s.match(
    /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/,
  );
  if (rgbaMatch) {
    const alpha = parseFloat(rgbaMatch[1]);
    if (alpha >= 1) return undefined; // fully opaque
    if (alpha <= 0) return 100; // fully transparent
    return Math.round((1 - alpha) * 100);
  }

  // "transparent" keyword
  if (s.toLowerCase() === "transparent") return 100;

  return undefined;
}

/**
 * Extract the first font family name from a CSS font-family string.
 * "Inter, system-ui, sans-serif" → "Inter"
 * "'Playfair Display', Georgia, serif" → "Playfair Display"
 */
export function parseFontFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0].trim();
  // Strip quotes
  return first.replace(/^['"]|['"]$/g, "");
}

/** Map fontWeight number to PptxGenJS bold boolean. */
export function isBold(weight: number): boolean {
  return weight >= 600;
}

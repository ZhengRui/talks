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
 * Split a CSS value on top-level commas (not inside parentheses).
 * "radial-gradient(...), #080808" → ["radial-gradient(...)", "#080808"]
 */
function splitTopLevel(css: string): string[] {
  let depth = 0;
  const segments: string[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") depth--;
    else if (css[i] === "," && depth === 0) {
      segments.push(css.slice(start, i).trim());
      start = i + 1;
    }
  }
  segments.push(css.slice(start).trim());
  return segments;
}

/**
 * Extract a solid fallback color from a CSS background that may contain gradients.
 * "radial-gradient(...), radial-gradient(...), #080808" → "#080808"
 * "#ff0000" → "#ff0000" (pass through)
 */
export function extractSolidColor(css: string): string {
  if (!css || !css.includes("gradient(")) return css;
  const segments = splitTopLevel(css);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (!segments[i].includes("gradient(")) return segments[i];
  }
  return "";
}

/** Parsed CSS gradient layer from a background string. */
export interface ParsedCssGradient {
  type: "radial" | "linear";
  centerX?: number; // 0-100, for radial (e.g. "at 20% 80%" → 20)
  centerY?: number; // 0-100, for radial
  angle?: number;   // CSS degrees, for linear
  stops: { color: string; position: number }[]; // position 0-1
}

/**
 * Parse CSS gradient layers from a background value.
 * Returns only gradient layers (not the solid fallback).
 */
export function parseCssGradients(css: string): ParsedCssGradient[] {
  if (!css || !css.includes("gradient(")) return [];
  const segments = splitTopLevel(css);
  const results: ParsedCssGradient[] = [];

  for (const seg of segments) {
    if (seg.startsWith("radial-gradient(")) {
      const inner = seg.slice("radial-gradient(".length, -1);
      // Parse "at X% Y%, color1 pos1, color2 pos2, ..."
      const parts = splitTopLevel(inner);
      let centerX = 50, centerY = 50;
      let stopStart = 0;
      // Check if first part has "at X% Y%"
      const atMatch = parts[0]?.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) {
        centerX = parseFloat(atMatch[1]);
        centerY = parseFloat(atMatch[2]);
        stopStart = 1;
      }
      const stops: { color: string; position: number }[] = [];
      for (let i = stopStart; i < parts.length; i++) {
        const m = parts[i].match(/^(.+?)\s+([\d.]+)%$/);
        if (m) {
          stops.push({ color: m[1].trim(), position: parseFloat(m[2]) / 100 });
        }
      }
      if (stops.length >= 2) {
        results.push({ type: "radial", centerX, centerY, stops });
      }
    } else if (seg.startsWith("linear-gradient(")) {
      const inner = seg.slice("linear-gradient(".length, -1);
      const parts = splitTopLevel(inner);
      let angle = 180; // default: top-to-bottom
      let stopStart = 0;
      const angleMatch = parts[0]?.match(/^([\d.]+)deg$/);
      if (angleMatch) {
        angle = parseFloat(angleMatch[1]);
        stopStart = 1;
      }
      const stops: { color: string; position: number }[] = [];
      for (let i = stopStart; i < parts.length; i++) {
        const m = parts[i].match(/^(.+?)\s+([\d.]+)%$/);
        if (m) {
          stops.push({ color: m[1].trim(), position: parseFloat(m[2]) / 100 });
        }
      }
      if (stops.length >= 2) {
        results.push({ type: "linear", angle, stops });
      }
    }
  }
  return results;
}

/**
 * Parse any CSS color string to 6-char uppercase hex WITHOUT '#'.
 * Handles: #RGB, #RRGGBB, rgb(r,g,b), rgba(r,g,b,a), named colors (limited).
 * Also handles CSS gradient stacks by extracting the solid fallback color.
 * Returns "000000" as fallback.
 */
export function hexColor(color: string): string {
  if (!color) return "000000";

  // Extract solid color from gradient stacks
  const s = extractSolidColor(color).trim();
  if (!s) return "000000";

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

  // #RRGGBBAA (8-digit hex)
  if (s.startsWith("#") && s.length === 9) {
    const aa = parseInt(s.slice(7, 9), 16);
    if (aa >= 255) return undefined; // fully opaque
    if (aa <= 0) return 100; // fully transparent
    return Math.round((1 - aa / 255) * 100);
  }

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

// Map web fonts to closest PowerPoint-safe equivalents.
const PPTX_FONT_FALLBACK: Record<string, string> = {
  "Archivo Black": "Arial Black",
  "Cormorant": "Garamond",
  "Cormorant Garamond": "Garamond",
  "Bodoni Moda": "Bodoni MT",
  "Fraunces": "Georgia",
  "Playfair Display": "Georgia",
  "Plus Jakarta Sans": "Calibri",
  "Outfit": "Calibri",
  "Manrope": "Calibri",
  "DM Sans": "Calibri",
  "IBM Plex Sans": "Calibri",
  "Work Sans": "Calibri",
  "Space Grotesk": "Calibri",
  "Syne": "Arial",
  "Archivo": "Arial",
  "Nunito": "Calibri",
  "Source Serif 4": "Georgia",
  "Space Mono": "Consolas",
  "JetBrains Mono": "Consolas",
  "Inter": "Calibri",
};

/**
 * Extract the first font family name from a CSS font-family string,
 * then map to closest PowerPoint-safe equivalent.
 * "Inter, system-ui, sans-serif" → "Calibri"
 * "'Playfair Display', Georgia, serif" → "Georgia"
 */
export function parseFontFamily(fontFamily: string | undefined): string {
  if (!fontFamily) return "Calibri";
  const first = fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return PPTX_FONT_FALLBACK[first] ?? first;
}

/** Map fontWeight number to PptxGenJS bold boolean. */
export function isBold(weight: number): boolean {
  return weight >= 600;
}

import type { ResolvedTheme } from "../types";

function colorWithAlpha(color: string, alpha: number): string | undefined {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return undefined;

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1];
    const expanded = value.length === 3
      ? value.split("").map((ch) => ch + ch).join("")
      : value;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return undefined;
}

function resolveThemePath(
  value: string,
  theme: ResolvedTheme,
): unknown | undefined {
  const alphaMatch = value.match(/^(theme\.[A-Za-z0-9_.]+)@([0-9]*\.?[0-9]+)$/);
  const pathValue = alphaMatch ? alphaMatch[1] : value;
  const alpha = alphaMatch ? Number(alphaMatch[2]) : undefined;

  const path = pathValue.slice(6);
  let resolved: unknown = theme;
  for (const key of path.split(".")) {
    if (resolved && typeof resolved === "object") {
      resolved = (resolved as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  if (alpha == null) return resolved;
  if (typeof resolved !== "string") return undefined;
  return colorWithAlpha(resolved, alpha);
}

/**
 * Resolve a "theme.*" token string to a concrete value from the theme.
 * Returns the original string unchanged if it's not a theme reference.
 *
 * Examples:
 *   "theme.accent"       → "#4f6df5"
 *   "theme.bgSecondary"  → "#f5f5f5"
 *   "theme.border.color" → "#e2e0dc" (dot-path)
 *   "#1a1714"            → "#1a1714" (passthrough)
 */
export function resolveThemeToken(
  value: string | undefined,
  theme: ResolvedTheme,
): string | undefined {
  if (!value) return value;
  if (!value.startsWith("theme.")) return value;

  const resolved = resolveThemePath(value, theme);

  if (typeof resolved === "string") return resolved;
  if (typeof resolved === "number") return String(resolved);

  // For non-string theme values (objects like shadow, gradient, etc.), return undefined
  return undefined;
}

/**
 * Resolve a "theme.*" token to any value (string, number, or object).
 * Used by raw element token resolution where border/shadow are objects.
 * Returns undefined if the path doesn't exist in the theme.
 */
export function resolveThemeTokenAny(
  value: string,
  theme: ResolvedTheme,
): unknown | undefined {
  if (!value.startsWith("theme.")) return undefined;
  return resolveThemePath(value, theme);
}

/**
 * Resolve a color value that could be a theme token or a hardcoded hex/rgba.
 * Falls back to the provided default if resolution fails.
 */
export function resolveColor(
  value: string | undefined,
  theme: ResolvedTheme,
  fallback: string,
): string {
  return resolveThemeToken(value, theme) ?? fallback;
}

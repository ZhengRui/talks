import type { ResolvedTheme } from "../types";

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

  const path = value.slice(6); // strip "theme."
  let resolved: unknown = theme;
  for (const key of path.split(".")) {
    if (resolved && typeof resolved === "object") {
      resolved = (resolved as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

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

  const path = value.slice(6);
  let resolved: unknown = theme;
  for (const key of path.split(".")) {
    if (resolved && typeof resolved === "object") {
      resolved = (resolved as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return resolved;
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

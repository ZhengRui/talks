import type { ResolvedTheme } from "../types";

/**
 * Resolve a "theme.*" token string to a concrete value from the theme.
 * Returns the original string unchanged if it's not a theme reference.
 *
 * Examples:
 *   "theme.accent"      → "#4f6df5"
 *   "theme.bgSecondary"  → "#f5f5f5"
 *   "#1a1714"           → "#1a1714" (passthrough)
 */
export function resolveThemeToken(
  value: string | undefined,
  theme: ResolvedTheme,
): string | undefined {
  if (!value) return value;
  if (!value.startsWith("theme.")) return value;

  const key = value.slice(6); // strip "theme."
  const resolved = (theme as unknown as Record<string, unknown>)[key];

  if (typeof resolved === "string") return resolved;

  // For non-string theme values (objects like shadow, gradient, etc.), return undefined
  return undefined;
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

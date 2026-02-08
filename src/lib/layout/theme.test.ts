import { describe, it, expect } from "vitest";
import { THEMES, resolveTheme } from "./theme";
import type { ResolvedTheme } from "./types";

const EXPECTED_KEYS: (keyof ResolvedTheme)[] = [
  "bg", "bgSecondary", "bgTertiary",
  "text", "textMuted", "heading",
  "accent", "accent2", "accentGradient",
  "fontHeading", "fontBody", "fontMono",
  "radius", "radiusSm",
  "shadow", "shadowLg",
  "border",
  "cardBg", "cardBorder",
  "codeBg", "codeText",
  "overlayBg", "progressBg",
  "highlightInfoBg", "highlightInfoBorder",
  "highlightWarningBg", "highlightWarningBorder",
  "highlightSuccessBg", "highlightSuccessBorder",
];

describe("THEMES", () => {
  const themeNames = Object.keys(THEMES);

  it("has 16 themes", () => {
    expect(themeNames).toHaveLength(16);
  });

  it.each(themeNames)("%s has all required fields", (name) => {
    const theme = THEMES[name as keyof typeof THEMES];
    for (const key of EXPECTED_KEYS) {
      expect(theme[key], `${name}.${key}`).toBeDefined();
    }
  });

  it.each(themeNames)("%s has valid gradient", (name) => {
    const theme = THEMES[name as keyof typeof THEMES];
    expect(theme.accentGradient.type).toBe("linear");
    expect(theme.accentGradient.stops).toHaveLength(2);
  });
});

describe("resolveTheme", () => {
  it("defaults to modern", () => {
    expect(resolveTheme()).toBe(THEMES.modern);
    expect(resolveTheme(undefined)).toBe(THEMES.modern);
  });

  it("resolves all theme names", () => {
    for (const name of Object.keys(THEMES)) {
      expect(resolveTheme(name as keyof typeof THEMES)).toBe(
        THEMES[name as keyof typeof THEMES],
      );
    }
  });
});

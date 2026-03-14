import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";
import { resolveColor, resolveThemeToken } from "./theme-tokens";

const theme = resolveTheme("modern");

describe("resolveThemeToken", () => {
  it("resolves theme.accent to a concrete value", () => {
    expect(resolveThemeToken("theme.accent", theme)).toBe(theme.accent);
  });

  it("resolves dot-path values", () => {
    expect(resolveThemeToken("theme.border.color", theme)).toBe(theme.border.color);
  });

  it("supports alpha suffixes", () => {
    expect(resolveThemeToken("theme.accent@0.13", theme)).toBe("rgba(79, 109, 245, 0.13)");
  });

  it("returns undefined for non-string theme values", () => {
    expect(resolveThemeToken("theme.shadow", theme)).toBeUndefined();
  });
});

describe("resolveColor", () => {
  it("resolves theme-backed colors", () => {
    expect(resolveColor("theme.accent", theme, "#000")).toBe(theme.accent);
  });

  it("falls back when the token is missing or non-color", () => {
    expect(resolveColor(undefined, theme, "#fff")).toBe("#fff");
    expect(resolveColor("theme.shadow", theme, "#fff")).toBe("#fff");
  });

  it("passes through hard-coded colors", () => {
    expect(resolveColor("#abc123", theme, "#000")).toBe("#abc123");
  });
});

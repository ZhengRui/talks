import { describe, it, expect } from "vitest";
import {
  pxToInchesX,
  pxToInchesY,
  rectToInches,
  pxToPoints,
  radiusToInches,
  hexColor,
  colorAlpha,
  parseFontFamily,
  isBold,
} from "./pptx-helpers";

describe("pxToInchesX", () => {
  it("converts 0 to 0", () => {
    expect(pxToInchesX(0)).toBe(0);
  });

  it("converts full canvas width to slide width", () => {
    expect(pxToInchesX(1920)).toBe(13.3);
  });

  it("converts half canvas width", () => {
    expect(pxToInchesX(960)).toBeCloseTo(6.65);
  });
});

describe("pxToInchesY", () => {
  it("converts full canvas height to slide height", () => {
    expect(pxToInchesY(1080)).toBe(7.5);
  });
});

describe("rectToInches", () => {
  it("converts all rect fields", () => {
    const r = rectToInches({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(r).toEqual({ x: 0, y: 0, w: 13.3, h: 7.5 });
  });
});

describe("pxToPoints", () => {
  it("converts px to points (≈ px × 0.5)", () => {
    // 80px → ~40pt
    const pt = pxToPoints(80);
    expect(pt).toBeCloseTo(39.9, 0);
  });

  it("converts 0 to 0", () => {
    expect(pxToPoints(0)).toBe(0);
  });
});

describe("radiusToInches", () => {
  it("delegates to pxToInchesX", () => {
    expect(radiusToInches(1920)).toBe(13.3);
  });
});

describe("hexColor", () => {
  it("strips # from 6-char hex", () => {
    expect(hexColor("#4f6df5")).toBe("4F6DF5");
  });

  it("expands 3-char hex", () => {
    expect(hexColor("#abc")).toBe("AABBCC");
  });

  it("strips alpha from 8-char hex", () => {
    expect(hexColor("#4f6df5cc")).toBe("4F6DF5");
  });

  it("parses rgb()", () => {
    expect(hexColor("rgb(255, 128, 0)")).toBe("FF8000");
  });

  it("parses rgba() stripping alpha", () => {
    expect(hexColor("rgba(255, 255, 255, 0.85)")).toBe("FFFFFF");
  });

  it("handles named colors", () => {
    expect(hexColor("white")).toBe("FFFFFF");
    expect(hexColor("black")).toBe("000000");
  });

  it("returns 000000 for empty string", () => {
    expect(hexColor("")).toBe("000000");
  });

  it("returns 000000 for unknown values", () => {
    expect(hexColor("not-a-color")).toBe("000000");
  });
});

describe("colorAlpha", () => {
  it("returns undefined for fully opaque colors", () => {
    expect(colorAlpha("#4f6df5")).toBeUndefined();
    expect(colorAlpha("rgba(0,0,0,1)")).toBeUndefined();
  });

  it("extracts transparency from rgba", () => {
    // alpha 0.85 → transparency 15
    expect(colorAlpha("rgba(255,255,255,0.85)")).toBe(15);
  });

  it("returns 100 for fully transparent", () => {
    expect(colorAlpha("rgba(0,0,0,0)")).toBe(100);
    expect(colorAlpha("transparent")).toBe(100);
  });

  it("returns undefined for empty string", () => {
    expect(colorAlpha("")).toBeUndefined();
  });
});

describe("parseFontFamily", () => {
  it("maps web fonts to PPTX-safe equivalents", () => {
    expect(parseFontFamily("Inter, system-ui, sans-serif")).toBe("Calibri");
    expect(parseFontFamily("'Playfair Display', Georgia, serif")).toBe("Georgia");
    expect(parseFontFamily("JetBrains Mono, Fira Code, monospace")).toBe("Consolas");
    expect(parseFontFamily("Archivo Black, Arial Black, sans-serif")).toBe("Arial Black");
  });

  it("passes through unknown fonts as-is", () => {
    expect(parseFontFamily("Helvetica")).toBe("Helvetica");
  });

  it("maps all new theme fonts", () => {
    expect(parseFontFamily("Manrope, Inter, sans-serif")).toBe("Calibri");
    expect(parseFontFamily("Syne, Inter, sans-serif")).toBe("Arial");
    expect(parseFontFamily("Cormorant, Georgia, serif")).toBe("Garamond");
    expect(parseFontFamily("Bodoni Moda, Georgia, serif")).toBe("Bodoni MT");
    expect(parseFontFamily("Fraunces, Georgia, serif")).toBe("Georgia");
    expect(parseFontFamily("Outfit, Inter, sans-serif")).toBe("Calibri");
    expect(parseFontFamily("Source Serif 4, Georgia, serif")).toBe("Georgia");
    expect(parseFontFamily("Space Mono, monospace")).toBe("Consolas");
  });
});

describe("isBold", () => {
  it("returns true for weight >= 600", () => {
    expect(isBold(600)).toBe(true);
    expect(isBold(700)).toBe(true);
    expect(isBold(900)).toBe(true);
  });

  it("returns false for weight < 600", () => {
    expect(isBold(400)).toBe(false);
    expect(isBold(500)).toBe(false);
  });
});

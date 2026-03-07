import { describe, it, expect } from "vitest";
import { resolveTheme, THEMES } from "./theme";
import {
  estimateTextHeight,
  titleBlock,
  distributeHorizontal,
  columnLayout,
  makeEntrance,
  staggerDelay,
  CONTENT_X,
} from "./helpers";
import { layoutPresentation, layoutSlide } from "./index";
import type { SlideData } from "@/lib/types";

// --- Theme resolution ---

describe("resolveTheme", () => {
  it("returns modern theme by default", () => {
    const theme = resolveTheme();
    expect(theme.bg).toBe("#f8f9fc");
    expect(theme.accent).toBe("#4f6df5");
    expect(theme.fontHeading).toBe("Inter, system-ui, sans-serif");
    expect(theme.radius).toBe(12);
  });

  it("returns bold theme", () => {
    const theme = resolveTheme("bold");
    expect(theme.bg).toBe("#0a0a0a");
    expect(theme.accent).toBe("#ff6b35");
    expect(theme.radius).toBe(4);
  });

  it("returns elegant theme with serif heading font", () => {
    const theme = resolveTheme("elegant");
    expect(theme.fontHeading).toContain("Playfair");
    expect(theme.accent).toBe("#b8860b");
  });

  it("returns dark-tech theme with monospace heading font", () => {
    const theme = resolveTheme("dark-tech");
    expect(theme.fontHeading).toContain("JetBrains");
    expect(theme.accent).toBe("#00ffc8");
    expect(theme.heading).toBe("#00ffc8");
  });

  it("all themes have required properties", () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(theme.bg, `${name}.bg`).toBeTruthy();
      expect(theme.text, `${name}.text`).toBeTruthy();
      expect(theme.accent, `${name}.accent`).toBeTruthy();
      expect(theme.fontHeading, `${name}.fontHeading`).toBeTruthy();
      expect(theme.fontBody, `${name}.fontBody`).toBeTruthy();
      expect(theme.accentGradient.stops.length, `${name}.accentGradient`).toBe(2);
      expect(theme.radius, `${name}.radius`).toBeGreaterThanOrEqual(0);
    }
  });
});

// --- Helpers ---

describe("estimateTextHeight", () => {
  it("returns single line height for short text", () => {
    const h = estimateTextHeight("Hello", 28, 1.6, 1600);
    expect(h).toBe(28 * 1.6); // single line
  });

  it("returns multi-line height for long text", () => {
    const longText = "A".repeat(200);
    const h = estimateTextHeight(longText, 28, 1.6, 400);
    expect(h).toBeGreaterThan(28 * 1.6); // multiple lines
  });
});

describe("titleBlock", () => {
  it("produces title text and accent line elements", () => {
    const theme = resolveTheme("modern");
    const result = titleBlock("Test Title", theme);

    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].kind).toBe("text");
    expect(result.elements[1].kind).toBe("shape");
    expect(result.bottomY).toBeGreaterThan(0);
  });

  it("centers title by default", () => {
    const theme = resolveTheme("modern");
    const result = titleBlock("Test Title", theme);
    const titleEl = result.elements[0];
    if (titleEl.kind === "text") {
      expect(titleEl.style.textAlign).toBe("center");
    }
  });

  it("left-aligns when specified", () => {
    const theme = resolveTheme("modern");
    const result = titleBlock("Test Title", theme, { align: "left" });
    const titleEl = result.elements[0];
    if (titleEl.kind === "text") {
      expect(titleEl.style.textAlign).toBe("left");
      expect(titleEl.rect.x).toBe(CONTENT_X);
    }
  });
});

describe("distributeHorizontal", () => {
  it("evenly spaces items", () => {
    const rects = distributeHorizontal(3, 960, 20, 0, 100, 200);
    expect(rects).toHaveLength(3);
    const itemW = (960 - 20 * 2) / 3;
    expect(rects[0].rect.x).toBeCloseTo(0);
    expect(rects[1].rect.x).toBeCloseTo(itemW + 20);
    expect(rects[2].rect.x).toBeCloseTo(2 * (itemW + 20));
    rects.forEach((r) => {
      expect(r.rect.w).toBeCloseTo(itemW);
      expect(r.rect.h).toBe(200);
    });
  });
});

describe("columnLayout", () => {
  it("splits into equal columns with gap", () => {
    const cols = columnLayout(2, 32, 0, 1600);
    expect(cols).toHaveLength(2);
    expect(cols[0].w).toBe((1600 - 32) / 2);
    expect(cols[1].x).toBe(cols[0].w + 32);
  });
});

describe("makeEntrance", () => {
  it("creates entrance def", () => {
    const anim = makeEntrance("fade-up", 100, 500);
    expect(anim.type).toBe("fade-up");
    expect(anim.delay).toBe(100);
    expect(anim.duration).toBe(500);
  });
});

describe("staggerDelay", () => {
  it("calculates stagger delay", () => {
    expect(staggerDelay(0, 200, 100)).toBe(200);
    expect(staggerDelay(2, 200, 100)).toBe(400);
  });
});

// --- Layout functions ---

describe("layoutSlide", () => {
  it("returns fallback for unknown template", () => {
    const slide = { template: "unknown-thing" } as unknown as SlideData;
    const result = layoutSlide(slide, "modern", "/test");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].kind).toBe("text");
    if (result.elements[0].kind === "text") {
      expect(result.elements[0].text).toContain("unknown-thing");
    }
  });
});

// Note: Group 1-4 rigid templates removed in v7 — now DSL-based
// Integration tests for DSL templates are in src/lib/dsl/integration.test.ts

// --- Freeform template ---

describe("layoutPresentation - freeform", () => {
  const textEl = {
    kind: "text" as const,
    id: "t1",
    rect: { x: 100, y: 200, w: 760, h: 60 },
    text: "Hello freeform",
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 32,
      fontWeight: 700,
      color: "#1a1a2e",
      lineHeight: 1.2,
    },
  };

  const shapeEl = {
    kind: "shape" as const,
    id: "s1",
    rect: { x: 960, y: 0, w: 960, h: 1080 },
    shape: "rect" as const,
    style: { fill: "#0d0b09" },
  };

  const freeformSlide: SlideData = {
    template: "freeform",
    elements: [textEl, shapeEl],
  };

  it("passes through elements unchanged", () => {
    const result = layoutPresentation("Test", [freeformSlide], "modern", "/img");
    const slide = result.slides[0];
    // Elements should be in the output as-is
    const text = slide.elements.find((e) => e.id === "t1");
    const shape = slide.elements.find((e) => e.id === "s1");
    expect(text).toBeDefined();
    expect(shape).toBeDefined();
    if (text?.kind === "text") {
      expect(text.text).toBe("Hello freeform");
      expect(text.rect).toEqual({ x: 100, y: 200, w: 760, h: 60 });
    }
  });

  it("uses theme background when none specified", () => {
    const result = layoutPresentation("Test", [freeformSlide], "modern", "/img");
    const slide = result.slides[0];
    expect(slide.background).toBe("#f8f9fc"); // modern theme bg
  });

  it("uses custom background when specified", () => {
    const slide: SlideData = {
      template: "freeform",
      background: "#1a1714",
      elements: [textEl],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#1a1714");
  });

  it("handles empty elements array", () => {
    const slide: SlideData = {
      template: "freeform",
      elements: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].elements).toHaveLength(0);
  });

  it("respects per-slide theme override", () => {
    const slide: SlideData = {
      template: "freeform",
      theme: "bold",
      elements: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    // bold theme bg since no custom background and slide theme is bold
    expect(result.slides[0].background).toBe("#0a0a0a");
  });
});

// --- Per-slide theme override ---

describe("per-slide theme override", () => {
  it("uses slide-level theme when specified", () => {
    const slide: SlideData = {
      template: "full-compose",
      children: [{ type: "heading", text: "Dark Cover" }],
      theme: "dark-tech",
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const layout = result.slides[0];
    // dark-tech bg
    expect(layout.background).toBe("#0a0a12");
  });
});

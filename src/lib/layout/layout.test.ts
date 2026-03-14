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

  it("counts explicit newlines as line breaks", () => {
    const text = "Line one\nLine two";
    const h = estimateTextHeight(text, 26, 1.6, 1600);
    // Both lines are short enough to fit in 1600px, so height = 2 lines
    expect(h).toBeCloseTo(2 * 26 * 1.6, 0);
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

// Note: Group 1-4 rigid templates removed in v7 — now DSL-based
// Integration tests for DSL templates are in src/lib/dsl/integration.test.ts

// --- Scene IR passthrough ---

describe("layoutPresentation - scene IR passthrough", () => {
  const textEl = {
    kind: "text" as const,
    id: "t1",
    rect: { x: 100, y: 200, w: 760, h: 60 },
    text: "Hello raw",
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

  const sceneSlide: SlideData = {
    mode: "scene",
    children: [
      { kind: "ir", id: "scene-ir-text", element: textEl },
      { kind: "ir", id: "scene-ir-shape", element: shapeEl },
    ],
  };

  it("passes through elements", () => {
    const result = layoutPresentation("Test", [sceneSlide], "modern", "/img");
    const slide = result.slides[0];
    const text = slide.elements.find((e) => e.id === "t1");
    const shape = slide.elements.find((e) => e.id === "s1");
    expect(text).toBeDefined();
    expect(shape).toBeDefined();
    if (text?.kind === "text") {
      expect(text.text).toBe("Hello raw");
      expect(text.rect).toEqual({ x: 100, y: 200, w: 760, h: 60 });
    }
  });

  it("uses theme background when none specified", () => {
    const result = layoutPresentation("Test", [sceneSlide], "modern", "/img");
    expect(result.slides[0].background).toBe("#f8f9fc");
  });

  it("uses custom background when specified", () => {
    const slide: SlideData = {
      mode: "scene",
      background: "#1a1714",
      children: [{ kind: "ir", id: "scene-ir-text", element: textEl }],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#1a1714");
  });

  it("handles empty elements array", () => {
    const slide: SlideData = {
      mode: "scene",
      children: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].elements).toBeDefined();
  });

  it("respects per-slide theme override", () => {
    const slide: SlideData = {
      mode: "scene",
      theme: "bold",
      children: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#0a0a0a");
  });
});

// --- Per-slide theme override ---

describe("per-slide theme override", () => {
  it("uses slide-level theme when specified", () => {
    const slide: SlideData = {
      mode: "scene",
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 160, y: 120, w: 600 },
          text: "Dark Cover",
          style: {
            fontFamily: "heading",
            fontSize: 64,
            fontWeight: 700,
            color: "theme.heading",
            lineHeight: 1.1,
          },
        },
      ],
      theme: "dark-tech",
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const layout = result.slides[0];
    // dark-tech bg
    expect(layout.background).toBe("#0a0a12");
  });
});

// --- Scene slide ---

describe("scene slide", () => {
  it("resolves a direct scene graph", () => {
    const slide: SlideData = {
      mode: "scene",
      children: [
        {
          kind: "group",
          id: "root-stack",
          frame: { x: 160, y: 120, w: 600, h: 240 },
          layout: { type: "stack", gap: 28 },
          children: [
            {
              kind: "text",
              id: "hello-heading",
              text: "Hello Scene",
              style: {
                fontFamily: "heading",
                fontSize: 64,
                fontWeight: 700,
                color: "theme.heading",
                lineHeight: 1.1,
              },
            },
          ],
        },
      ],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const layout = result.slides[0];
    expect(layout.width).toBe(1920);
    expect(layout.height).toBe(1080);
    expect(layout.elements.length).toBeGreaterThan(0);
    const heading = layout.elements.flatMap((el) =>
      el.kind === "group" ? (el as { children: typeof layout.elements }).children : [el],
    ).find((el) => el.kind === "text" && el.id === "hello-heading");
    expect(heading).toBeDefined();
  });

  it("uses theme background", () => {
    const slide: SlideData = {
      mode: "scene",
      children: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#f8f9fc");
  });

  it("uses custom background", () => {
    const slide: SlideData = {
      mode: "scene",
      background: "#111111",
      children: [],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#111111");
  });
});

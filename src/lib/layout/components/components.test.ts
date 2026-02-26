import { describe, it, expect, vi } from "vitest";
import { resolveTheme } from "../theme";
import { resolveComponent, type ResolveContext } from "./resolvers";
import { stackComponents } from "./stacker";
import { resolveThemeToken, resolveColor } from "./theme-tokens";
import type { SlideComponent } from "./types";
import type { Rect } from "../types";
import { layoutPresentation } from "../index";
import type { SlideData } from "@/lib/types";

// --- Shared fixtures ---

const theme = resolveTheme("modern");
const panelRect: Rect = { x: 60, y: 60, w: 800, h: 960 };

function makeCtx(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    theme,
    panel: panelRect,
    idPrefix: "test",
    imageBase: "/img",
    ...overrides,
  };
}

// ============================================================
// Theme tokens
// ============================================================

describe("resolveThemeToken", () => {
  it("resolves theme.accent to concrete value", () => {
    expect(resolveThemeToken("theme.accent", theme)).toBe(theme.accent);
  });

  it("resolves theme.bg", () => {
    expect(resolveThemeToken("theme.bg", theme)).toBe(theme.bg);
  });

  it("resolves theme.bgSecondary", () => {
    expect(resolveThemeToken("theme.bgSecondary", theme)).toBe(theme.bgSecondary);
  });

  it("passes through hex values unchanged", () => {
    expect(resolveThemeToken("#1a1714", theme)).toBe("#1a1714");
  });

  it("passes through rgba values unchanged", () => {
    expect(resolveThemeToken("rgba(0,0,0,0.5)", theme)).toBe("rgba(0,0,0,0.5)");
  });

  it("returns undefined for undefined input", () => {
    expect(resolveThemeToken(undefined, theme)).toBeUndefined();
  });

  it("returns undefined for non-string theme properties", () => {
    // shadow is an object, not a string
    expect(resolveThemeToken("theme.shadow", theme)).toBeUndefined();
  });
});

describe("resolveColor", () => {
  it("resolves theme token with fallback", () => {
    expect(resolveColor("theme.accent", theme, "#000")).toBe(theme.accent);
  });

  it("uses fallback when token is undefined", () => {
    expect(resolveColor(undefined, theme, "#fff")).toBe("#fff");
  });

  it("uses fallback when theme property is non-string", () => {
    expect(resolveColor("theme.shadow", theme, "#fallback")).toBe("#fallback");
  });

  it("passes through hardcoded color", () => {
    expect(resolveColor("#abc123", theme, "#000")).toBe("#abc123");
  });
});

// ============================================================
// Component resolvers
// ============================================================

describe("resolveComponent — heading", () => {
  it("produces a text element with heading style", () => {
    const { elements, height } = resolveComponent(
      { type: "heading", text: "Title" },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("text");
    if (elements[0].kind === "text") {
      expect(elements[0].text).toBe("Title");
      expect(elements[0].style.fontWeight).toBe(700);
      expect(elements[0].style.fontSize).toBe(54); // level 1 default
    }
    expect(height).toBeGreaterThan(0);
  });

  it("uses smaller font for level 2", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Sub", level: 2 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(42);
    }
  });

  it("uses smaller font for level 3", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Sub", level: 3 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(34);
    }
  });

  it("uses panel textColor when provided", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Title" },
      makeCtx({ textColor: "#ffffff" }),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.color).toBe("#ffffff");
    }
  });
});

describe("resolveComponent — body", () => {
  it("produces a text element with body style", () => {
    const { elements, height } = resolveComponent(
      { type: "body", text: "Some body text here." },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("text");
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(28);
      expect(elements[0].style.fontWeight).toBe(400);
    }
    expect(height).toBeGreaterThan(0);
  });
});

describe("resolveComponent — bullets", () => {
  it("produces group elements for each bullet", () => {
    const { elements, height } = resolveComponent(
      { type: "bullets", items: ["First", "Second", "Third"] },
      makeCtx(),
    );
    expect(elements).toHaveLength(3);
    elements.forEach((el) => expect(el.kind).toBe("group"));
    expect(height).toBeGreaterThan(0);
  });

  it("bullets have left accent border", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["One"] },
      makeCtx(),
    );
    const group = elements[0];
    if (group.kind === "group") {
      expect(group.border?.sides).toContain("left");
      expect(group.border?.color).toBe(theme.accent);
    }
  });
});

describe("resolveComponent — stat", () => {
  it("produces value and label text elements", () => {
    const { elements, height } = resolveComponent(
      { type: "stat", value: "72", label: "years" },
      makeCtx(),
    );
    expect(elements).toHaveLength(2);
    expect(elements[0].kind).toBe("text");
    expect(elements[1].kind).toBe("text");
    if (elements[0].kind === "text") {
      expect(elements[0].text).toBe("72");
      expect(elements[0].style.fontSize).toBe(64);
    }
    if (elements[1].kind === "text") {
      expect(elements[1].text).toBe("years");
      expect(elements[1].style.fontSize).toBe(24);
    }
    expect(height).toBeGreaterThan(0);
  });
});

describe("resolveComponent — tag", () => {
  it("produces a pill shape and text", () => {
    const { elements, height } = resolveComponent(
      { type: "tag", text: "Overview" },
      makeCtx(),
    );
    expect(elements).toHaveLength(2);
    expect(elements[0].kind).toBe("shape"); // pill bg
    expect(elements[1].kind).toBe("text");  // label
    expect(height).toBeGreaterThan(0);
  });

  it("resolves theme token for color", () => {
    const { elements } = resolveComponent(
      { type: "tag", text: "Test", color: "theme.accent" },
      makeCtx(),
    );
    if (elements[1].kind === "text") {
      expect(elements[1].style.color).toBe(theme.accent);
    }
  });
});

describe("resolveComponent — divider", () => {
  it("produces a shape element", () => {
    const { elements, height } = resolveComponent(
      { type: "divider" },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("shape");
    expect(height).toBe(4);
  });

  it("uses gradient style for gradient variant", () => {
    const { elements } = resolveComponent(
      { type: "divider", variant: "gradient" },
      makeCtx(),
    );
    if (elements[0].kind === "shape") {
      expect(elements[0].style.gradient).toBeDefined();
    }
  });

  it("uses solid fill for solid variant", () => {
    const { elements } = resolveComponent(
      { type: "divider", variant: "solid" },
      makeCtx(),
    );
    if (elements[0].kind === "shape") {
      expect(elements[0].style.fill).toBe(theme.accent);
    }
  });
});

describe("resolveComponent — quote", () => {
  it("produces accent bar and quote text", () => {
    const { elements, height } = resolveComponent(
      { type: "quote", text: "To be or not to be." },
      makeCtx(),
    );
    expect(elements.length).toBeGreaterThanOrEqual(2);
    expect(elements[0].kind).toBe("shape"); // accent bar
    expect(elements[1].kind).toBe("text");  // quote text
    if (elements[1].kind === "text") {
      expect(elements[1].style.fontStyle).toBe("italic");
    }
    expect(height).toBeGreaterThan(0);
  });

  it("includes attribution when provided", () => {
    const { elements } = resolveComponent(
      { type: "quote", text: "A quote.", attribution: "Author" },
      makeCtx(),
    );
    expect(elements).toHaveLength(3);
    if (elements[2].kind === "text") {
      expect(elements[2].text).toContain("Author");
    }
  });
});

describe("resolveComponent — card", () => {
  it("produces a group with title and body", () => {
    const { elements, height } = resolveComponent(
      { type: "card", title: "Card Title", body: "Card body text." },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("group");
    if (elements[0].kind === "group") {
      expect(elements[0].children).toHaveLength(2);
    }
    expect(height).toBeGreaterThan(0);
  });
});

describe("resolveComponent — image", () => {
  it("produces an image element with default height", () => {
    const { elements, height } = resolveComponent(
      { type: "image", src: "photo.jpg" },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("image");
    if (elements[0].kind === "image") {
      expect(elements[0].src).toBe("/img/photo.jpg");
    }
    expect(height).toBe(400); // default
  });

  it("uses custom height", () => {
    const { height } = resolveComponent(
      { type: "image", src: "x.png", height: 250 },
      makeCtx(),
    );
    expect(height).toBe(250);
  });

  it("passes absolute URLs through", () => {
    const { elements } = resolveComponent(
      { type: "image", src: "https://example.com/img.png" },
      makeCtx(),
    );
    if (elements[0].kind === "image") {
      expect(elements[0].src).toBe("https://example.com/img.png");
    }
  });
});

describe("resolveComponent — code", () => {
  it("produces a code element", () => {
    const { elements, height } = resolveComponent(
      { type: "code", code: "const x = 1;\nconst y = 2;", language: "typescript" },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("code");
    if (elements[0].kind === "code") {
      expect(elements[0].code).toContain("const x = 1");
      expect(elements[0].language).toBe("typescript");
    }
    expect(height).toBeGreaterThan(0);
  });
});

describe("resolveComponent — spacer", () => {
  it("produces no elements with specified height", () => {
    const { elements, height } = resolveComponent(
      { type: "spacer", height: 50 },
      makeCtx(),
    );
    expect(elements).toHaveLength(0);
    expect(height).toBe(50);
  });
});

describe("resolveComponent — raw", () => {
  it("passes through elements with specified height", () => {
    const rawElements = [
      {
        kind: "shape" as const,
        id: "raw-shape",
        rect: { x: 0, y: 0, w: 65, h: 65 },
        shape: "rect" as const,
        style: { fill: "#c41e3a" },
      },
    ];
    const { elements, height } = resolveComponent(
      { type: "raw", height: 65, elements: rawElements },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe("raw-shape");
    expect(height).toBe(65);
  });
});

// ============================================================
// Vertical stacker
// ============================================================

describe("stackComponents", () => {
  const components: SlideComponent[] = [
    { type: "heading", text: "Title" },
    { type: "divider" },
    { type: "body", text: "Some text" },
  ];

  it("positions components top-to-bottom within panel", () => {
    const elements = stackComponents(components, panelRect, theme, {
      animate: false,
    });
    expect(elements.length).toBeGreaterThan(0);

    // All elements should have x >= panel.x
    elements.forEach((el) => {
      expect(el.rect.x).toBeGreaterThanOrEqual(panelRect.x);
    });

    // All elements should have y >= panel.y
    elements.forEach((el) => {
      expect(el.rect.y).toBeGreaterThanOrEqual(panelRect.y);
    });
  });

  it("each component starts below the previous one", () => {
    const elements = stackComponents(
      [
        { type: "heading", text: "First" },
        { type: "heading", text: "Second" },
        { type: "heading", text: "Third" },
      ],
      panelRect,
      theme,
      { animate: false },
    );

    // Extract the y of the first element from each component
    // Each heading resolves to 1 element
    expect(elements[0].rect.y).toBeLessThan(elements[1].rect.y);
    expect(elements[1].rect.y).toBeLessThan(elements[2].rect.y);
  });

  it("applies staggered animations when animate is true", () => {
    const elements = stackComponents(
      [
        { type: "heading", text: "A" },
        { type: "heading", text: "B" },
      ],
      panelRect,
      theme,
      { animate: true },
    );

    const delays = elements.map((el) => el.animation?.delay ?? 0);
    expect(delays[0]).toBeLessThan(delays[1]);
  });

  it("does not add animations when animate is false", () => {
    const elements = stackComponents(
      [{ type: "heading", text: "A" }],
      panelRect,
      theme,
      { animate: false },
    );

    // No animation should be added (heading resolver doesn't add one)
    elements.forEach((el) => {
      expect(el.animation).toBeUndefined();
    });
  });

  it("warns on overflow", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tinyPanel: Rect = { x: 0, y: 0, w: 800, h: 50 }; // very small
    stackComponents(
      [
        { type: "heading", text: "Title" },
        { type: "body", text: "This will overflow the tiny panel" },
        { type: "bullets", items: ["a", "b", "c", "d", "e"] },
      ],
      tinyPanel,
      theme,
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[stacker]"));
    warnSpy.mockRestore();
  });

  it("handles empty component list", () => {
    const elements = stackComponents([], panelRect, theme);
    expect(elements).toHaveLength(0);
  });
});

// ============================================================
// Integration: split-compose via layoutPresentation
// ============================================================

describe("layoutPresentation — split-compose", () => {
  const splitSlide: SlideData = {
    template: "split-compose",
    left: {
      background: "#faf9f7",
      children: [
        { type: "tag", text: "Overview" },
        { type: "heading", text: "What is this?" },
        { type: "divider", variant: "gradient" },
        { type: "bullets", items: ["Point one", "Point two"] },
      ],
    },
    right: {
      background: "#1a1714",
      textColor: "#e8e0d0",
      children: [
        { type: "stat", value: "72", label: "Years" },
        { type: "stat", value: "5", label: "Dynasties" },
      ],
    },
  };

  it("produces a valid slide with elements from both panels", () => {
    const result = layoutPresentation("Test", [splitSlide], "modern", "/img");
    expect(result.slides).toHaveLength(1);
    const slide = result.slides[0];
    expect(slide.width).toBe(1920);
    expect(slide.height).toBe(1080);
    // At minimum: 2 panel backgrounds + left children + right children
    expect(slide.elements.length).toBeGreaterThan(4);
  });

  it("places left panel background at x=0", () => {
    const result = layoutPresentation("Test", [splitSlide], "modern", "/img");
    const slide = result.slides[0];
    const leftBg = slide.elements.find((e) => e.id === "panel-left-bg");
    expect(leftBg).toBeDefined();
    expect(leftBg?.rect.x).toBe(0);
    if (leftBg?.kind === "shape") {
      expect(leftBg.style.fill).toBe("#faf9f7");
    }
  });

  it("places right panel background at split point", () => {
    const result = layoutPresentation("Test", [splitSlide], "modern", "/img");
    const slide = result.slides[0];
    const rightBg = slide.elements.find((e) => e.id === "panel-right-bg");
    expect(rightBg).toBeDefined();
    expect(rightBg?.rect.x).toBe(960); // 0.5 ratio
    if (rightBg?.kind === "shape") {
      expect(rightBg.style.fill).toBe("#1a1714");
    }
  });

  it("produces unique element IDs across both panels", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        children: [
          { type: "tag", text: "Left Tag" },
          { type: "heading", text: "Left Title" },
        ],
      },
      right: {
        children: [
          { type: "tag", text: "Right Tag" },
          { type: "heading", text: "Right Title" },
        ],
      },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const ids = result.slides[0].elements.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("respects custom ratio", () => {
    const slide: SlideData = {
      template: "split-compose",
      ratio: 0.4,
      left: { children: [{ type: "heading", text: "Left" }] },
      right: { children: [{ type: "heading", text: "Right" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const rightBg = result.slides[0].elements.find((e) => e.id === "panel-right-bg");
    expect(rightBg?.rect.x).toBe(Math.round(1920 * 0.4));
  });

  it("resolves theme tokens for panel backgrounds", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        background: "theme.bg",
        children: [{ type: "heading", text: "Left" }],
      },
      right: {
        background: "theme.accent",
        children: [{ type: "heading", text: "Right" }],
      },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftBg = result.slides[0].elements.find((e) => e.id === "panel-left-bg");
    const rightBg = result.slides[0].elements.find((e) => e.id === "panel-right-bg");
    if (leftBg?.kind === "shape") {
      expect(leftBg.style.fill).toBe(theme.bg);
    }
    if (rightBg?.kind === "shape") {
      expect(rightBg.style.fill).toBe(theme.accent);
    }
  });
});

// ============================================================
// Integration: full-compose via layoutPresentation
// ============================================================

describe("layoutPresentation — full-compose", () => {
  const fullSlide: SlideData = {
    template: "full-compose",
    children: [
      { type: "heading", text: "Background" },
      { type: "divider", variant: "solid" },
      { type: "bullets", items: ["Point A", "Point B"] },
      { type: "quote", text: "A famous quote", attribution: "Someone" },
    ],
  };

  it("produces a valid slide with all components", () => {
    const result = layoutPresentation("Test", [fullSlide], "modern", "/img");
    expect(result.slides).toHaveLength(1);
    const slide = result.slides[0];
    expect(slide.width).toBe(1920);
    // heading(1) + divider(1) + bullets(2 groups) + quote(3: bar + text + attr)
    expect(slide.elements.length).toBeGreaterThanOrEqual(5);
  });

  it("uses custom background", () => {
    const slide: SlideData = {
      template: "full-compose",
      background: "#222222",
      children: [{ type: "heading", text: "Dark" }],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    expect(result.slides[0].background).toBe("#222222");
  });

  it("uses theme background by default", () => {
    const result = layoutPresentation("Test", [fullSlide], "modern", "/img");
    expect(result.slides[0].background).toBe(theme.bg);
  });

  it("center alignment narrows content width", () => {
    const centered: SlideData = {
      template: "full-compose",
      align: "center",
      children: [{ type: "heading", text: "Centered" }],
    };
    const leftAligned: SlideData = {
      template: "full-compose",
      align: "left",
      children: [{ type: "heading", text: "Left" }],
    };

    const centerResult = layoutPresentation("Test", [centered], "modern", "/img");
    const leftResult = layoutPresentation("Test", [leftAligned], "modern", "/img");

    // Center uses 1200px width, left uses 1600px → center heading rect is narrower
    const centerHeading = centerResult.slides[0].elements[0];
    const leftHeading = leftResult.slides[0].elements[0];
    expect(centerHeading.rect.w).toBeLessThan(leftHeading.rect.w);
  });
});

// ============================================================
// Integration: raw escape hatch within composable templates
// ============================================================

describe("raw escape hatch in composable templates", () => {
  it("raw elements are offset to correct position in stack", () => {
    const slide: SlideData = {
      template: "full-compose",
      children: [
        { type: "heading", text: "Title" },
        {
          type: "raw",
          height: 65,
          elements: [
            {
              kind: "shape",
              id: "seal-border",
              rect: { x: 0, y: 0, w: 65, h: 65 },
              shape: "rect",
              style: { fill: "transparent", stroke: "#c41e3a", strokeWidth: 2 },
            },
          ],
        },
      ],
    };

    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const sealEl = result.slides[0].elements.find((e) => e.id === "seal-border");
    expect(sealEl).toBeDefined();
    // Should NOT be at y=0 — it should be offset below the heading
    expect(sealEl!.rect.y).toBeGreaterThan(0);
  });
});

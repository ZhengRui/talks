import { describe, it, expect } from "vitest";
import { resolveTheme, THEMES } from "./theme";
import {
  estimateTextHeight,
  titleBlock,
  distributeHorizontal,
  columnLayout,
  makeAnimation,
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

describe("makeAnimation", () => {
  it("creates animation def", () => {
    const anim = makeAnimation("fade-up", 100, 500);
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

describe("layoutPresentation - cover", () => {
  const coverSlide: SlideData = {
    template: "cover",
    title: "My Presentation",
    subtitle: "A great talk",
    author: "John Doe",
  };

  it("produces correct slide structure", () => {
    const result = layoutPresentation("Test", [coverSlide], "modern", "/img", "Author");
    expect(result.title).toBe("Test");
    expect(result.slides).toHaveLength(1);

    const slide = result.slides[0];
    expect(slide.width).toBe(1920);
    expect(slide.height).toBe(1080);
    expect(slide.background).toBe("#f8f9fc");
  });

  it("has title, accent line, subtitle, and author elements", () => {
    const result = layoutPresentation("Test", [coverSlide], "modern", "/img");
    const slide = result.slides[0];
    const kinds = slide.elements.map((e) => e.kind);
    expect(kinds).toContain("text"); // title + subtitle
    expect(kinds).toContain("shape"); // accent line
    expect(kinds).toContain("group"); // author pill
  });

  it("adds background image elements when image is specified", () => {
    const slideWithImage: SlideData = {
      ...coverSlide,
      image: "hero.jpg",
    };
    const result = layoutPresentation("Test", [slideWithImage], "modern", "/img");
    const slide = result.slides[0];
    const imageEls = slide.elements.filter((e) => e.kind === "image");
    expect(imageEls).toHaveLength(1);
    if (imageEls[0].kind === "image") {
      expect(imageEls[0].src).toBe("/img/hero.jpg");
    }
  });
});

describe("layoutPresentation - bullets", () => {
  const bulletSlide: SlideData = {
    template: "bullets",
    title: "Key Points",
    bullets: ["Point one", "Point two", "Point three"],
  };

  it("produces title and bullet groups", () => {
    const result = layoutPresentation("Test", [bulletSlide], "modern", "/img");
    const slide = result.slides[0];

    // Title (text) + accent line (shape) + 3 bullet groups
    expect(slide.elements.length).toBe(5);
    const groups = slide.elements.filter((e) => e.kind === "group");
    expect(groups).toHaveLength(3);
  });

  it("staggers bullet animations", () => {
    const result = layoutPresentation("Test", [bulletSlide], "modern", "/img");
    const slide = result.slides[0];
    const groups = slide.elements.filter((e) => e.kind === "group");
    const delays = groups.map((g) => g.animation?.delay ?? 0);
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
  });
});

describe("layoutPresentation - stats", () => {
  const statsSlide: SlideData = {
    template: "stats",
    title: "Numbers",
    stats: [
      { value: "99%", label: "Uptime" },
      { value: "50M", label: "Users" },
      { value: "< 1s", label: "Response" },
    ],
  };

  it("produces stat card groups", () => {
    const result = layoutPresentation("Test", [statsSlide], "bold", "/img");
    const slide = result.slides[0];
    const groups = slide.elements.filter((e) => e.kind === "group");
    expect(groups).toHaveLength(3); // 3 stat cards
  });

  it("uses bold theme colors", () => {
    const result = layoutPresentation("Test", [statsSlide], "bold", "/img");
    const slide = result.slides[0];
    expect(slide.background).toBe("#0a0a0a");
  });
});

describe("layoutPresentation - comparison", () => {
  const compSlide: SlideData = {
    template: "comparison",
    title: "Before vs After",
    left: { heading: "Before", items: ["Slow", "Manual"] },
    right: { heading: "After", items: ["Fast", "Automated"] },
  };

  it("produces two card groups", () => {
    const result = layoutPresentation("Test", [compSlide], "modern", "/img");
    const slide = result.slides[0];
    const groups = slide.elements.filter((e) => e.kind === "group");
    expect(groups).toHaveLength(2);
  });

  it("left card slides left, right card slides right", () => {
    const result = layoutPresentation("Test", [compSlide], "modern", "/img");
    const slide = result.slides[0];
    const groups = slide.elements.filter((e) => e.kind === "group");
    expect(groups[0].animation?.type).toBe("slide-left");
    expect(groups[1].animation?.type).toBe("slide-right");
  });
});

describe("layoutPresentation - table", () => {
  const tableSlide: SlideData = {
    template: "table",
    title: "Data Table",
    headers: ["Name", "Score"],
    rows: [
      ["Alice", "95"],
      ["Bob", "87"],
    ],
  };

  it("produces a table element", () => {
    const result = layoutPresentation("Test", [tableSlide], "elegant", "/img");
    const slide = result.slides[0];
    const tables = slide.elements.filter((e) => e.kind === "table");
    expect(tables).toHaveLength(1);
    if (tables[0].kind === "table") {
      expect(tables[0].headers).toEqual(["Name", "Score"]);
      expect(tables[0].rows).toHaveLength(2);
    }
  });

  it("uses elegant theme accent for header", () => {
    const result = layoutPresentation("Test", [tableSlide], "elegant", "/img");
    const slide = result.slides[0];
    const table = slide.elements.find((e) => e.kind === "table");
    if (table?.kind === "table") {
      expect(table.headerStyle.background).toBe("#b8860b");
    }
  });
});

// --- Per-slide theme override ---

describe("per-slide theme override", () => {
  it("uses slide-level theme when specified", () => {
    const slide: SlideData = {
      template: "cover",
      title: "Dark Cover",
      theme: "dark-tech",
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const layout = result.slides[0];
    // dark-tech bg
    expect(layout.background).toBe("#0a0a12");
  });
});

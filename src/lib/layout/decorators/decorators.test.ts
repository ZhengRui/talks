import { describe, it, expect } from "vitest";
import { resolveTheme } from "../theme";
import { splitBackground } from "./split-background";
import { edgeTabs } from "./edge-tabs";
import { sectionNumber } from "./section-number";
import { geometricAccent } from "./geometric-accent";
import { accentLine } from "./accent-line";
import { binderHoles } from "./binder-holes";
import { borderedBox } from "./bordered-box";
import { applyDecorators } from "./index";
import { layoutPresentation } from "../index";
import type { SlideData } from "@/lib/types";

// --- Individual decorator functions ---

describe("splitBackground", () => {
  it("produces two full-height rects", () => {
    const theme = resolveTheme("electric-studio");
    const els = splitBackground(theme);
    expect(els).toHaveLength(2);
    expect(els[0].kind).toBe("shape");
    expect(els[1].kind).toBe("shape");
    if (els[0].kind === "shape" && els[1].kind === "shape") {
      expect(els[0].rect).toEqual({ x: 0, y: 0, w: 960, h: 1080 });
      expect(els[1].rect).toEqual({ x: 960, y: 0, w: 960, h: 1080 });
      expect(els[0].style.fill).toBe(theme.bg);
      expect(els[1].style.fill).toBe(theme.bgSecondary);
    }
  });
});

describe("edgeTabs", () => {
  it("produces 5 tab shapes on right edge", () => {
    const theme = resolveTheme("notebook-tabs");
    const els = edgeTabs(theme);
    expect(els).toHaveLength(5);
    els.forEach((el) => {
      expect(el.kind).toBe("shape");
      if (el.kind === "shape") {
        expect(el.rect.x).toBe(1920 - 24);
        expect(el.rect.w).toBe(24);
      }
    });
  });

  it("alternates colors between accent and accent2", () => {
    const theme = resolveTheme("notebook-tabs");
    const els = edgeTabs(theme);
    if (els[0].kind === "shape" && els[1].kind === "shape") {
      expect(els[0].style.fill).toBe(theme.accent);
      expect(els[1].style.fill).toBe(theme.accent2);
    }
  });
});

describe("sectionNumber", () => {
  it("produces text element with zero-padded number", () => {
    const theme = resolveTheme("bold-signal");
    const els = sectionNumber(theme, 0);
    expect(els).toHaveLength(2); // number text + fade overlay
    const textEl = els[0];
    if (textEl.kind === "text") {
      expect(textEl.text).toBe("01");
      expect(textEl.style.fontSize).toBe(220);
    }
  });

  it("formats index 9 as '10'", () => {
    const theme = resolveTheme("bold-signal");
    const els = sectionNumber(theme, 9);
    const textEl = els[0];
    if (textEl.kind === "text") {
      expect(textEl.text).toBe("10");
    }
  });
});

describe("geometricAccent", () => {
  it("produces circle + line + dot (3 shapes)", () => {
    const theme = resolveTheme("vintage-editorial");
    const els = geometricAccent(theme);
    expect(els).toHaveLength(3);
    if (els[0].kind === "shape") {
      expect(els[0].shape).toBe("circle");
    }
    if (els[1].kind === "shape") {
      expect(els[1].shape).toBe("rect"); // thin line
    }
    if (els[2].kind === "shape") {
      expect(els[2].shape).toBe("circle"); // dot
    }
  });
});

describe("accentLine", () => {
  it("produces single thin vertical shape", () => {
    const theme = resolveTheme("dark-botanical");
    const els = accentLine(theme);
    expect(els).toHaveLength(1);
    if (els[0].kind === "shape") {
      expect(els[0].rect.w).toBe(2);
      expect(els[0].style.fill).toBe(theme.accent);
    }
  });
});

describe("binderHoles", () => {
  it("produces 3 circles", () => {
    const theme = resolveTheme("notebook-tabs");
    const els = binderHoles(theme);
    expect(els).toHaveLength(3);
    els.forEach((el) => {
      if (el.kind === "shape") {
        expect(el.shape).toBe("circle");
        expect(el.rect.w).toBe(20);
        expect(el.rect.h).toBe(20);
      }
    });
  });
});

describe("borderedBox", () => {
  it("produces single stroke-only shape", () => {
    const theme = resolveTheme("vintage-editorial");
    const els = borderedBox(theme);
    expect(els).toHaveLength(1);
    if (els[0].kind === "shape") {
      expect(els[0].style.stroke).toBe(theme.accent);
      expect(els[0].style.strokeWidth).toBe(2);
    }
  });
});

// --- Registry / applyDecorators ---

describe("applyDecorators", () => {
  it("returns empty for theme with no decorators", () => {
    const theme = resolveTheme("modern");
    const { background, foreground } = applyDecorators(theme, 0);
    expect(background).toHaveLength(0);
    expect(foreground).toHaveLength(0);
  });

  it("puts split-bg in background array", () => {
    const theme = resolveTheme("electric-studio");
    const result = applyDecorators(theme, 0);
    expect(result.background.length).toBeGreaterThan(0);
    expect(result.background[0].id).toContain("split");
    expect(result.foreground).toHaveLength(0);
  });

  it("puts non-split decorators in foreground array", () => {
    const theme = resolveTheme("vintage-editorial");
    const { background, foreground } = applyDecorators(theme, 0);
    expect(background).toHaveLength(0);
    expect(foreground.length).toBeGreaterThan(0);
  });

  it("handles multiple decorators", () => {
    const theme = resolveTheme("notebook-tabs");
    const { foreground } = applyDecorators(theme, 0);
    // edge-tabs (5) + binder-holes (3) = 8
    expect(foreground).toHaveLength(8);
  });
});

// --- Integration: decorators appear in layoutPresentation output ---

describe("decorator integration", () => {
  it("bold-signal slides include section numbers", () => {
    const slide: SlideData = {
      template: "cover",
      title: "Test",
    };
    const result = layoutPresentation("Test", [slide], "bold-signal", "/img");
    const layout = result.slides[0];
    const decoIds = layout.elements.map((e) => e.id);
    expect(decoIds).toContain("deco-section-num");
  });

  it("electric-studio slides include split background", () => {
    const slide: SlideData = {
      template: "bullets",
      title: "Test",
      bullets: ["A"],
    };
    const result = layoutPresentation("Test", [slide], "electric-studio", "/img");
    const layout = result.slides[0];
    // Split-bg should be the first two elements
    expect(layout.elements[0].id).toBe("deco-split-left");
    expect(layout.elements[1].id).toBe("deco-split-right");
  });

  it("modern theme has no decorator elements", () => {
    const slide: SlideData = {
      template: "cover",
      title: "Test",
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const layout = result.slides[0];
    const decoIds = layout.elements.filter((e) => e.id.startsWith("deco-"));
    expect(decoIds).toHaveLength(0);
  });
});

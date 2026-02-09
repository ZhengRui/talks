import { describe, it, expect } from "vitest";
import { resolveTheme } from "../theme";
import { splitBackground } from "./split-background";
import { edgeTabs } from "./edge-tabs";
import { sectionNumber } from "./section-number";
import { geometricAccent } from "./geometric-accent";
import { accentLine } from "./accent-line";
import { binderHoles } from "./binder-holes";
import { borderedBox } from "./bordered-box";
import { glowAccent } from "./glow-accent";
import { softGradientCircles } from "./soft-gradient-circles";
import { scanLines } from "./scan-lines";
import { gridOverlay } from "./grid-overlay";
import { halftoneDots } from "./halftone-dots";
import { applyDecorators } from "./index";
import { layoutPresentation } from "../index";
import type { SlideData } from "@/lib/types";
import { applyEffectsToSlideXml } from "@/lib/export/pptx-effects";

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

// --- Tier 1B: effects-based decorators ---

describe("glowAccent", () => {
  it("produces 2 circles with glow effects", () => {
    const theme = resolveTheme("neon-cyber");
    const els = glowAccent(theme);
    expect(els).toHaveLength(2);
    els.forEach((el) => {
      expect(el.kind).toBe("shape");
      if (el.kind === "shape") {
        expect(el.shape).toBe("circle");
        expect(el.effects).toBeDefined();
        expect(el.effects!.glow).toBeDefined();
        expect(el.effects!.softEdge).toBeGreaterThan(0);
      }
    });
  });

  it("uses accent and accent2 colors", () => {
    const theme = resolveTheme("neon-cyber");
    const els = glowAccent(theme);
    if (els[0].kind === "shape" && els[1].kind === "shape") {
      expect(els[0].style.fill).toBe(theme.accent);
      expect(els[1].style.fill).toBe(theme.accent2);
      expect(els[0].effects!.glow!.color).toBe(theme.accent);
      expect(els[1].effects!.glow!.color).toBe(theme.accent2);
    }
  });
});

describe("softGradientCircles", () => {
  it("produces 2 circles with softEdge", () => {
    const theme = resolveTheme("dark-botanical");
    const els = softGradientCircles(theme);
    expect(els).toHaveLength(2);
    els.forEach((el) => {
      expect(el.kind).toBe("shape");
      if (el.kind === "shape") {
        expect(el.shape).toBe("circle");
        expect(el.effects).toBeDefined();
        expect(el.effects!.softEdge).toBeGreaterThan(0);
      }
    });
  });
});

describe("scanLines", () => {
  it("produces 1 full-slide shape with narHorz pattern", () => {
    const theme = resolveTheme("terminal-green");
    const els = scanLines(theme);
    expect(els).toHaveLength(1);
    const el = els[0];
    expect(el.kind).toBe("shape");
    if (el.kind === "shape") {
      expect(el.rect).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
      expect(el.style.patternFill).toBeDefined();
      expect(el.style.patternFill!.preset).toBe("narHorz");
      expect(el.style.patternFill!.fgColor).toBe(theme.accent);
    }
  });
});

describe("gridOverlay", () => {
  it("produces 1 full-slide shape with smGrid pattern", () => {
    const theme = resolveTheme("swiss-modern");
    const els = gridOverlay(theme);
    expect(els).toHaveLength(1);
    const el = els[0];
    expect(el.kind).toBe("shape");
    if (el.kind === "shape") {
      expect(el.rect).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
      expect(el.style.patternFill).toBeDefined();
      expect(el.style.patternFill!.preset).toBe("smGrid");
    }
  });
});

describe("halftoneDots", () => {
  it("produces 1 full-slide shape with pct5 pattern", () => {
    const theme = resolveTheme("creative-voltage");
    const els = halftoneDots(theme);
    expect(els).toHaveLength(1);
    const el = els[0];
    expect(el.kind).toBe("shape");
    if (el.kind === "shape") {
      expect(el.rect).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
      expect(el.style.patternFill).toBeDefined();
      expect(el.style.patternFill!.preset).toBe("pct10");
    }
  });
});

// --- Tier 1B registry: effects decorators in background ---

describe("applyDecorators — Tier 1B", () => {
  it("puts glow-accent in background array", () => {
    const theme = resolveTheme("neon-cyber");
    const result = applyDecorators(theme, 0);
    const glowIds = result.background.filter((e) => e.id.startsWith("deco-glow"));
    expect(glowIds.length).toBeGreaterThan(0);
  });

  it("puts scan-lines in background array", () => {
    const theme = resolveTheme("terminal-green");
    const result = applyDecorators(theme, 0);
    const scanEl = result.background.find((e) => e.id === "deco-scan-lines");
    expect(scanEl).toBeDefined();
  });

  it("creative-voltage has split-bg + glow + halftone in background", () => {
    const theme = resolveTheme("creative-voltage");
    const result = applyDecorators(theme, 0);
    const ids = result.background.map((e) => e.id);
    expect(ids).toContain("deco-split-left");
    expect(ids).toContain("deco-glow-1");
    expect(ids).toContain("deco-halftone");
  });
});

// --- Tier 1B integration: decorators appear in layout output ---

describe("Tier 1B integration", () => {
  it("neon-cyber slides include glow decorators", () => {
    const slide: SlideData = { template: "cover", title: "Test" };
    const result = layoutPresentation("Test", [slide], "neon-cyber", "/img");
    const layout = result.slides[0];
    const glowEls = layout.elements.filter((e) => e.id.startsWith("deco-glow"));
    expect(glowEls.length).toBeGreaterThan(0);
    // glow elements should have effects
    const glowEl = glowEls[0];
    if (glowEl.kind === "shape") {
      expect(glowEl.effects).toBeDefined();
    }
  });

  it("terminal-green slides include scan-lines", () => {
    const slide: SlideData = { template: "bullets", title: "Test", bullets: ["A"] };
    const result = layoutPresentation("Test", [slide], "terminal-green", "/img");
    const layout = result.slides[0];
    const scanEl = layout.elements.find((e) => e.id === "deco-scan-lines");
    expect(scanEl).toBeDefined();
    if (scanEl?.kind === "shape") {
      expect(scanEl.style.patternFill).toBeDefined();
    }
  });
});

// --- PPTX effects post-processing ---

describe("applyEffectsToSlideXml", () => {
  const mockSlideXml = [
    '<p:sp><p:nvSpPr><p:cNvPr id="5" name="shape1"/>',
    "</p:nvSpPr><p:spPr>",
    "<a:solidFill><a:srgbClr val=\"FF0000\"/></a:solidFill>",
    "</p:spPr></p:sp>",
  ].join("");

  it("injects effectLst for glow effect", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      {
        spids: [5],
        effects: { glow: { color: "#00FF00", radius: 20, opacity: 0.5 } },
      },
    ]);
    expect(result).toContain("<a:effectLst>");
    expect(result).toContain("<a:glow");
    expect(result).toContain('val="00FF00"');
    expect(result).toContain("</a:effectLst></p:spPr>");
  });

  it("injects effectLst for softEdge", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      { spids: [5], effects: { softEdge: 30 } },
    ]);
    expect(result).toContain("<a:softEdge");
  });

  it("injects effectLst for blur", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      { spids: [5], effects: { blur: 10 } },
    ]);
    expect(result).toContain("<a:blur");
    expect(result).toContain('grow="1"');
  });

  it("replaces solidFill with pattFill", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      {
        spids: [5],
        patternFill: {
          preset: "narHorz",
          fgColor: "#00FF00",
          fgOpacity: 0.06,
          bgColor: "transparent",
        },
      },
    ]);
    expect(result).not.toContain("<a:solidFill>");
    expect(result).toContain('<a:pattFill prst="narHorz">');
    expect(result).toContain("<a:fgClr>");
    expect(result).toContain("<a:bgClr>");
  });

  it("applies both effects and patternFill", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      {
        spids: [5],
        effects: { glow: { color: "#FF00FF", radius: 40, opacity: 0.4 } },
        patternFill: { preset: "smGrid", fgColor: "#AABBCC", fgOpacity: 0.08, bgColor: "transparent" },
      },
    ]);
    expect(result).toContain("<a:effectLst>");
    expect(result).toContain('<a:pattFill prst="smGrid">');
    expect(result).not.toContain("<a:solidFill>");
  });

  it("returns unchanged xml when spid not found", () => {
    const result = applyEffectsToSlideXml(mockSlideXml, [
      { spids: [999], effects: { softEdge: 10 } },
    ]);
    expect(result).toBe(mockSlideXml);
  });

  it("handles PptxGenJS open/close cNvPr tags", () => {
    // PptxGenJS writes <p:cNvPr id="2" name="Shape 0"></p:cNvPr> not self-closing
    const pptxXml = [
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Shape 0"></p:cNvPr>',
      "<p:cNvSpPr/><p:nvPr></p:nvPr></p:nvSpPr><p:spPr>",
      '<a:solidFill><a:srgbClr val="00FFCC"><a:alpha val="18000"/></a:srgbClr></a:solidFill>',
      "<a:ln></a:ln></p:spPr></p:sp>",
    ].join("");
    const result = applyEffectsToSlideXml(pptxXml, [
      { spids: [2], effects: { glow: { color: "#00FFCC", radius: 100, opacity: 0.7 }, softEdge: 20 } },
    ]);
    expect(result).toContain("<a:effectLst>");
    expect(result).toContain("<a:glow");
    expect(result).toContain("<a:softEdge");
  });

  it("replaces noFill with pattFill for pattern-only shapes", () => {
    const noFillXml = [
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Shape 1"></p:cNvPr>',
      "<p:cNvSpPr/><p:nvPr></p:nvPr></p:nvSpPr><p:spPr>",
      "<a:noFill/><a:ln></a:ln></p:spPr></p:sp>",
    ].join("");
    const result = applyEffectsToSlideXml(noFillXml, [
      { spids: [3], patternFill: { preset: "narHorz", fgColor: "#00FF00", fgOpacity: 0.06, bgColor: "transparent" } },
    ]);
    expect(result).not.toContain("<a:noFill/>");
    expect(result).toContain('<a:pattFill prst="narHorz">');
  });
});

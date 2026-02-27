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

describe("resolveComponent — text", () => {
  it("produces a text element with default body style", () => {
    const { elements, height } = resolveComponent(
      { type: "text", text: "Hello world" },
      makeCtx(),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("text");
    if (elements[0].kind === "text") {
      expect(elements[0].text).toBe("Hello world");
      expect(elements[0].style.fontSize).toBe(28);
      expect(elements[0].style.fontWeight).toBe(400);
      expect(elements[0].style.fontFamily).toBe(theme.fontBody);
    }
    expect(height).toBeGreaterThan(0);
  });

  it("respects all style overrides", () => {
    const { elements } = resolveComponent(
      {
        type: "text",
        text: "Styled",
        fontSize: 36,
        fontWeight: "bold",
        fontFamily: "heading",
        color: "theme.accent",
        textAlign: "center",
        fontStyle: "italic",
        lineHeight: 1.2,
      },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(36);
      expect(elements[0].style.fontWeight).toBe(700);
      expect(elements[0].style.fontFamily).toBe(theme.fontHeading);
      expect(elements[0].style.color).toBe(theme.accent);
      expect(elements[0].style.textAlign).toBe("center");
      expect(elements[0].style.fontStyle).toBe("italic");
      expect(elements[0].style.lineHeight).toBe(1.2);
    }
  });

  it("returns gapBefore/gapAfter from marginTop/marginBottom", () => {
    const result = resolveComponent(
      { type: "text", text: "Spaced", marginTop: 8, marginBottom: 40 },
      makeCtx(),
    );
    expect(result.gapBefore).toBe(8);
    expect(result.gapAfter).toBe(40);
  });

  it("uses mono font family", () => {
    const { elements } = resolveComponent(
      { type: "text", text: "code", fontFamily: "mono" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontFamily).toBe(theme.fontMono);
    }
  });

  it("uses full panel width by default", () => {
    const { elements } = resolveComponent(
      { type: "text", text: "Full width" },
      makeCtx(),
    );
    expect(elements[0].rect.w).toBe(panelRect.w);
    expect(elements[0].rect.x).toBe(0);
  });

  it("constrains width and centers when maxWidth is set", () => {
    const { elements } = resolveComponent(
      { type: "text", text: "Narrow caption", maxWidth: 600 },
      makeCtx(),
    );
    expect(elements[0].rect.w).toBe(600);
    expect(elements[0].rect.x).toBe((panelRect.w - 600) / 2);
  });

  it("clamps maxWidth to panel width when larger", () => {
    const { elements } = resolveComponent(
      { type: "text", text: "Wide", maxWidth: 2000 },
      makeCtx(),
    );
    expect(elements[0].rect.w).toBe(panelRect.w);
    expect(elements[0].rect.x).toBe(0);
  });
});

describe("resolveComponent — animationType on any component", () => {
  it("applies animationType to heading elements", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Title", animationType: "slide-left" },
      makeCtx({ animate: true, animationDelay: 200 }),
    );
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.type).toBe("slide-left");
    expect(elements[0].animation!.delay).toBe(200);
  });

  it("applies animationType to body elements", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Content", animationType: "slide-right" },
      makeCtx({ animate: true, animationDelay: 100 }),
    );
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.type).toBe("slide-right");
  });

  it("does not apply when animate is false", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Title", animationType: "slide-left" },
      makeCtx({ animate: false }),
    );
    expect(elements[0].animation).toBeUndefined();
  });

  it("animationDelay overrides ctx.animationDelay", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Title", animationType: "fade-up", animationDelay: 0 },
      makeCtx({ animate: true, animationDelay: 500 }),
    );
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.delay).toBe(0); // component delay wins over ctx
  });

  it("animationDelay on box overrides ctx.animationDelay", () => {
    const { elements } = resolveComponent(
      { type: "box", children: [{ type: "body", text: "Hi" }], animationType: "slide-left", animationDelay: 200 },
      makeCtx({ animate: true, animationDelay: 0 }),
    );
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.delay).toBe(200);
  });

  it("overrides bullet stagger animations", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A", "B"], animationType: "slide-right" },
      makeCtx({ animate: true, animationDelay: 0 }),
    );
    elements.forEach((el) => {
      expect(el.animation!.type).toBe("slide-right");
    });
  });
});

describe("resolveComponent — opacity on any component", () => {
  it("sets opacity on group elements (box)", () => {
    const { elements } = resolveComponent(
      { type: "box", children: [{ type: "body", text: "Hi" }], opacity: 0.5 },
      makeCtx({ animate: false }),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("group");
    if (elements[0].kind === "group") {
      expect(elements[0].style?.opacity).toBe(0.5);
    }
  });

  it("sets opacity on image elements", () => {
    const { elements } = resolveComponent(
      { type: "image", src: "photo.jpg", opacity: 0.3 },
      makeCtx({ animate: false }),
    );
    expect(elements).toHaveLength(1);
    if (elements[0].kind === "image") {
      expect(elements[0].opacity).toBe(0.3);
    }
  });

  it("wraps text elements in an opacity group", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Faded", opacity: 0.7 },
      makeCtx({ animate: false }),
    );
    // Text element gets wrapped in a group with opacity
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("group");
    if (elements[0].kind === "group") {
      expect(elements[0].style?.opacity).toBe(0.7);
      expect(elements[0].children[0].kind).toBe("text");
    }
  });

  it("does not apply when opacity is 1 or undefined", () => {
    const result1 = resolveComponent(
      { type: "heading", text: "Full", opacity: 1 },
      makeCtx({ animate: false }),
    );
    // opacity=1 is not < 1, so no wrapping
    expect(result1.elements[0].kind).toBe("text");

    const result2 = resolveComponent(
      { type: "heading", text: "Default" },
      makeCtx({ animate: false }),
    );
    expect(result2.elements[0].kind).toBe("text");
  });

  it("preserves animation when wrapping text in opacity group", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Faded", opacity: 0.5, animationType: "fade-up" },
      makeCtx({ animate: true, animationDelay: 100 }),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("group");
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.type).toBe("fade-up");
  });
});

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

  it("respects textAlign prop", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Centered", textAlign: "center" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("center");
    }
  });

  it("defaults textAlign to left", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Default" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("left");
    }
  });

  it("respects fontSize override", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Big", fontSize: 80 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(80);
    }
  });

  it("fontSize override takes precedence over level", () => {
    const { elements } = resolveComponent(
      { type: "heading", text: "Custom", level: 2, fontSize: 72 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(72);
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

  it("respects textAlign prop", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Centered body", textAlign: "center" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("center");
    }
  });

  it("respects fontSize override", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Large body", fontSize: 36 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.fontSize).toBe(36);
    }
  });

  it("respects color override with theme token", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Muted", color: "theme.textMuted" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.color).toBe(theme.textMuted);
    }
  });

  it("color override takes precedence over panel textColor", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Custom", color: "#ff0000" },
      makeCtx({ textColor: "#ffffff" }),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.color).toBe("#ff0000");
    }
  });

  it("forwards lineHeight when specified", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Tall lines", lineHeight: 1.7 },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.lineHeight).toBe(1.7);
    }
  });

  it("defaults lineHeight to 1.6 when not specified", () => {
    const { elements } = resolveComponent(
      { type: "body", text: "Default height" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.lineHeight).toBe(1.6);
    }
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

  it("defaults to 30px font and 16px gap", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A", "B"] },
      makeCtx(),
    );
    // Check font size on the text child inside the group
    const group = elements[0];
    if (group.kind === "group") {
      const textEl = group.children[0];
      if (textEl.kind === "text") {
        expect(textEl.style.fontSize).toBe(30);
      }
    }
    // Gap check: second item y > first item y + first item h + 16
    const gap = elements[1].rect.y - (elements[0].rect.y + elements[0].rect.h);
    expect(gap).toBe(16);
  });

  it("respects fontSize override", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A"], fontSize: 24 },
      makeCtx(),
    );
    const group = elements[0];
    if (group.kind === "group") {
      const textEl = group.children[0];
      if (textEl.kind === "text") {
        expect(textEl.style.fontSize).toBe(24);
      }
    }
  });

  it("respects gap override", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A", "B"], gap: 8 },
      makeCtx(),
    );
    const gap = elements[1].rect.y - (elements[0].rect.y + elements[0].rect.h);
    expect(gap).toBe(8);
  });

  it("applies per-item staggered animation when animate is true", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A", "B", "C"] },
      makeCtx({ animate: true, animationDelay: 200 }),
    );
    expect(elements).toHaveLength(3);
    elements.forEach((el, i) => {
      expect(el.animation).toBeDefined();
      expect(el.animation!.type).toBe("fade-up");
      expect(el.animation!.delay).toBe(200 + i * 100);
    });
  });

  it("does not apply animation when animate is false", () => {
    const { elements } = resolveComponent(
      { type: "bullets", items: ["A", "B"] },
      makeCtx({ animate: false }),
    );
    elements.forEach((el) => {
      expect(el.animation).toBeUndefined();
    });
  });

  it("ordered card variant renders circle badges inside groups", () => {
    const { elements } = resolveComponent(
      { type: "bullets", ordered: true, items: ["First", "Second"] },
      makeCtx({ animate: false }),
    );
    expect(elements).toHaveLength(2);
    elements.forEach((el) => expect(el.kind).toBe("group"));
    // Each group should have a badge group + text child
    if (elements[0].kind === "group") {
      expect(elements[0].children.length).toBe(2);
      const badge = elements[0].children[0];
      expect(badge.kind).toBe("group");
      if (badge.kind === "group") {
        expect(badge.style?.borderRadius).toBe(100); // circle
        expect(badge.style?.fill).toBe(theme.accent);
      }
      // No left accent border for ordered
      expect(elements[0].border).toBeUndefined();
    }
  });

  it("plain variant renders text without card background", () => {
    const { elements } = resolveComponent(
      { type: "bullets", variant: "plain", items: ["A", "B"] },
      makeCtx({ animate: false }),
    );
    // Plain unordered: just text elements, no groups
    elements.forEach((el) => expect(el.kind).toBe("text"));
  });

  it("ordered plain variant renders badges and text separately", () => {
    const { elements } = resolveComponent(
      { type: "bullets", ordered: true, variant: "plain", items: ["A", "B"] },
      makeCtx({ animate: false }),
    );
    // Each item produces a badge group + text element = 4 total
    expect(elements).toHaveLength(4);
    expect(elements[0].kind).toBe("group"); // badge
    expect(elements[1].kind).toBe("text");  // text
    expect(elements[2].kind).toBe("group"); // badge
    expect(elements[3].kind).toBe("text");  // text
    if (elements[0].kind === "group") {
      expect(elements[0].style?.borderRadius).toBe(100);
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

  it("defaults textAlign to left", () => {
    const { elements } = resolveComponent(
      { type: "stat", value: "42", label: "items" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("left");
    }
    if (elements[1].kind === "text") {
      expect(elements[1].style.textAlign).toBe("left");
    }
  });

  it("respects textAlign center", () => {
    const { elements } = resolveComponent(
      { type: "stat", value: "99", label: "score", textAlign: "center" },
      makeCtx(),
    );
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("center");
    }
    if (elements[1].kind === "text") {
      expect(elements[1].style.textAlign).toBe("center");
    }
  });
});

describe("resolveComponent — columns", () => {
  it("distributes children horizontally with correct widths", () => {
    const panel: Rect = { x: 0, y: 0, w: 800, h: 600 };
    const { elements, height } = resolveComponent(
      {
        type: "columns",
        children: [
          { type: "stat", value: "10", label: "A" },
          { type: "stat", value: "20", label: "B" },
        ],
      },
      makeCtx({ panel, animate: false }),
    );
    // 2 columns, default gap 32: colW = (800 - 32) / 2 = 384
    // Each stat produces 2 text elements → 4 total
    expect(elements).toHaveLength(4);
    // First column elements at x=0
    expect(elements[0].rect.x).toBe(0);
    // Second column elements at x = 384 + 32 = 416
    expect(elements[2].rect.x).toBe(416);
    expect(height).toBeGreaterThan(0);
  });

  it("uses custom gap", () => {
    const panel: Rect = { x: 0, y: 0, w: 800, h: 600 };
    const { elements } = resolveComponent(
      {
        type: "columns",
        gap: 16,
        children: [
          { type: "stat", value: "1", label: "X" },
          { type: "stat", value: "2", label: "Y" },
        ],
      },
      makeCtx({ panel, animate: false }),
    );
    // colW = (800 - 16) / 2 = 392, second col at 392 + 16 = 408
    expect(elements[2].rect.x).toBe(408);
  });

  it("height is max of children heights", () => {
    const panel: Rect = { x: 0, y: 0, w: 800, h: 600 };
    const { height } = resolveComponent(
      {
        type: "columns",
        children: [
          { type: "stat", value: "1", label: "Short" },
          { type: "stat", value: "2", label: "Short" },
        ],
      },
      makeCtx({ panel, animate: false }),
    );
    // Both stats have same height — max should equal either
    const singleStat = resolveComponent(
      { type: "stat", value: "1", label: "Short" },
      makeCtx({ panel, animate: false }),
    );
    expect(height).toBe(singleStat.height);
  });

  it("applies per-column staggered animation", () => {
    const panel: Rect = { x: 0, y: 0, w: 900, h: 600 };
    const { elements } = resolveComponent(
      {
        type: "columns",
        children: [
          { type: "stat", value: "A", label: "a" },
          { type: "stat", value: "B", label: "b" },
          { type: "stat", value: "C", label: "c" },
        ],
      },
      makeCtx({ panel, animate: true, animationDelay: 200 }),
    );
    // Each column's elements should have staggered delays
    // Col 0: delay 200, Col 1: delay 300, Col 2: delay 400
    expect(elements[0].animation).toBeDefined();
    expect(elements[0].animation!.delay).toBe(200);
    expect(elements[2].animation).toBeDefined();
    expect(elements[2].animation!.delay).toBe(300);
    expect(elements[4].animation).toBeDefined();
    expect(elements[4].animation!.delay).toBe(400);
  });

  it("returns empty for no children", () => {
    const { elements, height } = resolveComponent(
      { type: "columns", children: [] },
      makeCtx({ animate: false }),
    );
    expect(elements).toHaveLength(0);
    expect(height).toBe(0);
  });

  it("uses ratio for 2-column width split", () => {
    const panel: Rect = { x: 0, y: 0, w: 1600, h: 600 };
    const { elements } = resolveComponent(
      {
        type: "columns",
        gap: 40,
        ratio: 0.3,
        children: [
          { type: "stat", value: "A", label: "a" },
          { type: "stat", value: "B", label: "b" },
        ],
      },
      makeCtx({ panel, animate: false }),
    );
    // col0W = round(1600 * 0.3) = 480, col1W = 1600 - 480 - 40 = 1080
    // First column at x=0, second column at x=480+40=520
    expect(elements[0].rect.x).toBe(0);
    expect(elements[2].rect.x).toBe(520);
  });

  it("equalHeight stretches all group elements to max height", () => {
    const panel: Rect = { x: 0, y: 0, w: 800, h: 600 };
    const { elements } = resolveComponent(
      {
        type: "columns",
        equalHeight: true,
        children: [
          { type: "box", children: [{ type: "body", text: "Short" }] },
          { type: "box", children: [{ type: "body", text: "Much longer text that wraps to multiple lines for testing purposes" }] },
        ],
      },
      makeCtx({ panel, animate: false }),
    );
    // Both boxes are groups — should have same height (the max)
    const groups = elements.filter((e) => e.kind === "group");
    expect(groups).toHaveLength(2);
    expect(groups[0].rect.h).toBe(groups[1].rect.h);
  });
});

describe("resolveComponent — box", () => {
  it("wraps children in GroupElement with card styling", () => {
    const { elements, height } = resolveComponent(
      {
        type: "box",
        children: [{ type: "stat", value: "42", label: "Answer" }],
      },
      makeCtx({ animate: false }),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("group");
    if (elements[0].kind === "group") {
      expect(elements[0].style?.fill).toBe(theme.cardBg);
      expect(elements[0].style?.borderRadius).toBe(theme.radius);
      expect(elements[0].style?.shadow).toEqual(theme.shadow);
      expect(elements[0].children.length).toBeGreaterThan(0);
    }
    expect(height).toBeGreaterThan(0);
  });

  it("accentTop adds top border", () => {
    const { elements } = resolveComponent(
      {
        type: "box",
        accentTop: true,
        children: [{ type: "stat", value: "1", label: "X" }],
      },
      makeCtx({ animate: false }),
    );
    if (elements[0].kind === "group") {
      expect(elements[0].border?.sides).toContain("top");
      expect(elements[0].border?.color).toBe(theme.accent);
      expect(elements[0].border?.width).toBe(3);
    }
  });

  it("uses default cardBorder when accentTop is false", () => {
    const { elements } = resolveComponent(
      {
        type: "box",
        children: [{ type: "stat", value: "1", label: "X" }],
      },
      makeCtx({ animate: false }),
    );
    if (elements[0].kind === "group") {
      expect(elements[0].border).toEqual(theme.cardBorder);
    }
  });

  it("fill expands box to panel height", () => {
    const panel: Rect = { x: 0, y: 0, w: 400, h: 800 };
    const { elements, height } = resolveComponent(
      {
        type: "box",
        fill: true,
        children: [{ type: "body", text: "Short" }],
      },
      makeCtx({ panel, animate: false }),
    );
    // Box should expand to full panel height
    expect(height).toBe(800);
    if (elements[0].kind === "group") {
      expect(elements[0].rect.h).toBe(800);
    }
  });

  it("fill does not vertically center content", () => {
    const panel: Rect = { x: 0, y: 0, w: 400, h: 800 };
    const { elements } = resolveComponent(
      {
        type: "box",
        fill: true,
        children: [{ type: "body", text: "Short" }],
      },
      makeCtx({ panel, animate: false }),
    );
    if (elements[0].kind === "group") {
      // Content should stay at top (padding=28 default)
      const firstChild = elements[0].children[0];
      expect(firstChild.rect.y).toBe(28);
    }
  });

  it("panel variant has fill and borderRadius but no shadow or border", () => {
    const { elements } = resolveComponent(
      {
        type: "box",
        variant: "panel",
        background: "theme.bgSecondary",
        children: [{ type: "body", text: "Sidebar" }],
      },
      makeCtx({ animate: false }),
    );
    if (elements[0].kind === "group") {
      expect(elements[0].style?.fill).toBe(theme.bgSecondary);
      expect(elements[0].style?.borderRadius).toBe(theme.radius);
      expect(elements[0].style?.shadow).toBeUndefined();
      expect(elements[0].border).toBeUndefined();
    }
  });

  it("uses custom background color", () => {
    const { elements } = resolveComponent(
      {
        type: "box",
        background: "theme.bgSecondary",
        children: [{ type: "body", text: "Sidebar" }],
      },
      makeCtx({ animate: false }),
    );
    if (elements[0].kind === "group") {
      expect(elements[0].style?.fill).toBe(theme.bgSecondary);
    }
  });

  it("respects custom padding", () => {
    const panel: Rect = { x: 0, y: 0, w: 400, h: 400 };
    const result40 = resolveComponent(
      {
        type: "box",
        padding: 40,
        children: [{ type: "stat", value: "1", label: "X" }],
      },
      makeCtx({ panel, animate: false }),
    );
    const result20 = resolveComponent(
      {
        type: "box",
        padding: 20,
        children: [{ type: "stat", value: "1", label: "X" }],
      },
      makeCtx({ panel, animate: false }),
    );
    // Larger padding → taller box (more top+bottom padding)
    expect(result40.height).toBeGreaterThan(result20.height);
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

  it("respects width override", () => {
    const { elements } = resolveComponent(
      { type: "divider", width: 120 },
      makeCtx(),
    );
    expect(elements[0].rect.w).toBe(120);
  });

  it("centers divider when align is center", () => {
    const { elements } = resolveComponent(
      { type: "divider", width: 120, align: "center" },
      makeCtx(), // panel.w = 800
    );
    expect(elements[0].rect.x).toBe((800 - 120) / 2);
    expect(elements[0].rect.w).toBe(120);
  });

  it("defaults divider to left alignment", () => {
    const { elements } = resolveComponent(
      { type: "divider" },
      makeCtx(),
    );
    expect(elements[0].rect.x).toBe(0);
  });

  it("returns gapBefore/gapAfter from marginTop/marginBottom", () => {
    const result = resolveComponent(
      { type: "divider", marginTop: 16, marginBottom: 40 },
      makeCtx(),
    );
    expect(result.gapBefore).toBe(16);
    expect(result.gapAfter).toBe(40);
  });

  it("gapBefore/gapAfter are undefined when margins not set", () => {
    const result = resolveComponent(
      { type: "divider" },
      makeCtx(),
    );
    expect(result.gapBefore).toBeUndefined();
    expect(result.gapAfter).toBeUndefined();
  });
});

describe("stacker — gapBefore/gapAfter", () => {
  it("divider marginTop/marginBottom override stacker gap", () => {
    const components: SlideComponent[] = [
      { type: "heading", text: "Title" },
      { type: "divider", variant: "gradient", marginTop: 16, marginBottom: 40 },
      { type: "body", text: "Content" },
    ];
    const panel: Rect = { x: 100, y: 50, w: 800, h: 900 };
    const els = stackComponents(components, panel, theme, { animate: false, imageBase: "" });

    // Find the divider and body elements
    const divider = els.find((e) => e.id.includes("divider"));
    const heading = els.find((e) => e.id.includes("heading"));
    const body = els.find((e) => e.id.includes("body"));

    expect(divider).toBeDefined();
    expect(heading).toBeDefined();
    expect(body).toBeDefined();

    // Gap from heading bottom to divider top = marginTop (16)
    const headingBottom = heading!.rect.y + heading!.rect.h;
    expect(divider!.rect.y - headingBottom).toBe(16);

    // Gap from divider bottom to body top = marginBottom (40)
    const dividerBottom = divider!.rect.y + divider!.rect.h;
    expect(body!.rect.y - dividerBottom).toBe(40);
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

  it("centers text and removes accent bar when textAlign is center", () => {
    const { elements } = resolveComponent(
      { type: "quote", text: "Centered quote.", textAlign: "center" },
      makeCtx(),
    );
    // No accent bar — only quote text
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe("text");
    if (elements[0].kind === "text") {
      expect(elements[0].style.textAlign).toBe("center");
      expect(elements[0].rect.x).toBe(0); // no indent
    }
  });

  it("respects fontSize override", () => {
    const { elements } = resolveComponent(
      { type: "quote", text: "Big quote.", fontSize: 36 },
      makeCtx(),
    );
    const quoteText = elements.find((e) => e.kind === "text" && e.id.includes("quote-text"));
    if (quoteText?.kind === "text") {
      expect(quoteText.style.fontSize).toBe(36);
    }
  });

  it("respects attributionFontSize override", () => {
    const { elements } = resolveComponent(
      { type: "quote", text: "Q.", attribution: "Author", attributionFontSize: 26 },
      makeCtx(),
    );
    const attr = elements.find((e) => e.kind === "text" && e.id.includes("quote-attr"));
    if (attr?.kind === "text") {
      expect(attr.style.fontSize).toBe(26);
    }
  });

  it("decorative adds large opening quote mark", () => {
    const { elements, height } = resolveComponent(
      { type: "quote", text: "A quote.", textAlign: "center", decorative: true },
      makeCtx(),
    );
    // First element should be the decorative mark
    const mark = elements.find((e) => e.kind === "text" && e.id.includes("quote-mark"));
    expect(mark).toBeDefined();
    if (mark?.kind === "text") {
      expect(mark.text).toBe("\u201C");
      expect(mark.style.fontSize).toBe(120);
      expect(mark.style.color).toBe(theme.accent);
    }
    // Quote text should be below the mark
    const quoteText = elements.find((e) => e.kind === "text" && e.id.includes("quote-text"));
    expect(quoteText).toBeDefined();
    expect(quoteText!.rect.y).toBeGreaterThan(mark!.rect.y);
    expect(height).toBeGreaterThan(120);
  });

  it("decorative suppresses accent bar even for left-aligned quotes", () => {
    const { elements } = resolveComponent(
      { type: "quote", text: "Left decorative.", decorative: true },
      makeCtx(),
    );
    const bar = elements.find((e) => e.kind === "shape" && e.id.includes("quote-bar"));
    expect(bar).toBeUndefined();
    const mark = elements.find((e) => e.kind === "text" && e.id.includes("quote-mark"));
    expect(mark).toBeDefined();
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

  it("uses default radiusSm when no borderRadius specified", () => {
    const { elements } = resolveComponent(
      { type: "image", src: "photo.jpg" },
      makeCtx(),
    );
    if (elements[0].kind === "image") {
      expect(elements[0].borderRadius).toBe(theme.radiusSm);
    }
  });

  it("uses custom borderRadius when specified", () => {
    const { elements } = resolveComponent(
      { type: "image", src: "photo.jpg", borderRadius: 16 },
      makeCtx(),
    );
    if (elements[0].kind === "image") {
      expect(elements[0].borderRadius).toBe(16);
    }
  });

  it("forces square dimensions and centers when clipCircle is true", () => {
    const { elements } = resolveComponent(
      { type: "image", src: "avatar.jpg", height: 200, clipCircle: true },
      makeCtx(),
    );
    expect(elements[0].rect.w).toBe(200);  // square: w = h
    expect(elements[0].rect.h).toBe(200);
    expect(elements[0].rect.x).toBe((panelRect.w - 200) / 2); // centered
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

  it("flex spacer returns height 0 and flex flag", () => {
    const result = resolveComponent(
      { type: "spacer", flex: true },
      makeCtx(),
    );
    expect(result.elements).toHaveLength(0);
    expect(result.height).toBe(0);
    expect(result.flex).toBe(true);
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

  it("vertically centers content when verticalAlign is center", () => {
    const tallPanel: Rect = { x: 0, y: 0, w: 800, h: 1000 };
    const elements = stackComponents(
      [{ type: "heading", text: "Short" }],
      tallPanel,
      theme,
      { animate: false, verticalAlign: "center" },
    );
    // Content should be centered — y should be > 0 (not at the top)
    expect(elements[0].rect.y).toBeGreaterThan(0);
    // And roughly centered
    const contentH = elements[0].rect.h;
    const expectedY = (tallPanel.h - contentH) / 2;
    expect(elements[0].rect.y).toBeCloseTo(expectedY, 0);
  });

  it("aligns content to bottom when verticalAlign is bottom", () => {
    const tallPanel: Rect = { x: 0, y: 0, w: 800, h: 1000 };
    const elements = stackComponents(
      [{ type: "heading", text: "Short" }],
      tallPanel,
      theme,
      { animate: false, verticalAlign: "bottom" },
    );
    const contentH = elements[0].rect.h;
    const expectedY = tallPanel.h - contentH;
    expect(elements[0].rect.y).toBeCloseTo(expectedY, 0);
  });

  it("does not offset when verticalAlign is top (default)", () => {
    const elements = stackComponents(
      [{ type: "heading", text: "Short" }],
      panelRect,
      theme,
      { animate: false, verticalAlign: "top" },
    );
    expect(elements[0].rect.y).toBe(panelRect.y);
  });
});

describe("stacker — flex spacer", () => {
  it("single flex spacer pushes subsequent content down", () => {
    const tallPanel: Rect = { x: 0, y: 0, w: 800, h: 1000 };
    const elements = stackComponents(
      [
        { type: "heading", text: "Top" },
        { type: "spacer", flex: true },
        { type: "heading", text: "Bottom" },
      ],
      tallPanel,
      theme,
      { animate: false },
    );

    const top = elements.find((e) => e.kind === "text" && "text" in e && e.text === "Top")!;
    const bottom = elements.find((e) => e.kind === "text" && "text" in e && e.text === "Bottom")!;

    // Top heading at y=0, bottom heading pushed down by flex space
    expect(top.rect.y).toBe(0);
    // Bottom heading should end at panel bottom
    expect(bottom.rect.y + bottom.rect.h).toBeCloseTo(tallPanel.h, 0);
  });

  it("two flex spacers center content between them", () => {
    const tallPanel: Rect = { x: 0, y: 0, w: 800, h: 1000 };
    const elements = stackComponents(
      [
        { type: "heading", text: "Top" },
        { type: "spacer", flex: true },
        { type: "heading", text: "Middle" },
        { type: "spacer", flex: true },
        { type: "heading", text: "Bottom" },
      ],
      tallPanel,
      theme,
      { animate: false },
    );

    const top = elements.find((e) => e.kind === "text" && "text" in e && e.text === "Top")!;
    const middle = elements.find((e) => e.kind === "text" && "text" in e && e.text === "Middle")!;
    const bottom = elements.find((e) => e.kind === "text" && "text" in e && e.text === "Bottom")!;

    // Top at the start
    expect(top.rect.y).toBe(0);
    // Middle should be roughly centered
    const midCenter = middle.rect.y + middle.rect.h / 2;
    expect(midCenter).toBeCloseTo(tallPanel.h / 2, -1);
    // Bottom near the end
    expect(bottom.rect.y + bottom.rect.h).toBeCloseTo(tallPanel.h, 0);
  });

  it("flex spacer with no remaining space gets height 0", () => {
    const tinyPanel: Rect = { x: 0, y: 0, w: 800, h: 50 };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const elements = stackComponents(
      [
        { type: "heading", text: "Big Title That Takes Space" },
        { type: "spacer", flex: true },
        { type: "heading", text: "Another" },
      ],
      tinyPanel,
      theme,
      { animate: false },
    );

    // Both headings should still render (flex space = 0, no negative offset)
    expect(elements.length).toBeGreaterThanOrEqual(2);
    // Second heading should come right after the first + two gaps (heading→spacer, spacer→heading)
    const first = elements[0];
    const second = elements[1];
    expect(second.rect.y).toBeCloseTo(first.rect.y + first.rect.h + 28 * 2, 0); // 28 = default gap × 2

    warnSpy.mockRestore();
  });
});

// ============================================================
// split-compose — padding & gap
// ============================================================

describe("split-compose — padding & gap", () => {
  it("default padding (60) when no padding and no fill", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: { children: [{ type: "heading", text: "L" }] },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("l"),
    );
    // Default padding = 60 on all sides
    expect(leftHeading?.rect.x).toBe(60);
    expect(leftHeading?.rect.y).toBe(60);
  });

  it("fill: true gives zero padding (backward compat)", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        fill: true,
        children: [{ type: "image", src: "photo.jpg", height: 1080 }],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftImage = result.slides[0].elements.find((e) => e.kind === "image");
    expect(leftImage?.rect.x).toBe(0);
    expect(leftImage?.rect.y).toBe(0);
  });

  it("uniform padding overrides default", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        padding: 40,
        children: [{ type: "heading", text: "L" }],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("l"),
    );
    expect(leftHeading?.rect.x).toBe(40);
    expect(leftHeading?.rect.y).toBe(40);
  });

  it("2-value padding [vert, horiz]", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        padding: [40, 80],
        children: [{ type: "heading", text: "L" }],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("l"),
    );
    // top=40, left=80
    expect(leftHeading?.rect.x).toBe(80);
    expect(leftHeading?.rect.y).toBe(40);
    // width = splitX(960) - left(80) - right(80) = 800
    expect(leftHeading?.rect.w).toBe(800);
  });

  it("4-value padding [top, right, bottom, left]", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        padding: [10, 20, 30, 40],
        children: [{ type: "heading", text: "L" }],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("l"),
    );
    // left=40, top=10
    expect(leftHeading?.rect.x).toBe(40);
    expect(leftHeading?.rect.y).toBe(10);
    // width = splitX(960) - left(40) - right(20) = 900
    expect(leftHeading?.rect.w).toBe(900);
  });

  it("padding overrides fill", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        fill: true,
        padding: 40,
        children: [{ type: "heading", text: "L" }],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("l"),
    );
    // padding wins over fill
    expect(leftHeading?.rect.x).toBe(40);
    expect(leftHeading?.rect.y).toBe(40);
  });

  it("custom gap: 0 removes spacing between components", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        gap: 0,
        children: [
          { type: "heading", text: "First" },
          { type: "heading", text: "Second" },
        ],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftEls = result.slides[0].elements.filter(
      (e) => e.kind === "text" && e.id?.startsWith("l"),
    );
    expect(leftEls).toHaveLength(2);
    // Gap=0: second heading starts right after the first
    const firstBottom = leftEls[0].rect.y + leftEls[0].rect.h;
    expect(leftEls[1].rect.y).toBe(firstBottom);
  });

  it("default gap (28) when gap is not specified", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        children: [
          { type: "heading", text: "First" },
          { type: "heading", text: "Second" },
        ],
      },
      right: { children: [{ type: "heading", text: "R" }] },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftEls = result.slides[0].elements.filter(
      (e) => e.kind === "text" && e.id?.startsWith("l"),
    );
    expect(leftEls).toHaveLength(2);
    const firstBottom = leftEls[0].rect.y + leftEls[0].rect.h;
    expect(leftEls[1].rect.y - firstBottom).toBe(28);
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

  it("fill mode uses zero padding for edge-to-edge content", () => {
    const slide: SlideData = {
      template: "split-compose",
      left: {
        fill: true,
        children: [{ type: "image", src: "photo.jpg", height: 1080 }],
      },
      right: {
        children: [{ type: "heading", text: "Text" }],
      },
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const leftImage = result.slides[0].elements.find(
      (e) => e.kind === "image",
    );
    // fill: true → image starts at x=0, y=0 (no padding)
    expect(leftImage).toBeDefined();
    expect(leftImage?.rect.x).toBe(0);
    expect(leftImage?.rect.y).toBe(0);

    // Right panel still has normal padding (60px)
    const rightHeading = result.slides[0].elements.find(
      (e) => e.kind === "text" && e.id?.includes("heading"),
    );
    expect(rightHeading).toBeDefined();
    // Right panel starts at splitX (960) + 60 padding
    expect(rightHeading?.rect.x).toBe(960 + 60);
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

  it("vertically centers content when verticalAlign is center", () => {
    const slide: SlideData = {
      template: "full-compose",
      verticalAlign: "center",
      children: [{ type: "heading", text: "Centered" }],
    };
    const result = layoutPresentation("Test", [slide], "modern", "/img");
    const heading = result.slides[0].elements[0];
    // Should NOT be at top (y=60 padding) — should be pushed down
    expect(heading.rect.y).toBeGreaterThan(60);
    // Should be roughly vertically centered on the 1080px canvas
    expect(heading.rect.y).toBeGreaterThan(400);
    expect(heading.rect.y).toBeLessThan(600);
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

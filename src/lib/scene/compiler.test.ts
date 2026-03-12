import { describe, expect, it } from "vitest";
import { resolveTheme } from "@/lib/layout/theme";
import { compileSceneSlide } from "./compiler";
import type { SceneSlideData } from "@/lib/types";
import { layoutPresentation } from "@/lib/layout";

describe("compileSceneSlide", () => {
  it("resolves guide references and text style tokens", () => {
    const theme = resolveTheme("dark-tech");
    const slide: SceneSlideData = {
      mode: "scene",
      background: { type: "solid", color: "theme.bg" },
      guides: {
        x: { content: 160 },
        y: { top: 140 },
      },
      children: [
        {
          kind: "text",
          id: "title",
          frame: { left: "@x.content", top: "@y.top", w: 720 },
          text: "Hello Scene",
          style: {
            fontFamily: "heading",
            fontSize: 48,
            fontWeight: 700,
            color: "theme.accent",
            lineHeight: 1.15,
          },
        },
      ],
    };

    const result = compileSceneSlide(slide, theme, "/scene");
    const title = result.elements[0];

    expect(result.background).toBe(theme.bg);
    expect(title.kind).toBe("text");
    if (title.kind === "text") {
      expect(title.rect.x).toBe(160);
      expect(title.rect.y).toBe(140);
      expect(title.rect.w).toBe(720);
      expect(title.style.fontFamily).toBe(theme.fontHeading);
      expect(title.style.color).toBe(theme.accent);
    }
  });

  it("lays out stack groups with explicit gap", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "group",
          id: "stack",
          frame: { x: 100, y: 120, w: 400, h: 300 },
          layout: { type: "stack", gap: 24 },
          children: [
            {
              kind: "text",
              id: "heading",
              frame: { w: 400 },
              text: "Stack title",
              style: {
                fontFamily: "heading",
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.1,
              },
            },
            {
              kind: "shape",
              id: "rule",
              frame: { w: 120, h: 4 },
              shape: "rect",
              style: { fill: "#00ffc8" },
            },
          ],
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("dark-tech"), "/scene");
    const stack = result.elements[0];

    expect(stack.kind).toBe("group");
    if (stack.kind === "group") {
      const heading = stack.children[0];
      const rule = stack.children[1];
      expect(rule.rect.y).toBe(heading.rect.y + heading.rect.h + 24);
    }
  });

  it("lays out row groups with explicit tracks", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "group",
          id: "row",
          frame: { x: 0, y: 0, w: 620, h: 120 },
          layout: { type: "row", gap: 20, tracks: [200, 400] },
          children: [
            {
              kind: "shape",
              id: "left",
              frame: { h: 120 },
              shape: "rect",
              style: { fill: "#ff6b35" },
            },
            {
              kind: "shape",
              id: "right",
              frame: { h: 120 },
              shape: "rect",
              style: { fill: "#00d4ff" },
            },
          ],
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const row = result.elements[0];

    expect(row.kind).toBe("group");
    if (row.kind === "group") {
      expect(row.children[0].rect.x).toBe(0);
      expect(row.children[0].rect.w).toBe(200);
      expect(row.children[1].rect.x).toBe(220);
      expect(row.children[1].rect.w).toBe(400);
    }
  });

  it("scales and centers source-sized scenes into the slide canvas", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      sourceSize: { w: 1000, h: 500 },
      fit: "contain",
      align: "center",
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 100, y: 50, w: 200 },
          text: "Scaled title",
          style: {
            fontFamily: "heading",
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1.1,
          },
        },
        {
          kind: "shape",
          id: "panel",
          frame: { right: 50, bottom: 25, w: 200, h: 100 },
          shape: "rect",
          style: { fill: "#00d4ff", strokeWidth: 2 },
          borderRadius: 10,
          border: { width: 1, color: "#ffffff" },
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const title = result.elements[0];
    const panel = result.elements[1];

    expect(title.kind).toBe("text");
    if (title.kind === "text") {
      expect(title.rect.x).toBe(192);
      expect(title.rect.y).toBe(156);
      expect(title.rect.w).toBe(384);
      expect(title.style.fontSize).toBe(76.8);
    }

    expect(panel.kind).toBe("shape");
    if (panel.kind === "shape") {
      expect(panel.rect.x).toBe(1440);
      expect(panel.rect.y).toBe(780);
      expect(panel.rect.w).toBe(384);
      expect(panel.rect.h).toBe(192);
      expect(panel.borderRadius).toBe(19.2);
      expect(panel.style.strokeWidth).toBe(3.84);
      expect(panel.border?.width).toBe(1.92);
    }
  });
});

describe("layoutPresentation with scene slides", () => {
  it("compiles scene slides alongside the existing layout pipeline", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      background: { type: "solid", color: "#111111" },
      children: [
        {
          kind: "shape",
          id: "panel",
          frame: { x: 1200, y: 0, w: 720, h: 1080 },
          shape: "rect",
          style: { fill: "#1a1f2b" },
        },
      ],
    };

    const result = layoutPresentation("Scene Deck", [slide], "modern", "/scene");
    expect(result.slides[0].background).toBe("#111111");
    expect(result.slides[0].elements.some((element) => element.id === "panel")).toBe(true);
  });
});

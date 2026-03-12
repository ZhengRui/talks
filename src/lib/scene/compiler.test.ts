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

  it("applies scene presets before normalization and keeps explicit node overrides", () => {
    const theme = resolveTheme("dark-tech");
    const slide: SceneSlideData = {
      mode: "scene",
      presets: {
        card: {
          frame: { w: 320, h: 140 },
          borderRadius: 18,
          border: { width: 2, color: "theme.accent" },
          shadow: { color: "#00000055", offsetX: 0, offsetY: 8, blur: 20 },
          style: { fill: "theme.bgSecondary", strokeWidth: 3 },
        },
        headline: {
          frame: { w: 240 },
          style: {
            fontFamily: "heading",
            fontSize: 44,
            fontWeight: 700,
            color: "theme.text",
            lineHeight: 1.1,
          },
        },
      },
      children: [
        {
          kind: "shape",
          id: "panel",
          preset: "card",
          frame: { x: 100, y: 120, h: 120 },
          shape: "rect",
          style: { fill: "#223344" },
        },
        {
          kind: "text",
          id: "title",
          preset: "headline",
          frame: { x: 120, y: 150 },
          text: "Preset title",
          style: {
            fontSize: 52,
            color: "#ffffff",
          },
        },
      ],
    };

    const result = compileSceneSlide(slide, theme, "/scene");
    const panel = result.elements[0];
    const title = result.elements[1];

    expect(panel.kind).toBe("shape");
    if (panel.kind === "shape") {
      expect(panel.rect.w).toBe(320);
      expect(panel.rect.h).toBe(120);
      expect(panel.style.fill).toBe("#223344");
      expect(panel.style.strokeWidth).toBe(3);
      expect(panel.borderRadius).toBe(18);
      expect(panel.border?.width).toBe(2);
      expect(panel.border?.color).toBe(theme.accent);
    }

    expect(title.kind).toBe("text");
    if (title.kind === "text") {
      expect(title.rect.w).toBe(240);
      expect(title.style.fontFamily).toBe(theme.fontHeading);
      expect(title.style.fontSize).toBe(52);
      expect(title.style.fontWeight).toBe(700);
      expect(title.style.color).toBe("#ffffff");
    }
  });

  it("throws when a scene node references an unknown preset", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "shape",
          id: "panel",
          preset: "missing",
          frame: { x: 0, y: 0, w: 100, h: 100 },
          shape: "rect",
          style: { fill: "#000000" },
        },
      ],
    };

    expect(() => compileSceneSlide(slide, resolveTheme("modern"), "/scene")).toThrow(
      /Unknown preset "missing"/,
    );
  });

  it("throws when a scene node references an unknown guide", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      guides: {
        x: { content: 120 },
      },
      children: [
        {
          kind: "text",
          id: "title",
          frame: { left: "@x.missing", top: 80, w: 320 },
          text: "Missing guide",
          style: {
            fontFamily: "heading",
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1.1,
          },
        },
      ],
    };

    expect(() => compileSceneSlide(slide, resolveTheme("modern"), "/scene")).toThrow(
      /Unknown x guide "@x.missing"/,
    );
  });

  it("throws when scene nodes reuse the same id", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "shape",
          id: "duplicate",
          frame: { x: 0, y: 0, w: 100, h: 100 },
          shape: "rect",
          style: { fill: "#111111" },
        },
        {
          kind: "group",
          id: "container",
          frame: { x: 120, y: 0, w: 200, h: 120 },
          children: [
            {
              kind: "text",
              id: "duplicate",
              frame: { x: 0, y: 0, w: 100 },
              text: "Repeated",
              style: {
                fontFamily: "body",
                fontSize: 20,
                lineHeight: 1.2,
              },
            },
          ],
        },
      ],
    };

    expect(() => compileSceneSlide(slide, resolveTheme("modern"), "/scene")).toThrow(
      /Duplicate node id "duplicate"/,
    );
  });

  it("supports anchoring nodes to previously compiled siblings", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "shape",
          id: "panel",
          frame: { x: 120, y: 80, w: 300, h: 100 },
          shape: "rect",
          style: { fill: "#223344" },
        },
        {
          kind: "shape",
          id: "badge",
          frame: {
            centerX: "@panel.centerX",
            top: { ref: "@panel.bottom", offset: 20 },
            w: 60,
            h: 40,
          },
          shape: "rect",
          style: { fill: "#ff6b35" },
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const panel = result.elements[0];
    const badge = result.elements[1];

    expect(panel.kind).toBe("shape");
    expect(badge.kind).toBe("shape");
    if (panel.kind === "shape" && badge.kind === "shape") {
      expect(badge.rect.x).toBe(240);
      expect(badge.rect.y).toBe(200);
      expect(badge.rect.w).toBe(60);
      expect(badge.rect.h).toBe(40);
    }
  });

  it("scales anchor offsets with source-sized scenes", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      sourceSize: { w: 1000, h: 500 },
      fit: "contain",
      align: "center",
      children: [
        {
          kind: "shape",
          id: "panel",
          frame: { x: 100, y: 50, w: 200, h: 100 },
          shape: "rect",
          style: { fill: "#223344" },
        },
        {
          kind: "shape",
          id: "badge",
          frame: {
            x: { ref: "@panel.right", offset: 20 },
            y: { ref: "@panel.bottom", offset: 10 },
            w: 50,
            h: 30,
          },
          shape: "rect",
          style: { fill: "#ff6b35" },
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const panel = result.elements[0];
    const badge = result.elements[1];

    expect(panel.kind).toBe("shape");
    expect(badge.kind).toBe("shape");
    if (panel.kind === "shape" && badge.kind === "shape") {
      expect(panel.rect.x).toBe(192);
      expect(panel.rect.y).toBe(156);
      expect(panel.rect.w).toBe(384);
      expect(panel.rect.h).toBe(192);
      expect(badge.rect.x).toBeCloseTo(614.4);
      expect(badge.rect.y).toBeCloseTo(367.2);
      expect(badge.rect.w).toBe(96);
      expect(badge.rect.h).toBeCloseTo(57.6);
    }
  });

  it("resolves anchors within overlay groups using local container coordinates", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "group",
          id: "cluster",
          frame: { x: 100, y: 120, w: 320, h: 180 },
          children: [
            {
              kind: "shape",
              id: "card",
              frame: { x: 20, y: 30, w: 120, h: 60 },
              shape: "rect",
              style: { fill: "#223344" },
            },
            {
              kind: "shape",
              id: "rule",
              frame: {
                x: "@card.left",
                y: { ref: "@card.bottom", offset: 12 },
                w: "@card.width",
                h: 4,
              },
              shape: "rect",
              style: { fill: "#ff6b35" },
            },
          ],
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const cluster = result.elements[0];

    expect(cluster.kind).toBe("group");
    if (cluster.kind === "group") {
      expect(cluster.children[1]).toMatchObject({
        kind: "shape",
        rect: { x: 20, y: 102, w: 120, h: 4 },
      });
    }
  });

  it("throws when an anchor references a node that has not been compiled yet", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "shape",
          id: "badge",
          frame: {
            x: "@panel.right",
            y: 0,
            w: 60,
            h: 40,
          },
          shape: "rect",
          style: { fill: "#ff6b35" },
        },
        {
          kind: "shape",
          id: "panel",
          frame: { x: 120, y: 80, w: 300, h: 100 },
          shape: "rect",
          style: { fill: "#223344" },
        },
      ],
    };

    expect(() => compileSceneSlide(slide, resolveTheme("modern"), "/scene")).toThrow(
      /Unknown anchor reference "@panel.right"/,
    );
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

  it("supports low-level IR elements with source-space scaling", () => {
    const theme = resolveTheme("modern");
    const slide: SceneSlideData = {
      mode: "scene",
      sourceSize: { w: 1000, h: 500 },
      fit: "contain",
      align: "center",
      children: [
        {
          kind: "ir",
          id: "legacy-code-node",
          element: {
            kind: "code",
            id: "legacy-code",
            rect: { x: 100, y: 50, w: 200, h: 100 },
            code: "const answer = 42;",
            style: {
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 20,
              color: "#ffffff",
              background: "theme.bgSecondary",
              borderRadius: 12,
              padding: 16,
            },
          },
        },
      ],
    };

    const result = compileSceneSlide(slide, theme, "/scene");
    const code = result.elements[0];

    expect(code.kind).toBe("code");
    if (code.kind === "code") {
      expect(code.rect.x).toBe(192);
      expect(code.rect.y).toBe(156);
      expect(code.rect.w).toBe(384);
      expect(code.rect.h).toBe(192);
      expect(code.style.fontSize).toBe(38.4);
      expect(code.style.padding).toBe(30.72);
      expect(code.style.borderRadius).toBe(23.04);
      expect(code.style.background).toBe(theme.bgSecondary);
    }
  });

  it("fits wrapped IR groups into scene frames", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "ir",
          id: "legacy-group-node",
          frame: { x: 100, y: 120, w: 400, h: 200 },
          element: {
            kind: "group",
            id: "legacy-group",
            rect: { x: 0, y: 0, w: 200, h: 100 },
            children: [
              {
                kind: "shape",
                id: "legacy-box",
                rect: { x: 10, y: 20, w: 30, h: 40 },
                shape: "rect",
                style: { fill: "#ff6b35" },
              },
            ],
          },
        },
      ],
    };

    const result = compileSceneSlide(slide, resolveTheme("modern"), "/scene");
    const group = result.elements[0];

    expect(group.kind).toBe("group");
    if (group.kind === "group") {
      expect(group.rect.x).toBe(100);
      expect(group.rect.y).toBe(120);
      expect(group.rect.w).toBe(400);
      expect(group.rect.h).toBe(200);
      expect(group.children[0].rect.x).toBe(20);
      expect(group.children[0].rect.y).toBe(40);
      expect(group.children[0].rect.w).toBe(60);
      expect(group.children[0].rect.h).toBe(80);
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

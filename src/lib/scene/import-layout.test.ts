import { describe, expect, it } from "vitest";
import type { LayoutPresentation } from "@/lib/layout/types";
import {
  importLayoutElement,
  importLayoutPresentation,
  importLayoutSlide,
} from "@/lib/scene/import-layout";

describe("importLayoutElement", () => {
  it("converts layout groups recursively into scene nodes", () => {
    const node = importLayoutElement({
      kind: "group",
      id: "parent",
      rect: { x: 10, y: 20, w: 200, h: 100 },
      clipContent: true,
      style: { fill: "#111111" },
      children: [
        {
          kind: "text",
          id: "title",
          rect: { x: 0, y: 0, w: 200, h: 30 },
          text: "Hello",
          style: {
            fontFamily: "Inter",
            fontSize: 24,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.2,
          },
        },
      ],
    });

    expect(node).toMatchObject({
      kind: "group",
      id: "parent",
      frame: { x: 10, y: 20, w: 200, h: 100 },
      clipContent: true,
      style: { fill: "#111111" },
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 0, y: 0, w: 200, h: 30 },
          text: "Hello",
        },
      ],
    });
  });

  it("wraps unsupported layout elements as ir nodes and rewrites asset paths", () => {
    const node = importLayoutElement({
      kind: "video",
      id: "clip",
      rect: { x: 0, y: 0, w: 640, h: 360 },
      src: "/legacy/clip.mp4",
      poster: "/legacy/poster.jpg",
    }, {
      rewriteAssetPath: (path) => path.replace("/legacy/", "/ported/"),
    });

    expect(node).toMatchObject({
      kind: "ir",
      id: "clip",
      frame: { x: 0, y: 0, w: 640, h: 360 },
      element: {
        kind: "video",
        src: "/ported/clip.mp4",
        poster: "/ported/poster.jpg",
      },
    });
  });
});

describe("importLayoutSlide", () => {
  it("materializes background image and overlay as scene children", () => {
    const slide = importLayoutSlide({
      width: 1920,
      height: 1080,
      background: "#080808",
      backgroundImage: "/legacy/bg.jpg",
      overlay: "rgba(0,0,0,0.7)",
      elements: [],
    }, {
      rewriteAssetPath: (path) => path.replace("/legacy/", "/ported/"),
    });

    expect(slide).toMatchObject({
      mode: "scene",
      background: "#080808",
      children: [
        {
          kind: "image",
          id: "bg-image",
          src: "/ported/bg.jpg",
        },
        {
          kind: "shape",
          id: "bg-overlay",
          style: { fill: "rgba(0,0,0,0.7)" },
        },
      ],
    });
  });
});

describe("importLayoutPresentation", () => {
  it("converts all slides while preserving title and author", () => {
    const presentation: LayoutPresentation = {
      title: "Legacy Deck",
      author: "Legacy Author",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#000000",
          elements: [
            {
              kind: "image",
              id: "hero",
              rect: { x: 0, y: 0, w: 1920, h: 1080 },
              src: "/legacy/hero.jpg",
              objectFit: "cover",
            },
          ],
        },
      ],
    };

    const imported = importLayoutPresentation(presentation, {
      rewriteAssetPath: (path) => path.replace("/legacy/", "/ported/"),
    });

    expect(imported.title).toBe("Legacy Deck");
    expect(imported.author).toBe("Legacy Author");
    expect(imported.slides).toHaveLength(1);
    expect(imported.slides[0].children[0]).toMatchObject({
      kind: "image",
      id: "hero",
      src: "/ported/hero.jpg",
    });
  });

  it("prefixes imported ids when requested", () => {
    const imported = importLayoutPresentation({
      title: "Legacy Deck",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#000000",
          backgroundImage: "/legacy/bg.jpg",
          overlay: "rgba(0,0,0,0.7)",
          elements: [
            {
              kind: "text",
              id: "deco-section-num",
              rect: { x: 0, y: 0, w: 100, h: 40 },
              text: "1",
              style: {
                fontFamily: "Inter",
                fontSize: 24,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
              },
            },
          ],
        },
      ],
    }, {
      idPrefix: "imp-",
    });

    expect(imported.slides[0].children).toMatchObject([
      { id: "imp-bg-image" },
      { id: "imp-bg-overlay" },
      { id: "imp-deco-section-num" },
    ]);
  });
});

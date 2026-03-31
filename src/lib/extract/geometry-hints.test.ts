import { describe, expect, it } from "vitest";
import { buildGeometryHints } from "./geometry-hints";
import type { LayoutSlide } from "@/lib/layout/types";

describe("buildGeometryHints", () => {
  it("flattens nested groups to absolute rects in depth-first order", () => {
    const slide: LayoutSlide = {
      width: 1920,
      height: 1080,
      background: "#000",
      elements: [
        {
          kind: "group",
          id: "group-1",
          rect: { x: 100, y: 80, w: 600, h: 400 },
          children: [
            {
              kind: "text",
              id: "title",
              rect: { x: 20, y: 30, w: 300, h: 60 },
              text: "Hello world",
              style: {
                fontFamily: "Inter",
                fontSize: 48,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.2,
              },
            },
            {
              kind: "group",
              id: "group-2",
              rect: { x: 50, y: 100, w: 240, h: 120 },
              children: [
                {
                  kind: "shape",
                  id: "shape-1",
                  rect: { x: 10, y: 12, w: 90, h: 40 },
                  shape: "rect",
                  style: { fill: "#123456" },
                },
              ],
            },
          ],
        },
      ],
    };

    const hints = buildGeometryHints(slide);

    expect(hints.canvas).toEqual({ w: 1920, h: 1080 });
    expect(hints.elements.map((item) => item.id)).toEqual([
      "group-1",
      "title",
      "group-2",
      "shape-1",
    ]);
    expect(hints.elements[1]).toMatchObject({
      id: "title",
      parentId: "group-1",
      depth: 1,
      rect: { x: 120, y: 110, w: 300, h: 60 },
      text: "Hello world",
    });
    expect(hints.elements[3]).toMatchObject({
      id: "shape-1",
      parentId: "group-2",
      depth: 2,
      rect: { x: 160, y: 192, w: 90, h: 40 },
    });
  });

  it("summarizes text-bearing non-text elements", () => {
    const slide: LayoutSlide = {
      width: 1920,
      height: 1080,
      background: "#000",
      elements: [
        {
          kind: "list",
          id: "list-1",
          rect: { x: 0, y: 0, w: 400, h: 200 },
          items: ["Alpha", "Beta", "Gamma"],
          ordered: false,
          itemStyle: {
            fontFamily: "Inter",
            fontSize: 24,
            fontWeight: 400,
            color: "#fff",
            lineHeight: 1.4,
          },
          itemSpacing: 16,
        },
      ],
    };

    const hints = buildGeometryHints(slide);
    expect(hints.elements[0]?.text).toContain("Alpha");
    expect(hints.elements[0]?.text).toContain("Beta");
  });
});

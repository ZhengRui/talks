import { describe, it, expect } from "vitest";
import { resolveLayouts } from "./auto-layout";
import type {
  LayoutElement,
  GroupElement,
  TextElement,
  ShapeElement,
  Rect,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers — minimal elements for testing
// ---------------------------------------------------------------------------

function makeText(id: string, rect: Rect): TextElement {
  return {
    kind: "text",
    id,
    rect,
    text: "test",
    style: {
      fontFamily: "sans-serif",
      fontSize: 24,
      fontWeight: 400,
      color: "#000",
      lineHeight: 1.4,
    },
  };
}

function makeShape(id: string, rect: Rect): ShapeElement {
  return {
    kind: "shape",
    id,
    rect,
    shape: "rect",
    style: { fill: "#ccc" },
  };
}

function makeGroup(
  id: string,
  rect: Rect,
  children: LayoutElement[],
  layout?: GroupElement["layout"],
): GroupElement {
  return {
    kind: "group",
    id,
    rect,
    children,
    layout,
  };
}

/** Round a rect's values to 2 decimal places for assertion readability. */
function roundRect(r: Rect): Rect {
  return {
    x: Math.round(r.x * 100) / 100,
    y: Math.round(r.y * 100) / 100,
    w: Math.round(r.w * 100) / 100,
    h: Math.round(r.h * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveLayouts", () => {
  // =========================================================================
  // Flex Row
  // =========================================================================
  describe("flex row", () => {
    it("distributes auto-width children equally", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 1200, h: 400 },
        [
          makeText("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "row", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // innerW = 1200, gap total = 40, each auto = (1200 - 40) / 3 = 386.67
      expect(rects[0].w).toBeCloseTo(386.67, 1);
      expect(rects[1].w).toBeCloseTo(386.67, 1);
      expect(rects[2].w).toBeCloseTo(386.67, 1);

      // x positions: 0, 386.67+20=406.67, 813.33
      expect(rects[0].x).toBeCloseTo(0, 1);
      expect(rects[1].x).toBeCloseTo(406.67, 1);
      expect(rects[2].x).toBeCloseTo(813.33, 1);

      // All children get full height (no explicit h, default = innerH)
      expect(rects[0].h).toBe(400);
      expect(rects[1].h).toBe(400);
      expect(rects[2].h).toBe(400);
    });

    it("handles mixed explicit and auto width children", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 1000, h: 300 },
        [
          makeText("a", { x: 0, y: 0, w: 200, h: 100 }),
          makeText("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "row", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // auto width = (1000 - 200 - 2*20) / 2 = 380
      expect(rects[0].w).toBe(200);
      expect(rects[1].w).toBe(380);
      expect(rects[2].w).toBe(380);

      // child0 keeps its explicit h=100
      expect(rects[0].h).toBe(100);
      // child1/child2 get innerH (no explicit h)
      expect(rects[1].h).toBe(300);
      expect(rects[2].h).toBe(300);
    });

    it("applies justify: space-between", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 100 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("c", { x: 0, y: 0, w: 100, h: 50 }),
        ],
        { type: "flex", direction: "row", justify: "space-between" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // space-between: first at 0, last at 600-100=500, middle at 250
      expect(rects[0].x).toBe(0);
      expect(rects[1].x).toBe(250);
      expect(rects[2].x).toBe(500);
    });

    it("applies justify: center", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 100 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 50 }),
        ],
        { type: "flex", direction: "row", gap: 20, justify: "center" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // totalContentW = 100 + 100 + 20 = 220, offset = (600 - 220) / 2 = 190
      expect(rects[0].x).toBe(190);
      expect(rects[1].x).toBe(310);
    });

    it("applies justify: end", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 100 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 50 }),
        ],
        { type: "flex", direction: "row", gap: 20, justify: "end" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // totalContentW = 220, offset = 600 - 220 = 380
      expect(rects[0].x).toBe(380);
      expect(rects[1].x).toBe(500);
    });

    it("applies justify: space-around", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 100 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 50 }),
        ],
        { type: "flex", direction: "row", justify: "space-around" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // spaceAround = (600 - 200) / 2 = 200; first x = 200/2 = 100, second = 100 + 100 + 200 = 400
      expect(rects[0].x).toBe(100);
      expect(rects[1].x).toBe(400);
    });

    it("applies align: center (cross-axis vertical centering)", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 200 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 80 }),
        ],
        { type: "flex", direction: "row", gap: 10, align: "center" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // a: h=50, y = (200 - 50) / 2 = 75
      expect(rects[0].y).toBe(75);
      expect(rects[0].h).toBe(50);
      // b: h=80, y = (200 - 80) / 2 = 60
      expect(rects[1].y).toBe(60);
      expect(rects[1].h).toBe(80);
    });

    it("applies align: end", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 200 },
        [makeShape("a", { x: 0, y: 0, w: 100, h: 50 })],
        { type: "flex", direction: "row", align: "end" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      // y = 200 - 50 = 150
      expect(resolved.children[0].rect.y).toBe(150);
    });

    it("applies align: stretch (children fill cross-axis)", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 200 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 50 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 80 }),
        ],
        { type: "flex", direction: "row", gap: 10, align: "stretch" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];

      // All children stretched to innerH = 200
      expect(resolved.children[0].rect.h).toBe(200);
      expect(resolved.children[0].rect.y).toBe(0);
      expect(resolved.children[1].rect.h).toBe(200);
      expect(resolved.children[1].rect.y).toBe(0);
    });

    it("handles single child with space-between", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 100 },
        [makeShape("a", { x: 0, y: 0, w: 100, h: 50 })],
        { type: "flex", direction: "row", justify: "space-between" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      // Single item should be at start
      expect(resolved.children[0].rect.x).toBe(0);
    });
  });

  // =========================================================================
  // Flex Column
  // =========================================================================
  describe("flex column", () => {
    it("distributes auto-height children equally", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 600 },
        [
          makeText("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "column", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // innerH = 600, gap total = 40, each auto = (600 - 40) / 3 = 186.67
      expect(rects[0].h).toBeCloseTo(186.67, 1);
      expect(rects[1].h).toBeCloseTo(186.67, 1);
      expect(rects[2].h).toBeCloseTo(186.67, 1);

      // y positions: 0, 206.67, 413.33
      expect(rects[0].y).toBeCloseTo(0, 1);
      expect(rects[1].y).toBeCloseTo(206.67, 1);
      expect(rects[2].y).toBeCloseTo(413.33, 1);

      // All children get full width (cross-axis, no explicit w)
      expect(rects[0].w).toBe(400);
    });

    it("handles explicit heights mixed with auto", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 500 },
        [
          makeText("a", { x: 0, y: 0, w: 0, h: 100 }),
          makeText("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "column", gap: 10 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // autoH = (500 - 100 - 2*10) / 2 = 190
      expect(rects[0].h).toBe(100);
      expect(rects[1].h).toBe(190);
      expect(rects[2].h).toBe(190);
    });

    it("applies justify: space-between on column axis", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 200, h: 600 },
        [
          makeShape("a", { x: 0, y: 0, w: 100, h: 100 }),
          makeShape("b", { x: 0, y: 0, w: 100, h: 100 }),
          makeShape("c", { x: 0, y: 0, w: 100, h: 100 }),
        ],
        { type: "flex", direction: "column", justify: "space-between" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // space = (600 - 300) / 2 = 150
      expect(rects[0].y).toBe(0);
      expect(rects[1].y).toBe(250);
      expect(rects[2].y).toBe(500);
    });

    it("applies align: center on column cross-axis (horizontal)", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 600 },
        [makeShape("a", { x: 0, y: 0, w: 200, h: 100 })],
        { type: "flex", direction: "column", align: "center" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      // x = (400 - 200) / 2 = 100
      expect(resolved.children[0].rect.x).toBe(100);
      expect(resolved.children[0].rect.w).toBe(200);
    });

    it("applies align: stretch on column cross-axis", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 600 },
        [makeShape("a", { x: 0, y: 0, w: 200, h: 100 })],
        { type: "flex", direction: "column", align: "stretch" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      expect(resolved.children[0].rect.x).toBe(0);
      expect(resolved.children[0].rect.w).toBe(400);
    });
  });

  // =========================================================================
  // Grid
  // =========================================================================
  describe("grid", () => {
    it("positions 4 children in a 2x2 grid", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 800, h: 600 },
        [
          makeShape("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("c", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("d", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 2, gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // colW = (800 - 20) / 2 = 390
      // rowH = (600 - 20) / 2 = 290 (equal rows, no explicit heights)
      expect(rects[0]).toEqual({ x: 0, y: 0, w: 390, h: 290 });
      expect(rects[1]).toEqual({ x: 410, y: 0, w: 390, h: 290 });
      expect(rects[2]).toEqual({ x: 0, y: 310, w: 390, h: 290 });
      expect(rects[3]).toEqual({ x: 410, y: 310, w: 390, h: 290 });
    });

    it("handles uneven children (5 children, 3 columns → 2 rows)", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 960, h: 400 },
        [
          makeShape("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("c", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("d", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("e", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 3, gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // colW = (960 - 2*20) / 3 = 306.67
      const colW = (960 - 40) / 3;
      // 2 rows → rowH = (400 - 20) / 2 = 190
      expect(rects.length).toBe(5);

      // Row 1
      expect(rects[0].x).toBeCloseTo(0, 1);
      expect(rects[0].y).toBe(0);
      expect(rects[0].w).toBeCloseTo(colW, 1);
      expect(rects[0].h).toBe(190);

      expect(rects[1].x).toBeCloseTo(colW + 20, 1);

      // Row 2
      expect(rects[3].y).toBe(210);
      expect(rects[4].y).toBe(210);
    });

    it("uses separate rowGap and columnGap", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 500, h: 500 },
        [
          makeShape("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("b", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("c", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("d", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 2, rowGap: 40, columnGap: 10 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // colW = (500 - 10) / 2 = 245
      expect(rects[0].w).toBe(245);
      expect(rects[1].x).toBe(255); // 245 + 10

      // rowH = (500 - 40) / 2 = 230
      expect(rects[2].y).toBe(270); // 230 + 40
    });

    it("respects explicit child heights", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 800, h: 600 },
        [
          makeShape("a", { x: 0, y: 0, w: 0, h: 150 }),
          makeShape("b", { x: 0, y: 0, w: 0, h: 100 }),
          makeShape("c", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("d", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 2, gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => c.rect);

      // Row 1: max height = max(150, 100) = 150
      expect(rects[0].h).toBe(150);
      expect(rects[1].h).toBe(100); // keeps its explicit height

      // Row 2 y = 150 + 20 = 170
      expect(rects[2].y).toBe(170);
    });
  });

  // =========================================================================
  // Padding
  // =========================================================================
  describe("padding", () => {
    it("applies uniform padding to flex row", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 200 },
        [makeShape("a", { x: 0, y: 0, w: 0, h: 0 })],
        { type: "flex", direction: "row", padding: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rect = resolved.children[0].rect;

      // innerW = 400 - 40 = 360, innerH = 200 - 40 = 160
      expect(rect.x).toBe(20);
      expect(rect.y).toBe(20);
      expect(rect.w).toBe(360);
      expect(rect.h).toBe(160);
    });

    it("applies asymmetric padding [top, right, bottom, left]", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 200 },
        [makeShape("a", { x: 0, y: 0, w: 0, h: 0 })],
        { type: "flex", direction: "row", padding: [10, 20, 30, 40] },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rect = resolved.children[0].rect;

      // innerW = 400 - 40 - 20 = 340, innerH = 200 - 10 - 30 = 160
      expect(rect.x).toBe(40); // left padding
      expect(rect.y).toBe(10); // top padding
      expect(rect.w).toBe(340);
      expect(rect.h).toBe(160);
    });

    it("applies padding to grid layout", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 500, h: 400 },
        [
          makeShape("a", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("b", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 2, gap: 20, padding: 30 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => c.rect);

      // innerW = 500 - 60 = 440, colW = (440 - 20) / 2 = 210
      expect(rects[0].x).toBe(30);
      expect(rects[0].y).toBe(30);
      expect(rects[0].w).toBe(210);
      expect(rects[1].x).toBe(260); // 30 + 210 + 20
    });

    it("applies padding to flex column", () => {
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 300, h: 500 },
        [makeShape("a", { x: 0, y: 0, w: 0, h: 0 })],
        { type: "flex", direction: "column", padding: 25 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rect = resolved.children[0].rect;

      expect(rect.x).toBe(25);
      expect(rect.y).toBe(25);
      expect(rect.w).toBe(250); // 300 - 50
      expect(rect.h).toBe(450); // 500 - 50
    });
  });

  // =========================================================================
  // Nesting
  // =========================================================================
  describe("nesting", () => {
    it("resolves nested layout groups recursively", () => {
      const innerGroup = makeGroup(
        "inner",
        { x: 0, y: 0, w: 0, h: 0 },
        [
          makeShape("ia", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("ib", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "row", gap: 10 },
      );

      const outerGroup = makeGroup(
        "outer",
        { x: 0, y: 0, w: 800, h: 400 },
        [
          makeShape("oa", { x: 0, y: 0, w: 0, h: 0 }),
          innerGroup,
        ],
        { type: "flex", direction: "column", gap: 20 },
      );

      const [resolved] = resolveLayouts([outerGroup]) as GroupElement[];

      // Outer: 2 children, column, gap:20
      // autoH = (400 - 20) / 2 = 190 each
      expect(resolved.children[0].rect.h).toBe(190);
      expect(resolved.children[1].rect.h).toBe(190);

      // Inner group is the second child — its rect should be 800×190
      const inner = resolved.children[1] as GroupElement;
      expect(inner.rect.w).toBe(800);
      expect(inner.rect.h).toBe(190);

      // Inner group's children should be resolved with the inner group's rect
      // innerW = 800, gap = 10, 2 children → each w = (800 - 10) / 2 = 395
      expect(inner.children[0].rect.w).toBe(395);
      expect(inner.children[1].rect.w).toBe(395);
      expect(inner.children[0].rect.x).toBe(0);
      expect(inner.children[1].rect.x).toBe(405);
    });
  });

  // =========================================================================
  // Passthrough
  // =========================================================================
  describe("passthrough", () => {
    it("passes through non-group elements unchanged", () => {
      const text = makeText("t", { x: 10, y: 20, w: 300, h: 50 });
      const shape = makeShape("s", { x: 100, y: 200, w: 50, h: 50 });

      const result = resolveLayouts([text, shape]);
      expect(result[0].rect).toEqual({ x: 10, y: 20, w: 300, h: 50 });
      expect(result[1].rect).toEqual({ x: 100, y: 200, w: 50, h: 50 });
    });

    it("passes through groups without layout property", () => {
      const group = makeGroup(
        "g",
        { x: 50, y: 50, w: 400, h: 300 },
        [makeText("a", { x: 10, y: 10, w: 100, h: 30 })],
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      expect(resolved.children[0].rect).toEqual({
        x: 10,
        y: 10,
        w: 100,
        h: 30,
      });
    });

    it("does not mutate input elements", () => {
      const child = makeText("a", { x: 5, y: 5, w: 0, h: 0 });
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 200 },
        [child],
        { type: "flex", direction: "row" },
      );

      resolveLayouts([group]);

      // Original child rect should be unchanged
      expect(child.rect).toEqual({ x: 5, y: 5, w: 0, h: 0 });
    });

    it("preserves element properties besides rect", () => {
      const child: ShapeElement = {
        kind: "shape",
        id: "s1",
        rect: { x: 0, y: 0, w: 0, h: 0 },
        shape: "circle",
        style: { fill: "#ff0000" },
        opacity: 0.5,
        borderRadius: 10,
      };

      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 200 },
        [child],
        { type: "flex", direction: "row" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const resolvedChild = resolved.children[0] as ShapeElement;

      expect(resolvedChild.kind).toBe("shape");
      expect(resolvedChild.id).toBe("s1");
      expect(resolvedChild.shape).toBe("circle");
      expect(resolvedChild.style.fill).toBe("#ff0000");
      expect(resolvedChild.opacity).toBe(0.5);
      expect(resolvedChild.borderRadius).toBe(10);
      // Rect should be resolved
      expect(resolvedChild.rect.w).toBe(400);
      expect(resolvedChild.rect.h).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Flex-row wrap
  // ---------------------------------------------------------------------------

  describe("flex row wrap", () => {
    it("wraps children to next row when they overflow", () => {
      // 3 children of width 500 in a 1200-wide container → 2 fit, 1 wraps
      const children = [
        makeText("a", { x: 0, y: 0, w: 500, h: 50 }),
        makeText("b", { x: 0, y: 0, w: 500, h: 50 }),
        makeText("c", { x: 0, y: 0, w: 500, h: 50 }),
      ];
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 1200, h: 200 },
        children,
        { type: "flex", direction: "row", gap: 20, wrap: true },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // Row 1: a (x=0, w=500), b (x=520, w=500)
      expect(rects[0].x).toBe(0);
      expect(rects[0].w).toBe(500);
      expect(rects[1].x).toBe(520);
      expect(rects[1].w).toBe(500);
      // Row 2: c wraps
      expect(rects[2].x).toBe(0);
      expect(rects[2].w).toBe(500);
      // c should be on a lower row
      expect(rects[2].y).toBeGreaterThan(rects[0].y);
    });

    it("keeps all items in one row when they fit", () => {
      const children = [
        makeText("a", { x: 0, y: 0, w: 200, h: 50 }),
        makeText("b", { x: 0, y: 0, w: 200, h: 50 }),
      ];
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 200 },
        children,
        { type: "flex", direction: "row", gap: 20, wrap: true },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));
      // All on row 0
      expect(rects[0].y).toBe(rects[1].y);
    });
  });

  // =========================================================================
  // Absolute Positioning
  // =========================================================================
  describe("absolute positioning", () => {
    it("absolute children keep rects in flex-row", () => {
      const absChild = {
        ...makeShape("abs", { x: 100, y: 50, w: 200, h: 80 }),
        position: "absolute" as const,
      };
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 1200, h: 400 },
        [
          makeText("a", { x: 0, y: 0, w: 0, h: 0 }),
          absChild,
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "row", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // Absolute child keeps its exact rect
      expect(rects[1]).toEqual({ x: 100, y: 50, w: 200, h: 80 });

      // Two flow children share the full container (1200 wide, gap 20)
      // autoW = (1200 - 20) / 2 = 590
      expect(rects[0].w).toBe(590);
      expect(rects[2].w).toBe(590);
      expect(rects[0].x).toBe(0);
      expect(rects[2].x).toBe(610); // 590 + 20
    });

    it("absolute children keep rects in flex-column", () => {
      const absChild = {
        ...makeShape("abs", { x: 50, y: 100, w: 150, h: 60 }),
        position: "absolute" as const,
      };
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 400, h: 600 },
        [
          makeText("a", { x: 0, y: 0, w: 0, h: 0 }),
          absChild,
          makeText("c", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "column", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // Absolute child keeps its exact rect
      expect(rects[1]).toEqual({ x: 50, y: 100, w: 150, h: 60 });

      // Two flow children share the full container height (600, gap 20)
      // autoH = (600 - 20) / 2 = 290
      expect(rects[0].h).toBe(290);
      expect(rects[2].h).toBe(290);
      expect(rects[0].y).toBe(0);
      expect(rects[2].y).toBe(310); // 290 + 20
    });

    it("z-order preserved after layout", () => {
      const absChild = {
        ...makeShape("abs-mid", { x: 10, y: 10, w: 50, h: 50 }),
        position: "absolute" as const,
      };
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 600, h: 200 },
        [
          makeText("flow-0", { x: 0, y: 0, w: 0, h: 0 }),
          absChild,
          makeText("flow-2", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "flex", direction: "row", gap: 10 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];

      // Children should be in their original order by id
      expect(resolved.children[0].id).toBe("flow-0");
      expect(resolved.children[1].id).toBe("abs-mid");
      expect(resolved.children[2].id).toBe("flow-2");
    });

    it("all-absolute children (no crash)", () => {
      const children = [
        { ...makeShape("a1", { x: 0, y: 0, w: 100, h: 100 }), position: "absolute" as const },
        { ...makeShape("a2", { x: 200, y: 200, w: 50, h: 50 }), position: "absolute" as const },
        { ...makeShape("a3", { x: 500, y: 300, w: 80, h: 40 }), position: "absolute" as const },
      ];
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 1000, h: 600 },
        children,
        { type: "flex", direction: "row", gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];

      // All children should keep their original rects unchanged
      expect(resolved.children[0].rect).toEqual({ x: 0, y: 0, w: 100, h: 100 });
      expect(resolved.children[1].rect).toEqual({ x: 200, y: 200, w: 50, h: 50 });
      expect(resolved.children[2].rect).toEqual({ x: 500, y: 300, w: 80, h: 40 });
    });

    it("absolute child in grid layout", () => {
      const absChild = {
        ...makeShape("abs", { x: 777, y: 333, w: 120, h: 45 }),
        position: "absolute" as const,
      };
      const group = makeGroup(
        "g",
        { x: 0, y: 0, w: 800, h: 600 },
        [
          makeShape("g1", { x: 0, y: 0, w: 0, h: 0 }),
          absChild,
          makeShape("g2", { x: 0, y: 0, w: 0, h: 0 }),
          makeShape("g3", { x: 0, y: 0, w: 0, h: 0 }),
        ],
        { type: "grid", columns: 2, gap: 20 },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];
      const rects = resolved.children.map((c) => roundRect(c.rect));

      // Absolute child keeps its rect
      expect(rects[1]).toEqual({ x: 777, y: 333, w: 120, h: 45 });

      // 3 flow children in a 2-column grid:
      // Row 1: g1, g2  Row 2: g3
      // colW = (800 - 20) / 2 = 390
      // 2 rows → rowH = (600 - 20) / 2 = 290
      expect(rects[0]).toEqual({ x: 0, y: 0, w: 390, h: 290 }); // g1: row 0, col 0
      expect(rects[2]).toEqual({ x: 410, y: 0, w: 390, h: 290 }); // g2: row 0, col 1
      expect(rects[3]).toEqual({ x: 0, y: 310, w: 390, h: 290 }); // g3: row 1, col 0
    });

    it("recursion into absolute groups with layout", () => {
      // An inner group that is absolute-positioned but has its own flex layout
      const innerGroup: GroupElement = {
        ...makeGroup(
          "inner",
          { x: 100, y: 100, w: 400, h: 200 },
          [
            makeShape("ia", { x: 0, y: 0, w: 0, h: 0 }),
            makeShape("ib", { x: 0, y: 0, w: 0, h: 0 }),
          ],
          { type: "flex", direction: "row", gap: 20 },
        ),
        position: "absolute" as const,
      };

      const group = makeGroup(
        "outer",
        { x: 0, y: 0, w: 1200, h: 600 },
        [
          makeText("flow", { x: 0, y: 0, w: 0, h: 0 }),
          innerGroup,
        ],
        { type: "flex", direction: "row" },
      );

      const [resolved] = resolveLayouts([group]) as GroupElement[];

      // The outer group's absolute child keeps its rect
      const inner = resolved.children[1] as GroupElement;
      expect(inner.rect).toEqual({ x: 100, y: 100, w: 400, h: 200 });

      // The flow child takes full container width (only 1 flow child, no gap)
      expect(resolved.children[0].rect.w).toBe(1200);

      // The inner group's children should be laid out by its flex-row layout
      // innerW = 400, gap = 20, 2 auto children → each w = (400 - 20) / 2 = 190
      expect(inner.children[0].rect.w).toBe(190);
      expect(inner.children[1].rect.w).toBe(190);
      expect(inner.children[0].rect.x).toBe(0);
      expect(inner.children[1].rect.x).toBe(210); // 190 + 20
      expect(inner.children[0].rect.h).toBe(200);
      expect(inner.children[1].rect.h).toBe(200);
    });
  });
});

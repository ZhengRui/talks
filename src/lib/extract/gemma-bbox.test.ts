import { describe, expect, it } from "vitest";
import { box2dToPixelBbox } from "./gemma-bbox";

describe("box2dToPixelBbox", () => {
  it("converts [y1,x1,y2,x2] on 1000x1000 to pixel {x,y,w,h}", () => {
    // box_2d covers the top-left quarter of a 2000x1000 image
    const result = box2dToPixelBbox([0, 0, 500, 500], 2000, 1000);
    expect(result).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });

  it("handles a centered box on a non-square image", () => {
    // box_2d spans the middle 40% of a 1920x1080 image
    const result = box2dToPixelBbox([300, 300, 700, 700], 1920, 1080);
    expect(result.x).toBeCloseTo(576); // 300/1000 * 1920
    expect(result.y).toBeCloseTo(324); // 300/1000 * 1080
    expect(result.width).toBeCloseTo(768);  // 400/1000 * 1920
    expect(result.height).toBeCloseTo(432); // 400/1000 * 1080
  });

  it("handles full-image box", () => {
    const result = box2dToPixelBbox([0, 0, 1000, 1000], 1920, 1080);
    expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});

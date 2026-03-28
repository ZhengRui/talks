/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { annotateDiffImage } from "./annotate";
import type { DiffRegion } from "./compare";

describe("annotateDiffImage", () => {
  it("returns a valid PNG with same dimensions", async () => {
    const base = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    }).png().toBuffer();

    const regions: DiffRegion[] = [
      { x: 10, y: 10, w: 50, h: 50, mismatchRatio: 0.47 },
    ];

    const result = await annotateDiffImage(base, regions);
    expect(result[0]).toBe(0x89);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it("returns the image unchanged when no regions", async () => {
    const base = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    }).png().toBuffer();

    const result = await annotateDiffImage(base, []);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});

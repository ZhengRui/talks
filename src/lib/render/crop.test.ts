/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cropToContentBounds } from "./crop";

async function solidPng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  }).png().toBuffer();
}

describe("cropToContentBounds", () => {
  it("crops to the specified bounds", async () => {
    const img = await solidPng(200, 200);
    const cropped = await cropToContentBounds(img, { x: 10, y: 20, w: 100, h: 80 });
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });

  it("returns the original when contentBounds is null", async () => {
    const img = await solidPng(200, 200);
    const result = await cropToContentBounds(img, null);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it("clamps bounds that exceed image dimensions", async () => {
    const img = await solidPng(100, 100);
    const cropped = await cropToContentBounds(img, { x: 50, y: 50, w: 200, h: 200 });
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("returns original for zero-area bounds", async () => {
    const img = await solidPng(200, 200);
    const result = await cropToContentBounds(img, { x: 0, y: 0, w: 0, h: 0 });
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });
});

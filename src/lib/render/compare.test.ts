/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compareImages } from "./compare";

async function solidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha?: number },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: color.r,
        g: color.g,
        b: color.b,
        alpha: color.alpha ?? 1,
      },
    },
  })
    .png()
    .toBuffer();
}

describe("compareImages", () => {
  it("returns zero mismatch for identical images", async () => {
    const img = await solidPng(100, 100, { r: 255, g: 0, b: 0 });

    const result = await compareImages(img, img);

    expect(result.mismatchRatio).toBe(0);
    expect(result.mismatchPixels).toBe(0);
    expect(result.totalPixels).toBe(10_000);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.regions).toEqual([]);
  });

  it("returns full mismatch for completely different images", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });

    const result = await compareImages(red, blue);

    expect(result.mismatchRatio).toBe(1);
    expect(result.mismatchPixels).toBe(10_000);
  });

  it("produces a valid PNG diff image with correct dimensions", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });

    const result = await compareImages(red, blue);
    const meta = await sharp(result.diffImage).metadata();

    expect(result.diffImage[0]).toBe(0x89);
    expect(result.diffImage[1]).toBe(0x50);
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it("uses threshold correctly", async () => {
    const a = await solidPng(100, 100, { r: 100, g: 100, b: 100 });
    const b = await solidPng(100, 100, { r: 110, g: 100, b: 100 });

    const loose = await compareImages(a, b);
    const strict = await compareImages(a, b, { threshold: 5 });

    expect(loose.mismatchRatio).toBe(0);
    expect(strict.mismatchRatio).toBe(1);
  });

  it("throws on dimension mismatch", async () => {
    const a = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const b = await solidPng(200, 100, { r: 255, g: 0, b: 0 });

    await expect(compareImages(a, b)).rejects.toThrow(/dimension/i);
  });

  it("accepts JPEG input", async () => {
    const png = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const jpeg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();

    const result = await compareImages(png, jpeg);

    expect(result.mismatchRatio).toBeLessThan(0.05);
  });

  it("accepts WebP input", async () => {
    const png = await solidPng(100, 100, { r: 0, g: 128, b: 0 });
    const webp = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 128, b: 0, alpha: 1 },
      },
    })
      .webp({ lossless: true })
      .toBuffer();

    const result = await compareImages(png, webp);

    expect(result.mismatchRatio).toBe(0);
  });
});

describe("compareImages mismatch regions", () => {
  it("returns no regions for identical images", async () => {
    const img = await solidPng(200, 200, { r: 255, g: 0, b: 0 });

    const result = await compareImages(img, img);

    expect(result.regions).toEqual([]);
  });

  it("detects a localized mismatch region", async () => {
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const modified = await sharp(red)
      .composite([{ input: blueSquare, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified);
    const topRegion = result.regions[0];

    expect(result.regions.length).toBeGreaterThan(0);
    expect(topRegion.x).toBeLessThanOrEqual(0);
    expect(topRegion.y).toBeLessThanOrEqual(0);
    expect(topRegion.x + topRegion.w).toBeGreaterThanOrEqual(64);
    expect(topRegion.y + topRegion.h).toBeGreaterThanOrEqual(64);
    expect(topRegion.mismatchRatio).toBeGreaterThan(0.5);
  });

  it("detects separated mismatch areas as distinct regions", async () => {
    const red = await solidPng(400, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const modified = await sharp(red)
      .composite([
        { input: blueSquare, left: 0, top: 0 },
        { input: blueSquare, left: 336, top: 136 },
      ])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified);

    expect(result.regions.length).toBeGreaterThanOrEqual(2);
  });

  it("respects maxRegions", async () => {
    const red = await solidPng(400, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const modified = await sharp(red)
      .composite([
        { input: blueSquare, left: 0, top: 0 },
        { input: blueSquare, left: 336, top: 136 },
      ])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified, { maxRegions: 1 });

    expect(result.regions.length).toBe(1);
  });

  it("region mismatchRatio is the within-region ratio", async () => {
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(200, 200, { r: 0, g: 0, b: 255 });

    const result = await compareImages(red, blue);

    for (const region of result.regions) {
      expect(region.mismatchRatio).toBeGreaterThan(0);
      expect(region.mismatchRatio).toBeLessThanOrEqual(1);
    }
  });
});

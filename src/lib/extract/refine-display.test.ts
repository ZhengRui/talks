/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildRefineDiffArtifactImage } from "./refine-display";

async function solidPng(
  w: number,
  h: number,
  color: { r: number; g: number; b: number; alpha?: number },
): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: color,
    },
  }).png().toBuffer();
}

describe("buildRefineDiffArtifactImage", () => {
  it("returns the annotated diff unchanged when contentBounds is absent", async () => {
    const reference = await solidPng(100, 80, { r: 255, g: 0, b: 0, alpha: 1 });
    const annotated = await solidPng(20, 10, { r: 0, g: 0, b: 255, alpha: 1 });

    const result = await buildRefineDiffArtifactImage(
      reference,
      annotated,
      { w: 100, h: 80 },
      null,
    );

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(20);
    expect(meta.height).toBe(10);
  });

  it("embeds the cropped diff back into the full-size canvas", async () => {
    const reference = await solidPng(100, 80, { r: 255, g: 0, b: 0, alpha: 1 });
    const annotated = await solidPng(20, 10, { r: 0, g: 0, b: 255, alpha: 1 });

    const result = await buildRefineDiffArtifactImage(
      reference,
      annotated,
      { w: 100, h: 80 },
      { x: 30, y: 20, w: 20, h: 10 },
    );

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);

    const { data, info } = await sharp(result)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const backgroundOffset = (5 * info.width + 5) * 4;
    expect(data[backgroundOffset]).toBe(data[backgroundOffset + 1]);
    expect(data[backgroundOffset + 1]).toBe(data[backgroundOffset + 2]);

    const overlayOffset = (24 * info.width + 35) * 4;
    expect(data[overlayOffset]).toBe(0);
    expect(data[overlayOffset + 1]).toBe(0);
    expect(data[overlayOffset + 2]).toBe(255);
  });
});

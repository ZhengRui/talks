import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resizeForGoogle } from "./google-image-prep";

async function makeImage(width: number, height: number, format: "png" | "jpeg" = "png"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    [format]()
    .toBuffer();
}

describe("resizeForGoogle", () => {
  it("passes small images through unchanged and preserves mediaType", async () => {
    const buffer = await makeImage(800, 600, "jpeg");
    const result = await resizeForGoogle(buffer, 800, 600, "image/jpeg");
    expect(result.buffer).toBe(buffer);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.mediaType).toBe("image/jpeg");
  });

  it("downscales wide images and switches mediaType to image/png", async () => {
    const buffer = await makeImage(3840, 2160, "jpeg");
    const result = await resizeForGoogle(buffer, 3840, 2160, "image/jpeg");
    expect(result.buffer).not.toBe(buffer);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.mediaType).toBe("image/png");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.format).toBe("png");
  });

  it("downscales tall images with correct aspect ratio", async () => {
    const buffer = await makeImage(1080, 3840, "png");
    const result = await resizeForGoogle(buffer, 1080, 3840, "image/png");
    expect(result.height).toBe(1920);
    expect(result.width).toBe(540);
    expect(result.mediaType).toBe("image/png");
  });

  it("passes through when exactly at the 1920 edge", async () => {
    const buffer = await makeImage(1920, 1080, "png");
    const result = await resizeForGoogle(buffer, 1920, 1080, "image/png");
    expect(result.buffer).toBe(buffer);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });
});

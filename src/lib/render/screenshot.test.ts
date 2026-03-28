/* @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";
import type { LayoutSlide } from "@/lib/layout/types";
import { closeBrowser, renderSlideToImage } from "./screenshot";

afterAll(async () => {
  await closeBrowser();
});

const testSlide: LayoutSlide = {
  width: 1920,
  height: 1080,
  background: "#ff0000",
  elements: [
    {
      kind: "text",
      id: "title",
      rect: { x: 120, y: 80, w: 600, h: 100 },
      text: "RENDER TEST",
      style: {
        fontFamily: "Inter, sans-serif",
        fontSize: 64,
        fontWeight: 700,
        color: "#ffffff",
        lineHeight: 1.2,
      },
    },
  ],
};

function readPngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("renderSlideToImage", () => {
  it("returns a PNG buffer", async () => {
    const buf = await renderSlideToImage(testSlide);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  }, 15_000);

  it("respects custom output dimensions", async () => {
    const buf = await renderSlideToImage(testSlide, {
      width: 800,
      height: 600,
    });

    expect(readPngSize(buf)).toEqual({ width: 800, height: 600 });
  }, 15_000);

  it("supports JPEG format", async () => {
    const buf = await renderSlideToImage(testSlide, { format: "jpeg" });

    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  }, 15_000);

  it("recreates the page when deviceScaleFactor changes", async () => {
    const first = await renderSlideToImage(testSlide, {
      width: 400,
      height: 300,
      deviceScaleFactor: 1,
    });
    const second = await renderSlideToImage(testSlide, {
      width: 400,
      height: 300,
      deviceScaleFactor: 2,
    });

    expect(readPngSize(first)).toEqual({ width: 400, height: 300 });
    expect(readPngSize(second)).toEqual({ width: 800, height: 600 });
  }, 15_000);
});

import { describe, it, expect } from "vitest";
import { exportPptx } from "./pptx";
import type { LayoutPresentation } from "@/lib/layout/types";

const minimalLayout: LayoutPresentation = {
  title: "Test Presentation",
  author: "Test Author",
  slides: [
    {
      width: 1920,
      height: 1080,
      background: "#ffffff",
      elements: [
        {
          kind: "text",
          id: "title",
          rect: { x: 100, y: 100, w: 600, h: 80 },
          text: "Hello World",
          style: {
            fontFamily: "Inter, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            color: "#1a1a2e",
            lineHeight: 1.2,
            textAlign: "left",
          },
        },
      ],
    },
  ],
};

describe("exportPptx", () => {
  it("produces a valid buffer", async () => {
    const buffer = await exportPptx(minimalLayout);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("produces a valid ZIP (PPTX magic bytes)", async () => {
    const buffer = await exportPptx(minimalLayout);
    // PPTX files are ZIP archives — magic bytes PK\x03\x04
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it("handles slides with shapes and groups", async () => {
    const layout: LayoutPresentation = {
      title: "Shape Test",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#f8f9fc",
          elements: [
            {
              kind: "shape",
              id: "accent",
              rect: { x: 100, y: 100, w: 80, h: 4 },
              shape: "rect",
              style: {
                fill: "#4f6df5",
              },
            },
            {
              kind: "group",
              id: "card",
              rect: { x: 100, y: 200, w: 800, h: 100 },
              style: {
                fill: "#ffffff",
                borderRadius: 12,
              },
              border: { width: 3, color: "#4f6df5", sides: ["left"] },
              children: [
                {
                  kind: "text",
                  id: "card-text",
                  rect: { x: 24, y: 16, w: 752, h: 48 },
                  text: "Card content",
                  style: {
                    fontFamily: "Inter, sans-serif",
                    fontSize: 28,
                    fontWeight: 400,
                    color: "#1a1a2e",
                    lineHeight: 1.4,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    expect(buffer.length).toBeGreaterThan(0);
    // Valid ZIP
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("handles empty slides array", async () => {
    const layout: LayoutPresentation = {
      title: "Empty",
      slides: [],
    };

    const buffer = await exportPptx(layout);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it("handles background image slides", async () => {
    const layout: LayoutPresentation = {
      title: "BG Image",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#000000",
          backgroundImage: "https://example.com/image.jpg",
          overlay: "rgba(0,0,0,0.5)",
          elements: [],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles gradient fills via fallback", async () => {
    const layout: LayoutPresentation = {
      title: "Gradient",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          elements: [
            {
              kind: "shape",
              id: "gradient-line",
              rect: { x: 100, y: 100, w: 200, h: 4 },
              shape: "rect",
              style: {
                gradient: {
                  type: "linear",
                  angle: 90,
                  stops: [
                    { color: "#4f6df5", position: 0 },
                    { color: "#a855f7", position: 1 },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
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

  it("injects timing XML for animated elements", async () => {
    const layout: LayoutPresentation = {
      title: "Animated",
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
              text: "Animated Title",
              style: {
                fontFamily: "Inter, sans-serif",
                fontSize: 48,
                fontWeight: 700,
                color: "#1a1a2e",
                lineHeight: 1.2,
              },
              animation: { type: "fade-in", delay: 0, duration: 600 },
            },
          ],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    // Valid ZIP
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    // Extract and verify timing XML was injected
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain("<p:timing>");
    expect(slideXml).toContain("p:animEffect");
    expect(slideXml).toContain('filter="fade"');
  });

  it("does not inject timing XML for non-animated slides", async () => {
    const buffer = await exportPptx(minimalLayout);

    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(slideXml).toBeDefined();
    expect(slideXml).not.toContain("<p:timing>");
  });

  it("handles mixed animated and non-animated slides", async () => {
    const layout: LayoutPresentation = {
      title: "Mixed",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          elements: [
            {
              kind: "text",
              id: "static-title",
              rect: { x: 100, y: 100, w: 600, h: 80 },
              text: "No animation",
              style: {
                fontFamily: "Inter, sans-serif",
                fontSize: 48,
                fontWeight: 700,
                color: "#1a1a2e",
                lineHeight: 1.2,
              },
            },
          ],
        },
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          elements: [
            {
              kind: "text",
              id: "animated-title",
              rect: { x: 100, y: 100, w: 600, h: 80 },
              text: "Animated",
              style: {
                fontFamily: "Inter, sans-serif",
                fontSize: 48,
                fontWeight: 700,
                color: "#1a1a2e",
                lineHeight: 1.2,
              },
              animation: { type: "fade-up", delay: 200, duration: 600 },
            },
          ],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    const zip = await JSZip.loadAsync(buffer);

    // Slide 1: no animations
    const slide1 = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(slide1).not.toContain("<p:timing>");

    // Slide 2: has animations
    const slide2 = await zip.file("ppt/slides/slide2.xml")?.async("string");
    expect(slide2).toContain("<p:timing>");
    expect(slide2).toContain("ppt_y");
  });

  it("tracks correct spids for group elements", async () => {
    const layout: LayoutPresentation = {
      title: "Group Animation",
      slides: [
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          elements: [
            {
              kind: "group",
              id: "card",
              rect: { x: 100, y: 200, w: 800, h: 100 },
              style: { fill: "#ffffff", borderRadius: 12 },
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
              animation: { type: "scale-up", delay: 100, duration: 500 },
            },
          ],
        },
      ],
    };

    const buffer = await exportPptx(layout);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(slideXml).toContain("<p:timing>");
    expect(slideXml).toContain("p:animScale");
    // Group renders bg shape + text child = 2 objects → spids 2 and 3
    expect(slideXml).toContain('spid="2"');
    expect(slideXml).toContain('spid="3"');
  });
});

import { describe, expect, it } from "vitest";
import type { LayoutSlide } from "@/lib/layout/types";
import { buildSlideHtml } from "./html";

const minSlide: LayoutSlide = {
  width: 1920,
  height: 1080,
  background: "#1a1a2e",
  elements: [
    {
      kind: "text",
      id: "title",
      rect: { x: 100, y: 100, w: 400, h: 60 },
      text: "Hello",
      style: {
        fontFamily: "Inter, sans-serif",
        fontSize: 48,
        fontWeight: 700,
        color: "#ffffff",
        lineHeight: 1.2,
      },
    },
  ],
};

describe("buildSlideHtml", () => {
  it("returns a complete HTML document", () => {
    const html = buildSlideHtml(minSlide);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("includes Google Fonts and CSS font variables", () => {
    const html = buildSlideHtml(minSlide);

    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("--font-inter");
    expect(html).toContain("'Inter'");
  });

  it("includes animations CSS and rendered slide markup", () => {
    const html = buildSlideHtml(minSlide);

    expect(html).toContain("@keyframes fadeUp");
    expect(html).toContain("@keyframes float");
    expect(html).toContain("Hello");
    expect(html).toContain("#1a1a2e");
  });

  it("defaults output size to the slide dimensions", () => {
    const html = buildSlideHtml(minSlide);

    expect(html).toContain("width: 1920px");
    expect(html).toContain("height: 1080px");
  });

  it("injects a base tag when assetBaseUrl is provided", () => {
    const html = buildSlideHtml(minSlide, {
      assetBaseUrl: "http://127.0.0.1:3000/",
    });

    expect(html).toContain('<base href="http://127.0.0.1:3000/" />');
  });

  it("uses a contain transform by default", () => {
    const html = buildSlideHtml(minSlide, { width: 800, height: 800 });

    expect(html).toContain("left: 0px");
    expect(html).toContain("top: 175px");
    expect(html).toContain("transform: scale(0.4166666666666667)");
  });

  it("uses a cover transform when requested", () => {
    const html = buildSlideHtml(minSlide, {
      width: 800,
      height: 800,
      fit: "cover",
    });

    expect(html).toContain("left: -311.1111111111111px");
    expect(html).toContain("top: 0px");
    expect(html).toContain("transform: scale(0.7407407407407407)");
  });

  it("uses independent X/Y scale in stretch mode", () => {
    const html = buildSlideHtml(minSlide, {
      width: 800,
      height: 600,
      fit: "stretch",
    });

    expect(html).toContain("left: 0px");
    expect(html).toContain("top: 0px");
    expect(html).toContain("transform: scale(0.4166666666666667, 0.5555555555555556)");
  });
});

/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LayoutSlideRenderer } from "./LayoutRenderer";
import type { LayoutSlide } from "@/lib/layout/types";

afterEach(cleanup);

function makeSlide(): LayoutSlide {
  return {
    width: 800,
    height: 600,
    background: "#000000",
    elements: [
      {
        kind: "text",
        id: "title",
        rect: { x: 100, y: 80, w: 240, h: 60 },
        text: "THE AXIS OF RESISTANCE",
        style: {
          fontFamily: "Inter, sans-serif",
          fontSize: 48,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.1,
          textAlign: "center",
          letterSpacing: 3,
          textTransform: "uppercase",
        },
      },
    ],
  };
}

describe("LayoutSlideRenderer", () => {
  it("clips text by default", () => {
    const { container } = render(<LayoutSlideRenderer slide={makeSlide()} animationNone />);
    const textNode = container.querySelector("section > div");

    expect(textNode).not.toBeNull();
    expect(textNode?.getAttribute("style")).toContain("overflow: hidden");
  });

  it("shows text overflow guides in debug preview mode", () => {
    const { container } = render(
      <LayoutSlideRenderer slide={makeSlide()} animationNone debugTextOverflow />,
    );
    const textNode = container.querySelector("section > div");

    expect(textNode).not.toBeNull();
    expect(textNode?.getAttribute("style")).toContain("overflow: visible");
    expect(textNode?.getAttribute("style")).toContain("outline: 1px dashed");
  });
});

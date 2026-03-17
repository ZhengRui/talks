import { describe, expect, it } from "vitest";
import { normalizeAnalysisRegions } from "./normalize-analysis";

describe("normalizeAnalysisRegions", () => {
  it("rescales proposal regions when analysis dimensions differ from actual image size", () => {
    const analysis = {
      source: {
        image: "slide.png",
        dimensions: { w: 960, h: 540 },
      },
      proposals: [
        {
          name: "chart",
          region: { x: 480, y: 270, w: 240, h: 135 },
        },
      ],
    };

    const result = normalizeAnalysisRegions(analysis, { w: 1920, h: 1080 });

    expect(result.source?.dimensions).toEqual({ w: 1920, h: 1080 });
    expect(result.proposals?.[0].region).toEqual({
      x: 960,
      y: 540,
      w: 480,
      h: 270,
    });
  });

  it("only updates source dimensions when no reported dimensions exist", () => {
    const analysis = {
      source: {
        image: "slide.png",
      },
      proposals: [
        {
          name: "chart",
          region: { x: 10, y: 20, w: 30, h: 40 },
        },
      ],
    };

    const result = normalizeAnalysisRegions(analysis, { w: 1920, h: 1080 });

    expect(result.source?.dimensions).toEqual({ w: 1920, h: 1080 });
    expect(result.proposals?.[0].region).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("clamps rescaled regions to the actual image bounds", () => {
    const analysis = {
      source: {
        dimensions: { w: 1000, h: 500 },
      },
      proposals: [
        {
          name: "oversized",
          region: { x: 900, y: 450, w: 300, h: 100 },
        },
      ],
    };

    const result = normalizeAnalysisRegions(analysis, { w: 2000, h: 1000 });

    expect(result.proposals?.[0].region).toEqual({
      x: 1800,
      y: 900,
      w: 200,
      h: 100,
    });
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAnalysisRegions } from "./normalize-analysis";

describe("normalizeAnalysisRegions", () => {
  const inventoryFixture = {
    slideBounds: { x: 0, y: 0, w: 960, h: 540 },
    background: {
      summary: "dark",
      base: "#111820",
      palette: ["#111820", "#ffffff"],
      layers: [
        {
          kind: "glow",
          bbox: { x: 100, y: 200, w: 300, h: 120 },
          description: "warm glow",
          importance: "high" as const,
        },
      ],
    },
    typography: [
      {
        id: "title",
        text: "KEY PLAYERS",
        bbox: { x: 220, y: 120, w: 300, h: 60 },
        importance: "high" as const,
        style: {
          color: "#ffffff",
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: 2,
          lineHeight: 1.1,
        },
      },
    ],
    regions: [
      {
        id: "badge",
        kind: "group",
        bbox: { x: 500, y: 320, w: 100, h: 24 },
        importance: "medium" as const,
        description: "badge",
      },
    ],
    repeatGroups: [
      {
        id: "cards-row",
        bbox: { x: 100, y: 300, w: 760, h: 180 },
        count: 4,
        orientation: "row" as const,
        itemSize: { w: 180, h: 180 },
        gap: 10,
        description: "cards",
      },
      {
        id: "stats-col",
        bbox: { x: 820, y: 80, w: 100, h: 240 },
        count: 3,
        orientation: "column" as const,
        itemSize: { w: 100, h: 60 },
        gap: 20,
        description: "stats",
      },
      {
        id: "grid",
        bbox: { x: 0, y: 0, w: 400, h: 300 },
        count: 6,
        orientation: "grid" as const,
        itemSize: { w: 100, h: 80 },
        gapX: 12,
        gapY: 16,
        description: "grid",
      },
    ],
    mustPreserve: [{ text: "glow", ref: null }],
    uncertainties: [],
    blockCandidates: [],
  };

  type TestProposal = {
    name: string;
    region: { x: number; y: number; w: number; h: number };
  };

  type TestSource = {
    image?: string;
    dimensions?: { w: number; h: number };
    reportedDimensions?: { w: number; h: number };
  };

  type TestAnalysis = {
    source: TestSource;
    inventory?: typeof inventoryFixture;
    proposals: TestProposal[];
  };

  it("rescales proposal regions when analysis dimensions differ from actual image size", () => {
    const analysis: TestAnalysis = {
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
    expect(result.source?.reportedDimensions).toEqual({ w: 960, h: 540 });
    expect(result.proposals?.[0].region).toEqual({
      x: 960,
      y: 540,
      w: 480,
      h: 270,
    });
  });

  it("only updates source dimensions when no reported dimensions exist", () => {
    const analysis: TestAnalysis = {
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
    const analysis: TestAnalysis = {
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

  it("normalizes inventory spatial metrics and preserves non-spatial values", () => {
    const analysis: TestAnalysis = {
      source: {
        image: "slide.png",
        dimensions: { w: 960, h: 540 },
      },
      inventory: inventoryFixture,
      proposals: [
        {
          name: "slide",
          region: { x: 0, y: 0, w: 960, h: 540 },
        },
      ],
    };

    const result = normalizeAnalysisRegions(analysis, { w: 1920, h: 1080 });
    const inventory = result.inventory!;

    expect(inventory.slideBounds).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(inventory.background.layers[0].bbox).toEqual({
      x: 200,
      y: 400,
      w: 600,
      h: 240,
    });
    expect(inventory.typography[0].bbox).toEqual({
      x: 440,
      y: 240,
      w: 600,
      h: 120,
    });
    expect(inventory.typography[0].style.fontSize).toBe(80);
    expect(inventory.typography[0].style.letterSpacing).toBe(4);
    expect(inventory.typography[0].style.lineHeight).toBe(1.1);
    expect(inventory.typography[0].style.fontWeight).toBe(700);
    expect(inventory.repeatGroups[0].itemSize).toEqual({ w: 360, h: 360 });
    expect(inventory.repeatGroups[0].gap).toBe(20);
    expect(inventory.repeatGroups[1].gap).toBe(40);
    expect(inventory.repeatGroups[2].gapX).toBe(24);
    expect(inventory.repeatGroups[2].gapY).toBe(32);
    expect(inventory.repeatGroups[0].count).toBe(4);
    expect(inventory.repeatGroups[0].orientation).toBe("row");
    expect(inventory.background.palette).toEqual(["#111820", "#ffffff"]);
  });

  it("supports the full v11 response shape and remains backwards-compatible without inventory", () => {
    const withInventoryAnalysis: TestAnalysis = {
      source: {
        image: "slide.png",
        dimensions: { w: 960, h: 540 },
      },
      inventory: inventoryFixture,
      proposals: [
        {
          name: "slide",
          region: { x: 0, y: 0, w: 960, h: 540 },
        },
      ],
    };

    const withInventory = normalizeAnalysisRegions(
      withInventoryAnalysis,
      { w: 1440, h: 810 },
    );

    expect(withInventory.inventory?.repeatGroups[0].gap).toBe(15);
    expect(withInventory.source.reportedDimensions).toEqual({ w: 960, h: 540 });

    const withoutInventoryAnalysis: TestAnalysis = {
      source: {
        image: "slide.png",
        dimensions: { w: 960, h: 540 },
      },
      proposals: [
        {
          name: "slide",
          region: { x: 0, y: 0, w: 960, h: 540 },
        },
      ],
    };

    const withoutInventory = normalizeAnalysisRegions(
      withoutInventoryAnalysis,
      { w: 1440, h: 810 },
    );

    expect(withoutInventory.inventory).toBeUndefined();
    expect(withoutInventory.proposals[0].region).toEqual({
      x: 0,
      y: 0,
      w: 1440,
      h: 810,
    });
  });

  it("leaves inventory untouched when no rescale is needed", () => {
    const analysis: TestAnalysis = {
      source: {
        image: "slide.png",
        dimensions: { w: 960, h: 540 },
      },
      inventory: inventoryFixture,
      proposals: [
        {
          name: "slide",
          region: { x: 0, y: 0, w: 960, h: 540 },
        },
      ],
    };

    const result = normalizeAnalysisRegions(analysis, { w: 960, h: 540 });
    expect(result.inventory).toEqual(inventoryFixture);
  });
});

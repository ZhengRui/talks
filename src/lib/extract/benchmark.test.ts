/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeometryHints } from "@/components/extract/types";
import type { LayoutSlide } from "@/lib/layout/types";

const mocks = vi.hoisted(() => ({
  mockDiscoverPresentations: vi.fn(),
  mockLoadPresentation: vi.fn(),
  mockLayoutSlide: vi.fn(),
  mockRenderSlideToImage: vi.fn(),
  mockBuildGeometryHints: vi.fn(),
}));

vi.mock("@/lib/loadPresentation", () => ({
  discoverPresentations: mocks.mockDiscoverPresentations,
  loadPresentation: mocks.mockLoadPresentation,
}));

vi.mock("@/lib/layout", () => ({
  layoutSlide: mocks.mockLayoutSlide,
}));

vi.mock("@/lib/render/screenshot", () => ({
  renderSlideToImage: mocks.mockRenderSlideToImage,
}));

vi.mock("./geometry-hints", () => ({
  buildGeometryHints: mocks.mockBuildGeometryHints,
}));

import { listBenchmarkDecks, loadBenchmarkSlide } from "./benchmark";

describe("benchmark helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists decks sorted by slug", () => {
    mocks.mockDiscoverPresentations.mockReturnValue([
      { slug: "zeta", title: "Zeta", slideCount: 1 },
      { slug: "alpha", title: "Alpha", slideCount: 3 },
    ]);

    expect(listBenchmarkDecks()).toEqual([
      { slug: "alpha", title: "Alpha", slideCount: 3 },
      { slug: "zeta", title: "Zeta", slideCount: 1 },
    ]);
  });

  it("loads one slide, renders it, and returns image data plus geometry hints", async () => {
    const slide = { mode: "scene", children: [] };
    const layout: LayoutSlide = {
      width: 1920,
      height: 1080,
      background: "#fff",
      elements: [],
    };
    const geometryHints: GeometryHints = {
      source: "layout",
      canvas: { w: 1920, h: 1080 },
      elements: [],
    };

    mocks.mockLoadPresentation.mockReturnValue({
      title: "My Deck",
      theme: "modern",
      slides: [slide, slide],
    });
    mocks.mockLayoutSlide.mockReturnValue(layout);
    mocks.mockRenderSlideToImage.mockResolvedValue(Buffer.from("png-bits"));
    mocks.mockBuildGeometryHints.mockReturnValue(geometryHints);

    const result = await loadBenchmarkSlide("demo", 2, {
      assetBaseUrl: "http://127.0.0.1:3000/",
    });

    expect(mocks.mockLayoutSlide).toHaveBeenCalledWith(
      slide,
      "modern",
      "/demo",
      1,
      expect.any(Object),
    );
    expect(mocks.mockRenderSlideToImage).toHaveBeenCalledWith(layout, {
      width: 1920,
      height: 1080,
      assetBaseUrl: "http://127.0.0.1:3000/",
    });
    expect(result).toMatchObject({
      slug: "demo",
      title: "My Deck",
      slideIndex: 2,
      label: "demo slide 2",
      fileName: "demo-slide-2.png",
      width: 1920,
      height: 1080,
      geometryHints,
    });
    expect(result.imageDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects out-of-range slide numbers", async () => {
    mocks.mockLoadPresentation.mockReturnValue({
      title: "My Deck",
      slides: [{ mode: "scene", children: [] }],
    });

    await expect(loadBenchmarkSlide("demo", 2)).rejects.toThrow(/out of range/i);
  });
});

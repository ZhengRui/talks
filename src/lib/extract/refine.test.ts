import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "@/components/extract/types";

const {
  mockQuery,
  mockCompileProposalPreview,
  mockAnnotateDiffImage,
  mockCompareImages,
  mockCropToContentBounds,
  mockPutRefineArtifact,
  mockRenderSlideToImage,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockCompileProposalPreview: vi.fn(() => ({ width: 1920, height: 1080 })),
  mockAnnotateDiffImage: vi.fn(async (buffer: Buffer) => buffer),
  mockCompareImages: vi.fn(async () => ({
    mismatchRatio: 0.2,
    mismatchPixels: 10,
    totalPixels: 100,
    diffImage: Buffer.from("diff"),
    regions: [],
    width: 100,
    height: 100,
  })),
  mockCropToContentBounds: vi.fn(async (buffer: Buffer) => buffer),
  mockPutRefineArtifact: vi.fn(() => "artifact-1"),
  mockRenderSlideToImage: vi.fn(async () => Buffer.from("replica")),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mockQuery,
}));

vi.mock("@/lib/extract/compile-preview", () => ({
  compileProposalPreview: mockCompileProposalPreview,
}));

vi.mock("@/lib/render/annotate", () => ({
  annotateDiffImage: mockAnnotateDiffImage,
}));

vi.mock("@/lib/render/compare", () => ({
  compareImages: mockCompareImages,
}));

vi.mock("@/lib/render/crop", () => ({
  cropToContentBounds: mockCropToContentBounds,
}));

vi.mock("@/lib/extract/refine-artifacts", () => ({
  putRefineArtifact: mockPutRefineArtifact,
}));

vi.mock("@/lib/render/screenshot", () => ({
  renderSlideToImage: mockRenderSlideToImage,
}));

import { runRefinementLoop } from "./refine";

function makeProposals(): Proposal[] {
  return [
    {
      scope: "slide",
      name: "slide-template",
      description: "base slide",
      region: { x: 0, y: 0, w: 1920, h: 1080 },
      params: {},
      style: {},
      body: "children: []",
    },
  ];
}

describe("runRefinementLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockImplementation(async function* () {
      yield {
        type: "result",
        result: "this is not valid json",
      };
    });
  });

  it("keeps proposals unchanged when Claude returns malformed JSON", async () => {
    const proposals = makeProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    const result = await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: {
        source: {
          image: "reference.png",
          dimensions: { w: 1920, h: 1080 },
          contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
        },
        proposals,
      },
      maxIterations: 2,
      mismatchThreshold: 0.05,
      model: "claude-opus-4-6",
      effort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.converged).toBe(false);
    expect(result.finalIteration).toBe(2);
    expect(result.proposals).toEqual(proposals);
    expect(mockCompareImages).toHaveBeenCalledTimes(2);
    expect(
      events.find((event) => event.event === "refine:patch")?.data.proposals,
    ).toEqual(proposals);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "@/components/extract/types";

const {
  mockQuery,
  mockCompileProposalPreview,
  mockAnnotateDiffImage,
  mockCompareImages,
  mockPutRefineArtifact,
  mockRenderSlideToImage,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockCompileProposalPreview: vi.fn(() => ({
    width: 1920, height: 1080, background: "#000", elements: [],
  })),
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

function makePatchedProposals(): Proposal[] {
  return [
    {
      ...makeProposals()[0],
      body: "children:\n  - kind: text\n    text: changed",
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
    // Initial diff plus one post-patch render per iteration.
    expect(mockCompareImages).toHaveBeenCalledTimes(3);
    expect(mockCompareImages).toHaveBeenNthCalledWith(
      1,
      Buffer.from("reference"),
      Buffer.from("replica"),
      { maskBounds: { x: 0, y: 0, w: 1920, h: 1080 } },
    );
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(
      events.find((event) => event.event === "refine:patch")?.data.proposals,
    ).toEqual(proposals);
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      iteration: 1,
      mismatchRatio: 0.2,
    });
  });

  it("sends absolute geometry and preserves the original media type", async () => {
    const proposals = makeProposals();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );
    mockRenderSlideToImage.mockResolvedValueOnce(pngBuffer);

    await runRefinementLoop({
      image: pngBuffer,
      imageMediaType: "image/jpeg",
      proposals,
      baseAnalysis: {
        source: {
          image: "reference.png",
          dimensions: { w: 1920, h: 1080 },
          contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
        },
        proposals,
      },
      maxIterations: 1,
      mismatchThreshold: 0.05,
      model: "claude-opus-4-6",
      effort: "medium",
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryArg = mockQuery.mock.calls[0]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
      options: { systemPrompt: string };
    };
    const firstPrompt = await queryArg.prompt.next();
    const content = firstPrompt.value?.message.content ?? [];

    // 3 images (side-by-side, original, replica) + 1 text prompt
    expect(content).toHaveLength(4);
    expect(content[0]?.type).toBe("image");
    expect(content[1]?.type).toBe("image");
    expect(content[2]?.type).toBe("image");
    expect(content[3]?.type).toBe("text");
    // side-by-side is always PNG, original preserves upload type, replica is PNG
    expect((content[0] as { source: { media_type: string } }).source.media_type).toBe("image/png");
    expect((content[1] as { source: { media_type: string } }).source.media_type).toBe("image/jpeg");
    expect((content[2] as { source: { media_type: string } }).source.media_type).toBe("image/png");
    // no geometry table in prompt
    const textContent = (content[3] as { text: string }).text;
    expect(textContent).not.toContain("Resolved element geometry");
    expect(textContent).toContain("proposals");
  });

  it("keeps a patch even when it increases mismatch", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery.mockImplementation(async function* () {
      yield {
        type: "result",
        result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
      };
    });

    mockCompareImages
      .mockResolvedValueOnce({
        mismatchRatio: 0.2,
        mismatchPixels: 20,
        totalPixels: 100,
        diffImage: Buffer.from("diff-initial"),
        regions: [],
        width: 100,
        height: 100,
      })
      .mockResolvedValueOnce({
        mismatchRatio: 0.3,
        mismatchPixels: 30,
        totalPixels: 100,
        diffImage: Buffer.from("diff-regressed"),
        regions: [],
        width: 100,
        height: 100,
      });

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
      maxIterations: 1,
      mismatchThreshold: 0.05,
      model: "claude-opus-4-6",
      effort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.converged).toBe(false);
    expect(result.finalIteration).toBe(1);
    expect(result.mismatchRatio).toBe(0.3);
    expect(result.proposals).toEqual(patchedProposals);
    expect(
      events.find((event) => event.event === "refine:patch")?.data,
    ).toMatchObject({
      iteration: 1,
      proposals: patchedProposals,
    });
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      iteration: 1,
      mismatchRatio: 0.3,
    });
  });

  it("keeps a patch when the mismatch stays flat", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery.mockImplementation(async function* () {
      yield {
        type: "result",
        result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
      };
    });

    mockCompareImages
      .mockResolvedValueOnce({
        mismatchRatio: 0.2,
        mismatchPixels: 20,
        totalPixels: 100,
        diffImage: Buffer.from("diff-initial"),
        regions: [],
        width: 100,
        height: 100,
      })
      .mockResolvedValueOnce({
        mismatchRatio: 0.2,
        mismatchPixels: 20,
        totalPixels: 100,
        diffImage: Buffer.from("diff-flat"),
        regions: [],
        width: 100,
        height: 100,
      });

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
      maxIterations: 1,
      mismatchThreshold: 0.05,
      model: "claude-opus-4-6",
      effort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.proposals).toEqual(patchedProposals);
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      iteration: 1,
      mismatchRatio: 0.2,
    });
  });

  it("emits cumulative iteration numbers when continuing refinement", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery.mockImplementation(async function* () {
      yield {
        type: "result",
        result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
      };
    });

    mockCompareImages
      .mockResolvedValueOnce({
        mismatchRatio: 0.2,
        mismatchPixels: 20,
        totalPixels: 100,
        diffImage: Buffer.from("diff-initial"),
        regions: [],
        width: 100,
        height: 100,
      })
      .mockResolvedValueOnce({
        mismatchRatio: 0.18,
        mismatchPixels: 18,
        totalPixels: 100,
        diffImage: Buffer.from("diff-iter-2"),
        regions: [],
        width: 100,
        height: 100,
      });

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
      maxIterations: 1,
      iterationOffset: 1,
      mismatchThreshold: 0.05,
      model: "claude-opus-4-6",
      effort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.finalIteration).toBe(2);
    expect(result.proposals).toEqual(patchedProposals);
    expect(
      events.find((event) => event.event === "refine:start")?.data,
    ).toMatchObject({
      iteration: 1,
      maxIterations: 2,
    });
    expect(
      events
        .filter((event) => event.event === "refine:diff")
        .map((event) => event.data.iteration),
    ).toEqual([1, 2]);
    expect(
      events.find((event) => event.event === "refine:patch")?.data,
    ).toMatchObject({
      iteration: 2,
      proposals: patchedProposals,
    });
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      iteration: 2,
      mismatchRatio: 0.18,
    });
    expect(
      events.find((event) => event.event === "refine:done")?.data,
    ).toMatchObject({
      finalIteration: 2,
      mismatchRatio: 0.18,
    });
  });
});

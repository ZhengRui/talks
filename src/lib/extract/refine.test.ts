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

function makeBaseAnalysis(proposals: Proposal[]) {
  return {
    source: {
      image: "reference.png",
      dimensions: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    },
    proposals,
  };
}

describe("runRefinementLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockQuery
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "1. Title is too large compared to the original.\n2. Background line pattern is missing.",
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: `\`\`\`json
${JSON.stringify(makePatchedProposals(), null, 2)}
\`\`\``,
        };
      });
  });

  it("vision call sends labeled comparison images and no proposals JSON", async () => {
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
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const visionCall = mockQuery.mock.calls[0]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
      options: { systemPrompt: string };
    };
    const firstPrompt = await visionCall.prompt.next();
    const content = firstPrompt.value?.message.content ?? [];

    // text label + image + text label + image + user prompt = 5 blocks
    expect(content).toHaveLength(5);
    expect(content[0]?.type).toBe("text");
    expect((content[0] as { text: string }).text).toBe("ORIGINAL slide:");
    expect(content[1]?.type).toBe("image");
    expect((content[1] as { source: { media_type: string } }).source.media_type).toBe("image/jpeg");
    expect(content[2]?.type).toBe("text");
    expect((content[2] as { text: string }).text).toBe("REPLICA slide:");
    expect(content[3]?.type).toBe("image");
    expect((content[3] as { source: { media_type: string } }).source.media_type).toBe("image/png");
    expect(content[4]?.type).toBe("text");

    const userPrompt = (content[4] as { text: string }).text;
    expect(userPrompt).not.toContain("proposals");
    expect(visionCall.options.systemPrompt).not.toContain("JSON");
    expect(visionCall.options.systemPrompt).toContain("ORIGINAL");
    expect(visionCall.options.systemPrompt).toContain("REPLICA");
  });

  it("edit call sends labeled comparison images alongside differences and proposals JSON", async () => {
    const proposals = makeProposals();
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );
    mockRenderSlideToImage.mockResolvedValueOnce(pngBuffer);

    await runRefinementLoop({
      image: pngBuffer,
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
    });

    const editCall = mockQuery.mock.calls[1]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
      options: { systemPrompt: string };
    };
    const firstPrompt = await editCall.prompt.next();
    const content = firstPrompt.value?.message.content ?? [];

    expect(content).toHaveLength(5);
    expect(content[0]?.type).toBe("text");
    expect((content[0] as { text: string }).text).toBe("ORIGINAL slide:");
    expect(content[1]?.type).toBe("image");
    expect((content[1] as { source: { media_type: string } }).source.media_type).toBe("image/png");
    expect(content[2]?.type).toBe("text");
    expect((content[2] as { text: string }).text).toBe("REPLICA slide:");
    expect(content[3]?.type).toBe("image");
    expect((content[3] as { source: { media_type: string } }).source.media_type).toBe("image/png");
    expect(content[4]?.type).toBe("text");
    const textContent = (content[4] as { text: string }).text;
    expect(textContent).toContain("Title is too large");
    expect(textContent).toContain('"scope": "slide"');
    expect(textContent).toContain("You will also receive two labeled images");
    expect(editCall.options.systemPrompt).toContain("proposals");
    expect(editCall.options.systemPrompt).toContain("ORIGINAL");
    expect(editCall.options.systemPrompt).toContain("REPLICA");
  });

  it("emits prompt events for vision and edit requests", async () => {
    const proposals = makeProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-sonnet-4-6",
      editEffort: "high",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(events.find((event) => event.event === "refine:vision:prompt")?.data)
      .toMatchObject({
        iteration: 1,
        phase: "vision",
        model: "claude-opus-4-6",
        effort: "medium",
      });
    expect(events.find((event) => event.event === "refine:edit:prompt")?.data)
      .toMatchObject({
        iteration: 1,
        phase: "edit",
        model: "claude-sonnet-4-6",
        effort: "high",
      });
  });

  it("keeps proposals unchanged when the edit step returns malformed JSON", async () => {
    const proposals = makeProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "1. Title is too large.\n2. Accent rule is missing.",
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "this is not valid json",
        };
      });

    const result = await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.converged).toBe(false);
    expect(result.finalIteration).toBe(1);
    expect(result.proposals).toEqual(proposals);
    expect(mockCompareImages).toHaveBeenCalledTimes(2);
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

  it("skips edit and keeps proposals when vision returns empty", async () => {
    const proposals = makeProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "   ",
        };
      });

    const result = await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.proposals).toEqual(proposals);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockCompareImages).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.event === "refine:edit:start")).toBe(false);
    expect(events.some((event) => event.event === "refine:diff" && event.data.iteration === 1)).toBe(false);
    expect(
      events.find((event) => event.event === "refine:vision:done")?.data,
    ).toMatchObject({
      differences: "   ",
      visionEmpty: true,
    });
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      iteration: 1,
      mismatchRatio: 0.2,
      visionEmpty: true,
    });
  });

  it("skips edit when trimmed vision output is 19 characters", async () => {
    const proposals = makeProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "1234567890123456789",
        };
      });

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.event === "refine:edit:start")).toBe(false);
    expect(
      events.find((event) => event.event === "refine:complete")?.data,
    ).toMatchObject({
      visionEmpty: true,
    });
  });

  it("runs the edit step when trimmed vision output is 20 characters", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "12345678901234567890",
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
        };
      });

    const result = await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.proposals).toEqual(patchedProposals);
    expect(events.some((event) => event.event === "refine:edit:start")).toBe(true);
    expect(
      events.find((event) => event.event === "refine:complete")?.data.visionEmpty,
    ).toBeUndefined();
  });

  it("emits cumulative iteration numbers when continuing refinement", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: "1. Title is too large.\n2. Accent rule is missing.",
        };
      })
      .mockImplementationOnce(async function* () {
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
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      iterationOffset: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
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
      visionModel: "claude-opus-4-6",
      editModel: "claude-opus-4-6",
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

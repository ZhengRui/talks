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

function makeVisionIssuesJson(
  overrides?: {
    issues?: Array<Record<string, unknown>>;
    priorIssueChecks?: Array<Record<string, unknown>>;
    resolvedIssueIds?: string[];
  },
): string {
  const issues = overrides?.issues ?? [
    {
      priority: 1,
      issueId: "title.scale",
      category: "layout",
      ref: "title",
      area: "title",
      issue: "title is too large",
      fixType: "style_adjustment",
      observed: "Replica title feels oversized.",
      desired: "Original title should feel smaller.",
      confidence: 0.9,
    },
    {
      priority: 2,
      issueId: "proxy-cards.content",
      category: "content",
      ref: "proxy-cards",
      area: "proxy card descriptions",
      issue: "description text is truncated",
      fixType: "content_fix",
      observed: "Replica cuts off the final word in two cards.",
      desired: "Original shows the full proxy descriptions.",
      confidence: 0.88,
    },
    {
      priority: 3,
      issueId: "connector-lines.graphic-structure",
      category: "signature_visual",
      ref: "connector-lines",
      area: "background lines",
      issue: "background line pattern is missing",
      fixType: "structural_change",
      observed: "Replica is missing the line pattern.",
      desired: "Original includes the line pattern.",
      confidence: 0.82,
    },
  ];

  if (!overrides?.priorIssueChecks && !overrides?.resolvedIssueIds) {
    return JSON.stringify(issues, null, 2);
  }

  return JSON.stringify({
    priorIssueChecks: overrides?.priorIssueChecks ?? [],
    issues,
    ...(overrides?.resolvedIssueIds
      ? { resolvedIssueIds: overrides.resolvedIssueIds }
      : {}),
  }, null, 2);
}

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

function extractStructuredIssuesFromEditPrompt(prompt: string): string {
  const match = prompt.match(/Structured issues:\n```json\n([\s\S]*?)\n```/);
  return match?.[1] ?? "";
}

function makeBaseAnalysis(proposals: Proposal[]) {
  return {
    source: {
      image: "reference.png",
      dimensions: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    },
    inventory: {
      slideBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      background: {
        summary: "dark slide",
        base: "#000000",
        palette: ["#000000"],
        layers: [],
      },
      typography: [],
      regions: [
        {
          id: "connector-lines",
          kind: "decorative-lines",
          bbox: { x: 600, y: 300, w: 700, h: 500 },
          importance: "high",
          description: "Diagonal connector X crossing through the center hub",
        },
      ],
      repeatGroups: [],
      signatureVisuals: [
        {
          text: "Orange hub circle with diagonal connector X",
          ref: "connector-lines",
          importance: "high",
        },
      ],
      mustPreserve: [
        {
          text: "Title text: THE AXIS OF RESISTANCE",
          ref: "title",
        },
      ],
      uncertainties: [],
      blockCandidates: [],
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
          result: makeVisionIssuesJson(),
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

  it("vision call sends labeled comparison images and requests structured issues without proposals JSON", async () => {
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
    expect(userPrompt).toContain("Signature visuals from extract");
    expect(userPrompt).toContain("Orange hub circle with diagonal connector X");
    expect(visionCall.options.systemPrompt).toContain("JSON array");
    expect(visionCall.options.systemPrompt).not.toContain("\"priorIssueChecks\"");
    expect(visionCall.options.systemPrompt).toContain("\"issueId\"");
    expect(visionCall.options.systemPrompt).toContain("\"category\"");
    expect(visionCall.options.systemPrompt).toContain("\"ref\"");
    expect(visionCall.options.systemPrompt).toContain("\"fixType\"");
    expect(visionCall.options.systemPrompt).toContain("ORIGINAL");
    expect(visionCall.options.systemPrompt).toContain("REPLICA");
  });

  it("passes prior unresolved issues into the next vision prompt", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson(),
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson(),
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
        diffImage: Buffer.from("diff-iter-1"),
        regions: [],
        width: 100,
        height: 100,
      })
      .mockResolvedValueOnce({
        mismatchRatio: 0.16,
        mismatchPixels: 16,
        totalPixels: 100,
        diffImage: Buffer.from("diff-iter-2"),
        regions: [],
        width: 100,
        height: 100,
      });

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 2,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
    });

    const secondVisionCall = mockQuery.mock.calls[2]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const secondPrompt = await secondVisionCall.prompt.next();
    const secondText = (secondPrompt.value?.message.content?.[4] as { text: string }).text;

    expect(secondText).toContain("Previous issues to re-check from the prior iteration");
    expect(secondText).toContain("\"issueId\": \"title.scale\"");
    expect(secondText).toContain("\"issue\": \"title is too large\"");
    expect(secondText).toContain("\"fixType\": \"structural_change\"");
    expect(secondText).toContain("\"ref\": \"connector-lines\"");
  });

  it("seeds prior unresolved issues into the first vision prompt when provided in options", async () => {
    const proposals = makeProposals();

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      priorIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "connector-lines.graphic-structure",
          category: "signature_visual",
          ref: "connector-lines",
          area: "connector lines",
          issue: "line topology is wrong",
          fixType: "structural_change",
          observed: "Replica uses short spokes.",
          desired: "Original uses a diagonal X.",
          confidence: 0.9,
        },
      ]),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
    });

    const firstVisionCall = mockQuery.mock.calls[0]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const firstPrompt = await firstVisionCall.prompt.next();
    const firstText = (firstPrompt.value?.message.content?.[4] as { text: string }).text;

    expect(firstText).toContain("Previous issues to re-check from the prior iteration");
    expect(firstText).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(firstText).toContain("\"issue\": \"line topology is wrong\"");
    expect(firstText).toContain("\"fixType\": \"structural_change\"");
    expect(firstText).toContain("\"ref\": \"connector-lines\"");
  });

  it("diversifies top issues across signature visuals, content, and layout when all are present", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            issues: [
              {
                priority: 1,
                category: "style",
                ref: "title",
                area: "title",
                issue: "title is slightly too bold",
                fixType: "style_adjustment",
                observed: "Replica title feels slightly heavier.",
                desired: "Original title is lighter.",
                confidence: 0.8,
              },
              {
                priority: 2,
                category: "style",
                ref: null,
                area: "background",
                issue: "background is slightly too flat",
                fixType: "style_adjustment",
                observed: "Replica background looks flatter.",
                desired: "Original background has more atmosphere.",
                confidence: 0.78,
              },
              {
                priority: 3,
                category: "content",
                ref: "proxy-cards",
                area: "proxy descriptions",
                issue: "description text is truncated",
                fixType: "content_fix",
                observed: "Replica clips the last word.",
                desired: "Original shows the full text.",
                confidence: 0.91,
              },
              {
                priority: 4,
                category: "style",
                ref: "connector-lines",
                area: "connector lines",
                issue: "connector pattern is wrong",
                fixType: "structural_change",
                observed: "Replica uses the wrong line topology.",
                desired: "Original uses the full diagonal connector system.",
                confidence: 0.93,
              },
              {
                priority: 5,
                category: "layout",
                ref: null,
                area: "diagram cluster",
                issue: "diagram sits too high",
                fixType: "layout_adjustment",
                observed: "Replica compresses the title-to-diagram spacing.",
                desired: "Original has more vertical breathing room.",
                confidence: 0.86,
              },
            ],
          }),
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

    const issues = events.find((event) => event.event === "refine:vision:done")?.data.issues as
      | Array<{ category: string; ref?: string | null }>
      | undefined;

    expect(issues?.slice(0, 3).map((issue) => issue.category)).toEqual([
      "signature_visual",
      "content",
      "layout",
    ]);
    expect(issues?.[0]?.ref).toBe("connector-lines");
  });

  it("derives a generic band-direction issue id for layered directional visuals when the model omits issueId", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            issues: [
              {
                priority: 1,
                category: "signature_visual",
                ref: "hero-title",
                area: "hero title color bands",
                issue: "band order is inverted",
                fixType: "style_adjustment",
                observed: "Replica shows the layered bands in the wrong top-to-bottom order.",
                desired: "Original uses a different top-to-bottom band order.",
                confidence: 0.92,
              },
            ],
          }),
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
    });

    const editCall = mockQuery.mock.calls[1]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const firstPrompt = await editCall.prompt.next();
    const textContent = (firstPrompt.value?.message.content?.[4] as { text: string }).text;

    expect(textContent).toContain("\"issueId\": \"hero-title.band-direction\"");
  });

  it("includes unresolved sticky signature visuals in the edit issue list even when they fall below the top 3", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            issues: [
              {
                priority: 1,
                category: "content",
                ref: "proxy-cards",
                area: "proxy descriptions",
                issue: "description text is truncated",
                fixType: "content_fix",
                observed: "Replica clips the last word.",
                desired: "Original shows the full text.",
                confidence: 0.91,
              },
              {
                priority: 2,
                category: "layout",
                ref: null,
                area: "diagram cluster",
                issue: "diagram sits too high",
                fixType: "layout_adjustment",
                observed: "Replica compresses the title-to-diagram spacing.",
                desired: "Original has more vertical breathing room.",
                confidence: 0.86,
              },
              {
                priority: 3,
                category: "style",
                ref: "title",
                area: "title",
                issue: "title is too large",
                fixType: "style_adjustment",
                observed: "Replica title dominates the slide.",
                desired: "Original title feels smaller.",
                confidence: 0.82,
              },
            ],
            priorIssueChecks: [
              {
                issueId: "connector-lines.graphic-structure",
                status: "still_wrong",
              },
            ],
          }),
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

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      priorIssuesJson: JSON.stringify([
        {
          priority: 1,
          category: "signature_visual",
          ref: "connector-lines",
          area: "connector lines",
          issue: "connector pattern is wrong",
          fixType: "structural_change",
          observed: "Replica uses short spokes.",
          desired: "Original uses the full diagonal connector system.",
          confidence: 0.94,
        },
      ], null, 2),
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
    };
    const firstPrompt = await editCall.prompt.next();
    const textContent = (firstPrompt.value?.message.content?.[4] as { text: string }).text;

    expect(textContent).toContain("\"ref\": \"connector-lines\"");
    expect(textContent).toContain("\"sticky\": true");
    expect(textContent).toContain("\"fixType\": \"structural_change\"");
  });

  it("does not re-carry a resolved issueId when another issue on the same ref remains", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            issues: [
              {
                priority: 1,
                issueId: "title.scale",
                category: "layout",
                ref: "title",
                area: "title size / scale",
                issue: "title is slightly too large",
                fixType: "layout_adjustment",
                observed: "Replica title spans too much width.",
                desired: "Original title is more contained.",
                confidence: 0.85,
              },
              {
                priority: 2,
                issueId: "background.background-style",
                category: "style",
                ref: null,
                area: "background glow",
                issue: "background glow is too faint",
                fixType: "style_adjustment",
                observed: "Replica lacks enough warm glow.",
                desired: "Original has a stronger warm glow.",
                confidence: 0.8,
              },
            ],
            priorIssueChecks: [
              {
                issueId: "title.tricolor-direction",
                status: "resolved",
              },
            ],
          }),
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

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      priorIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "title.content",
          category: "content",
          ref: "title",
          area: "title text",
          issue: "title is missing 2026",
          fixType: "content_fix",
          observed: "Replica shows only IRAN WAR.",
          desired: "Original shows IRAN WAR 2026.",
          confidence: 0.95,
        },
        {
          priority: 2,
          issueId: "title.tricolor-direction",
          category: "signature_visual",
          ref: "title",
          area: "title tricolor direction",
          issue: "tricolor direction is inverted",
          fixType: "style_adjustment",
          observed: "Replica shows red on top and blue on bottom.",
          desired: "Original shows blue on top and red on bottom.",
          confidence: 0.92,
          sticky: true,
        },
      ], null, 2),
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

    const editCall = mockQuery.mock.calls[1]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const firstPrompt = await editCall.prompt.next();
    const textContent = (firstPrompt.value?.message.content?.[4] as { text: string }).text;
    const structuredIssues = extractStructuredIssuesFromEditPrompt(textContent);
    const visionDoneData = events.find((event) => event.event === "refine:vision:done")?.data as
      | Record<string, unknown>
      | undefined;

    expect(structuredIssues).toContain("\"issueId\": \"title.scale\"");
    expect(structuredIssues).not.toContain("\"issueId\": \"title.tricolor-direction\"");
    expect(structuredIssues).not.toContain("tricolor direction is inverted");
    expect(visionDoneData?.priorIssueChecks).toEqual([
      { issueId: "title.content", status: "unclear" },
      { issueId: "title.tricolor-direction", status: "resolved" },
    ]);
    expect(typeof visionDoneData?.priorIssuesJson).toBe("string");
    expect(visionDoneData?.priorIssuesJson).toContain("\"issueId\": \"title.scale\"");
    expect(visionDoneData?.priorIssuesJson).not.toContain("\"issueId\": \"title.tricolor-direction\"");
  });

  it("keeps unclear prior issues for the next vision pass without forcing them into edit", async () => {
    const proposals = makeProposals();
    const patchedProposals = makePatchedProposals();

    mockQuery
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            priorIssueChecks: [
              {
                issueId: "connector-lines.graphic-structure",
                status: "unclear",
              },
            ],
            issues: [
              {
                priority: 1,
                issueId: "title.scale",
                category: "layout",
                ref: "title",
                area: "title size",
                issue: "title is slightly too large",
                fixType: "layout_adjustment",
                observed: "Replica title spans too much width.",
                desired: "Original title is more contained.",
                confidence: 0.84,
              },
            ],
          }),
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: `\`\`\`json
${JSON.stringify(patchedProposals, null, 2)}
\`\`\``,
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          type: "result",
          result: makeVisionIssuesJson({
            issues: [
              {
                priority: 1,
                issueId: "background.background-style",
                category: "style",
                ref: null,
                area: "background glow",
                issue: "background glow is too faint",
                fixType: "style_adjustment",
                observed: "Replica lacks enough warm glow.",
                desired: "Original has a stronger warm glow.",
                confidence: 0.8,
              },
            ],
          }),
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
        diffImage: Buffer.from("diff-iter-1"),
        regions: [],
        width: 100,
        height: 100,
      })
      .mockResolvedValueOnce({
        mismatchRatio: 0.16,
        mismatchPixels: 16,
        totalPixels: 100,
        diffImage: Buffer.from("diff-iter-2"),
        regions: [],
        width: 100,
        height: 100,
      });

    await runRefinementLoop({
      image: Buffer.from("reference"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      priorIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "connector-lines.graphic-structure",
          category: "signature_visual",
          ref: "connector-lines",
          area: "connector lines",
          issue: "line topology is wrong",
          fixType: "structural_change",
          observed: "Replica uses short spokes.",
          desired: "Original uses a diagonal X.",
          confidence: 0.9,
          sticky: true,
        },
      ], null, 2),
      maxIterations: 2,
      mismatchThreshold: 0.05,
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-opus-4-6",
      editEffort: "medium",
    });

    const firstEditCall = mockQuery.mock.calls[1]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const firstEditPrompt = await firstEditCall.prompt.next();
    const firstEditText = (firstEditPrompt.value?.message.content?.[4] as { text: string }).text;

    const secondVisionCall = mockQuery.mock.calls[2]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const secondVisionPrompt = await secondVisionCall.prompt.next();
    const secondVisionText = (secondVisionPrompt.value?.message.content?.[4] as { text: string }).text;

    expect(firstEditText).not.toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(firstEditText).not.toContain("\"sticky\": true");
    expect(secondVisionText).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
  });


  it("edit call sends labeled comparison images alongside structured issues and proposals JSON", async () => {
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
    expect(textContent).toContain("Structured issues:");
    expect(textContent).toContain("\"issueId\": \"title.scale\"");
    expect(textContent).toContain("\"issue\": \"title is too large\"");
    expect(textContent).toContain("\"category\": \"layout\"");
    expect(textContent).toContain("\"ref\": \"connector-lines\"");
    expect(textContent).toContain("\"fixType\": \"structural_change\"");
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
          result: makeVisionIssuesJson(),
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
          result: makeVisionIssuesJson(),
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

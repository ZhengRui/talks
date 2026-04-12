import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult, Proposal } from "@/components/extract/types";
import type { ProviderTurnInput, ProviderTurnResult, ExtractModelProvider } from "@/lib/extract/providers/types";
import type { ProviderSelection } from "@/lib/extract/providers/shared";
import type { RefineEvent } from "./refine";

const {
  mockCompileProposalPreview,
  mockAnnotateDiffImage,
  mockCompareImages,
  mockPutRefineArtifact,
  mockRenderSlideToImage,
  mockGetExtractModelProvider,
  mockProviderRun,
} = vi.hoisted(() => ({
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
  mockGetExtractModelProvider: vi.fn(),
  mockProviderRun: vi.fn<(
    input: ProviderTurnInput
  ) => Promise<ProviderTurnResult>>(),
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

vi.mock("@/lib/extract/providers/registry", () => ({
  getExtractModelProvider: mockGetExtractModelProvider,
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

function makePatchedProposals(name = "refined-preview"): Proposal[] {
  return [
    {
      ...makeProposals()[0],
      name,
      body: `children:\n  - kind: text\n    text: ${name}`,
    },
  ];
}

function makeBaseAnalysis(proposals: Proposal[]): AnalysisResult {
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

function makeSelection(): ProviderSelection {
  return {
    provider: "openai-codex",
    model: "gpt-5.4",
    effort: "low",
  };
}

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

function extractPriorIssuesFromVisionPrompt(prompt: string): string {
  const match = prompt.match(/Previous issues to re-check from the prior iteration:[\s\S]*?```json\n([\s\S]*?)\n```/);
  return match?.[1] ?? "";
}

describe("runRefinementLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExtractModelProvider.mockImplementation((selection: ProviderSelection) => ({
      id: selection.provider,
      run: mockProviderRun,
    } satisfies ExtractModelProvider));
  });

  it("emits legacy vision result fields and passes structured issues to edit", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeVisionIssuesJson(),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json\n${JSON.stringify(makePatchedProposals(), null, 2)}\n\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        events.push(event);
      },
    });

    const visionDone = events.find((event) => event.event === "refine:vision:done")?.data;
    expect(Array.isArray(visionDone?.issues)).toBe(true);
    expect((visionDone?.issues as Array<unknown>)?.length).toBe(3);
    expect(typeof visionDone?.issuesJson).toBe("string");
    expect(typeof visionDone?.editIssuesJson).toBe("string");
    expect(typeof visionDone?.priorIssuesJson).toBe("string");
    expect(Array.isArray(visionDone?.priorIssueChecks)).toBe(true);
    expect(Array.isArray(visionDone?.resolvedIssueIds)).toBe(true);

    const editPrompt = events.find((event) => event.event === "refine:edit:prompt")?.data.userPrompt as string;
    expect(editPrompt).toContain("Structured issues:");
    expect(editPrompt).toContain("\"issueId\": \"title.scale\"");
    expect(editPrompt).toContain("\"issueId\": \"proxy-cards.content\"");
    expect(editPrompt).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
  });

  it("seeds the first vision prompt with supplied prior issues", async () => {
    const proposals = makeProposals();

    mockProviderRun.mockImplementationOnce(async () => ({
      text: JSON.stringify([]),
      elapsed: 1,
      cost: null,
      usage: null,
    }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
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
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
    });

    const firstVisionInput = mockProviderRun.mock.calls[0]?.[0] as ProviderTurnInput;
    const priorIssuesJson = extractPriorIssuesFromVisionPrompt(firstVisionInput.userPrompt);
    expect(priorIssuesJson).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(priorIssuesJson).toContain("\"sticky\": true");
  });

  it("keeps proposals unchanged when the edit step returns malformed JSON", async () => {
    const proposals = makeProposals();

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeVisionIssuesJson(),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: "not valid json",
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    const result = await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
    });

    expect(result.proposals).toEqual(proposals);
  });

  it("skips edit when vision returns no issues", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun.mockImplementationOnce(async () => ({
      text: JSON.stringify([]),
      elapsed: 1,
      cost: null,
      usage: null,
    }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        events.push(event);
      },
    });

    expect(mockProviderRun).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.event === "refine:edit:prompt")).toBe(false);
    expect(events).toContainEqual({
      event: "refine:complete",
      data: {
        iteration: 1,
        mismatchRatio: 0.2,
        iterElapsed: 1,
        iterCost: null,
        visionEmpty: true,
      },
    });
  });
});

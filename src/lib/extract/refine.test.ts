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
      repeatGroups: [
        {
          id: "evp-columns",
          bbox: { x: 64, y: 239, w: 1160, h: 417 },
          count: 5,
          orientation: "row",
          itemSize: { w: 223, h: 417 },
          gapX: 11,
          gapY: 0,
          description: "Five matching columns with upper frame and lower panel",
          variationPoints: ["heading", "icon", "color"],
        },
      ],
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

function makeCritique(overrides?: {
  fidelityIssues?: Array<Record<string, unknown>>;
  designQualityIssues?: Array<Record<string, unknown>>;
}): string {
  return JSON.stringify({
    fidelityIssues: overrides?.fidelityIssues ?? [
      {
        priority: 1,
        issueId: "title.scale",
        category: "layout",
        ref: "title",
        area: "title",
        issue: "title is too large",
        fixType: "layout_adjustment",
        observed: "Replica title feels oversized.",
        desired: "Original title should feel smaller.",
        confidence: 0.9,
        salience: "important",
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
        salience: "critical",
      },
    ],
    designQualityIssues: overrides?.designQualityIssues ?? [
      {
        priority: 1,
        issueId: "badges.optical-centering",
        category: "style",
        ref: "badges",
        area: "badge icons",
        issue: "icons are not optically centered",
        fixType: "style_adjustment",
        observed: "Replica icons feel low.",
        desired: "Original icons feel centered.",
        confidence: 0.84,
        salience: "important",
      },
    ],
  }, null, 2);
}

describe("runRefinementLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExtractModelProvider.mockImplementation((selection: ProviderSelection) => ({
      id: selection.provider,
      run: mockProviderRun,
    } satisfies ExtractModelProvider));
  });

  it("emits bucketed vision results and separate issue JSON fields", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeCritique(),
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
    expect(Array.isArray(visionDone?.fidelityIssues)).toBe(true);
    expect(Array.isArray(visionDone?.designQualityIssues)).toBe(true);
    expect((visionDone?.fidelityIssues as Array<unknown>)?.length).toBe(2);
    expect((visionDone?.designQualityIssues as Array<unknown>)?.length).toBe(1);
    expect(typeof visionDone?.fidelityIssuesJson).toBe("string");
    expect(typeof visionDone?.designQualityIssuesJson).toBe("string");
    expect(typeof visionDone?.watchlistIssuesJson).toBe("string");
    expect(visionDone?.issueCount).toBe(3);
  });

  it("passes a tiny bucketed watchlist into the next vision prompt", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeCritique({
          fidelityIssues: [
            {
              priority: 1,
              issueId: "cards.structure",
              category: "signature_visual",
              ref: "cards",
              area: "card topology",
              issue: "cards are detached boxes",
              fixType: "structural_change",
              observed: "Replica splits the chamber and body into detached pieces.",
              desired: "Original reads as one composite card.",
              confidence: 0.96,
              salience: "critical",
            },
            {
              priority: 2,
              issueId: "body.copy",
              category: "layout",
              ref: "body",
              area: "body copy",
              issue: "body text is too large",
              fixType: "layout_adjustment",
              observed: "Replica text crowds the cards.",
              desired: "Original text leaves more breathing room.",
              confidence: 0.92,
              salience: "important",
            },
            {
              priority: 3,
              issueId: "title.scale",
              category: "layout",
              ref: "title",
              area: "title",
              issue: "title is too large",
              fixType: "layout_adjustment",
              observed: "Replica title dominates the slide.",
              desired: "Original title is calmer.",
              confidence: 0.82,
              salience: "important",
            },
          ],
          designQualityIssues: [
            {
              priority: 1,
              issueId: "icons.centering",
              category: "style",
              ref: "icons",
              area: "icon badges",
              issue: "icons are not optically centered",
              fixType: "style_adjustment",
              observed: "Replica icons feel low and inconsistent.",
              desired: "Original icons feel centered and calm.",
              confidence: 0.9,
              salience: "important",
            },
            {
              priority: 2,
              issueId: "icons.symbols",
              category: "style",
              ref: "icons",
              area: "icon language",
              issue: "icon symbols are inconsistent",
              fixType: "style_adjustment",
              observed: "Replica mixes awkward symbols.",
              desired: "Original uses a coherent icon language.",
              confidence: 0.88,
              salience: "important",
            },
          ],
        }),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json\n${JSON.stringify(makePatchedProposals("refined-1"), null, 2)}\n\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({ fidelityIssues: [], designQualityIssues: [] }),
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 2,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        events.push(event);
      },
    });

    const visionPrompts = events.filter((event) => event.event === "refine:vision:prompt");
    const secondVisionPrompt = visionPrompts[1]?.data.userPrompt as string;
    expect(secondVisionPrompt).toContain("Tiny watchlist from the last iteration");
    expect(secondVisionPrompt).toContain("\"fidelityWatchlist\"");
    expect(secondVisionPrompt).toContain("\"issueId\": \"cards.structure\"");
    expect(secondVisionPrompt).toContain("\"issueId\": \"body.copy\"");
    expect(secondVisionPrompt).toContain("\"designQualityWatchlist\"");
    expect(secondVisionPrompt).toContain("\"issueId\": \"icons.centering\"");
    expect(secondVisionPrompt).not.toContain("\"issueId\": \"title.scale\"");
    expect(secondVisionPrompt).not.toContain("\"issueId\": \"icons.symbols\"");
  });

  it("seeds the first vision prompt with a supplied bucketed watchlist", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({ fidelityIssues: [], designQualityIssues: [] }),
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      watchlistIssuesJson: JSON.stringify({
        fidelityWatchlist: [
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
            salience: "critical",
          },
        ],
        designQualityWatchlist: [
          {
            priority: 1,
            issueId: "badges.optical-centering",
            category: "style",
            ref: "badges",
            area: "badge icons",
            issue: "icons feel low",
            fixType: "style_adjustment",
            observed: "Replica icons feel low.",
            desired: "Original icons feel centered.",
            confidence: 0.82,
            salience: "important",
          },
        ],
      }),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        events.push(event);
      },
    });

    const firstVisionPrompt = events.find((event) => event.event === "refine:vision:prompt")?.data.userPrompt as string;
    expect(firstVisionPrompt).toContain("Tiny watchlist from the last iteration");
    expect(firstVisionPrompt).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(firstVisionPrompt).toContain("\"issueId\": \"badges.optical-centering\"");
  });

  it("passes separate fidelity and design-quality sections into the edit prompt", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeCritique(),
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

    const editPrompt = events.find((event) => event.event === "refine:edit:prompt")?.data.userPrompt as string;
    expect(editPrompt).toContain("Fidelity issues:");
    expect(editPrompt).toContain("Design quality issues:");
    expect(editPrompt).toContain("\"issueId\": \"title.scale\"");
    expect(editPrompt).toContain("\"issueId\": \"proxy-cards.content\"");
    expect(editPrompt).toContain("\"issueId\": \"badges.optical-centering\"");
    expect(editPrompt).not.toContain("Structured issues:");
  });

  it("keeps proposals unchanged when the edit step returns malformed JSON", async () => {
    const proposals = makeProposals();

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeCritique(),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: "not json",
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

  it("skips edit when both buckets are empty", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({ fidelityIssues: [], designQualityIssues: [] }),
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
      async onEvent(event) {
        events.push(event);
      },
    });

    expect(events.some((event) => event.event === "refine:edit:start")).toBe(false);
    expect(result.proposals).toEqual(proposals);
  });

  it("emits cumulative iteration numbers when continuing refinement", async () => {
    const proposals = makeProposals();
    const firstEvents: RefineEvent[] = [];
    const secondEvents: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeCritique(),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json\n${JSON.stringify(makePatchedProposals("refined-1"), null, 2)}\n\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: makeCritique(),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json\n${JSON.stringify(makePatchedProposals("refined-2"), null, 2)}\n\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    const first = await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        firstEvents.push(event);
      },
    });

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals: first.proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      watchlistIssuesJson: (firstEvents.find((event) => event.event === "refine:vision:done")?.data.watchlistIssuesJson as string) ?? null,
      maxIterations: 1,
      mismatchThreshold: 0.05,
      iterationOffset: 1,
      forceIterations: true,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        secondEvents.push(event);
      },
    });

    expect(firstEvents.find((event) => event.event === "refine:vision:start")?.data.iteration).toBe(1);
    expect(secondEvents.find((event) => event.event === "refine:vision:start")?.data.iteration).toBe(2);
  });
});

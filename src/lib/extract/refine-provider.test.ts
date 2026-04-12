import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult, Proposal } from "@/components/extract/types";
import type { RefineEvent } from "./refine";
import type { ProviderTurnInput, ProviderTurnResult, ExtractModelProvider } from "@/lib/extract/providers/types";
import type { ProviderSelection } from "@/lib/extract/providers/shared";

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

function extractStructuredIssuesFromEditPrompt(prompt: string): string {
  const match = prompt.match(/Structured issues:\n```json\n([\s\S]*?)\n```/);
  return match?.[1] ?? "";
}

function extractPriorIssuesFromVisionPrompt(prompt: string): string {
  const match = prompt.match(/Previous issues to re-check from the prior iteration:[\s\S]*?```json\n([\s\S]*?)\n```/);
  return match?.[1] ?? "";
}

describe("runRefinementLoop provider integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExtractModelProvider.mockImplementation((selection: ProviderSelection) => ({
      id: selection.provider,
      run: mockProviderRun,
    } satisfies ExtractModelProvider));
  });

  it("passes provider selections and ordered content through the provider abstraction", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];
    const referenceImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );
    const visionSelection: ProviderSelection = {
      provider: "openai-codex",
      model: "gpt-5.4",
      effort: "high",
    };
    const editSelection: ProviderSelection = {
      provider: "claude-code",
      model: "claude-sonnet-4-6",
      effort: "medium",
    };

    mockProviderRun
      .mockImplementationOnce(async (input) => {
        await input.onEvent?.({ type: "thinking", text: "Vision provider thinking" });
        await input.onEvent?.({ type: "text", text: "Vision provider text" });
        return {
          text: JSON.stringify([
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
          ]),
          elapsed: 1,
          cost: null,
          usage: null,
        };
      })
      .mockImplementationOnce(async (input) => {
        await input.onEvent?.({ type: "thinking", text: "Edit provider thinking" });
        await input.onEvent?.({ type: "text", text: "Edit provider text" });
        return {
          text: `\`\`\`json
${JSON.stringify(makePatchedProposals(), null, 2)}
\`\`\``,
          elapsed: 2,
          cost: null,
          usage: null,
        };
      });

    await runRefinementLoop({
      image: referenceImage,
      imageMediaType: "image/jpeg",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection,
      editSelection,
      async onEvent(event) {
        events.push(event);
      },
    });

    expect(mockGetExtractModelProvider).toHaveBeenNthCalledWith(1, visionSelection);
    expect(mockGetExtractModelProvider).toHaveBeenNthCalledWith(2, editSelection);

    const visionInput = mockProviderRun.mock.calls[0]?.[0] as ProviderTurnInput;
    expect(visionInput.phase).toBe("vision");
    expect(visionInput.selection).toEqual(visionSelection);
    expect(visionInput.content).toEqual([
      { type: "text", text: "ORIGINAL slide:" },
      expect.objectContaining({ type: "image", mediaType: "image/jpeg", fileName: "original.png" }),
      { type: "text", text: "REPLICA slide:" },
      expect.objectContaining({ type: "image", mediaType: "image/png", fileName: "replica.png" }),
      { type: "text", text: visionInput.userPrompt },
    ]);

    const editInput = mockProviderRun.mock.calls[1]?.[0] as ProviderTurnInput;
    expect(editInput.phase).toBe("edit");
    expect(editInput.selection).toEqual(editSelection);
    expect(editInput.content[0]).toEqual({ type: "text", text: "ORIGINAL slide:" });
    expect(editInput.content[2]).toEqual({ type: "text", text: "REPLICA slide:" });
    expect(editInput.content[4]).toEqual({ type: "text", text: editInput.userPrompt });

    expect(events).toContainEqual({
      event: "refine:start",
      data: {
        iteration: 0,
        maxIterations: 1,
        visionProvider: "openai-codex",
        visionModel: "gpt-5.4",
        visionEffort: "high",
        editProvider: "claude-code",
        editModel: "claude-sonnet-4-6",
        editEffort: "medium",
        mismatchThreshold: 0.05,
      },
    });
  });

  it("passes top structured issues to edit and carries prior issues into the next vision prompt", async () => {
    const proposals = makeProposals();

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify([
          {
            priority: 1,
            issueId: "title.scale",
            category: "layout",
            ref: "title",
            area: "title",
            issue: "title is too large",
            fixType: "layout_adjustment",
            observed: "Replica title dominates the slide.",
            desired: "Original title is calmer.",
            confidence: 0.82,
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
          {
            priority: 4,
            issueId: "badge-pill.border-style",
            category: "style",
            ref: "badge-pill",
            area: "pill badges",
            issue: "pill borders are too heavy",
            fixType: "style_adjustment",
            observed: "Replica badges feel heavier.",
            desired: "Original badges are lighter.",
            confidence: 0.75,
          },
        ], null, 2),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json
${JSON.stringify(makePatchedProposals("refined-1"), null, 2)}
\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
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
      maxIterations: 2,
      mismatchThreshold: 0.05,
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    const firstEditInput = mockProviderRun.mock.calls[1]?.[0] as ProviderTurnInput;
    const structuredIssuesJson = extractStructuredIssuesFromEditPrompt(firstEditInput.userPrompt);
    expect(structuredIssuesJson).toContain("\"issueId\": \"title.scale\"");
    expect(structuredIssuesJson).toContain("\"issueId\": \"proxy-cards.content\"");
    expect(structuredIssuesJson).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(structuredIssuesJson).not.toContain("\"issueId\": \"badge-pill.border-style\"");

    const secondVisionInput = mockProviderRun.mock.calls[2]?.[0] as ProviderTurnInput;
    const priorIssuesJson = extractPriorIssuesFromVisionPrompt(secondVisionInput.userPrompt);
    expect(priorIssuesJson).toContain("\"issueId\": \"title.scale\"");
    expect(priorIssuesJson).toContain("\"issueId\": \"proxy-cards.content\"");
    expect(priorIssuesJson).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(priorIssuesJson).toContain("\"issueId\": \"badge-pill.border-style\"");
  });

  it("accepts prior issues JSON as the continuation seed", async () => {
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
          issueId: "title.scale",
          category: "layout",
          ref: "title",
          area: "title",
          issue: "title is too large",
          fixType: "layout_adjustment",
          observed: "Replica title is oversized.",
          desired: "Original title is smaller.",
          confidence: 0.9,
        },
        {
          priority: 2,
          issueId: "badges.centering",
          category: "style",
          ref: "badges",
          area: "badge icons",
          issue: "icons feel low",
          fixType: "style_adjustment",
          observed: "Replica icons are optically low.",
          desired: "Original icons feel centered.",
          confidence: 0.84,
        },
      ]),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    const firstVisionInput = mockProviderRun.mock.calls[0]?.[0] as ProviderTurnInput;
    const priorIssuesJson = extractPriorIssuesFromVisionPrompt(firstVisionInput.userPrompt);
    expect(priorIssuesJson).toContain("\"issueId\": \"title.scale\"");
    expect(priorIssuesJson).toContain("\"issueId\": \"badges.centering\"");
  });

  it("normalizes text block scalars with interpolated multiline values before compile", async () => {
    const proposals = makeProposals();

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify([
          {
            priority: 1,
            issueId: "body.copy",
            category: "content",
            ref: "body",
            area: "body copy",
            issue: "newlines render literally",
            fixType: "content_fix",
            observed: "Replica shows escaped newline text.",
            desired: "Original renders paragraphs correctly.",
            confidence: 0.95,
          },
        ]),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json
[
  {
    "scope": "slide",
    "name": "slide-template",
    "description": "base slide",
    "region": { "x": 0, "y": 0, "w": 1920, "h": 1080 },
    "params": {},
    "style": {},
    "body": "children:\\n  - kind: text\\n    text: |-\\n      {{ item.body }}"
  }
]
\`\`\``,
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
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    expect(result.proposals[0]?.body).toContain('text: "{{ item.body | yaml_string }}"');
  });
});

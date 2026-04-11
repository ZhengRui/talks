import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult, Proposal } from "@/components/extract/types";
import type { RefineEvent } from "./refine";
import type { ProviderTurnInput, ProviderTurnResult } from "@/lib/extract/providers/types";
import type { ExtractModelProvider } from "@/lib/extract/providers/types";
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

function makePatchedProposals(): Proposal[] {
  return [
    {
      ...makeProposals()[0],
      body: "children:\n  - kind: text\n    text: changed",
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
      regions: [],
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

function extractJsonSection(prompt: string, header: string): string {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = prompt.match(new RegExp(`${escaped}:\\n\`\`\`json\\n([\\s\\S]*?)\\n\`\`\``));
  return match?.[1] ?? "";
}

function extractVisionWatchlist(prompt: string): string {
  const match = prompt.match(/Tiny watchlist from the last iteration[\s\S]*?\`\`\`json\n([\s\S]*?)\n\`\`\`/);
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
          text: JSON.stringify({
            fidelityIssues: [
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
                salience: "important",
              },
            ],
            designQualityIssues: [],
          }),
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

  it("passes separate buckets to edit and carries a tiny bucketed watchlist across rounds", async () => {
    const proposals = makeProposals();
    const referenceImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({
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
        text: `\`\`\`json
${JSON.stringify(proposals, null, 2)}
\`\`\``,
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
      image: referenceImage,
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 2,
      mismatchThreshold: 0.05,
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    const firstEditInput = mockProviderRun.mock.calls[1]?.[0] as ProviderTurnInput;
    const fidelityJson = extractJsonSection(firstEditInput.userPrompt, "Fidelity issues");
    const designJson = extractJsonSection(firstEditInput.userPrompt, "Design quality issues");

    expect(fidelityJson).toContain("\"issueId\": \"cards.structure\"");
    expect(fidelityJson).toContain("\"issueId\": \"body.copy\"");
    expect(fidelityJson).toContain("\"issueId\": \"title.scale\"");
    expect(designJson).toContain("\"issueId\": \"icons.centering\"");
    expect(designJson).toContain("\"issueId\": \"icons.symbols\"");

    const secondVisionInput = mockProviderRun.mock.calls[2]?.[0] as ProviderTurnInput;
    const watchlistJson = extractVisionWatchlist(secondVisionInput.userPrompt);

    expect(watchlistJson).toContain("\"fidelityWatchlist\"");
    expect(watchlistJson).toContain("\"designQualityWatchlist\"");
    expect(watchlistJson).toContain("\"issueId\": \"cards.structure\"");
    expect(watchlistJson).toContain("\"issueId\": \"body.copy\"");
    expect(watchlistJson).toContain("\"issueId\": \"icons.centering\"");
    expect(watchlistJson).not.toContain("\"issueId\": \"title.scale\"");
    expect(watchlistJson).not.toContain("\"issueId\": \"icons.symbols\"");
  });

  it("uses legacy flat-array vision output as fidelity-only fallback", async () => {
    const proposals = makeProposals();
    const referenceImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );

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
            observed: "Replica title is oversized.",
            desired: "Original title is smaller.",
            confidence: 0.9,
            salience: "important",
          },
        ]),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json
${JSON.stringify(proposals, null, 2)}
\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    await runRefinementLoop({
      image: referenceImage,
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    const editInput = mockProviderRun.mock.calls[1]?.[0] as ProviderTurnInput;
    const fidelityJson = extractJsonSection(editInput.userPrompt, "Fidelity issues");
    const designJson = extractJsonSection(editInput.userPrompt, "Design quality issues");

    expect(fidelityJson).toContain("\"issueId\": \"title.scale\"");
    expect(designJson).toBe("[]");
  });

  it("increments persistenceCount from the bucketed watchlist carry-over", async () => {
    const proposals = makeProposals();
    const referenceImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({
          fidelityIssues: [
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
              salience: "important",
            },
          ],
          designQualityIssues: [
            {
              priority: 1,
              issueId: "badges.centering",
              category: "style",
              ref: "badges",
              area: "badge icons",
              issue: "icons feel low",
              fixType: "style_adjustment",
              observed: "Replica icons are optically low.",
              desired: "Original icons feel centered.",
              confidence: 0.84,
              salience: "important",
            },
          ],
        }),
        elapsed: 1,
        cost: null,
        usage: null,
      }))
      .mockImplementationOnce(async () => ({
        text: `\`\`\`json
${JSON.stringify(proposals, null, 2)}
\`\`\``,
        elapsed: 1,
        cost: null,
        usage: null,
      }));

    await runRefinementLoop({
      image: referenceImage,
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      watchlistIssuesJson: JSON.stringify({
        fidelityWatchlist: [
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
            salience: "important",
            persistenceCount: 2,
          },
        ],
        designQualityWatchlist: [
          {
            priority: 1,
            issueId: "badges.centering",
            category: "style",
            ref: "badges",
            area: "badge icons",
            issue: "icons feel low",
            fixType: "style_adjustment",
            observed: "Replica icons are optically low.",
            desired: "Original icons feel centered.",
            confidence: 0.84,
            salience: "important",
            persistenceCount: 1,
          },
        ],
      }),
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
      editSelection: { provider: "openai-codex", model: "gpt-5.4", effort: "low" },
    });

    const editInput = mockProviderRun.mock.calls[1]?.[0] as ProviderTurnInput;
    const fidelityJson = extractJsonSection(editInput.userPrompt, "Fidelity issues");
    const designJson = extractJsonSection(editInput.userPrompt, "Design quality issues");

    expect(fidelityJson).toContain("\"issueId\": \"title.scale\"");
    expect(fidelityJson).toContain("\"persistenceCount\": 3");
    expect(designJson).toContain("\"issueId\": \"badges.centering\"");
    expect(designJson).toContain("\"persistenceCount\": 2");
  });

  it("normalizes text block scalars with interpolated multiline values before compile", async () => {
    const proposals = makeProposals();
    const referenceImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0GQAAAAASUVORK5CYII=",
      "base64",
    );

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: JSON.stringify({
          fidelityIssues: [
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
              salience: "critical",
            },
          ],
          designQualityIssues: [],
        }),
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
      image: referenceImage,
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

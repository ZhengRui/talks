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

import {
  runRefinementLoop,
  postProcessVision,
  selectIssuesForEdit,
  parseVisionCritique,
  computePersistenceCounts,
  type VisionIssue,
} from "./refine";

/* ---------- helpers ---------- */

function makeIssue(overrides: Partial<VisionIssue> & { issueId: string; priority: number }): VisionIssue {
  return {
    category: "layout",
    ref: null,
    area: "slide",
    issue: "test issue",
    fixType: "layout_adjustment",
    observed: "observed",
    desired: "desired",
    confidence: 0.9,
    ...overrides,
  };
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
    resolved?: string[];
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

  if (!overrides?.resolved) {
    return JSON.stringify(issues, null, 2);
  }

  return JSON.stringify({
    resolved: overrides.resolved,
    issues,
  }, null, 2);
}

/* ---------- postProcessVision ---------- */

describe("postProcessVision", () => {
  it("adds missing priors back to issues (rule 1)", () => {
    const currentIssues = [
      makeIssue({ priority: 1, issueId: "a" }),
    ];
    const priorIssues = [
      makeIssue({ priority: 1, issueId: "a" }),
      makeIssue({ priority: 2, issueId: "b" }),
    ];

    const result = postProcessVision([], currentIssues, priorIssues);

    expect(result.issues.map(i => i.issueId)).toContain("b");
    expect(result.issues.map(i => i.issueId)).toContain("a");
  });

  it("conflict: unresolved wins over resolved (rule 2)", () => {
    const currentIssues = [
      makeIssue({ priority: 1, issueId: "x" }),
    ];
    // Vision claims "x" is both resolved and still an issue
    const resolved = ["x"];

    const result = postProcessVision(resolved, currentIssues, []);

    // "x" should NOT be in resolved because it's still a current issue
    expect(result.resolved).not.toContain("x");
    expect(result.issues.map(i => i.issueId)).toContain("x");
  });

  it("applies both rules together", () => {
    const currentIssues = [
      makeIssue({ priority: 1, issueId: "a" }),
    ];
    const priorIssues = [
      makeIssue({ priority: 1, issueId: "a" }),
      makeIssue({ priority: 2, issueId: "b" }),
      makeIssue({ priority: 3, issueId: "c" }),
    ];
    // "a" is conflict (current + resolved) -> unresolved wins
    // "b" is genuinely resolved
    // "c" is missing from both -> added back
    const resolved = ["a", "b"];

    const result = postProcessVision(resolved, currentIssues, priorIssues);

    expect(result.resolved).toEqual(["b"]);
    expect(result.issues.map(i => i.issueId)).toContain("a");
    expect(result.issues.map(i => i.issueId)).toContain("c");
    expect(result.issues.map(i => i.issueId)).not.toContain("b");
  });

  it("handles no priors (iteration 1)", () => {
    const currentIssues = [
      makeIssue({ priority: 1, issueId: "x" }),
      makeIssue({ priority: 2, issueId: "y" }),
    ];

    const result = postProcessVision([], currentIssues, []);

    expect(result.resolved).toEqual([]);
    expect(result.issues.map(i => i.issueId)).toEqual(["x", "y"]);
  });
});

/* ---------- selectIssuesForEdit ---------- */

describe("selectIssuesForEdit", () => {
  it("caps at top 5 issues", () => {
    const issues = Array.from({ length: 8 }, (_, i) =>
      makeIssue({ priority: i + 1, issueId: `issue-${i + 1}` }),
    );

    const result = selectIssuesForEdit(issues, new Set());

    expect(result).toHaveLength(5);
    expect(result.map(i => i.issueId)).toEqual([
      "issue-1", "issue-2", "issue-3", "issue-4", "issue-5",
    ]);
  });

  it("swaps in signature visual from below top 5 using history ids", () => {
    const issues = Array.from({ length: 7 }, (_, i) =>
      makeIssue({ priority: i + 1, issueId: `issue-${i + 1}` }),
    );
    // issue-6 was a signature visual in a past iteration
    const everSignatureVisualIds = new Set(["issue-6"]);

    const result = selectIssuesForEdit(issues, everSignatureVisualIds);

    expect(result).toHaveLength(5);
    expect(result.map(i => i.issueId)).toContain("issue-6");
  });

  it("protects current signature_visual issues from being swapped out", () => {
    const issues = [
      makeIssue({ priority: 1, issueId: "sig-1", category: "signature_visual" }),
      makeIssue({ priority: 2, issueId: "layout-1" }),
      makeIssue({ priority: 3, issueId: "layout-2" }),
      makeIssue({ priority: 4, issueId: "layout-3" }),
      makeIssue({ priority: 5, issueId: "layout-4" }),
      makeIssue({ priority: 6, issueId: "sig-2", category: "signature_visual" }),
    ];

    const result = selectIssuesForEdit(issues, new Set());

    // sig-2 should swap in for the last non-protected issue
    expect(result.map(i => i.issueId)).toContain("sig-1");
    expect(result.map(i => i.issueId)).toContain("sig-2");
    expect(result).toHaveLength(5);
  });

  it("passes through when under 5 issues", () => {
    const issues = [
      makeIssue({ priority: 1, issueId: "a" }),
      makeIssue({ priority: 2, issueId: "b" }),
    ];

    const result = selectIssuesForEdit(issues, new Set());

    expect(result).toHaveLength(2);
    expect(result.map(i => i.issueId)).toEqual(["a", "b"]);
  });
});

/* ---------- parseVisionCritique ---------- */

describe("parseVisionCritique", () => {
  const signatureRefs = new Set(["connector-lines"]);

  it("parses { resolved, issues } object correctly", () => {
    const json = JSON.stringify({
      resolved: ["old-issue-1"],
      issues: [
        {
          priority: 1,
          issueId: "title.scale",
          category: "layout",
          ref: "title",
          area: "title",
          issue: "title too big",
          fixType: "style_adjustment",
          observed: "too big",
          desired: "smaller",
          confidence: 0.9,
        },
      ],
    });

    const result = parseVisionCritique(json, signatureRefs);

    expect(result.resolved).toEqual(["old-issue-1"]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].issueId).toBe("title.scale");
  });

  it("parses bare array (backward compat) with resolved: []", () => {
    const json = JSON.stringify([
      {
        priority: 1,
        issueId: "title.scale",
        category: "layout",
        ref: "title",
        area: "title",
        issue: "title too big",
        fixType: "style_adjustment",
        observed: "too big",
        desired: "smaller",
        confidence: 0.9,
      },
    ]);

    const result = parseVisionCritique(json, signatureRefs);

    expect(result.resolved).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  it("handles invalid JSON with resolved: []", () => {
    const result = parseVisionCritique("this is not json at all and is long enough to trigger fallback", signatureRefs);

    expect(result.resolved).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("overrides category to signature_visual when ref matches signatureRefs", () => {
    const json = JSON.stringify([
      {
        priority: 1,
        issueId: "connector-lines.structure",
        category: "layout",
        ref: "connector-lines",
        area: "lines",
        issue: "lines missing",
        fixType: "structural_change",
        observed: "missing",
        desired: "present",
        confidence: 0.8,
      },
    ]);

    const result = parseVisionCritique(json, signatureRefs);

    expect(result.issues[0].category).toBe("signature_visual");
  });

  it("filters non-string entries from resolved array", () => {
    const json = JSON.stringify({
      resolved: ["valid-id", 42, null, "", "another-valid"],
      issues: [],
    });

    const result = parseVisionCritique(json, signatureRefs);

    expect(result.resolved).toEqual(["valid-id", "another-valid"]);
  });
});

/* ---------- computePersistenceCounts ---------- */

describe("computePersistenceCounts", () => {
  it("returns empty map for empty records", () => {
    const result = computePersistenceCounts([]);
    expect(result.size).toBe(0);
  });

  it("counts edits across records and skips editApplied: false", () => {
    const result = computePersistenceCounts([
      {
        iteration: 1,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: [],
      },
      {
        iteration: 2,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: false,
        issuesResolved: [],
        issuesUnresolved: [],
      },
      {
        iteration: 3,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: [],
      },
    ]);
    expect(result.get("a")).toBe(2);
  });

  it("resets count on resolution", () => {
    const result = computePersistenceCounts([
      {
        iteration: 1,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: [],
      },
      {
        iteration: 2,
        issuesFound: [],
        issuesEdited: [],
        editApplied: true,
        issuesResolved: ["a"],
        issuesUnresolved: [],
      },
    ]);
    expect(result.has("a")).toBe(false);
  });

  it("issue resolved then reappearing starts fresh", () => {
    const result = computePersistenceCounts([
      {
        iteration: 1,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: [],
      },
      {
        iteration: 2,
        issuesFound: [],
        issuesEdited: [],
        editApplied: true,
        issuesResolved: ["a"],
        issuesUnresolved: [],
      },
      {
        iteration: 3,
        issuesFound: [{ issueId: "a", category: "layout", summary: "a" }],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: [],
      },
    ]);
    expect(result.get("a")).toBe(1);
  });
});

/* ---------- runRefinementLoop (integration) ---------- */

describe("runRefinementLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExtractModelProvider.mockImplementation((selection: ProviderSelection) => ({
      id: selection.provider,
      run: mockProviderRun,
    } satisfies ExtractModelProvider));
  });

  it("emits vision result fields and passes structured issues to edit", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeVisionIssuesJson({ resolved: [] }),
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
    expect(typeof visionDone?.issuesJson).toBe("string");
    expect(typeof visionDone?.editIssuesJson).toBe("string");
    expect(visionDone?.issueCount).toBe(3);
    expect(Array.isArray(visionDone?.resolved)).toBe(true);
  });

  it("seeds the first vision prompt with supplied seedHistory and seedLastIssues", async () => {
    const proposals = makeProposals();
    const events: RefineEvent[] = [];

    // Vision resolves the seed issue and returns no new issues
    mockProviderRun.mockImplementationOnce(async () => ({
      text: JSON.stringify({ resolved: ["title.scale"], issues: [] }),
      elapsed: 1,
      cost: null,
      usage: null,
    }));

    await runRefinementLoop({
      image: Buffer.from("ref"),
      imageMediaType: "image/png",
      proposals,
      baseAnalysis: makeBaseAnalysis(proposals),
      seedHistory: [
        {
          iteration: 1,
          issuesFound: [{ issueId: "title.scale", category: "layout", summary: "title too big" }],
          issuesEdited: ["title.scale"],
          editApplied: true,
          issuesResolved: [],
          issuesUnresolved: [],
        },
      ],
      seedLastIssues: [
        makeIssue({ priority: 1, issueId: "title.scale" }),
      ],
      maxIterations: 1,
      mismatchThreshold: 0.05,
      visionSelection: makeSelection(),
      editSelection: makeSelection(),
      async onEvent(event) {
        events.push(event);
      },
    });

    // The vision prompt event should exist
    const visionPromptEvent = events.find((event) => event.event === "refine:vision:prompt");
    expect(visionPromptEvent).toBeDefined();

    // Should have completed with visionEmpty since all issues resolved
    const completeEvent = events.find((event) => event.event === "refine:complete");
    expect(completeEvent?.data.visionEmpty).toBe(true);
    expect(Array.isArray(completeEvent?.data.iterationHistory)).toBe(true);
    expect(Array.isArray(completeEvent?.data.lastIssues)).toBe(true);

    // The seed record should have been backfilled with resolution info
    const iterationHistory = completeEvent?.data.iterationHistory as Array<Record<string, unknown>>;
    expect(iterationHistory.length).toBeGreaterThanOrEqual(2);
    const seedRecord = iterationHistory[0];
    expect(seedRecord.issuesResolved).toEqual(["title.scale"]);

    // The refine:done event should include iterationHistory and lastIssues
    const doneEvent = events.find((event) => event.event === "refine:done");
    expect(Array.isArray(doneEvent?.data.iterationHistory)).toBe(true);
    expect(Array.isArray(doneEvent?.data.lastIssues)).toBe(true);
  });

  it("keeps proposals unchanged when the edit step returns malformed JSON", async () => {
    const proposals = makeProposals();

    mockProviderRun
      .mockImplementationOnce(async () => ({
        text: makeVisionIssuesJson({ resolved: [] }),
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
      text: JSON.stringify({ resolved: [], issues: [] }),
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
  });
});

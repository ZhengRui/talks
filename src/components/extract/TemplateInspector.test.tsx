import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TemplateInspector from "./TemplateInspector";
import type { SlideCard } from "./store";
import type { AnalysisProvenance } from "./types";

const mockSelectTemplate = vi.fn();
const mockResetAnalysis = vi.fn();
const mockSetActiveStage = vi.fn();
let mockAutoRefine = true;
let mockRefineVisionModel = "claude-opus-4-6";
let mockRefineVisionEffort = "medium";
let mockRefineEditModel = "claude-opus-4-6";
let mockRefineEditEffort = "medium";
const writeTextMock = vi.fn();
const defaultPass: AnalysisProvenance = {
  provider: "claude-code",
  model: "claude-opus-4-6",
  effort: "high",
};

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: writeTextMock,
  },
});

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        selectTemplate: mockSelectTemplate,
        resetAnalysis: mockResetAnalysis,
        setActiveStage: mockSetActiveStage,
        autoRefine: mockAutoRefine,
        refineVisionSelection: {
          provider: "claude-code",
          model: mockRefineVisionModel,
          effort: mockRefineVisionEffort,
        },
        refineEditSelection: {
          provider: "claude-code",
          model: mockRefineEditModel,
          effort: mockRefineEditEffort,
        },
      };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock("./TemplateTabs", () => ({
  default: () => <div data-testid="template-tabs">tabs</div>,
}));

vi.mock("./ParamsStyleView", () => ({
  default: () => <div data-testid="params-style-view">params</div>,
}));

vi.mock("./InlineYaml", () => ({
  default: () => <div data-testid="inline-yaml">yaml</div>,
}));

vi.mock("./log-utils", () => ({
  LogEntryRow: ({ entry }: { entry: { content: string } }) => <div>{entry.content}</div>,
  filterLogEntries: (log: Array<{ content?: string }>) => log,
  LOG_ICONS: {},
}));

function makeCard(overrides: Partial<SlideCard> = {}): SlideCard {
  return {
    id: "card-1",
    label: "Slide #abc",
    file: new File([""], "slide.png", { type: "image/png" }),
    previewUrl: "blob:preview-1",
    position: { x: 0, y: 0 },
    size: { w: 480, h: 270 },
    naturalSize: null,
    status: "analyzed",
    description: "",
    analysis: {
      source: {
        image: "slide.png",
        dimensions: { w: 1474, h: 828 },
      },
      proposals: [
        {
          scope: "slide",
          name: "key-players",
          description: "slide",
          region: { x: 0, y: 0, w: 1474, h: 828 },
          params: {},
          style: {},
          body: "children: []",
        },
      ],
    },
    pass1Analysis: null,
    log: [],
    elapsed: 0,
    pass1: defaultPass,
    pass1Elapsed: 12,
    pass1Cost: 0.82,
    refinePass: {
      visionModel: "claude-opus-4-6",
      visionEffort: "low",
      editModel: "claude-opus-4-6",
      editEffort: "low",
    },
    refineSettingsLocked: false,
    error: null,
    activeStage: "extract",
    selectedTemplateIndex: { extract: 0, refine: 0 },
    viewMode: "original",
    refineAnalysis: null,
    refineStatus: "idle",
    refineIteration: 0,
    refineMaxIterations: 4,
    refineMismatchThreshold: 0.05,
    refineResult: null,
    refineHistory: [],
    refineError: null,
    refineElapsed: 9,
    refineCost: 0.14,
    refineStartMismatch: null,
    refinePriorIssuesJson: null,
    autoRefine: true,
    normalizedImage: null,
    diffObjectUrl: null,
    promptHistory: [],
    benchmarkGroupId: null,
    benchmarkVariant: null,
    benchmarkSlug: null,
    benchmarkSlideIndex: null,
    geometryHints: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  writeTextMock.mockReset();
  mockAutoRefine = true;
  mockRefineVisionModel = "claude-opus-4-6";
  mockRefineVisionEffort = "medium";
  mockRefineEditModel = "claude-opus-4-6";
  mockRefineEditEffort = "medium";
});

describe("TemplateInspector", () => {
  it("renders extract-stage errors in the inspector and allows retry", () => {
    const onAnalyze = vi.fn();
    const card = makeCard({
      status: "error",
      error: "Model returned JSON followed by extra text.",
      analysis: null,
      pass1Analysis: null,
      log: [
        { type: "status", content: "Starting analysis...", timestamp: 1, stage: "extract" },
        { type: "error", content: "Model returned JSON followed by extra text.", timestamp: 2, stage: "extract" },
      ],
    });

    render(
      <TemplateInspector
        card={card}
        onAnalyze={onAnalyze}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
        defaultTab="log"
      />,
    );

    expect(screen.getByText("Stage error")).toBeTruthy();
    expect(screen.getAllByText("Model returned JSON followed by extra text.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Retry"));
    expect(onAnalyze).toHaveBeenCalledWith("card-1");
  });

  it("renders inventory panel when analysis.inventory exists", () => {
    const card = makeCard({
      analysis: {
        source: {
          image: "slide.png",
          dimensions: { w: 1474, h: 828 },
        },
        inventory: {
          slideBounds: { x: 0, y: 0, w: 1474, h: 828 },
          background: {
            summary: "dark",
            base: "#111820",
            palette: ["#111820", "#ffffff"],
            layers: [],
          },
          typography: [],
          regions: [],
          repeatGroups: [],
          signatureVisuals: [
            { text: "warm glow", ref: null, importance: "high" },
          ],
          mustPreserve: [{ text: "warm glow", ref: null }],
          uncertainties: ["font unclear"],
          blockCandidates: [
            {
              name: "player-card-row",
              sourceRepeatGroupId: "cards",
              reason: "repeated cards",
              defer: true,
            },
          ],
        },
        proposals: [
          {
            scope: "slide",
            name: "key-players",
            description: "slide",
            region: { x: 0, y: 0, w: 1474, h: 828 },
            params: {},
            style: {},
            body: "children: []",
          },
        ],
      },
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    expect(screen.getByText("Inventory")).toBeTruthy();
    expect(screen.queryByText("warm glow")).toBeNull();

    fireEvent.click(screen.getByText("Inventory"));

    expect(screen.getByText("Signature Visuals")).toBeTruthy();
    expect(screen.getAllByText("warm glow").length).toBeGreaterThan(0);
    expect(screen.getByText("Must Preserve")).toBeTruthy();
    expect(screen.getByText("Uncertainties")).toBeTruthy();
    expect(screen.getByText("font unclear")).toBeTruthy();
    expect(screen.getByText("Block Candidates")).toBeTruthy();
    expect(screen.getByText("player-card-row")).toBeTruthy();
  });

  it("does not render inventory panel when analysis has no inventory", () => {
    const card = makeCard();
    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );
    expect(screen.queryByText("Inventory")).toBeNull();
  });

  it("renders captured prompts in the Prompt tab for the active stage", () => {
    const card = makeCard({
      activeStage: "refine",
      promptHistory: [
        {
          stage: "extract",
          phase: "extract",
          iteration: null,
          systemPrompt: "extract system",
          userPrompt: "extract user",
          timestamp: 1,
        },
        {
          stage: "refine",
          phase: "vision",
          iteration: 1,
          systemPrompt: "vision system",
          userPrompt: "vision user",
          model: "claude-opus-4-6",
          effort: "medium",
          timestamp: 2,
        },
        {
          stage: "refine",
          phase: "edit",
          iteration: 1,
          systemPrompt: "edit system",
          userPrompt: "edit user",
          model: "claude-sonnet-4-6",
          effort: "high",
          timestamp: 3,
        },
      ],
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Prompt"));

    expect(screen.getByText("Iter 1 · Vision · Opus 4.6 · medium")).toBeTruthy();
    expect(screen.getByText("Iter 1 · Edit · Sonnet 4.6 · high")).toBeTruthy();
    expect(screen.getAllByText("System Prompt").length).toBeGreaterThan(0);
    expect(screen.queryByText("vision system")).toBeNull();
    expect(screen.queryByText("edit user")).toBeNull();
    expect(screen.getAllByText("Show").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("Show")[0]);
    expect(screen.getByText("vision system")).toBeTruthy();
    expect(screen.queryByText("extract system")).toBeNull();
  });

  it("copies expanded prompt text from the prompt tab", () => {
    const card = makeCard({
      activeStage: "refine",
      promptHistory: [
        {
          stage: "refine",
          phase: "vision",
          iteration: 1,
          systemPrompt: "vision system",
          userPrompt: "vision user",
          timestamp: 1,
        },
      ],
    });

    writeTextMock.mockResolvedValue(undefined);

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Prompt"));
    fireEvent.click(screen.getAllByText("Show")[0]);
    fireEvent.click(screen.getByLabelText("Copy prompt"));

    expect(writeTextMock).toHaveBeenCalledWith("vision system");
  });

  it("uses equal-width buttons for Result, Log, and Prompt", () => {
    const card = makeCard();

    const { container } = render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    const buttons = Array.from(container.querySelectorAll("button")).filter((button) =>
      ["Result", "Log", "Prompt"].includes(button.textContent ?? ""),
    );

    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      expect(button.className).toContain("w-[72px]");
    });
  });

  it("reports the active scroll container as tabs change", () => {
    const onScrollTargetChange = vi.fn();
    const card = makeCard({
      promptHistory: [
        {
          stage: "extract",
          phase: "extract",
          iteration: null,
          systemPrompt: "extract system",
          userPrompt: "extract user",
          timestamp: 1,
        },
      ],
      log: [
        {
          type: "status",
          content: "hello",
          timestamp: 1,
          stage: "extract",
        },
      ],
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
        onScrollTargetChange={onScrollTargetChange}
      />,
    );

    expect(onScrollTargetChange).toHaveBeenCalledWith(expect.any(HTMLDivElement));

    fireEvent.click(screen.getByText("Log"));
    expect(onScrollTargetChange).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));

    fireEvent.click(screen.getByText("Prompt"));
    expect(onScrollTargetChange).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));
  });

  it("starts with inventory panel collapsed", () => {
    const card = makeCard({
      analysis: {
        source: {
          image: "slide.png",
          dimensions: { w: 1474, h: 828 },
        },
        inventory: {
          slideBounds: { x: 0, y: 0, w: 1474, h: 828 },
          background: {
            summary: "dark",
            base: "#111820",
            palette: ["#111820"],
            layers: [],
          },
          typography: [],
          regions: [],
          repeatGroups: [],
          signatureVisuals: [{ text: "glow", ref: null, importance: "high" }],
          mustPreserve: [{ text: "glow", ref: null }],
          uncertainties: [],
          blockCandidates: [],
        },
        proposals: [
          {
            scope: "slide",
            name: "key-players",
            description: "slide",
            region: { x: 0, y: 0, w: 1474, h: 828 },
            params: {},
            style: {},
            body: "children: []",
          },
        ],
      },
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );
    expect(screen.queryByText("Must Preserve")).toBeNull();
    expect(screen.getByText("Show")).toBeTruthy();
  });

  it("shows extract stage tab and meta", () => {
    const card = makeCard();

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    expect(screen.getByText("Extract")).toBeTruthy();
    expect(screen.getByText(/Opus 4.6 · high · 12s · \$0.82/)).toBeTruthy();
  });

  it("shows separate vision and edit provenance when refine settings differ", () => {
    const card = makeCard({
      activeStage: "refine",
      refinePass: {
        visionModel: "claude-opus-4-6",
        visionEffort: "low",
        editModel: "claude-sonnet-4-6",
        editEffort: "high",
      },
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    expect(screen.getByText(/vision: Opus 4.6 · low/)).toBeTruthy();
    expect(screen.getByText(/edit: Sonnet 4.6 · high/)).toBeTruthy();
    expect(screen.getByText(/9s · \$0.14/)).toBeTruthy();
  });

  it("shows the planned refine stage while extract is still running", () => {
    mockAutoRefine = false;
    const card = makeCard({
      status: "analyzing",
      autoRefine: true,
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    expect(screen.getByText("Extract")).toBeTruthy();
    expect(screen.getByText("Refine")).toBeTruthy();
  });
});

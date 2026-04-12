import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import InspectorPanel from "./InspectorPanel";
import type { SlideCard } from "./store";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));
vi.mock("./log-utils", () => ({
  LogEntryRow: ({ entry }: { entry: { content: string } }) => <div>{entry.content}</div>,
  filterLogEntries: (log: Array<{ content?: string }>) => log,
  LOG_ICONS: {},
}));

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSelectCard = vi.fn();
const mockUpdateDescription = vi.fn();
const mockSelectTemplate = vi.fn();
const mockOpenYamlModal = vi.fn();
const mockResetAnalysis = vi.fn();
const mockSetActiveStage = vi.fn();
const mockSetAnalyzeProvider = vi.fn();
const mockSetAnalyzeModel = vi.fn();
const mockSetAnalyzeEffort = vi.fn();
const mockSetAutoRefine = vi.fn();
const mockSetCardAutoRefine = vi.fn();
const mockSetRefineMaxIterations = vi.fn();
const mockSetRefineMismatchThreshold = vi.fn();
const mockSetRefineVisionProvider = vi.fn();
const mockSetRefineVisionModel = vi.fn();
const mockSetRefineVisionEffort = vi.fn();
const mockSetRefineEditProvider = vi.fn();
const mockSetRefineEditModel = vi.fn();
const mockSetRefineEditEffort = vi.fn();
const mockSetCardRefineVisionProvider = vi.fn();
const mockSetCardRefineVisionModel = vi.fn();
const mockSetCardRefineVisionEffort = vi.fn();
const mockSetCardRefineEditProvider = vi.fn();
const mockSetCardRefineEditModel = vi.fn();
const mockSetCardRefineEditEffort = vi.fn();

let mockCards = new Map<string, SlideCard>();
let mockCardOrder: string[] = [];
let mockSelectedCardId: string | null = null;

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        cards: mockCards,
        cardOrder: mockCardOrder,
        selectedCardId: mockSelectedCardId,
        selectCard: mockSelectCard,
        updateDescription: mockUpdateDescription,
        selectTemplate: mockSelectTemplate,
        openYamlModal: mockOpenYamlModal,
        resetAnalysis: mockResetAnalysis,
        setActiveStage: mockSetActiveStage,
        analyzeSelection: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
        },
        autoRefine: true,
        refineVisionSelection: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "medium",
        },
        refineEditSelection: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "medium",
        },
        setAnalyzeProvider: mockSetAnalyzeProvider,
        setAnalyzeModel: mockSetAnalyzeModel,
        setAnalyzeEffort: mockSetAnalyzeEffort,
        setAutoRefine: mockSetAutoRefine,
        setCardAutoRefine: mockSetCardAutoRefine,
        setRefineMaxIterations: mockSetRefineMaxIterations,
        setRefineMismatchThreshold: mockSetRefineMismatchThreshold,
        setRefineVisionProvider: mockSetRefineVisionProvider,
        setRefineVisionModel: mockSetRefineVisionModel,
        setRefineVisionEffort: mockSetRefineVisionEffort,
        setRefineEditProvider: mockSetRefineEditProvider,
        setRefineEditModel: mockSetRefineEditModel,
        setRefineEditEffort: mockSetRefineEditEffort,
        setCardRefineVisionProvider: mockSetCardRefineVisionProvider,
        setCardRefineVisionModel: mockSetCardRefineVisionModel,
        setCardRefineVisionEffort: mockSetCardRefineVisionEffort,
        setCardRefineEditProvider: mockSetCardRefineEditProvider,
        setCardRefineEditModel: mockSetCardRefineEditModel,
        setCardRefineEditEffort: mockSetCardRefineEditEffort,
        setPanelWidth: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<SlideCard> = {}): SlideCard {
  return {
    id: "card-1",
    label: "Slide #abc",
    file: new File([""], "slide.png", { type: "image/png" }),
    previewUrl: "blob:preview-1",
    position: { x: 40, y: 40 },
    size: { w: 480, h: 270 },
    naturalSize: null,
    status: "idle",
    description: "",
    analysis: null,
    pass1Analysis: null,
    log: [],
    elapsed: 0,
    pass1: null,
    pass1Elapsed: 0,
    pass1Cost: null,
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
    refineElapsed: 0,
    refineCost: null,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockCards = new Map();
  mockCardOrder = [];
  mockSelectedCardId = null;
});

describe("InspectorPanel", () => {
  const onAnalyze = vi.fn();
  const onRefine = vi.fn();
  const onCancelRefine = vi.fn();

  it("shows empty state when no card is selected", () => {
    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );
    expect(container.textContent).toContain("Select a slide");
  });

  it("shows analyze form when idle card is selected", () => {
    const card = makeCard({ id: "card-1", status: "idle" });
    mockCards.set("card-1", card);
    mockCardOrder = ["card-1"];
    mockSelectedCardId = "card-1";

    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    // Should show the description textarea
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    // Should show the Analyze button
    const buttons = Array.from(container.querySelectorAll("button"));
    const analyzeBtnFound = buttons.some(
      (b) => b.textContent?.includes("Analyze"),
    );
    expect(analyzeBtnFound).toBe(true);
  });

  it("shows log tab when analyzing card is selected", () => {
    const card = makeCard({ id: "card-2", status: "analyzing", elapsed: 5 });
    mockCards.set("card-2", card);
    mockCardOrder = ["card-2"];
    mockSelectedCardId = "card-2";

    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    // Should show the Result/Log toggle with Log active
    const buttons = Array.from(container.querySelectorAll("button"));
    const logBtn = buttons.find((b) => b.textContent === "Log");
    expect(logBtn).not.toBeNull();
    // Should show Extract stage tab
    const extractBtn = buttons.find((b) => b.textContent === "Extract");
    expect(extractBtn).not.toBeNull();
  });

  it("shows template inspector when analyzed card is selected", () => {
    const card = makeCard({
      id: "card-3",
      status: "analyzed",
      analysis: {
        source: {
          image: "base64",
          dimensions: { w: 1920, h: 1080 },
        },
        proposals: [
          {
            scope: "slide",
            name: "hero_title",
            description: "A hero title slide",
            region: { x: 0, y: 0, w: 1920, h: 1080 },
            params: {},
            style: {},
            body: "yaml: content",
          },
        ],
      },
    });
    mockCards.set("card-3", card);
    mockCardOrder = ["card-3"];
    mockSelectedCardId = "card-3";

    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    expect(container.textContent).toContain("Extract");
    expect(container.textContent).toContain("Log");
  });

  it("shows error card in the inspector with retry and log context", () => {
    const card = makeCard({
      id: "card-4",
      status: "error",
      error: "API timeout",
      pass1: { provider: "openai-codex", model: "gpt-5.4", effort: "none" },
      log: [
        { type: "status", content: "Starting analysis...", timestamp: 1, stage: "extract" },
        { type: "error", content: "API timeout", timestamp: 2, stage: "extract" },
      ],
      promptHistory: [
        {
          stage: "extract",
          phase: "extract",
          systemPrompt: "system",
          userPrompt: "user",
          timestamp: 1,
          provider: "openai-codex",
          model: "gpt-5.4",
          effort: "none",
          iteration: null,
        },
      ],
    });
    mockCards.set("card-4", card);
    mockCardOrder = ["card-4"];
    mockSelectedCardId = "card-4";

    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    expect(container.textContent).toContain("API timeout");
    expect(container.textContent).toContain("Stage error");
    expect(container.textContent).toContain("Retry");
    expect(container.textContent).toContain("Log");
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("renders thumbnail strip with cards", () => {
    const card1 = makeCard({ id: "card-1", previewUrl: "blob:1" });
    const card2 = makeCard({ id: "card-2", previewUrl: "blob:2" });
    mockCards.set("card-1", card1);
    mockCards.set("card-2", card2);
    mockCardOrder = ["card-1", "card-2"];
    mockSelectedCardId = "card-1";

    const { container } = render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    // Should render thumbnail images
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it("shows jump-to-top and jump-to-bottom buttons when a card is selected", () => {
    const card = makeCard({ id: "card-5", status: "idle" });
    mockCards.set("card-5", card);
    mockCardOrder = ["card-5"];
    mockSelectedCardId = "card-5";

    render(
      <InspectorPanel
        onAnalyze={onAnalyze}
        onRefine={onRefine}
        onCancelRefine={onCancelRefine}
      />,
    );

    expect(document.querySelector('button[title="Jump to top"]')).not.toBeNull();
    expect(document.querySelector('button[title="Jump to bottom"]')).not.toBeNull();
  });
});

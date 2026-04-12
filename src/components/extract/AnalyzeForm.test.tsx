import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyzeForm from "./AnalyzeForm";
import type { SlideCard } from "./store";

const mockUpdateDescription = vi.fn();
const mockSetAnalyzeProvider = vi.fn();
const mockSetAnalyzeModel = vi.fn();
const mockSetAnalyzeEffort = vi.fn();
const mockSetAutoRefine = vi.fn();
const mockSetCardAutoRefine = vi.fn();
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

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        updateDescription: mockUpdateDescription,
        analyzeSelection: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
        },
        autoRefine: true,
        setAnalyzeProvider: mockSetAnalyzeProvider,
        setAnalyzeModel: mockSetAnalyzeModel,
        setAnalyzeEffort: mockSetAnalyzeEffort,
        setAutoRefine: mockSetAutoRefine,
        setCardAutoRefine: mockSetCardAutoRefine,
        refineVisionSelection: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "medium",
        },
        refineEditSelection: {
          provider: "claude-code",
          model: "claude-sonnet-4-6",
          effort: "high",
        },
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
        setRefineMaxIterations: vi.fn(),
        setRefineMismatchThreshold: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
  };
});

function makeCard(): SlideCard {
  return {
    id: "card-1",
    label: "Slide #abc",
    file: new File([""], "slide.png", { type: "image/png" }),
    previewUrl: "blob:preview-1",
    position: { x: 0, y: 0 },
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
    refinePass: {
      visionModel: "claude-opus-4-6",
      visionEffort: "medium",
      editModel: "claude-sonnet-4-6",
      editEffort: "high",
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
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AnalyzeForm", () => {
  it("renders extract, vision, and edit pass rows", () => {
    render(<AnalyzeForm card={makeCard()} onAnalyze={vi.fn()} />);

    expect(screen.getByText("Extract")).toBeTruthy();
    expect(screen.getByLabelText("Refine")).toBeTruthy();
    expect(screen.getByText("Vision")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getAllByText("Opus 4.6").length).toBeGreaterThan(0);
  });
});

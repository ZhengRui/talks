import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TemplateInspector from "./TemplateInspector";
import type { SlideCard } from "./store";
import type { AnalysisProvenance } from "./types";

const mockSelectTemplate = vi.fn();
const mockOpenLogModal = vi.fn();
const mockResetAnalysis = vi.fn();
const mockSetActiveStage = vi.fn();
const defaultPass: AnalysisProvenance = {
  model: "claude-opus-4-6",
  effort: "high",
};

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
        openLogModal: mockOpenLogModal,
        resetAnalysis: mockResetAnalysis,
        setActiveStage: mockSetActiveStage,
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

vi.mock("./LogModal", () => ({
  LogEntryRow: ({ entry }: { entry: { content: string } }) => <div>{entry.content}</div>,
  filterLogEntries: (log: Array<{ content?: string }>) => log,
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
    usedCritique: false,
    pass1: defaultPass,
    pass2: null,
    pass1Elapsed: 12,
    pass2Elapsed: 0,
    pass1Cost: 0.82,
    pass2Cost: null,
    error: null,
    activeStage: "extract",
    selectedTemplateIndex: { extract: 0, critique: 0, refine: 0 },
    viewMode: "original",
    refineAnalysis: null,
    refineStatus: "idle",
    refineIteration: 0,
    refineMaxIterations: 4,
    refineMismatchThreshold: 0.05,
    refineResult: null,
    refineHistory: [],
    refineError: null,
    autoRefine: true,
    normalizedImage: null,
    diffObjectUrl: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TemplateInspector", () => {
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

  it("shows stage tabs and extract-stage meta", () => {
    const card = makeCard({
      usedCritique: true,
      pass2: { model: "claude-opus-4-6", effort: "max" },
      pass2Elapsed: 14,
      pass2Cost: 1.24,
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    expect(screen.getByText("Extract")).toBeTruthy();
    expect(screen.getByText("Critique")).toBeTruthy();
    expect(screen.getByText(/opus-4-6 · high · 12s · \$0.82/)).toBeTruthy();
  });

  it("switches stage when critique tab is clicked", () => {
    const card = makeCard({
      usedCritique: true,
      pass2: { model: "claude-opus-4-6", effort: "max" },
      pass2Elapsed: 14,
      pass2Cost: 1.24,
    });

    render(
      <TemplateInspector
        card={card}
        onRefine={vi.fn()}
        onCancelRefine={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Critique"));

    expect(mockSetActiveStage).toHaveBeenCalledWith("card-1", "critique");
  });

  it("renders failed critique diagnostic view", () => {
    const card = makeCard({
      usedCritique: true,
      activeStage: "critique",
      pass2: null,
      log: [
        {
          type: "status",
          content: "Critique failed, returning pass 1 result",
          timestamp: 1,
          stage: "critique",
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

    expect(screen.getAllByText("Critique failed").length).toBeGreaterThan(0);
    expect(screen.getByText(/Critique pass failed/)).toBeTruthy();
    expect(screen.getByText(/returning pass 1 result/)).toBeTruthy();
    expect(screen.queryByTestId("template-tabs")).toBeNull();
  });
});

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
        resetAnalysis: mockResetAnalysis,
        setActiveStage: mockSetActiveStage,
        autoRefine: mockAutoRefine,
        refineVisionModel: mockRefineVisionModel,
        refineVisionEffort: mockRefineVisionEffort,
        refineEditModel: mockRefineEditModel,
        refineEditEffort: mockRefineEditEffort,
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
    autoRefine: true,
    normalizedImage: null,
    diffObjectUrl: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAutoRefine = true;
  mockRefineVisionModel = "claude-opus-4-6";
  mockRefineVisionEffort = "medium";
  mockRefineEditModel = "claude-opus-4-6";
  mockRefineEditEffort = "medium";
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
    expect(screen.getByText(/opus-4-6 · high · 12s · \$0.82/)).toBeTruthy();
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

    expect(screen.getByText(/vision: opus-4-6 · low/)).toBeTruthy();
    expect(screen.getByText(/edit: sonnet-4-6 · high/)).toBeTruthy();
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

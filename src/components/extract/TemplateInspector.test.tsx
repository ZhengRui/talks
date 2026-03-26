import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TemplateInspector from "./TemplateInspector";
import type { SlideCard } from "./store";

const mockSelectTemplate = vi.fn();
const mockOpenLogModal = vi.fn();
const mockResetAnalysis = vi.fn();

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        selectTemplate: mockSelectTemplate,
        openLogModal: mockOpenLogModal,
        resetAnalysis: mockResetAnalysis,
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
    log: [],
    elapsed: 0,
    usedModel: "claude-opus-4-6",
    usedEffort: "high",
    error: null,
    selectedTemplateIndex: 0,
    viewMode: "original",
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

    render(<TemplateInspector card={card} />);

    expect(screen.getByText("Inventory")).toBeTruthy();
    expect(screen.queryByText("warm glow")).toBeNull();

    fireEvent.click(screen.getByText("Inventory"));

    expect(screen.getByText("Must Preserve")).toBeTruthy();
    expect(screen.getByText("warm glow")).toBeTruthy();
    expect(screen.getByText("Uncertainties")).toBeTruthy();
    expect(screen.getByText("font unclear")).toBeTruthy();
    expect(screen.getByText("Block Candidates")).toBeTruthy();
    expect(screen.getByText("player-card-row")).toBeTruthy();
  });

  it("does not render inventory panel when analysis has no inventory", () => {
    const card = makeCard();
    render(<TemplateInspector card={card} />);
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

    render(<TemplateInspector card={card} />);
    expect(screen.queryByText("Must Preserve")).toBeNull();
    expect(screen.getByText("Show")).toBeTruthy();
  });
});

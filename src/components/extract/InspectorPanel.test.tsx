import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import InspectorPanel from "./InspectorPanel";
import type { SlideCard } from "./store";

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSelectCard = vi.fn();
const mockUpdateDescription = vi.fn();
const mockSelectTemplate = vi.fn();
const mockOpenYamlModal = vi.fn();
const mockOpenLogModal = vi.fn();

let mockCards = new Map<string, SlideCard>();
let mockCardOrder: string[] = [];
let mockSelectedCardId: string | null = null;

vi.mock("./store", () => ({
  useExtractStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      cards: mockCards,
      cardOrder: mockCardOrder,
      selectedCardId: mockSelectedCardId,
      selectCard: mockSelectCard,
      updateDescription: mockUpdateDescription,
      selectTemplate: mockSelectTemplate,
      openYamlModal: mockOpenYamlModal,
      openLogModal: mockOpenLogModal,
      setPanelWidth: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

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
    log: [],
    elapsed: 0,
    usedModel: null,
    usedEffort: null,
    error: null,
    selectedTemplateIndex: 0,
    viewMode: "original",
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

  it("shows empty state when no card is selected", () => {
    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);
    expect(container.textContent).toContain("Select a slide");
  });

  it("shows analyze form when idle card is selected", () => {
    const card = makeCard({ id: "card-1", status: "idle" });
    mockCards.set("card-1", card);
    mockCardOrder = ["card-1"];
    mockSelectedCardId = "card-1";

    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);

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

  it("shows spinner when analyzing card is selected", () => {
    const card = makeCard({ id: "card-2", status: "analyzing", elapsed: 5 });
    mockCards.set("card-2", card);
    mockCardOrder = ["card-2"];
    mockSelectedCardId = "card-2";

    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);

    // Should show elapsed time
    expect(container.textContent).toContain("5s");
    expect(container.textContent).toContain("Analyzing");

    // Should show the spinner element
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
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

    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);

    // Should show the template name
    expect(container.textContent).toContain("hero_title");
  });

  it("shows error card with analyze form", () => {
    const card = makeCard({
      id: "card-4",
      status: "error",
      error: "API timeout",
    });
    mockCards.set("card-4", card);
    mockCardOrder = ["card-4"];
    mockSelectedCardId = "card-4";

    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);

    // Should show the error message
    expect(container.textContent).toContain("API timeout");

    // Should show the Analyze button (retry)
    const buttons = Array.from(container.querySelectorAll("button"));
    const analyzeBtnFound = buttons.some(
      (b) => b.textContent?.includes("Analyze"),
    );
    expect(analyzeBtnFound).toBe(true);
  });

  it("renders thumbnail strip with cards", () => {
    const card1 = makeCard({ id: "card-1", previewUrl: "blob:1" });
    const card2 = makeCard({ id: "card-2", previewUrl: "blob:2" });
    mockCards.set("card-1", card1);
    mockCards.set("card-2", card2);
    mockCardOrder = ["card-1", "card-2"];
    mockSelectedCardId = "card-1";

    const { container } = render(<InspectorPanel onAnalyze={onAnalyze} />);

    // Should render thumbnail images
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

// Mock SlideCard before importing CanvasViewport
vi.mock("./SlideCard", () => ({
  default: ({ cardId }: { cardId: string }) => (
    <div data-testid={`slide-card-${cardId}`}>{cardId}</div>
  ),
}));

// Mock the store
const mockSelectCard = vi.fn();
const mockAddCard = vi.fn().mockReturnValue("new-card-id");
const mockSetPan = vi.fn();
const mockSetZoom = vi.fn();

let mockStoreState: Record<string, unknown> = {};

vi.mock("./store", () => ({
  useExtractStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = mockStoreState;
    return selector ? selector(state) : state;
  },
}));

import CanvasViewport from "./CanvasViewport";

beforeEach(() => {
  mockStoreState = {
    pan: { x: 0, y: 0 },
    zoom: 1,
    cardOrder: [],
    selectedCardId: null,
    cards: new Map(),
    selectCard: mockSelectCard,
    addCard: mockAddCard,
    setPan: mockSetPan,
    setZoom: mockSetZoom,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CanvasViewport", () => {
  it("renders transform container with correct transform style", () => {
    mockStoreState.pan = { x: 100, y: -50 };
    mockStoreState.zoom = 1.5;

    const { getByTestId } = render(<CanvasViewport />);

    const transform = getByTestId("canvas-transform");
    expect(transform.style.transform).toBe("translate(100px, -50px) scale(1.5)");
  });

  it("renders outer viewport with data-testid", () => {
    const { getByTestId } = render(<CanvasViewport />);
    expect(getByTestId("canvas-viewport")).toBeDefined();
  });

  it("clicking empty viewport area deselects (calls selectCard(null))", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    // Simulate mousedown then mouseup without significant movement (click)
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(viewport, { clientX: 100, clientY: 100 });

    expect(mockSelectCard).toHaveBeenCalledWith(null);
  });

  it("does not deselect when drag exceeds threshold", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(viewport, { clientX: 110, clientY: 110 });

    expect(mockSelectCard).not.toHaveBeenCalled();
  });

  it("shows empty state hint when no cards exist", () => {
    const { getByText } = render(<CanvasViewport />);
    expect(getByText(/Paste an image/i)).toBeDefined();
  });

  it("does not show empty state hint when cards exist", () => {
    mockStoreState.cardOrder = ["card-1"];
    mockStoreState.cards = new Map([
      [
        "card-1",
        {
          id: "card-1",
          position: { x: 40, y: 40 },
          size: { w: 480, h: 270 },
        },
      ],
    ]);

    const { queryByText } = render(<CanvasViewport />);
    expect(queryByText(/Paste an image/i)).toBeNull();
  });

  it("renders SlideCard for each card in cardOrder", () => {
    mockStoreState.cardOrder = ["card-1", "card-2"];
    mockStoreState.cards = new Map([
      [
        "card-1",
        {
          id: "card-1",
          position: { x: 40, y: 40 },
          size: { w: 480, h: 270 },
        },
      ],
      [
        "card-2",
        {
          id: "card-2",
          position: { x: 560, y: 40 },
          size: { w: 480, h: 270 },
        },
      ],
    ]);

    const { getByTestId } = render(<CanvasViewport />);
    expect(getByTestId("slide-card-card-1")).toBeDefined();
    expect(getByTestId("slide-card-card-2")).toBeDefined();
  });
});

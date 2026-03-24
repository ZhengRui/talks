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
  useExtractStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = mockStoreState;
      return selector ? selector(state) : state;
    },
    {
      getState: () => mockStoreState,
    },
  ),
}));

import CanvasViewport from "./CanvasViewport";

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;

function mockViewportRect(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 20,
    top: 20,
    left: 10,
    right: 410,
    bottom: 320,
    width: 400,
    height: 300,
    toJSON: () => ({}),
  } as DOMRect);
}

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

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CanvasViewport", () => {
  it("renders transform container with correct transform style", () => {
    mockStoreState.pan = { x: 100, y: -50 };
    mockStoreState.zoom = 1.5;

    const { getByTestId } = render(<CanvasViewport />);

    const transform = getByTestId("canvas-transform");
    expect(transform.style.transform).toBe("translate(100px, -50px) scale(1.5)");
  });

  it("does not force compositor promotion on the zoomed canvas layer", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const transform = getByTestId("canvas-transform");
    expect(transform.style.willChange).toBe("");
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

  it("treats likely trackpad wheel gestures as panning", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    const transform = getByTestId("canvas-transform");

    fireEvent.wheel(viewport, {
      deltaMode: DOM_DELTA_PIXEL,
      deltaX: 12.5,
      deltaY: 8.25,
    });

    expect(mockSetPan).toHaveBeenCalledTimes(1);
    expect(mockSetPan).toHaveBeenCalledWith({ x: -12.5, y: -8.25 });
    expect(mockSetZoom).not.toHaveBeenCalled();
    expect(transform.style.transform).toBe("translate(-12.5px, -8.25px) scale(1)");
  });

  it("keeps a trackpad gesture latched to pan as deltas accelerate", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    const transform = getByTestId("canvas-transform");

    fireEvent.wheel(viewport, {
      deltaMode: DOM_DELTA_PIXEL,
      deltaY: 8,
    });
    fireEvent.wheel(viewport, {
      deltaMode: DOM_DELTA_PIXEL,
      deltaY: 48,
    });

    expect(mockSetPan).toHaveBeenNthCalledWith(1, { x: 0, y: -8 });
    expect(mockSetPan).toHaveBeenNthCalledWith(2, { x: 0, y: -56 });
    expect(mockSetZoom).not.toHaveBeenCalled();
    expect(transform.style.transform).toBe("translate(0px, -56px) scale(1)");
  });

  it("treats ctrl+wheel as pinch zoom toward the cursor", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.wheel(viewport, {
      ctrlKey: true,
      deltaMode: DOM_DELTA_PIXEL,
      deltaY: -90,
      clientX: 110,
      clientY: 70,
    });

    expect(mockSetPan).toHaveBeenCalledTimes(1);
    expect(mockSetZoom).toHaveBeenCalledTimes(1);

    const panArg = mockSetPan.mock.calls[0][0] as { x: number; y: number };
    const zoomArg = mockSetZoom.mock.calls[0][0] as number;

    expect(panArg.x).toBeCloseTo(-6, 5);
    expect(panArg.y).toBeCloseTo(-3, 5);
    expect(zoomArg).toBeCloseTo(1.06, 5);
  });

  it("keeps plain mouse-wheel zoom behavior unchanged", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.wheel(viewport, {
      deltaMode: DOM_DELTA_LINE,
      deltaY: -120,
      clientX: 210,
      clientY: 140,
    });

    expect(mockSetPan).toHaveBeenCalledTimes(1);
    expect(mockSetZoom).toHaveBeenCalledTimes(1);

    const panArg = mockSetPan.mock.calls[0][0] as { x: number; y: number };
    const zoomArg = mockSetZoom.mock.calls[0][0] as number;

    expect(panArg.x).toBeCloseTo(-12, 5);
    expect(panArg.y).toBeCloseTo(-7.2, 5);
    expect(zoomArg).toBeCloseTo(1.06, 5);
  });

  it("keeps coarse pixel-mode mouse wheel input as zoom", () => {
    const { getByTestId } = render(<CanvasViewport />);

    const viewport = getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.wheel(viewport, {
      deltaMode: DOM_DELTA_PIXEL,
      deltaY: -120,
      clientX: 210,
      clientY: 140,
    });

    expect(mockSetPan).toHaveBeenCalledTimes(1);
    expect(mockSetZoom).toHaveBeenCalledTimes(1);

    const panArg = mockSetPan.mock.calls[0][0] as { x: number; y: number };
    const zoomArg = mockSetZoom.mock.calls[0][0] as number;

    expect(panArg.x).toBeCloseTo(-12, 5);
    expect(panArg.y).toBeCloseTo(-7.2, 5);
    expect(zoomArg).toBeCloseTo(1.06, 5);
  });
});

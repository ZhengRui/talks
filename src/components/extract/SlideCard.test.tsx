import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { createExtractStore } from "./store";
import type { StoreApi } from "zustand/vanilla";
import type { ExtractState } from "./store";

const { mockCompileProposalPreview } = vi.hoisted(() => ({
  mockCompileProposalPreview: vi.fn(() => ({
    width: 1920 as const,
    height: 1080 as const,
    background: "#ffffff",
    elements: [],
  })),
}));

const { mockLayoutSlideRenderer } = vi.hoisted(() => ({
  mockLayoutSlideRenderer: vi.fn(() => <div data-testid="layout-slide" />),
}));

let testStore: StoreApi<ExtractState>;

vi.mock("@/lib/extract/compile-preview", () => ({
  compileProposalPreview: mockCompileProposalPreview,
}));

vi.mock("@/components/LayoutRenderer", () => ({
  LayoutSlideRenderer: mockLayoutSlideRenderer,
}));

vi.mock("./store", async () => {
  const actual =
    await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useExtractStore: (selector?: any) => {
      const state = testStore.getState();
      return selector ? selector(state) : state;
    },
  };
});

import SlideCard from "./SlideCard";

function makeFile(name = "slide.png"): File {
  return new File(["fake"], name, { type: "image/png" });
}

describe("SlideCard", () => {
  let cardId: string;

  beforeEach(() => {
    testStore = createExtractStore();
    cardId = testStore.getState().addCard(makeFile("test-slide.png"));
    mockCompileProposalPreview.mockClear();
    mockLayoutSlideRenderer.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders at the correct position from store", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const el = container.querySelector(
      `[data-testid="slide-card-${cardId}"]`,
    ) as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.left).toBe("40px");
    expect(el.style.top).toBe("40px");
    expect(el.style.width).toBe("480px");
  });

  it("click on image card selects the card", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const imageCard = container.querySelector(".group") as HTMLElement;
    fireEvent.click(imageCard);
    expect(testStore.getState().selectedCardId).toBe(cardId);
  });

  it("shows an image element", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBeTruthy();
  });

  it("shows slide label above the card", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    expect(container.textContent).toMatch(/Slide #[a-z0-9]{3}/);
  });

  it("has delete button when selected", () => {
    testStore.getState().selectCard(cardId);
    const { container } = render(<SlideCard cardId={cardId} />);
    const deleteBtn = container.querySelector("[title='Remove slide']") as HTMLElement;
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(testStore.getState().cards.has(cardId)).toBe(false);
  });

  it("shows only Original/Extract toggle when analyzed", () => {
    testStore.getState().completeAnalysis(cardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1920, h: 1080 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          scope: "slide",
          name: "extract-preview",
          description: "extract",
          region: { x: 0, y: 0, w: 1920, h: 1080 },
          params: {},
          style: {},
          body: "mode: scene\nchildren: []",
        },
      ],
    });

    const { getByText, queryByText } = render(<SlideCard cardId={cardId} />);

    expect(getByText("Original")).toBeTruthy();
    expect(getByText("Extract")).toBeTruthy();
    expect(queryByText("Critique")).toBeNull();
  });

  it("renders extract preview from the correct stage analysis", () => {
    testStore.getState().completeAnalysis(cardId, {
      source: {
        image: "data:image/png;base64,extract",
        dimensions: { w: 1280, h: 720 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          scope: "slide",
          name: "extract-preview",
          description: "extract",
          region: { x: 0, y: 0, w: 1280, h: 720 },
          params: {},
          style: {},
          body: "mode: scene\nchildren: []",
        },
        {
          scope: "block",
          name: "extract-block",
          description: "extract block",
          region: { x: 10, y: 10, w: 100, h: 100 },
          params: {},
          style: {},
          body: "kind: text\ntext: extract",
        },
      ],
    });

    const { getByText, rerender } = render(<SlideCard cardId={cardId} />);

    fireEvent.click(getByText("Extract"));
    rerender(<SlideCard cardId={cardId} />);

    expect(mockCompileProposalPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "extract-preview" }),
      expect.arrayContaining([
        expect.objectContaining({ name: "extract-preview" }),
        expect.objectContaining({ name: "extract-block" }),
      ]),
      1280,
      720,
    );
  });

  it("keeps preview text box guides off by default", () => {
    testStore.getState().completeAnalysis(cardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1920, h: 1080 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          scope: "slide",
          name: "extract-preview",
          description: "extract",
          region: { x: 0, y: 0, w: 1920, h: 1080 },
          params: {},
          style: {},
          body: "mode: scene\nchildren: []",
        },
      ],
    });

    const { getByText, rerender } = render(<SlideCard cardId={cardId} />);

    fireEvent.click(getByText("Extract"));
    rerender(<SlideCard cardId={cardId} />);

    expect(mockLayoutSlideRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ debugTextOverflow: false }),
      undefined,
    );
  });

  it("passes preview text box guide mode through when enabled", () => {
    testStore.getState().setPreviewDebugTextBoxes(true);
    testStore.getState().completeAnalysis(cardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1920, h: 1080 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          scope: "slide",
          name: "extract-preview",
          description: "extract",
          region: { x: 0, y: 0, w: 1920, h: 1080 },
          params: {},
          style: {},
          body: "mode: scene\nchildren: []",
        },
      ],
    });

    const { getByText, rerender } = render(<SlideCard cardId={cardId} />);

    fireEvent.click(getByText("Extract"));
    rerender(<SlideCard cardId={cardId} />);

    expect(mockLayoutSlideRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ debugTextOverflow: true }),
      undefined,
    );
  });

  it("renders inline preview compile errors without crashing", () => {
    mockCompileProposalPreview.mockImplementationOnce(() => {
      throw new Error('Template "extract-preview" uses unsupported Nunjucks filter(s): | max. Pre-compute those numeric values instead.');
    });

    testStore.getState().completeAnalysis(cardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1920, h: 1080 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          scope: "slide",
          name: "extract-preview",
          description: "extract",
          region: { x: 0, y: 0, w: 1920, h: 1080 },
          params: {},
          style: {},
          body: "mode: scene\nchildren: []",
        },
      ],
    });

    const { getByText, rerender } = render(<SlideCard cardId={cardId} />);

    fireEvent.click(getByText("Extract"));
    rerender(<SlideCard cardId={cardId} />);

    expect(getByText("Compile error")).toBeTruthy();
    expect(getByText(/unsupported Nunjucks filter/)).toBeTruthy();
  });
});

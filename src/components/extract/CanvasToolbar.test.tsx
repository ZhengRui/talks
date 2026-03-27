import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

let mockStoreState: Record<string, unknown> = {};
const mockArrangeCards = vi.fn();
const mockSetPreviewDebugTextBoxes = vi.fn((enabled: boolean) => {
  mockStoreState.previewDebugTextBoxes = enabled;
});

vi.mock("./store", () => ({
  useExtractStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = mockStoreState;
    return selector ? selector(state) : state;
  },
}));

import CanvasToolbar from "./CanvasToolbar";

describe("CanvasToolbar", () => {
  beforeEach(() => {
    mockStoreState = {
      cardOrder: [],
      arrangeCards: mockArrangeCards,
      layoutKey: "3",
      previewDebugTextBoxes: false,
      setPreviewDebugTextBoxes: mockSetPreviewDebugTextBoxes,
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("toggles preview text box guides from the toolbar button", () => {
    const { getByTitle, rerender } = render(<CanvasToolbar />);

    const button = getByTitle("Toggle preview text box guides");
    fireEvent.click(button);

    expect(mockSetPreviewDebugTextBoxes).toHaveBeenCalledWith(true);

    rerender(<CanvasToolbar />);
    fireEvent.click(getByTitle("Toggle preview text box guides"));

    expect(mockSetPreviewDebugTextBoxes).toHaveBeenCalledWith(false);
  });
});

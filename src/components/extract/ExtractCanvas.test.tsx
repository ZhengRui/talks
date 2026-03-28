import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Mock child components
vi.mock("./CanvasViewport", () => ({
  default: () => <div data-testid="canvas-viewport">viewport</div>,
}));

vi.mock("./CanvasToolbar", () => ({
  default: () => <div data-testid="canvas-toolbar" />,
}));

vi.mock("./InspectorPanel", () => ({
  default: ({
    onAnalyze,
  }: {
    onAnalyze: (id: string) => void;
    onRefine: (id: string) => void;
    onCancelRefine: (id: string) => void;
  }) => (
    <div data-testid="inspector-panel">
      <button onClick={() => onAnalyze("test-card")}>Analyze</button>
    </div>
  ),
}));

vi.mock("./YamlModal", () => ({
  default: () => <div data-testid="yaml-modal" />,
}));

vi.mock("./LogModal", () => ({
  default: () => <div data-testid="log-modal" />,
}));

// Mock the store
const mockStartAnalysis = vi.fn();
const mockAppendLog = vi.fn();
const mockCompleteAnalysis = vi.fn();
const mockFailAnalysis = vi.fn();
const mockTickElapsed = vi.fn();
const mockSetNormalizedImage = vi.fn();
const mockStartRefinement = vi.fn();
const mockUpdateRefinement = vi.fn();
const mockSetDiffObjectUrl = vi.fn();
const mockCompleteRefinement = vi.fn();
const mockFailRefinement = vi.fn();
const mockAbortRefinement = vi.fn();

let mockStoreState: Record<string, unknown> = {};

vi.mock("./store", () => {
  const hook = (selector?: (state: Record<string, unknown>) => unknown) => {
    return selector ? selector(mockStoreState) : mockStoreState;
  };
  hook.getState = () => mockStoreState;
  hook.store = () => ({ getState: () => mockStoreState });
  return { useExtractStore: hook };
});

import ExtractCanvas from "./ExtractCanvas";

beforeEach(() => {
  mockStoreState = {
    cards: new Map(),
    startAnalysis: mockStartAnalysis,
    appendLog: mockAppendLog,
    completeAnalysis: mockCompleteAnalysis,
    failAnalysis: mockFailAnalysis,
    tickElapsed: mockTickElapsed,
    setNormalizedImage: mockSetNormalizedImage,
    startRefinement: mockStartRefinement,
    updateRefinement: mockUpdateRefinement,
    setDiffObjectUrl: mockSetDiffObjectUrl,
    completeRefinement: mockCompleteRefinement,
    failRefinement: mockFailRefinement,
    abortRefinement: mockAbortRefinement,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExtractCanvas", () => {
  it("renders viewport and inspector panel", () => {
    const { getByTestId } = render(<ExtractCanvas />);

    expect(getByTestId("canvas-viewport")).toBeDefined();
    expect(getByTestId("inspector-panel")).toBeDefined();
  });

  it("renders log modal", () => {
    const { getByTestId } = render(<ExtractCanvas />);

    expect(getByTestId("log-modal")).toBeDefined();
  });

  it("has the correct root layout class", () => {
    const { container } = render(<ExtractCanvas />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
  });
});

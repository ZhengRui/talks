import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyzeForm from "./AnalyzeForm";
import type { SlideCard } from "./store";

const mockUpdateDescription = vi.fn();
const mockSetModel = vi.fn();
const mockSetEffort = vi.fn();
const mockSetCritique = vi.fn();

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: unknown) => unknown) => {
      const state = {
        updateDescription: mockUpdateDescription,
        model: "claude-opus-4-6",
        effort: "low",
        critique: true,
        setModel: mockSetModel,
        setEffort: mockSetEffort,
        setCritique: mockSetCritique,
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
    usedCritique: false,
    pass1: null,
    pass2: null,
    pass1Elapsed: 0,
    pass2Elapsed: 0,
    pass1Cost: null,
    pass2Cost: null,
    error: null,
    activeStage: "extract",
    selectedTemplateIndex: { extract: 0, critique: 0 },
    viewMode: "original",
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AnalyzeForm", () => {
  it("renders a compact critique toggle without helper text", () => {
    render(<AnalyzeForm card={makeCard()} onAnalyze={vi.fn()} />);

    expect(screen.getByLabelText("Critique")).toBeTruthy();
    expect(
      screen.queryByText("Run a second pass for higher fidelity"),
    ).toBeNull();
  });
});

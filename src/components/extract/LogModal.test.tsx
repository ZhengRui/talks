import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LogModal, { filterLogEntries } from "./LogModal";
import type { SlideCard, LogEntry } from "./store";

const mockCloseLogModal = vi.fn();

let mockStoreState: Record<string, unknown> = {};

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

vi.mock("./store", async () => {
  const actual = await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    useExtractStore: (selector?: (state: Record<string, unknown>) => unknown) =>
      selector ? selector(mockStoreState) : mockStoreState,
  };
});

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

function makeEntry(content: string, stage?: LogEntry["stage"]): LogEntry {
  return {
    type: "status",
    content,
    timestamp: Date.now(),
    stage,
  };
}

beforeEach(() => {
  mockStoreState = {
    logModal: { open: true, cardId: "card-1" },
    cards: new Map<string, SlideCard>(),
    closeLogModal: mockCloseLogModal,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LogModal", () => {
  it("shows all staged logs while analysis is running with live label", () => {
    const card = makeCard({
      status: "analyzing",
      activeStage: "extract",
      log: [
        makeEntry("Done (pass 1 / success)", "extract"),
        makeEntry("Pass 1 complete. Starting critique (pass 2)...", "critique"),
      ],
    });
    mockStoreState.cards = new Map([["card-1", card]]);

    render(<LogModal />);

    expect(screen.getByText("Done (pass 1 / success)")).toBeTruthy();
    expect(screen.getByText("Pass 1 complete. Starting critique (pass 2)...")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
  });

  it("opens to the card's active stage with stage tabs", () => {
    const card = makeCard({
      status: "analyzed",
      activeStage: "critique",
      log: [
        makeEntry("Done (pass 1 / success)", "extract"),
        makeEntry("Done (pass 2 / success)", "critique"),
      ],
    });
    mockStoreState.cards = new Map([["card-1", card]]);

    render(<LogModal />);

    // Opens to critique (the card's active stage) — only critique logs visible
    expect(screen.queryByText("Done (pass 1 / success)")).toBeNull();
    expect(screen.getByText("Done (pass 2 / success)")).toBeTruthy();
    // Stage tabs are present
    expect(screen.getByText("all")).toBeTruthy();
    expect(screen.getByText("extract")).toBeTruthy();
    expect(screen.getByText("critique")).toBeTruthy();
  });

  it("shows refine stage tab when refine logs exist", () => {
    const card = makeCard({
      status: "analyzed",
      activeStage: "refine",
      log: [
        makeEntry("Done (pass 1 / success)", "extract"),
        makeEntry("Iter 1 diff — 23% mismatch", "refine"),
      ],
      refineStatus: "done",
    });
    mockStoreState.cards = new Map([["card-1", card]]);

    render(<LogModal />);

    expect(screen.getByText("refine")).toBeTruthy();
    expect(screen.getByText("Iter 1 diff — 23% mismatch")).toBeTruthy();
  });
});

describe("filterLogEntries", () => {
  it("preserves legacy logs without stage tags", () => {
    const log = [
      makeEntry("legacy entry"),
      makeEntry("another legacy entry"),
    ];

    expect(filterLogEntries(log, "extract")).toEqual(log);
  });
});
